import { getDb } from "./client";
import { investorHoldings } from "./schema";
import { eq, and, sql } from "drizzle-orm";

/** Ensure the investor_holdings table exists (fallback if migration missed it) */
async function ensureTable(): Promise<void> {
  try {
    const db = getDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS investor_holdings (
        id SERIAL PRIMARY KEY,
        investor_address TEXT NOT NULL,
        token_address TEXT NOT NULL,
        contract_id TEXT NOT NULL,
        amount REAL NOT NULL,
        buy_price REAL NOT NULL,
        current_price REAL NOT NULL,
        purchased_at TEXT
      )
    `);
  } catch {
    // Table likely already exists
  }
}

let tableChecked = false;

export interface Holding {
  id: number;
  investorAddress: string;
  contractId: string;
  tokenAddress: string;
  amount: number;
  buyPrice: number;
  currentPrice: number;
  purchasedAt: string | null;
}

async function checkTable() {
  if (!tableChecked) {
    await ensureTable();
    tableChecked = true;
  }
}

export async function createHolding(data: {
  investorAddress: string;
  contractId: string;
  tokenAddress: string;
  amount: number;
  buyPrice: number;
}): Promise<void> {
  await checkTable();
  const db = getDb();
  await db.insert(investorHoldings).values({
    investorAddress: data.investorAddress.toLowerCase(),
    contractId: data.contractId,
    tokenAddress: data.tokenAddress,
    amount: data.amount,
    buyPrice: data.buyPrice,
    currentPrice: data.buyPrice,
    purchasedAt: new Date().toISOString(),
  });
}

export async function findByInvestor(address: string): Promise<Holding[]> {
  await checkTable();
  const db = getDb();
  const result = await db
    .select()
    .from(investorHoldings)
    .where(eq(investorHoldings.investorAddress, address.toLowerCase()))
    .orderBy(sql`purchased_at DESC`);
  return result as Holding[];
}

export async function addToHolding(
  investorAddress: string,
  contractId: string,
  amount: number,
  buyPrice: number,
  tokenAddress: string = "",
): Promise<void> {
  await checkTable();
  const db = getDb();
  const existing = await db
    .select()
    .from(investorHoldings)
    .where(
      and(
        eq(investorHoldings.investorAddress, investorAddress.toLowerCase()),
        eq(investorHoldings.contractId, contractId),
      ),
    );

  if (existing.length > 0) {
    const old = existing[0];
    const newAmount = old.amount + amount;
    await db
      .update(investorHoldings)
      .set({ amount: newAmount, buyPrice })
      .where(eq(investorHoldings.id, old.id));
  } else {
    await createHolding({
      investorAddress,
      contractId,
      tokenAddress,
      amount,
      buyPrice,
    });
  }
}

/**
 * Reduce an investor's holding by the given amount.
 * If the resulting amount is 0 or less, the holding row is deleted.
 * Returns true if the reduction was applied, false if insufficient balance.
 */
export async function reduceHolding(
  investorAddress: string,
  contractId: string,
  amount: number,
): Promise<boolean> {
  const db = getDb();
  const existing = await db
    .select()
    .from(investorHoldings)
    .where(
      and(
        eq(investorHoldings.investorAddress, investorAddress.toLowerCase()),
        eq(investorHoldings.contractId, contractId),
      ),
    );

  if (existing.length === 0) return false;

  const old = existing[0];
  if (old.amount < amount) return false;

  const newAmount = old.amount - amount;
  if (newAmount <= 0) {
    await db
      .delete(investorHoldings)
      .where(eq(investorHoldings.id, old.id));
  } else {
    await db
      .update(investorHoldings)
      .set({ amount: newAmount })
      .where(eq(investorHoldings.id, old.id));
  }
  return true;
}

/**
 * Find all holdings for a given contract (all investors).
 */
export async function findByContract(contractId: string): Promise<Holding[]> {
  const db = getDb();
  const result = await db
    .select()
    .from(investorHoldings)
    .where(eq(investorHoldings.contractId, contractId));
  return result as Holding[];
}
