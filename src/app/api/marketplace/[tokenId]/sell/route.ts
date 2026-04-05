import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notify } from "@/lib/notifications";

const ClaimBodySchema = z.object({
  amount: z.number().positive(),
});

/**
 * POST /api/marketplace/:tokenId/sell
 *
 * Investor CLAIMS (redeems) tokens at face value ($1/token).
 * ONLY available when the contract is COMPLETED (all milestones approved).
 * Tokens are burned from the investor's holding record.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureInit();
    const { tokenId } = await params;
    const body = await request.json();
    const parsed = ClaimBodySchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const contract = await db.contracts.findById(tokenId);
    if (!contract) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }

    // Only allow claims when contract is completed
    if (contract.status !== "completed") {
      return Response.json(
        { error: "Tokens can only be redeemed when the contract is completed (all milestones approved)." },
        { status: 400 },
      );
    }

    const investorAddress = auth.user!.walletAddress!;
    const { amount } = parsed.data;

    // Check investor holds enough tokens
    const holdings = await db.holdings.findByInvestor(investorAddress);
    const holding = holdings.find((h) => h.contractId === tokenId);

    if (!holding || holding.amount < amount) {
      return Response.json(
        { error: `Insufficient token balance. You hold ${holding?.amount ?? 0} tokens.` },
        { status: 400 },
      );
    }

    // Redeem at face value ($1/token)
    const redeemPrice = 1.0;
    const totalReceived = amount * redeemPrice;

    // Reduce holding in DB
    await db.holdings.reduceHolding(investorAddress, tokenId, amount);

    console.log(`[claim] ${investorAddress.slice(0, 10)} redeemed ${amount} tokens of ${tokenId} at $${redeemPrice}/token ($${totalReceived} total)`);

    // Notify investor
    notify(investorAddress, {
      type: "token_sold",
      title: "Tokens redeemed",
      message: `You redeemed ${amount} tokens of "${contract.title}" at $${redeemPrice.toFixed(2)}/token. Total: $${totalReceived.toFixed(2)}.`,
      contractTitle: contract.title,
      contractId: tokenId,
      tokenAmount: amount,
      amount: totalReceived,
    });

    return Response.json({
      success: true,
      amount,
      redeemPrice,
      totalReceived,
      contractCompleted: true,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
