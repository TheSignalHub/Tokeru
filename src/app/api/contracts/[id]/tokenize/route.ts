import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { TokenizationExposure } from "@/lib/types/contract";
import { DEFAULT_EXPOSURE } from "@/lib/types/contract";

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

    const exposureSettings: TokenizationExposure = {
      ...DEFAULT_EXPOSURE,
      ...exposure,
      // Store pricing info for the buy route
      tokenName,
      tokenSymbol,
      totalSupply,
      pricePerToken,
    };

    const updated = await db.contracts.update(id, {
      tokenizationExposure: JSON.stringify(exposureSettings),
    });

    console.log(`[tokenize] Contract ${id} marked as investable: ${totalSupply} tokens at $${pricePerToken}/token`);

    return Response.json({
      success: true,
      contract: updated,
      tokenAddress: contract.tokenAddress,
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
