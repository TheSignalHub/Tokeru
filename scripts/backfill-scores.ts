/**
 * Backfill agency scores from existing contract and dispute data.
 *
 * Reads all contracts and disputes from the DB, computes scores for each
 * agency address, and updates the agency profile in DB.
 *
 * Run: npx tsx scripts/backfill-scores.ts
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import { computeAgencyScore } from "../src/lib/scoring";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required. Set it in .env or .env.local");
    process.exit(1);
  }

  const db = drizzle(process.env.DATABASE_URL, { schema });

  console.log("Loading contracts...");
  const allContracts = await db.select().from(schema.contracts);
  console.log(`  Found ${allContracts.length} contracts`);

  console.log("Loading disputes...");
  const allDisputes = await db.select().from(schema.disputes);
  console.log(`  Found ${allDisputes.length} disputes`);

  // Collect unique agency addresses
  const agencyAddresses = [...new Set(allContracts.map((c) => c.agency))];
  console.log(`\nFound ${agencyAddresses.length} unique agency addresses\n`);

  for (const address of agencyAddresses) {
    const agencyContracts = allContracts.filter(
      (c) => c.agency.toLowerCase() === address.toLowerCase(),
    );

    const contractsCompleted = agencyContracts.filter(
      (c) => c.status === "completed",
    ).length;

    const contractsFailed = agencyContracts.filter(
      (c) => c.status === "failed",
    ).length;

    const totalVolume = agencyContracts
      .filter((c) => c.status === "completed")
      .reduce((sum, c) => sum + c.totalValue, 0);

    // Disputes: find disputes on contracts where this agency is involved
    const contractIds = new Set(agencyContracts.map((c) => c.id));
    const agencyDisputes = allDisputes.filter((d) =>
      contractIds.has(d.contractId),
    );

    // disputesWon: ruling === 2 means agency wins (Kleros convention: 2 = respondent/agency)
    // disputesLost: ruling === 1 means client wins
    // For our simple model: if the dispute was initiated by the client and ruling favors agency = won
    // We use a simpler heuristic: resolved disputes where agency was NOT the loser
    let disputesWon = 0;
    let disputesLost = 0;

    for (const d of agencyDisputes) {
      if (d.resolvedAt) {
        if (d.ruling === 2) {
          // agency won
          disputesWon++;
        } else if (d.ruling === 1) {
          // agency lost
          disputesLost++;
        }
        // ruling === 0 or null = unresolved / no ruling
      }
    }

    const score = computeAgencyScore({
      contractsCompleted,
      contractsFailed,
      disputesWon,
      disputesLost,
      avgAiScore: 50, // default — no AI score available for backfill
    });

    console.log(
      `${address}: completed=${contractsCompleted} failed=${contractsFailed} ` +
        `volume=${totalVolume} dWon=${disputesWon} dLost=${disputesLost} → score=${score}`,
    );

    // Upsert agency profile in DB
    const profileRows = await db
      .select()
      .from(schema.agencyProfiles)
      .where(eq(schema.agencyProfiles.address, address));
    const existing = profileRows[0] ?? null;

    const values = {
      score,
      contractsCompleted,
      contractsFailed,
      disputesWon,
      disputesLost,
      totalVolume,
    };

    if (existing) {
      await db
        .update(schema.agencyProfiles)
        .set(values)
        .where(eq(schema.agencyProfiles.address, address));
    } else {
      // Ensure user row exists first
      const userRows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.address, address));
      if (userRows.length === 0) {
        console.log(`  SKIP — no user row for ${address}`);
        continue;
      }

      await db.insert(schema.agencyProfiles).values({
        address,
        ...values,
        avgAiScore: 0,
        verified: false,
        attestations: "[]",
        categories: "[]",
      });
    }

    console.log(`  ✓ Updated DB profile`);
  }

  console.log("\nBackfill complete.");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
