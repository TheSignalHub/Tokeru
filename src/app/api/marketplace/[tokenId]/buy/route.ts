import { type NextRequest } from "next/server";
import { ethers } from "ethers";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { isBlockchainConfigured } from "@/lib/blockchain";
import { getDeployerSigner } from "@/lib/blockchain/clients";
import { SERVICE_CONTRACT_ABI } from "@/lib/blockchain/abis";
import { requireAuth } from "@/lib/auth";
import { notify } from "@/lib/notifications";

const BuyBodySchema = z.object({
  amount: z.number().positive(),
});

/**
 * POST /api/marketplace/:tokenId/buy
 *
 * Investor buys tokens for a tokenized contract.
 * Tokens are minted on demand via ServiceContract.mintTokens().
 * Payment is recorded in DB (USDC transfer handled by operator or client-side).
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
    const parsed = BuyBodySchema.safeParse(body);

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

    if (!contract.tokenizationExposure) {
      return Response.json({ error: "This contract is not tokenized" }, { status: 400 });
    }

    if (!contract.tokenAddress || !contract.onChainAddress) {
      return Response.json(
        { error: "Contract not yet deployed on-chain. The agency needs to re-tokenize this contract to trigger deployment." },
        { status: 400 },
      );
    }

    // Parse tokenization settings (1 token = $1 face value by default)
    let totalSupply = contract.totalValue;
    let pricePerToken = 1;
    try {
      const exposure = JSON.parse(contract.tokenizationExposure);
      totalSupply = exposure.totalSupply ?? contract.totalValue;
      pricePerToken = exposure.pricePerToken ?? 1;
    } catch {
      // use defaults
    }

    const { amount } = parsed.data;
    const buyerAddress = auth.user!.walletAddress!;

    // Check remaining supply: maxSupply - currentSupply
    if (isBlockchainConfigured()) {
      try {
        const provider = getDeployerSigner().provider!;
        const tokenContract = new ethers.Contract(
          contract.tokenAddress,
          [
            "function totalSupply() view returns (uint256)",
            "function maxSupply() view returns (uint256)",
          ],
          provider,
        );
        const [currentSupply, maxSupply] = await Promise.all([
          tokenContract.totalSupply(),
          tokenContract.maxSupply(),
        ]);
        const remaining = maxSupply - currentSupply;
        const requestedAmount = ethers.parseUnits(amount.toString(), 18);

        if (requestedAmount > remaining) {
          const remainingFormatted = Number(ethers.formatUnits(remaining, 18));
          return Response.json(
            { error: `Only ${remainingFormatted} tokens remaining. Requested ${amount}.` },
            { status: 400 },
          );
        }
      } catch (err) {
        console.warn("[marketplace/buy] Could not check remaining supply:", err);
      }
    }

    const totalCost = amount * pricePerToken;

    console.log(
      `[marketplace/buy] ${buyerAddress.slice(0, 10)} buying ${amount} tokens of ${tokenId} at $${pricePerToken}/token ($${totalCost} total)`,
    );

    let txHash: string | undefined;

    // Mint tokens to the investor on-chain
    if (isBlockchainConfigured()) {
      try {
        const signer = getDeployerSigner();
        const sc = new ethers.Contract(contract.onChainAddress, SERVICE_CONTRACT_ABI, signer);
        const mintAmount = ethers.parseUnits(amount.toString(), 18);

        const tx = await sc.mintTokens(buyerAddress, mintAmount, { gasLimit: 300_000 });
        const receipt = await tx.wait(1);
        txHash = receipt.hash;
        console.log("[marketplace/buy] Tokens minted to investor:", txHash);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Minting failed";
        console.error("[marketplace/buy] Mint FAILED:", msg);
        return Response.json(
          { error: `Token purchase failed: ${msg}` },
          { status: 500 },
        );
      }
    }

    await db.holdings.addToHolding(buyerAddress, tokenId, amount, pricePerToken, contract.tokenAddress ?? "");
    console.log("[marketplace/buy] Holding recorded:", { buyerAddress, tokenId, amount, pricePerToken });

    // Notify agency
    const investorLabel = `${buyerAddress.slice(0, 6)}...${buyerAddress.slice(-4)}`;
    if (contract.agency) {
      notify(contract.agency, {
        type: "investment_received",
        title: "Investment received",
        message: `${investorLabel} purchased ${amount.toLocaleString()} tokens ($${totalCost.toLocaleString()}) for "${contract.title}".`,
        contractTitle: contract.title,
        contractId: tokenId,
        tokenAmount: amount,
        amount: totalCost,
        investorName: investorLabel,
      });
    }

    // Notify investor (buyer) — purchase confirmation
    notify(buyerAddress, {
      type: "investment_received",
      title: "Purchase confirmed",
      message: `Purchase confirmed: ${amount.toLocaleString()} tokens of ${contract.title} at $${pricePerToken}/token.`,
      contractTitle: contract.title,
      contractId: tokenId,
      tokenAmount: amount,
      amount: totalCost,
    });

    return Response.json({
      success: true,
      amount,
      pricePerToken,
      totalCost,
      tokenId,
      buyerAddress,
      ...(txHash && { txHash }),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
