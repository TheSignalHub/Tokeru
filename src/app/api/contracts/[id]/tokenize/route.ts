import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isFactoryConfigured, createDeal } from "@/lib/blockchain";
import type { TokenizationExposure } from "@/lib/types/contract";
import { DEFAULT_EXPOSURE } from "@/lib/types/contract";
import { notify } from "@/lib/notifications";

const TokenizeBodySchema = z.object({
  tokenName: z.string().min(1).max(64),
  tokenSymbol: z.string().min(1).max(12),
  totalSupply: z.number().positive(),
  pricePerToken: z.number().positive(),
  exposure: z
    .object({
      showDescription: z.boolean().optional(),
      showMilestones: z.boolean().optional(),
      showDisputeHistory: z.boolean().optional(),
    })
    .optional(),
});

/**
 * POST /api/contracts/:id/tokenize
 *
 * Agency-only. Marks a contract as investable by setting price, supply, and
 * exposure settings. No on-chain minting — tokens are minted on demand when
 * investors buy (see /api/marketplace/[tokenId]/buy).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    await ensureInit();
    const { id } = await params;
    const contract = await db.contracts.findById(id);

    if (!contract) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.agency.toLowerCase() !== auth.user!.walletAddress?.toLowerCase()) {
      return Response.json({ error: "Only the agency can tokenize this contract" }, { status: 403 });
    }

    if (contract.status !== "active") {
      return Response.json(
        { error: "Contract must be active (escrow deposited) before tokenization" },
        { status: 400 },
      );
    }

    if (contract.tokenizationExposure) {
      return Response.json({ error: "Contract is already tokenized" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = TokenizeBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { tokenName, tokenSymbol, totalSupply, pricePerToken, exposure } = parsed.data;

    // Deploy on-chain if not yet deployed (handles contracts created before factory was ready)
    let tokenAddress = contract.tokenAddress;
    let onChainAddress = contract.onChainAddress;

    if (!onChainAddress && isFactoryConfigured() && contract.client && contract.agency) {
      try {
        console.log(`[tokenize] Contract not on-chain yet — deploying via factory...`);
        const result = await createDeal({
          client: contract.client,
          agency: contract.agency,
          bd: contract.bd,
          bdFeeBps: Math.round((contract.bdFeePercent ?? 0) * 100),
          termsHash: contract.termsHash || `terms_${contract.id}`,
          milestones: contract.milestones.map((m) => ({
            name: m.name,
            amount: BigInt(Math.round(m.amount * 1e18)),
            deadline: m.deadline ? Math.floor(new Date(m.deadline).getTime() / 1000) : 0,
          })),
          tokenName,
          tokenSymbol,
        });

        onChainAddress = result.serviceContractAddress;
        tokenAddress = result.tokenAddress;

        await db.contracts.update(id, {
          onChainAddress,
          tokenAddress,
        });
        console.log(`[tokenize] Deployed on-chain: ${onChainAddress}, token: ${tokenAddress}`);
      } catch (chainErr) {
        const msg = chainErr instanceof Error ? chainErr.message : String(chainErr);
        console.error("[tokenize] Factory deploy failed:", msg);
        return Response.json(
          { error: `On-chain deployment failed: ${msg}` },
          { status: 500 },
        );
      }
    }

    const exposureSettings: TokenizationExposure = {
      ...DEFAULT_EXPOSURE,
      ...exposure,
      tokenName,
      tokenSymbol,
      totalSupply,
      pricePerToken,
    };

    const updated = await db.contracts.update(id, {
      tokenizationExposure: JSON.stringify(exposureSettings),
    });

    console.log(`[tokenize] Contract ${id} marked as investable: ${totalSupply} tokens at $${pricePerToken}/token`);

    // Notify agency (confirmation)
    if (contract.agency) {
      notify(contract.agency, {
        type: "investment_received",
        title: "Contract tokenized",
        message: `Contract tokenized: ${contract.title}. ${totalSupply} tokens at $${pricePerToken}/token. Investors can now purchase.`,
        contractTitle: contract.title,
        contractId: id,
        tokenAmount: totalSupply,
        amount: pricePerToken,
      });
    }

    return Response.json({
      success: true,
      contract: updated,
      tokenAddress: tokenAddress ?? null,
      onChainAddress: onChainAddress ?? null,
      totalSupply,
      pricePerToken,
    });
  } catch (error) {
    console.error("[tokenize] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
