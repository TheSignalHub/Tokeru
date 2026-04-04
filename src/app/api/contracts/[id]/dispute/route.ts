import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { isBlockchainConfigured, refundMilestone, agencyProfile as agencyProfileChain } from "@/lib/blockchain";
import { notifyUser } from "@/lib/email";
import { computeAgencyScore } from "@/lib/scoring";
import { uploadFile } from "@/lib/storage";

// --- Constants ---
const ESTIMATED_ARBITRATION_FEE = 0.05; // ETH
const DISCUSSION_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours

// --- Zod schemas for each action ---

const CreateActionSchema = z.object({
  action: z.literal("create"),
  milestoneId: z.number().int().positive(),
  argument: z.string().min(1),
});

const RespondActionSchema = z.object({
  action: z.literal("respond"),
  disputeId: z.string().min(1),
  message: z.string().min(1),
});

const EscalateActionSchema = z.object({
  action: z.literal("escalate"),
  disputeId: z.string().min(1),
});

const AcceptRejectionActionSchema = z.object({
  action: z.literal("accept_rejection"),
  disputeId: z.string().min(1),
});

const ApproveMilestoneActionSchema = z.object({
  action: z.literal("approve_milestone"),
  disputeId: z.string().min(1),
});

const SettleActionSchema = z.object({
  action: z.literal("settle"),
  disputeId: z.string().min(1),
  proposal: z.enum(["approve", "reject"]),
});

const AcceptSettlementActionSchema = z.object({
  action: z.literal("accept_settlement"),
  disputeId: z.string().min(1),
});

