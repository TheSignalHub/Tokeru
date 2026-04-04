import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { calculateMilestoneRelease } from "@/lib/payments/escrow";
import { approveMilestone, isBlockchainConfigured } from "@/lib/blockchain";
import { getTokenDecimals } from "@/lib/blockchain/utils";
import { getProvider } from "@/lib/blockchain/clients";
import { notify } from "@/lib/notifications";
import { privateTransfer, isUnlinkConfigured } from "@/lib/privacy";
import { computeAgencyScore } from "@/lib/scoring";
import { agencyProfile as agencyProfileChain } from "@/lib/blockchain";

// USDC on Base Sepolia
const PAYMENT_TOKEN = process.env.PAYMENT_TOKEN_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const ApproveSchema = z.object({
  milestoneId: z.number().int().positive(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;

    // Auth: only the client can approve milestones
    const auth = await requireRole(request, id, "client");
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const parsed = ApproveSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const contract = await db.contracts.findById(id);
    if (!contract) {
      return Response.json({ error: "Contract not found" }, { status: 404 });
    }

    const milestone = contract.milestones.find(
      (m) => m.id === parsed.data.milestoneId,
    );
    if (!milestone) {
      return Response.json({ error: "Milestone not found" }, { status: 404 });
    }

    if (milestone.status !== "delivered") {
      return Response.json(
        { error: "Milestone must be in 'delivered' status to approve" },
        { status: 400 },
      );
    }

    // Block approval if milestone has an active (unresolved) dispute
    const activeDisputes = (await db.disputes
      .findByContract(id))
      .filter(
        (d) =>
          d.milestoneId === parsed.data.milestoneId &&
          d.phase !== "resolved",
      );
    if (activeDisputes.length > 0) {
      return Response.json(
        {
          error:
            "Cannot approve milestone with an active dispute. The dispute must be resolved first.",
        },
        { status: 400 },
      );
    }

    const feeBreakdown = calculateMilestoneRelease(
      milestone.amount,
      contract.bdFeePercent,
    );

    // Chain-first: if on-chain, approval must succeed on-chain before DB update
    if (isBlockchainConfigured() && contract.onChainAddress) {
      try {
        const txHash = await approveMilestone(contract.onChainAddress, parsed.data.milestoneId);
        console.log("[approve] On-chain success:", txHash);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "On-chain approval failed";
        console.error("[approve] On-chain FAILED:", msg);
        return Response.json(
          { error: `On-chain approval failed: ${msg}` },
          { status: 500 },
        );
      }
    }

    // Atomic conditional update — only approve if milestone is still "delivered"
    const updatedContract = await db.contracts.conditionalUpdateMilestone(
      id,
      parsed.data.milestoneId,
      "delivered",
      {
        status: "approved",
        approvedAt: new Date(),
      },
    );

    if (!updatedContract) {
      return Response.json(
        { error: "Milestone status changed — it is no longer in 'delivered' state. Please refresh and try again." },
        { status: 409 },
      );
    }

    const escrow = await db.escrows.release(id, milestone.amount);

    // Attempt private milestone payout via Unlink shielded pool (server-side ZKP)
    if (isUnlinkConfigured()) {
      try {
        // Get the client's mnemonic (escrow holder) and agency's mnemonic (recipient)
        const clientRaw = await db.users.findRawByAddress(auth.walletAddress);
        const agencyRaw = await db.users.findRawByAddress(contract.agency);
        if (clientRaw?.unlinkMnemonic && agencyRaw?.unlinkMnemonic) {
          const { createUnlinkClient } = await import("@/lib/privacy");
          const agencyUnlink = createUnlinkClient(agencyRaw.unlinkMnemonic);
          const agencyUnlinkAddress = await agencyUnlink.getAddress();
          const toAgencyAmount = feeBreakdown.toAgency;
          const decimals = await getTokenDecimals(PAYMENT_TOKEN, getProvider());
          const payoutAmountWei = BigInt(Math.round(toAgencyAmount * 10 ** decimals));
          await privateTransfer(
            clientRaw.unlinkMnemonic,
            agencyUnlinkAddress,
            PAYMENT_TOKEN,
            payoutAmountWei.toString(),
          );
        }
      } catch (unlinkError) {
        console.error("[Unlink] privateTransfer failed:", unlinkError);
        return Response.json(
          { error: `Private transfer failed: ${unlinkError instanceof Error ? unlinkError.message : "Unknown error"}` },
          { status: 500 },
        );
      }
    }

    const allApproved = updatedContract.milestones.every(
      (m) => m.status === "approved",
    );
    if (allApproved) {
      await db.contracts.update(id, { status: "completed" });

      // Update agency score on contract completion
      try {
        const agencyUser = await db.users.findByAddress(contract.agency);
        const profile = agencyUser?.agencyProfile;
        const updatedCompleted = (profile?.contractsCompleted ?? 0) + 1;
        const updatedVolume = (profile?.totalVolume ?? 0) + contract.totalValue;
        const newScore = computeAgencyScore({
          contractsCompleted: updatedCompleted,
          contractsFailed: profile?.contractsFailed ?? 0,
          disputesWon: profile?.disputesWon ?? 0,
          disputesLost: profile?.disputesLost ?? 0,
          avgAiScore: 0,
        });
        await db.users.updateAgencyScore(contract.agency, {
          contractsCompleted: updatedCompleted,
          totalVolume: updatedVolume,
          score: newScore,
        });
        // Best-effort on-chain update
        agencyProfileChain.recordCompletion(contract.agency, contract.totalValue, newScore);
      } catch (scoreErr) {
        console.error("[approve] Agency score update failed:", scoreErr);
      }
    }

    // Notify agency that milestone was approved
    if (contract.agency) {
      notify(contract.agency, {
        type: "milestone_approved",
        title: "Milestone approved",
        message: `Milestone "${milestone.name}" on "${contract.title}" has been approved.`,
        contractTitle: contract.title,
        contractId: id,
        milestoneName: milestone.name,
      });
    }

    // Notify both parties when contract is fully completed
    if (allApproved) {
      const completedNotif = {
        type: "contract_completed" as const,
        title: "Contract completed",
        message: `All milestones on "${contract.title}" have been approved. The contract is complete.`,
        contractTitle: contract.title,
        contractId: id,
      };
      if (contract.agency) notify(contract.agency, completedNotif);
      if (contract.client) notify(contract.client, completedNotif);
    }

    return Response.json({
      contract: allApproved
        ? await db.contracts.findById(id)
        : updatedContract,
      escrow,
      feeBreakdown,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
