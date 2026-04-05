import { type NextRequest } from "next/server";
import { ethers } from "ethers";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { isBlockchainConfigured } from "@/lib/blockchain";
import { getDeployerSigner, getProvider } from "@/lib/blockchain/clients";
import { CHAIN_CONFIG } from "@/lib/blockchain/config";
import { requireAuth } from "@/lib/auth";
import { getPoolAddress } from "@/lib/uniswap/pool";
import { buyTokens, sellTokens, getQuote } from "@/lib/uniswap/swap";

const TradeBodySchema = z.object({
  action: z.enum(["buy", "sell"]),
  amount: z.number().positive(),
});

/**
 * POST /api/marketplace/:tokenId/trade
 *
 * Execute a swap on the Uniswap V3 secondary market.
 * - buy: swap USDC -> ContractToken
 * - sell: swap ContractToken -> USDC
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
    const parsed = TradeBodySchema.safeParse(body);

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

    // Check that a Uniswap pool exists
    const provider = getProvider();
    const poolAddress = await getPoolAddress(
      contract.tokenAddress,
      usdcAddress,
      provider,
    );

    if (!poolAddress || poolAddress === ethers.ZeroAddress) {
      return Response.json(
        { error: "No secondary market available. Trade on primary market." },
        { status: 400 },
      );
    }

    const { action, amount } = parsed.data;
    const signer = getDeployerSigner();
    const investorAddress = auth.user!.walletAddress;

    let txHash: string;
    let amountIn: string;
    let estimatedOut: string;

    if (action === "buy") {
      // amount = number of USDC to spend
      const usdcAmount = ethers.parseUnits(amount.toString(), 6);

      // Get quote for display
      const quoteOut = await getQuote({
        tokenIn: usdcAddress,
        tokenOut: contract.tokenAddress,
        amount: usdcAmount,
        provider,
      });

      txHash = await buyTokens({
        tokenAddress: contract.tokenAddress,
        usdcAddress,
        usdcAmount,
        signer,
        recipient: investorAddress,
      });

      amountIn = amount.toString();
      estimatedOut = ethers.formatUnits(quoteOut, 18);
    } else {
      // amount = number of tokens to sell
      const tokenAmount = ethers.parseUnits(amount.toString(), 18);

      // Get quote for display
      const quoteOut = await getQuote({
        tokenIn: contract.tokenAddress,
        tokenOut: usdcAddress,
        amount: tokenAmount,
        provider,
      });

      txHash = await sellTokens({
        tokenAddress: contract.tokenAddress,
        usdcAddress,
        tokenAmount,
        signer,
        recipient: investorAddress,
      });

      amountIn = amount.toString();
      estimatedOut = ethers.formatUnits(quoteOut, 6);
    }

    return Response.json({
      success: true,
      txHash,
      amountIn,
      amountOut: estimatedOut,
      action,
    });
  } catch (error) {
    console.error("[marketplace/trade] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Trade failed" },
      { status: 500 },
    );
  }
}