const RejectSettlementActionSchema = z.object({
  action: z.literal("reject_settlement"),
  disputeId: z.string().min(1),
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
  RespondActionSchema,
  EscalateActionSchema,
  AcceptRejectionActionSchema,
  ApproveMilestoneActionSchema,
  SettleActionSchema,
  AcceptSettlementActionSchema,
  RejectSettlementActionSchema,
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
      case "respond":
        return handleRespond(id, contract, data, callerRole);
      case "escalate":
        return handleEscalate(id, contract, data, callerRole);
      case "accept_rejection":
        return handleAcceptRejection(id, contract, data, callerRole);
      case "approve_milestone":
        return handleApproveMilestone(id, contract, data, callerRole);
      case "settle":
        return handleSettle(id, contract, data, callerRole);
      case "accept_settlement":
        return handleAcceptSettlement(id, contract, data, callerRole);
      case "reject_settlement":
        return handleRejectSettlement(id, data, callerRole);
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

type Contract = NonNullable<Awaited<ReturnType<typeof db.contracts.findById>>>;

async function handleCreate(
  contractId: string,
  contract: Contract,
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

  // Atomic conditional update -- only dispute if milestone is still delivered/rejected
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

  // Discussion deadline: 48 hours from now
  const discussionDeadline = new Date(Date.now() + DISCUSSION_DURATION_MS);

  // Create dispute record -- starts in discussion phase (not evidence)
  const dispute = await db.disputes.createDispute({
    contractId,
    milestoneId: data.milestoneId,
    phase: "discussion",
    initiatedBy,
    partyResponses: [],
    clientFeePaid: false,
    agencyFeePaid: false,
    discussionDeadline,
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

  const milestoneAmount = milestone.amount ?? 0;
  const updatedDispute = await db.disputes.findById(dispute.id) ?? dispute;
  return Response.json({
    ...updatedDispute,
    arbitrationCostEstimate: {
      feePerParty: ESTIMATED_ARBITRATION_FEE,
      milestoneAmount,
      warning: `You will spend ~${ESTIMATED_ARBITRATION_FEE} ETH in fees to dispute ${milestoneAmount} USD`,
    },
  }, { status: 201 });
}

async function handleRespond(
  contractId: string,
  contract: Contract,
  data: z.infer<typeof RespondActionSchema>,
  callerRole: "client" | "agency",
) {
  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }
  if (dispute.contractId !== contractId) {
    return Response.json({ error: "Dispute does not belong to this contract" }, { status: 400 });
  }
  if (dispute.phase !== "discussion") {
    return Response.json({ error: "Responses can only be submitted during the discussion phase" }, { status: 400 });
  }

  const updatedDispute = await db.disputes.addEvidence(data.disputeId, {
    party: callerRole,
    type: "response",
    uri: "",
    description: data.message,
    submittedAt: new Date(),
  });

  // Notify the other party
  const otherPartyAddress = callerRole === "client" ? contract.agency : contract.client;
  if (otherPartyAddress) {
    notifyUser(otherPartyAddress, {
      type: "evidence_submitted",
      contractTitle: contract.title,
      contractId,
      actorName: callerRole === "client" ? "The client" : "The agency",
    });
  }

  return Response.json(updatedDispute);
}

async function handleEscalate(
  contractId: string,
  contract: Contract,
  data: z.infer<typeof EscalateActionSchema>,
  callerRole: "client" | "agency",
) {
  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }
  if (dispute.contractId !== contractId) {
    return Response.json({ error: "Dispute does not belong to this contract" }, { status: 400 });
  }
  if (dispute.phase !== "discussion") {
    return Response.json({ error: "Can only escalate from discussion phase" }, { status: 400 });
  }

  // Move to evidence phase
  await db.disputes.update(data.disputeId, { phase: "evidence" });

  // Add a system note
  await db.disputes.addEvidence(data.disputeId, {
    party: "system",
    type: "argument",
    uri: "",
    description: `Escalated to formal arbitration by ${callerRole}.`,
    submittedAt: new Date(),
  });

  // Notify the other party
  const otherPartyAddress = callerRole === "client" ? contract.agency : contract.client;
  if (otherPartyAddress) {
    notifyUser(otherPartyAddress, {
      type: "dispute_started",
      contractTitle: contract.title,
      contractId,
      milestoneName: contract.milestones.find((m) => m.id === dispute.milestoneId)?.name,
    });
  }

  const finalDispute = (await db.disputes.findById(data.disputeId))!;
  return Response.json(finalDispute);
}

async function handleAcceptRejection(
  contractId: string,
  contract: Contract,
  data: z.infer<typeof AcceptRejectionActionSchema>,
  callerRole: "client" | "agency",
) {
  if (callerRole !== "agency") {
    return Response.json({ error: "Only the agency can accept a rejection" }, { status: 403 });
  }

  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }
  if (dispute.contractId !== contractId) {
    return Response.json({ error: "Dispute does not belong to this contract" }, { status: 400 });
  }
  if (dispute.phase !== "discussion") {
    return Response.json({ error: "Can only accept rejection during discussion phase" }, { status: 400 });
  }

  // Resolve dispute in client's favor (rejection stands)
  await db.disputes.update(data.disputeId, {
    phase: "resolved",
    resolvedAt: new Date(),
    ruling: 1, // client wins
  });

  // Revert milestone to rejected
  await db.contracts.updateMilestone(contractId, dispute.milestoneId, {
    status: "rejected",
  });
  await db.contracts.update(contractId, { status: "active" });

  // Notify client
  if (contract.client) {
    notifyUser(contract.client, {
      type: "dispute_deadline_default",
      contractTitle: contract.title,
      contractId,
      winner: "Agency accepted the rejection. Milestone reverted to rejected status.",
    });
  }

  const finalDispute = (await db.disputes.findById(data.disputeId))!;
  return Response.json(finalDispute);
}

async function handleApproveMilestone(
  contractId: string,
  contract: Contract,
  data: z.infer<typeof ApproveMilestoneActionSchema>,
  callerRole: "client" | "agency",
) {
  if (callerRole !== "client") {
    return Response.json({ error: "Only the client can approve a milestone during discussion" }, { status: 403 });
  }

  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }
  if (dispute.contractId !== contractId) {
    return Response.json({ error: "Dispute does not belong to this contract" }, { status: 400 });
  }
  if (dispute.phase !== "discussion") {
    return Response.json({ error: "Can only approve milestone during discussion phase" }, { status: 400 });
  }

  // Resolve dispute in agency's favor
  await db.disputes.update(data.disputeId, {
    phase: "resolved",
    resolvedAt: new Date(),
    ruling: 2, // agency wins
  });

  // Approve milestone
  await db.contracts.updateMilestone(contractId, dispute.milestoneId, {
    status: "approved",
    approvedAt: new Date(),
  });

  // Restore contract status
  const freshContract = await db.contracts.findById(contractId);
  if (freshContract) {
    const allDone = freshContract.milestones.every(
      (m) => m.status === "approved" || m.status === "failed",
    );
    if (allDone) {
      const allApproved = freshContract.milestones.every((m) => m.status === "approved");
      await db.contracts.update(contractId, { status: allApproved ? "completed" : "failed" });
    } else {
      await db.contracts.update(contractId, { status: "active" });
    }
  }

  // Notify agency
  if (contract.agency) {
    notifyUser(contract.agency, {
      type: "dispute_deadline_default",
      contractTitle: contract.title,
      contractId,
      winner: "Client approved the milestone during discussion. Dispute resolved in agency's favor.",
    });
  }

  const finalDispute = (await db.disputes.findById(data.disputeId))!;
  return Response.json(finalDispute);
}

async function handleSettle(
  contractId: string,
  _contract: Contract,
  data: z.infer<typeof SettleActionSchema>,
  callerRole: "client" | "agency",
) {
  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }
  if (dispute.contractId !== contractId) {
    return Response.json({ error: "Dispute does not belong to this contract" }, { status: 400 });
  }
  if (dispute.phase === "resolved") {
    return Response.json({ error: "Dispute is already resolved" }, { status: 400 });
  }

  // Check if there's already a pending settlement
  if (dispute.settlement && dispute.settlement.accepted === undefined) {
    return Response.json({ error: "There is already a pending settlement proposal" }, { status: 400 });
  }

  const settlement = {
    proposedBy: callerRole,
    proposal: data.proposal,
    proposedAt: new Date(),
  };

  await db.disputes.update(data.disputeId, { settlement });

  const finalDispute = (await db.disputes.findById(data.disputeId))!;
  return Response.json(finalDispute);
}

