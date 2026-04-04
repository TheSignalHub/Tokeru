import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { isBlockchainConfigured, refundMilestone, agencyProfile as agencyProfileChain } from "@/lib/blockchain";
import { notifyUser } from "@/lib/email";
import { computeAgencyScore } from "@/lib/scoring";
import { uploadFile } from "@/lib/storage";

// --- Zod schemas for each action ---

const CreateActionSchema = z.object({
  action: z.literal("create"),
  milestoneId: z.number().int().positive(),
  argument: z.string().min(1),
});

const PayFeeActionSchema = z.object({
  action: z.literal("pay_fee"),
  disputeId: z.string().min(1),
});

const CheckDeadlineActionSchema = z.object({
  action: z.literal("check_deadline"),
  disputeId: z.string().min(1),
});

const SubmitEvidenceActionSchema = z.object({
  action: z.literal("submit_evidence"),
  disputeId: z.string().min(1),
  evidenceUri: z.string().min(1),
  description: z.string().min(1),
});

const DisputeActionSchema = z.discriminatedUnion("action", [
  CreateActionSchema,
  PayFeeActionSchema,
  CheckDeadlineActionSchema,
  SubmitEvidenceActionSchema,
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;

    // Auth: either party can participate in disputes
    const auth = await requireRole(request, id, "party");
    if ("error" in auth) return auth.error;
    const { walletAddress } = auth;

    const body = await request.json();
    const parsed = DisputeActionSchema.safeParse(body);

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

    const data = parsed.data;

    // Determine the caller's role on this contract (case-insensitive)
    const callerRole: "client" | "agency" =
      walletAddress?.toLowerCase() === contract.client?.toLowerCase() ? "client" : "agency";

    switch (data.action) {
      case "create":
        return handleCreate(id, contract, data, callerRole);
      case "pay_fee":
        return handlePayFee(id, data, callerRole);
      case "check_deadline":
        return handleCheckDeadline(id, data);
      case "submit_evidence":
        return handleSubmitEvidence(data, callerRole);
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}

// --- Action handlers ---

async function handleCreate(
  contractId: string,
  contract: NonNullable<Awaited<ReturnType<typeof db.contracts.findById>>>,
  data: z.infer<typeof CreateActionSchema>,
  callerRole: "client" | "agency",
) {
  const milestone = contract.milestones.find(
    (m) => m.id === data.milestoneId,
  );
  if (!milestone) {
    return Response.json({ error: "Milestone not found" }, { status: 404 });
  }

  if (milestone.status !== "delivered" && milestone.status !== "rejected") {
    return Response.json(
      {
        error:
          "Milestone must be in 'delivered' or 'rejected' status to dispute",
      },
      { status: 400 },
    );
  }

  // Dispute spam prevention: max 2 disputes per milestone
  const existingDisputes = (await db.disputes.findByContract(contractId))
    .filter((d) => d.milestoneId === data.milestoneId);
  if (existingDisputes.length >= 2) {
    return Response.json(
      { error: "Maximum of 2 disputes per milestone has been reached" },
      { status: 400 },
    );
  }

  const initiatedBy = callerRole;

  // Atomic conditional update — only dispute if milestone is still delivered/rejected
  const disputeUpdateResult = await db.contracts.conditionalUpdateMilestone(
    contractId,
    data.milestoneId,
    milestone.status,
    { status: "disputed" },
  );
  if (!disputeUpdateResult) {
    return Response.json(
      { error: "Milestone status changed before dispute could be created. Please refresh and try again." },
      { status: 409 },
    );
  }
  await db.contracts.update(contractId, { status: "disputed" });

  // Create dispute record — goes straight to evidence phase
  const dispute = await db.disputes.createDispute({
    contractId,
    milestoneId: data.milestoneId,
    phase: "evidence",
    initiatedBy,
    partyResponses: [],
    clientFeePaid: false,
    agencyFeePaid: false,
    evidence: [
      {
        party: initiatedBy,
        type: "argument",
        uri: "",
        description: data.argument,
        submittedAt: new Date(),
      },
    ],
  });

  // Notify the other party about the dispute
  const otherPartyAddress = callerRole === "client" ? contract.agency : contract.client;
  if (otherPartyAddress) {
    notifyUser(otherPartyAddress, {
      type: "dispute_started",
      contractTitle: contract.title,
      contractId,
      milestoneName: milestone?.name,
    });
  }

  const updatedDispute = await db.disputes.findById(dispute.id) ?? dispute;
  return Response.json(updatedDispute, { status: 201 });
}

async function handlePayFee(
  contractId: string,
  data: z.infer<typeof PayFeeActionSchema>,
  callerRole: "client" | "agency",
) {
  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }

  if (dispute.contractId !== contractId) {
    return Response.json(
      { error: "Dispute does not belong to this contract" },
      { status: 400 },
    );
  }

  const party = callerRole;

  // Check if this party already paid
  if ((party === "client" && dispute.clientFeePaid) || (party === "agency" && dispute.agencyFeePaid)) {
    return Response.json({ error: "You have already paid the arbitration fee" }, { status: 400 });
  }

  const contract = await db.contracts.findById(contractId);

  await db.disputes.recordFeePaid(data.disputeId, party);
  const updated = (await db.disputes.findById(data.disputeId))!;

  // Notify the other party that this party paid their fee
  if (contract) {
    const otherPartyAddress = party === "client" ? contract.agency : contract.client;
    if (otherPartyAddress) {
      notifyUser(otherPartyAddress, {
        type: "dispute_fee_paid",
        contractTitle: contract.title,
        contractId,
        actorName: party === "client" ? "The client" : "The agency",
      });
    }
  }

  // If both parties paid, escalate to Kleros review (on-chain Kleros not yet wired)
  if (updated.clientFeePaid && updated.agencyFeePaid) {
    await db.disputes.update(data.disputeId, { phase: "kleros_review" });
    console.log("[court] Both fees paid — escalated to kleros_review (DB only)");
  }

  const finalDispute = (await db.disputes.findById(data.disputeId))!;
  return Response.json(finalDispute);
}

async function handleCheckDeadline(
  contractId: string,
  data: z.infer<typeof CheckDeadlineActionSchema>,
) {
  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }

  if (dispute.contractId !== contractId) {
    return Response.json(
      { error: "Dispute does not belong to this contract" },
      { status: 400 },
    );
  }

  const result = await db.disputes.checkFeeDeadline(data.disputeId);

  if (result.expired && result.defaultWinner) {
    // Resolve dispute — the party that didn't pay loses by default
    const milestoneStatus =
      result.defaultWinner === "client" ? "failed" : "approved";
    await db.contracts.updateMilestone(contractId, dispute.milestoneId, {
      status: milestoneStatus,
      ...(milestoneStatus === "approved" ? { approvedAt: new Date() } : {}),
    });
    await db.disputes.update(data.disputeId, {
      phase: "resolved",
      resolvedAt: new Date(),
      ruling: result.defaultWinner === "client" ? 1 : 2,
    });

    // Restore contract status
    const freshContract = await db.contracts.findById(contractId);
    if (freshContract) {
      const allDone = freshContract.milestones.every(
        (m) => m.status === "approved" || m.status === "failed",
      );
      if (allDone) {
        const allApproved = freshContract.milestones.every(
          (m) => m.status === "approved",
        );
        await db.contracts.update(contractId, {
          status: allApproved ? "completed" : "failed",
        });
      } else {
        await db.contracts.update(contractId, { status: "active" });
      }
    }

    // Refund milestone on-chain if client wins by default
    if (result.defaultWinner === "client" && isBlockchainConfigured() && freshContract?.onChainAddress) {
      try {
        const txHash = await refundMilestone(freshContract.onChainAddress, dispute.milestoneId);
        console.log("[dispute/deadline] On-chain refundMilestone success:", txHash);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "On-chain refund failed";
        console.error("[dispute/deadline] On-chain refundMilestone FAILED:", msg);
        return Response.json(
          { error: `Dispute resolved but on-chain refund failed: ${msg}` },
          { status: 500 },
        );
      }
    }

    // Update agency score based on dispute outcome
    if (freshContract) {
      try {
        const agencyWon = result.defaultWinner === "agency";
        const agencyUser = await db.users.findByAddress(freshContract.agency);
        const profile = agencyUser?.agencyProfile;
        const updatedDisputesWon = (profile?.disputesWon ?? 0) + (agencyWon ? 1 : 0);
        const updatedDisputesLost = (profile?.disputesLost ?? 0) + (agencyWon ? 0 : 1);
        const newScore = computeAgencyScore({
          contractsCompleted: profile?.contractsCompleted ?? 0,
          contractsFailed: profile?.contractsFailed ?? 0,
          disputesWon: updatedDisputesWon,
          disputesLost: updatedDisputesLost,
          avgAiScore: 0,
        });
        await db.users.updateAgencyScore(freshContract.agency, {
          disputesWon: updatedDisputesWon,
          disputesLost: updatedDisputesLost,
          score: newScore,
        });
        // Best-effort on-chain update
        agencyProfileChain.recordDisputeResult(freshContract.agency, agencyWon, newScore);
      } catch (scoreErr) {
        console.error("[dispute] Agency score update failed:", scoreErr);
      }
    }

    // Notify both parties of the default ruling
    if (freshContract) {
      const defaultNotif = {
        type: "dispute_deadline_default" as const,
        contractTitle: freshContract.title,
        contractId,
        winner: result.defaultWinner === "client"
          ? "Client wins by default — agency did not pay arbitration fee"
          : "Agency wins by default — client did not pay arbitration fee",
      };
      if (freshContract.client) notifyUser(freshContract.client, defaultNotif);
      if (freshContract.agency) notifyUser(freshContract.agency, defaultNotif);
    }
  }

  const finalDispute = (await db.disputes.findById(data.disputeId))!;
  return Response.json({ dispute: finalDispute, ...result });
}

