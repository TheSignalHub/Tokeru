import { type NextRequest } from "next/server";
import { db, ensureInit } from "@/lib/db";
import type { TokenizationExposure } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    await ensureInit();
    const { address } = await params;

    const holdings = await db.holdings.findByInvestor(address);

    // Enrich each holding with contract data
    const enriched = await Promise.all(
      holdings.map(async (h) => {
        const contract = await db.contracts.findById(h.contractId);

        let exposure: TokenizationExposure | null = null;
        try {
          if (contract?.tokenizationExposure) {
            exposure = JSON.parse(contract.tokenizationExposure) as TokenizationExposure;
          }
        } catch {
          // invalid JSON
        }

        const currentPrice = exposure?.pricePerToken ?? h.currentPrice;
        const value = h.amount * currentPrice;
        const cost = h.amount * h.buyPrice;
        const pnl = value - cost;
        const pnlPct = cost > 0 ? ((pnl / cost) * 100) : 0;
        // Yield: face value is $1.00, so yield = (1/buyPrice - 1) * 100
        const yieldPct = h.buyPrice > 0 ? ((1 / h.buyPrice - 1) * 100) : 0;

        return {
          contractId: h.contractId,
          tokenAddress: h.tokenAddress,
          contractTitle: contract?.title ?? "Unknown Contract",
          tokenName: exposure?.tokenName ?? contract?.title ?? "Unknown",
          status: contract?.status ?? "unknown",
          amount: h.amount,
          buyPrice: h.buyPrice,
          currentPrice,
          pnl,
          pnlPct: Math.round(pnlPct * 10) / 10,
          yieldPct: Math.round(yieldPct * 10) / 10,
          purchasedAt: h.purchasedAt,
        };
      }),
    );

    return Response.json(enriched);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