async function handleAcceptSettlement(
  contractId: string,
  contract: Contract,
  data: z.infer<typeof AcceptSettlementActionSchema>,
  callerRole: "client" | "agency",
) {
  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }
  if (dispute.contractId !== contractId) {
    return Response.json({ error: "Dispute does not belong to this contract" }, { status: 400 });
  }
  if (!dispute.settlement || dispute.settlement.accepted !== undefined) {
    return Response.json({ error: "No pending settlement proposal" }, { status: 400 });
  }
  if (dispute.settlement.proposedBy === callerRole) {
    return Response.json({ error: "Cannot accept your own settlement proposal" }, { status: 400 });
  }

  // Accept the settlement
  const updatedSettlement = {
    ...dispute.settlement,
    accepted: true,
    respondedAt: new Date(),
  };
  const ruling = dispute.settlement.proposal === "approve" ? 2 : 1; // approve = agency wins, reject = client wins
  const milestoneStatus = ruling === 2 ? "approved" : "failed";

  await db.disputes.update(data.disputeId, {
    settlement: updatedSettlement,
    phase: "resolved",
    resolvedAt: new Date(),
    ruling: ruling as 0 | 1 | 2,
  });

  await db.contracts.updateMilestone(contractId, dispute.milestoneId, {
    status: milestoneStatus as "approved" | "failed",
    ...(milestoneStatus === "approved" ? { approvedAt: new Date() } : {}),
  });

  // Restore contract status
  const freshContract = await db.contracts.findById(contractId);
  if (freshContract) {
    const allDone = freshContract.milestones.every(
      (m) => m.status === "approved" || m.status === "failed",
    );
    if (allDone) {
      const allApproved = freshContract.milestones.every((m) => m.status === "approved");
      await db.contracts.update(contractId, { status: allApproved ? "completed" : "failed" });
    } else {
      await db.contracts.update(contractId, { status: "active" });
    }
  }

  // Notify both parties
  const winnerText = ruling === 2 ? "Milestone approved by settlement." : "Milestone rejected by settlement.";
  if (contract.client) notifyUser(contract.client, { type: "dispute_deadline_default", contractTitle: contract.title, contractId, winner: winnerText });
  if (contract.agency) notifyUser(contract.agency, { type: "dispute_deadline_default", contractTitle: contract.title, contractId, winner: winnerText });

  const finalDispute = (await db.disputes.findById(data.disputeId))!;
  return Response.json(finalDispute);
}

async function handleRejectSettlement(
  contractId: string,
  data: z.infer<typeof RejectSettlementActionSchema>,
  callerRole: "client" | "agency",
) {
  const dispute = await db.disputes.findById(data.disputeId);
  if (!dispute) {
    return Response.json({ error: "Dispute not found" }, { status: 404 });
  }
  if (dispute.contractId !== contractId) {
    return Response.json({ error: "Dispute does not belong to this contract" }, { status: 400 });
  }
  if (!dispute.settlement || dispute.settlement.accepted !== undefined) {
    return Response.json({ error: "No pending settlement proposal" }, { status: 400 });
  }
  if (dispute.settlement.proposedBy === callerRole) {
    return Response.json({ error: "Cannot reject your own settlement proposal" }, { status: 400 });
  }

  const updatedSettlement = {
    ...dispute.settlement,
    accepted: false,
    respondedAt: new Date(),
  };

  await db.disputes.update(data.disputeId, { settlement: updatedSettlement });

  const finalDispute = (await db.disputes.findById(data.disputeId))!;
  return Response.json(finalDispute);
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
    console.log("[court] Both fees paid -- escalated to kleros_review (DB only)");
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

  // Check discussion deadline -- auto-escalate to evidence if 48h expired
  if (dispute.phase === "discussion" && dispute.discussionDeadline) {
    const now = new Date();
    if (now >= new Date(dispute.discussionDeadline)) {
      await db.disputes.update(data.disputeId, { phase: "evidence" });
      await db.disputes.addEvidence(data.disputeId, {
        party: "system",
        type: "argument",
        uri: "",
        description: "Discussion period expired. Automatically escalated to evidence phase.",
        submittedAt: new Date(),
      });
      const finalDispute = (await db.disputes.findById(data.disputeId))!;
      return Response.json({ dispute: finalDispute, discussionExpired: true, expired: false });
    }
  }

  const result = await db.disputes.checkFeeDeadline(data.disputeId);

  if (result.expired && result.defaultWinner) {
    // Resolve dispute -- the party that didn't pay loses by default
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
          ? "Client wins by default -- agency did not pay arbitration fee"
          : "Agency wins by default -- client did not pay arbitration fee",
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
      // Continue with original URI -- don't block evidence submission
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