async function handleSubmitEvidence(
  data: z.infer<typeof SubmitEvidenceActionSchema>,
  callerRole: "client" | "agency",
) {
  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }

  if (dispute.phase === "resolved") {
    return Response.json(
      { error: "Cannot submit evidence to a resolved dispute" },
      { status: 400 },
    );
  }

  let evidenceUri = data.evidenceUri;

  // If the evidenceUri looks like base64 file data, upload it to storage
  if (data.evidenceUri.startsWith("data:")) {
    try {
      const match = data.evidenceUri.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1];
        const buffer = Buffer.from(match[2], "base64");
        const filename = `evidence-${data.disputeId}-${Date.now()}`;
        const storageResult = await uploadFile(buffer, filename, contentType);
        evidenceUri = storageResult.url;

        // Store as document record
        await db.documents.createDocument({
          id: crypto.randomUUID(),
          contractId: dispute.contractId,
          milestoneId: dispute.milestoneId,
          type: "evidence",
          filename,
          contentType,
          contentHash: storageResult.contentHash,
          ipfsHash: storageResult.ipfsHash,
          blobUrl: storageResult.blobUrl,
          url: storageResult.url,
          size: storageResult.size,
        });
      }
    } catch (err) {
      console.error("[dispute] Evidence file upload failed:", err);
      // Continue with original URI — don't block evidence submission
    }
  }

  const updatedDispute = await db.disputes.addEvidence(data.disputeId, {
    party: callerRole,
    type: "document",
    uri: evidenceUri,
    description: data.description,
    submittedAt: new Date(),
  });

  // Notify the other party that evidence was submitted
  const contract = await db.contracts.findById(dispute.contractId);
  if (contract) {
    const otherPartyAddress = callerRole === "client" ? contract.agency : contract.client;
    if (otherPartyAddress) {
      notifyUser(otherPartyAddress, {
        type: "evidence_submitted",
        contractTitle: contract.title,
        contractId: dispute.contractId,
        actorName: callerRole === "client" ? "The client" : "The agency",
      });
    }
  }

  return Response.json(updatedDispute);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureInit();
    const { id } = await params;

    // Auth: only parties to the contract can view disputes
    const auth = await requireRole(request, id, "party");
    if ("error" in auth) return auth.error;

    const disputes = await db.disputes.findByContract(id);
    return Response.json(disputes);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
