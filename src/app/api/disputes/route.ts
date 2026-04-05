import { type NextRequest } from "next/server";
import { db, ensureInit } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/disputes
 * Returns all disputes the authenticated user is involved in,
 * enriched with contract title and milestone name.
 */
export async function GET(request: NextRequest) {
  try {
    await ensureInit();

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const walletAddress = auth.user!.walletAddress;
    if (!walletAddress) {
      return Response.json({ disputes: [] });
    }

    const disputes = await db.disputes.findByUser(walletAddress);

    // Enrich with contract title and milestone name
    const enriched = await Promise.all(
      disputes.map(async (d) => {
        const contract = await db.contracts.findById(d.contractId);
        const milestone = contract?.milestones.find((m) => m.id === d.milestoneId);
        return {
          ...d,
          contractTitle: contract?.title ?? "Unknown Contract",
          milestoneName: milestone?.name ?? `Milestone #${d.milestoneId}`,
        };
      }),
    );

    return Response.json({ disputes: enriched });
  } catch (error) {
    console.error("[disputes/GET] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
