import { type NextRequest } from "next/server";
import { ethers } from "ethers";
import { db, ensureInit } from "@/lib/db";
import { isBlockchainConfigured } from "@/lib/blockchain";
import { getProvider } from "@/lib/blockchain/clients";
import { CHAIN_CONFIG } from "@/lib/blockchain/config";
import { getPoolAddress } from "@/lib/uniswap/pool";
import { getQuote } from "@/lib/uniswap/swap";

/**
 * GET /api/marketplace/:tokenId/quote?action=buy&amount=10
 *
 * Public endpoint -- get a price quote from the Uniswap V3 pool.
 * No auth required (public price info).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  try {
    await ensureInit();
    const { tokenId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const amountStr = searchParams.get("amount");

    if (!action || !["buy", "sell"].includes(action)) {
      return Response.json(
        { error: "Missing or invalid 'action' query param (buy or sell)" },
        { status: 400 },
      );
    }

    if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) {
      return Response.json(
        { error: "Missing or invalid 'amount' query param" },
        { status: 400 },
      );
    }

    const contract = await db.contracts.findById(tokenId);
    if (!contract) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }

    if (!contract.tokenAddress) {
      return Response.json(
        { error: "Contract has no token deployed" },
        { status: 400 },
      );
    }

    if (!isBlockchainConfigured()) {
      return Response.json(
        { error: "Blockchain not configured" },
        { status: 500 },
      );
    }

    const usdcAddress = CHAIN_CONFIG.paymentTokenAddress;
    if (!usdcAddress) {
      return Response.json(
        { error: "USDC address not configured" },
        { status: 500 },
      );
    }

    const provider = getProvider();
    const poolAddress = await getPoolAddress(
      contract.tokenAddress,
      usdcAddress,
      provider,
    );

    const poolExists = !!poolAddress && poolAddress !== ethers.ZeroAddress;

    if (!poolExists) {
      return Response.json({
        amountIn: amountStr,
        estimatedOut: "0",
        pricePerToken: 0,
        poolExists: false,
      });
    }

    const amount = Number(amountStr);

    let amountIn: bigint;
    let tokenIn: string;
    let tokenOut: string;
    let outDecimals: number;

    if (action === "buy") {
      // Spending USDC to buy tokens
      amountIn = ethers.parseUnits(amount.toString(), 6);
      tokenIn = usdcAddress;
      tokenOut = contract.tokenAddress;
      outDecimals = 18;
    } else {
      // Selling tokens for USDC
      amountIn = ethers.parseUnits(amount.toString(), 18);
      tokenIn = contract.tokenAddress;
      tokenOut = usdcAddress;
      outDecimals = 6;
    }

    const estimatedOut = await getQuote({
      tokenIn,
      tokenOut,
      amount: amountIn,
      provider,
    });

    const estimatedOutFormatted = ethers.formatUnits(estimatedOut, outDecimals);
    const pricePerToken =
      action === "buy"
        ? amount / Number(estimatedOutFormatted || 1)
        : Number(estimatedOutFormatted || 0) / amount;

    return Response.json({
      amountIn: amountStr,
      estimatedOut: estimatedOutFormatted,
      pricePerToken,
      poolExists: true,
    });
  } catch (error) {
    console.error("[marketplace/quote] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Quote failed" },
      { status: 500 },
    );
  }
}
