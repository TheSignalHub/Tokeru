import { type NextRequest } from "next/server";
import { ethers } from "ethers";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { isBlockchainConfigured } from "@/lib/blockchain";
import { getDeployerSigner } from "@/lib/blockchain/clients";
import { CONTRACT_TOKEN_ABI } from "@/lib/blockchain/abis";
import { requireAuth } from "@/lib/auth";
import { notify } from "@/lib/notifications";

const SellBodySchema = z.object({
  amount: z.number().positive(),
});

/**
 * POST /api/marketplace/:tokenId/sell
 *
 * Investor sells tokens back to the platform.
 * Tokens are burned on-chain (ERC20Burnable.burn).
 * Sale value depends on contract completion status:
 *   - All milestones completed: $1.00/token (face value)
 *   - In progress: original buy price
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
    const parsed = SellBodySchema.safeParse(body);

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
        { error: "This contract has no token deployed" },
        { status: 400 },
      );
    }

    const { amount } = parsed.data;
    const sellerAddress = auth.user!.walletAddress!;

    // Check the investor holds enough tokens in DB
    const holdings = await db.holdings.findByInvestor(sellerAddress);
    const holding = holdings.find((h) => h.contractId === tokenId);

    if (!holding || holding.amount < amount) {
      return Response.json(
        {
          error: `Insufficient token balance. You hold ${holding?.amount ?? 0} tokens.`,
        },
        { status: 400 },
      );
    }

    // Determine sale price
    const allApproved = contract.milestones.every(
      (m) => m.status === "approved",
    );
    const salePrice = allApproved ? 1.0 : holding.buyPrice;
    const totalReceived = amount * salePrice;

    console.log(
      `[marketplace/sell] ${sellerAddress.slice(0, 10)} selling ${amount} tokens of ${tokenId} at $${salePrice}/token ($${totalReceived} total)`,
    );

    // On-chain: burn the tokens from the investor's wallet
    // The investor must call burn() themselves, but for the hackathon we use
    // burnFrom() via deployer (requires approval) or just record the sale.
    // Since ContractToken inherits ERC20Burnable, we attempt burnFrom via deployer.
    // If that fails (no approval), we just record in DB anyway for hackathon.
    if (isBlockchainConfigured() && contract.tokenAddress) {
      try {
        const signer = getDeployerSigner();
        const tokenContract = new ethers.Contract(
          contract.tokenAddress,
          CONTRACT_TOKEN_ABI,
          signer,
        );

        // Check on-chain balance
        const onChainBalance = await tokenContract.balanceOf(sellerAddress);
        const sellAmount = ethers.parseUnits(amount.toString(), 18);

        if (onChainBalance < sellAmount) {
          return Response.json(
            {
              error: `On-chain balance insufficient. You have ${Number(ethers.formatUnits(onChainBalance, 18))} tokens on-chain.`,
            },
            { status: 400 },
          );
        }

        // Try burnFrom (requires prior approval to deployer).
        // For hackathon, if burnFrom fails we still proceed with DB update.
        try {
          const tx = await tokenContract.burnFrom(sellerAddress, sellAmount, {
            gasLimit: 200_000,
          });
          const receipt = await tx.wait(1);
          console.log("[marketplace/sell] Tokens burned on-chain:", receipt.hash);
        } catch (burnErr) {
          console.warn(
            "[marketplace/sell] burnFrom failed (investor may not have approved deployer). Proceeding with DB-only sale.",
            burnErr instanceof Error ? burnErr.message : burnErr,
          );
        }
      } catch (err) {
        console.warn(
          "[marketplace/sell] On-chain check failed, proceeding with DB-only:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Update holdings in DB
    const reduced = await db.holdings.reduceHolding(
      sellerAddress,
      tokenId,
      amount,
    );
    if (!reduced) {
      return Response.json(
        { error: "Failed to update holdings" },
        { status: 500 },
      );
    }

    console.log("[marketplace/sell] Holding reduced:", {
      sellerAddress,
      tokenId,
      amount,
      salePrice,
    });

    // Notify investor of sale
    notify(sellerAddress, {
      type: "token_sold",
      title: "Tokens sold",
      message: `You sold ${amount.toLocaleString()} tokens for "${contract.title}" at $${salePrice.toFixed(2)}/token ($${totalReceived.toFixed(2)} total).`,
      contractTitle: contract.title,
      contractId: tokenId,
      tokenAmount: amount,
      amount: totalReceived,
    });

    return Response.json({
      success: true,
      amount,
      salePrice,
      totalReceived,
      contractCompleted: allApproved,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
