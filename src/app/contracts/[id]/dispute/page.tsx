"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Scale, CheckCircle, XCircle, AlertTriangle,
  ExternalLink, Clock, Loader2, DollarSign, Gavel,
  ShieldCheck, Timer, FileText, Send, MessageCircle,
} from "lucide-react";
import {
  useContract,
  useDisputes,
  startDispute,
  payKlerosFee,
  submitDisputeEvidence,
  respondToDispute,
  escalateDispute,
  acceptRejection,
  approveMilestoneInDispute,
  proposeSettlement,
  acceptSettlement,
  rejectSettlement,
} from "@/hooks/use-contracts";
import { useAuth } from "@/hooks/use-auth";
import type { Dispute, DisputePhase } from "@/lib/types";
import { toast } from "sonner";
import { Button, TextArea, Spinner } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PageHeader, SectionCard, EvidenceTag,
} from "@/components/ui";
import { formatCurrency } from "@/lib/utils/format";

// --- Constants ---
const ESTIMATED_ARBITRATION_FEE = 0.05; // ETH

// --- Phase definitions ---
const PHASES: { key: DisputePhase; label: string; icon: typeof Scale }[] = [
  { key: "discussion", label: "Discussion", icon: MessageCircle },
  { key: "evidence", label: "Evidence", icon: FileText },
  { key: "kleros_payment", label: "Fee Deposit", icon: DollarSign },
  { key: "kleros_review", label: "Court Review", icon: Scale },
  { key: "resolved", label: "Resolved", icon: CheckCircle },
];

const PHASE_TITLES: Record<DisputePhase, string> = {
  discussion: "Milestone Under Review",
  evidence: "Evidence Submission",
  kleros_payment: "Arbitration Fee Required",
  kleros_review: "Court Review",
  resolved: "Resolved",
};

function phaseIndex(phase: DisputePhase): number {
  return PHASES.findIndex((p) => p.key === phase);
}

// --- Countdown hook ---
function useCountdown(deadline: Date | undefined) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  const diff = new Date(deadline).getTime() - now;
  if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, text: "Expired" };

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const text =
    days > 0 ? `${days}d ${hours}h remaining` : hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;

  return { expired: false, days, hours, minutes, text };
}

// --- Component ---
export default function DisputePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const milestoneParam = searchParams.get("milestone");

  const { walletAddress } = useAuth();
  const { contract, loading: contractLoading } = useContract(id);
  const {
    data: disputes,
    loading: disputesLoading,
    refresh: refreshDisputes,
  } = useDisputes(id);

  const [argument, setArgument] = useState("");
  const [responseMsg, setResponseMsg] = useState("");
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [payingFee, setPayingFee] = useState(false);
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [settling, setSettling] = useState(false);
  const [showEscalateConfirm, setShowEscalateConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading = contractLoading || disputesLoading;

  // --- Role detection ---
  const userRole: "agency" | "client" | "viewer" = useMemo(() => {
    if (!contract || !walletAddress) return "viewer";
    if (contract.agency?.toLowerCase() === walletAddress?.toLowerCase()) return "agency";
    if (contract.client?.toLowerCase() === walletAddress?.toLowerCase()) return "client";
    return "viewer";
  }, [contract, walletAddress]);

  // --- Dispute data ---
  const dispute: Dispute | null = useMemo(() => {
    if (!disputes?.length) return null;
    if (milestoneParam) {
      return disputes.find((d) => d.milestoneId === Number(milestoneParam)) ?? disputes[0];
    }
    return disputes[0];
  }, [disputes, milestoneParam]);
  const phase: DisputePhase = dispute?.phase ?? "discussion";
  const currentPhaseIdx = phaseIndex(phase);
  const feeCountdown = useCountdown(dispute?.feeDeadline);
  const discussionCountdown = useCountdown(dispute?.discussionDeadline);

  const disputeMilestone = dispute
    ? contract?.milestones.find((m) => m.id === dispute.milestoneId)
    : milestoneParam
      ? contract?.milestones.find((m) => m.id === Number(milestoneParam))
      : null;

  const milestoneName = disputeMilestone?.name ?? "Milestone";
  const milestoneAmount = disputeMilestone?.amount ?? 0;

  const myFeePaid =
    userRole === "client"
      ? dispute?.clientFeePaid
      : userRole === "agency"
        ? dispute?.agencyFeePaid
        : false;
  const otherFeePaid =
    userRole === "client"
      ? dispute?.agencyFeePaid
      : userRole === "agency"
        ? dispute?.clientFeePaid
        : false;

  // Fee deadline warning: <3 days
  const feeDeadlineWarning = feeCountdown && !feeCountdown.expired && feeCountdown.days < 3;

  // Rejection reason from milestone or initial argument
  const rejectionReason = useMemo(() => {
    if (!dispute) return null;
    const firstArg = dispute.evidence.find((e) => e.type === "argument" && e.party !== "system");
    return firstArg?.description ?? null;
  }, [dispute]);

  // Settlement state
  const pendingSettlement = dispute?.settlement && dispute.settlement.accepted === undefined
    ? dispute.settlement : null;

  // --- Handlers ---
  const handleCreateDispute = async () => {
    if (!argument.trim()) return;
    const msId =
      milestoneParam != null
        ? Number(milestoneParam)
        : contract?.milestones.find((m) => m.status === "rejected")?.id;
    if (msId == null) {
      setError("No milestone selected for dispute");
      return;
    }
    setSubmittingDispute(true);
    setError(null);
    try {
      await startDispute(id, msId, argument.trim());
      toast.success("Response submitted -- discussion started");
      setArgument("");
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start discussion";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleRespond = async () => {
    if (!dispute || !responseMsg.trim()) return;
    setSubmittingResponse(true);
    setError(null);
    try {
      await respondToDispute(id, dispute.id, responseMsg.trim());
      toast.success("Response sent");
      setResponseMsg("");
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send response";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleEscalate = async () => {
    if (!dispute) return;
    setEscalating(true);
    setError(null);
    try {
      await escalateDispute(id, dispute.id);
      toast.success("Escalated to formal arbitration");
      setShowEscalateConfirm(false);
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to escalate";
      setError(msg);
      toast.error(msg);
    } finally {
      setEscalating(false);
    }
  };

  const handleAcceptRejection = async () => {
    if (!dispute) return;
    setAccepting(true);
    setError(null);
    try {
      await acceptRejection(id, dispute.id);
      toast.success("Rejection accepted");
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to accept rejection";
      setError(msg);
      toast.error(msg);
    } finally {
      setAccepting(false);
    }
  };

  const handleApproveMilestone = async () => {
    if (!dispute) return;
    setAccepting(true);
    setError(null);
    try {
      await approveMilestoneInDispute(id, dispute.id);
      toast.success("Milestone approved");
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to approve milestone";
      setError(msg);
      toast.error(msg);
    } finally {
      setAccepting(false);
    }
  };

  const handleProposeSettlement = async (proposal: "approve" | "reject") => {
    if (!dispute) return;
    setSettling(true);
    setError(null);
    try {
      await proposeSettlement(id, dispute.id, proposal);
      toast.success("Settlement proposed");
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to propose settlement";
      setError(msg);
      toast.error(msg);
    } finally {
      setSettling(false);
    }
  };

  const handleAcceptSettlement = async () => {
    if (!dispute) return;
    setSettling(true);
    setError(null);
    try {
      await acceptSettlement(id, dispute.id);
      toast.success("Settlement accepted -- dispute resolved");
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to accept settlement";
      setError(msg);
      toast.error(msg);
    } finally {
      setSettling(false);
    }
  };

  const handleRejectSettlement = async () => {
    if (!dispute) return;
    setSettling(true);
    setError(null);
    try {
      await rejectSettlement(id, dispute.id);
      toast.success("Settlement rejected");
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reject settlement";
      setError(msg);
      toast.error(msg);
    } finally {
      setSettling(false);
    }
  };

  const handlePayFee = async () => {
    if (!dispute) return;
    setPayingFee(true);
    setError(null);
    try {
      await payKlerosFee(id, dispute.id);
      toast.success("Fee paid");
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to pay fee";
      setError(msg);
      toast.error(msg);
    } finally {
      setPayingFee(false);
    }
  };

  const handleSubmitEvidence = async () => {
    if (!dispute || !evidenceDesc.trim()) return;
    setSubmittingEvidence(true);
    setError(null);
    try {
      await submitDisputeEvidence(id, dispute.id, "", evidenceDesc.trim());
      toast.success("Evidence submitted");
      setEvidenceDesc("");
      refreshDisputes();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit evidence";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmittingEvidence(false);
    }
  };

  // --- Loading ---
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" className="text-accent" />
        </div>
      </div>
    );
  }

  // --- No dispute yet: creation form ---
  if (!dispute) {
    if (!milestoneParam) {
      return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <PageHeader
            title="Under Review"
            description="No active reviews on this contract"
            backHref={`/contracts/${id}`}
            backLabel="Back to Contract"
          />
          <div className="rounded-xl border border-border bg-surface-secondary p-8 text-center">
            <Scale className="h-12 w-12 text-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No active reviews</p>
            <p className="text-xs text-muted mb-4">
              There are no open reviews on this contract. If a milestone has been rejected, you can respond to the rejection from the contract page.
            </p>
            <Link
              href={`/contracts/${id}`}
              className="text-sm text-accent hover:underline"
            >
              Back to Contract
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title="Respond to Rejection"
          description={
            disputeMilestone
              ? `Milestone: ${milestoneName} (${formatCurrency(milestoneAmount)})`
              : "Respond to a milestone rejection"
          }
          backHref={`/contracts/${id}`}
          backLabel="Back to Contract"
        />

        {/* Context banner */}
        <div className="mb-6 p-4 rounded-xl border border-accent/30 bg-accent/5 flex items-start gap-3">
          <MessageCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-0.5">Start a discussion</p>
            <p className="text-sm text-muted">
              Explain your position on <span className="font-semibold text-foreground">{milestoneName}</span> ({formatCurrency(milestoneAmount)}).
              You will have 48 hours to discuss and resolve this with the other party before either side can escalate to arbitration.
            </p>
          </div>
        </div>

        {/* Arbitration cost warning */}
        <div className="mb-6 p-4 rounded-xl border border-warning/30 bg-warning/5 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-0.5">Arbitration costs</p>
            <p className="text-sm text-muted">
              If escalated, arbitration costs ~{ESTIMATED_ARBITRATION_FEE} ETH per party.
              You would spend ~{ESTIMATED_ARBITRATION_FEE} ETH in fees to dispute {formatCurrency(milestoneAmount)}.
              Most issues can be resolved through discussion.
            </p>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6"
            >
              <div className="flex items-center gap-3 p-4 rounded-xl border border-danger/30 bg-danger/5 text-sm text-danger">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-danger/60 hover:text-danger"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <SectionCard
          title="Your Response"
          icon={<MessageCircle className="h-5 w-5 text-accent" />}
          className="mb-6"
        >
          <p className="text-sm text-muted mb-4">
            Explain clearly why you believe the rejection is or is not warranted. Be specific about which requirements were met or unmet.
            <span className="text-xs text-muted block mt-1">Minimum 50 characters required.</span>
          </p>
          <TextArea
            value={argument}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setArgument(e.target.value)
            }
            placeholder="Describe your position on this rejection. Reference specific deliverables and requirements..."
            className="w-full resize-none mb-1"
          />
          <p className={`text-xs mb-4 ${argument.length > 0 && argument.trim().length < 50 ? "text-warning" : "text-muted"}`}>
            {argument.trim().length} / 50 characters minimum
          </p>
          <Button
            onPress={handleCreateDispute}
            isDisabled={submittingDispute || argument.trim().length < 50}
            className="bg-accent text-accent-foreground text-sm font-semibold rounded-lg px-6"
          >
            {submittingDispute ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Response
              </>
            )}
          </Button>
        </SectionCard>

        <div className="rounded-xl border border-border bg-surface-secondary p-5">
          <h4 className="text-sm font-semibold mb-3">How the review process works</h4>
          <ol className="space-y-2 text-xs text-muted list-decimal list-inside">
            <li>
              <span className="text-foreground font-medium">Discussion (48h):</span>{" "}
              Both parties discuss and try to resolve the issue
            </li>
            <li>
              <span className="text-foreground font-medium">Escalation (optional):</span>{" "}
              If unresolved, either party can escalate to formal arbitration
            </li>
            <li>
              <span className="text-foreground font-medium">Arbitration fee:</span>{" "}
              Both parties deposit ~{ESTIMATED_ARBITRATION_FEE} ETH (1 month deadline)
            </li>
            <li>
              <span className="text-foreground font-medium">Court review:</span>{" "}
              Decentralized jurors review all evidence and rule
            </li>
          </ol>
          <p className="text-xs text-muted mt-3 italic">
            Arbitration requires a fee deposit from both parties. Most issues can be resolved through discussion.
          </p>
        </div>
      </div>
    );
  }

  // --- Main dispute view ---
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title={PHASE_TITLES[phase]}
        description={`Milestone: ${milestoneName} -- ${formatCurrency(milestoneAmount)}`}
        backHref={`/contracts/${id}`}
        backLabel="Back to Contract"
      />

      {/* Phase Timeline */}
      <div className="mb-8">
        <div className="flex items-center gap-1 p-4 rounded-xl border border-border bg-surface overflow-x-auto">
          {PHASES.map((p, i) => {
            const isActive = p.key === phase;
            const isDone = i < currentPhaseIdx;
            const Icon = p.icon;

            return (
              <div key={p.key} className="flex items-center gap-1 flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 min-w-[48px]">
                  <motion.div
                    initial={false}
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    className={`flex items-center justify-center h-9 w-9 rounded-full ${
                      isDone
                        ? "bg-success"
                        : isActive
                          ? "bg-accent"
                          : "bg-surface-secondary"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle className="h-4 w-4 text-success-foreground" />
                    ) : (
                      <Icon
                        className={`h-4 w-4 ${isActive ? "text-accent-foreground" : "text-muted"}`}
                      />
                    )}
                  </motion.div>
                  <span
                    className={`text-[10px] text-center leading-tight whitespace-nowrap ${
                      isActive
                        ? "text-foreground font-semibold"
                        : isDone
                          ? "text-success"
                          : "text-muted"
                    }`}
                  >
                    {p.label}
                  </span>
                </div>
                {i < PHASES.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-1 ${
                      isDone ? "bg-success" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 p-4 rounded-xl border border-danger/30 bg-danger/5 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-auto text-danger/60 hover:text-danger"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discussion Phase */}
      {phase === "discussion" && (
        <>
          {/* Timer */}
          {discussionCountdown && (
            <div className={`mb-6 flex items-center gap-2 p-4 rounded-xl border ${
              discussionCountdown.expired ? "border-danger/30 bg-danger/5 text-danger" : "border-accent/30 bg-accent/5 text-accent"
            }`}>
              <Timer className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">
                {discussionCountdown.expired
                  ? "Discussion period has expired. Either party can escalate to arbitration."
                  : `${discussionCountdown.text} to resolve before escalating to arbitration`}
              </span>
            </div>
          )}

          {/* Rejection reason */}
          {rejectionReason && (
            <SectionCard
              title="Reason for Review"
              icon={<AlertTriangle className="h-5 w-5 text-warning" />}
              className="mb-6 border-warning/30"
            >
              <p className="text-sm text-foreground whitespace-pre-wrap">{rejectionReason}</p>
            </SectionCard>
          )}

          {/* Pending settlement proposal */}
          {pendingSettlement && (
            <SectionCard
              title="Settlement Proposal"
              icon={<Scale className="h-5 w-5 text-accent" />}
              className="mb-6 border-accent/30"
            >
              <p className="text-sm text-foreground mb-3">
                {pendingSettlement.proposedBy === "client" ? "The client" : "The agency"} proposes to{" "}
                <span className="font-semibold">
                  {pendingSettlement.proposal === "approve" ? "approve the milestone (agency wins)" : "reject the milestone (client wins)"}
                </span>.
              </p>
              {pendingSettlement.proposedBy !== userRole && userRole !== "viewer" && (
                <div className="flex gap-2">
                  <Button
                    onPress={handleAcceptSettlement}
                    isDisabled={settling}
                    className="bg-success text-success-foreground text-sm font-semibold rounded-lg px-4"
                  >
                    {settling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Accept Settlement
                  </Button>
                  <Button
                    onPress={handleRejectSettlement}
                    isDisabled={settling}
                    variant="outline"
                    className="text-sm font-semibold rounded-lg px-4"
                  >
                    Decline
                  </Button>
                </div>
              )}
              {pendingSettlement.proposedBy === userRole && (
                <p className="text-xs text-muted italic">Waiting for the other party to respond to your proposal...</p>
              )}
            </SectionCard>
          )}

          {/* Message thread */}
          {dispute.evidence && dispute.evidence.length > 0 && (
            <SectionCard title="Discussion" className="mb-6">
              <div className="space-y-3">
                {dispute.evidence.map((ev, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${
                    ev.party === "system" ? "border-border/50 bg-surface" :
                    ev.party === userRole ? "border-accent/20 bg-accent/5 ml-4" : "border-border bg-surface-secondary mr-4"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <EvidenceTag type={ev.type} />
                      <span className="text-xs text-muted capitalize">{ev.party === "system" ? "System" : ev.party}</span>
                      <span className="text-xs text-muted ml-auto">
                        {new Date(ev.submittedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{ev.description}</p>
                    {ev.uri && (
                      <a
                        href={ev.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1"
                      >
                        View attachment <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Response form */}
          {userRole !== "viewer" && (
            <SectionCard
              title="Post a Response"
              icon={<MessageCircle className="h-5 w-5 text-accent" />}
              className="mb-6"
            >
              <TextArea
                value={responseMsg}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setResponseMsg(e.target.value)}
                placeholder="Write your response..."
                className="w-full resize-none mb-3"
              />
              <Button
                onPress={handleRespond}
                isDisabled={submittingResponse || !responseMsg.trim()}
                className="bg-accent text-accent-foreground text-sm font-semibold rounded-lg px-5"
              >
                {submittingResponse ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</>
                ) : (
                  <><Send className="h-4 w-4 mr-2" />Send Response</>
                )}
              </Button>
            </SectionCard>
          )}

          {/* Action buttons */}
          {userRole !== "viewer" && (
            <div className="space-y-3 mb-6">
              {/* Agency actions */}
              {userRole === "agency" && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    href={`/contracts/${id}/deliver`}
                    className="flex-1 inline-flex items-center justify-center h-10 px-4 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    Revise &amp; Re-submit
                  </Link>
                  <Button
                    onPress={handleAcceptRejection}
                    isDisabled={accepting}
                    variant="outline"
                    className="flex-1 text-sm font-semibold rounded-lg"
                  >
                    {accepting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Accept Rejection
                  </Button>
                </div>
              )}

              {/* Client actions */}
              {userRole === "client" && (
                <Button
                  onPress={handleApproveMilestone}
                  isDisabled={accepting}
                  className="bg-success text-success-foreground text-sm font-semibold rounded-lg px-5"
                >
                  {accepting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Approve Milestone
                </Button>
              )}

              {/* Settlement proposals */}
              {!pendingSettlement && (
                <div className="p-4 rounded-xl border border-border bg-surface-secondary">
                  <p className="text-xs text-muted mb-2">Propose a settlement:</p>
                  <div className="flex gap-2">
                    <Button
                      onPress={() => handleProposeSettlement("approve")}
                      isDisabled={settling}
                      size="sm"
                      variant="outline"
                      className="text-xs rounded-lg"
                    >
                      Propose: Approve Milestone
                    </Button>
                    <Button
                      onPress={() => handleProposeSettlement("reject")}
                      isDisabled={settling}
                      size="sm"
                      variant="outline"
                      className="text-xs rounded-lg"
                    >
                      Propose: Reject Milestone
                    </Button>
                  </div>
                </div>
              )}

              {/* Escalate to arbitration */}
              <div className="pt-4 border-t border-border/50">
                {!showEscalateConfirm ? (
                  <button
                    onClick={() => setShowEscalateConfirm(true)}
                    className="text-sm text-danger hover:underline font-medium"
                  >
                    Escalate to Arbitration
                  </button>
                ) : (
                  <div className="p-4 rounded-xl border border-danger/30 bg-danger/5">
                    <p className="text-sm text-foreground font-medium mb-2">Are you sure?</p>
                    <p className="text-sm text-muted mb-4">
                      Arbitration costs ~{ESTIMATED_ARBITRATION_FEE} ETH per party and takes up to 30 days.
                      Are you sure you cannot resolve this through discussion?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onPress={handleEscalate}
                        isDisabled={escalating}
                        className="bg-danger text-danger-foreground text-sm font-semibold rounded-lg px-4"
                      >
                        {escalating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Gavel className="h-4 w-4 mr-2" />}
                        Confirm Escalation
                      </Button>
                      <Button
                        onPress={() => setShowEscalateConfirm(false)}
                        variant="outline"
                        className="text-sm rounded-lg"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Evidence Phase */}
      {phase === "evidence" && (
        <SectionCard
          title="Submit Evidence"
          icon={<FileText className="h-5 w-5 text-accent" />}
          className="mb-6"
        >
          <p className="text-sm text-muted mb-4">
            Both parties can submit evidence during this phase. Once evidence is gathered,
            both parties need to pay the arbitration fee to proceed.
          </p>
          <TextArea
            value={evidenceDesc}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEvidenceDesc(e.target.value)}
            placeholder="Describe your evidence (links, screenshots, documents, arguments)..."
            className="w-full resize-none mb-3"
          />
          <Button
            onPress={handleSubmitEvidence}
            isDisabled={submittingEvidence || !evidenceDesc.trim()}
            className="bg-accent text-accent-foreground text-sm font-semibold rounded-lg px-5"
          >
            {submittingEvidence ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" />Submit Evidence</>
            )}
          </Button>
        </SectionCard>
      )}

      {/* Kleros Payment Phase */}
      {phase === "kleros_payment" && (
        <SectionCard
          title="Pay Arbitration Fee"
          icon={<DollarSign className="h-5 w-5 text-warning" />}
          className="mb-6 border-warning/30"
        >
          {feeCountdown && (
            <div className={`mb-4 flex items-center gap-2 text-sm ${feeCountdown.expired ? "text-danger" : feeDeadlineWarning ? "text-danger" : "text-warning"}`}>
              <Timer className="h-4 w-4 shrink-0" />
              <span>Deadline: {feeCountdown.text}</span>
              {feeDeadlineWarning && !feeCountdown.expired && (
                <span className="ml-2 px-2 py-0.5 rounded bg-danger/10 text-danger text-xs font-semibold">
                  Deadline approaching
                </span>
              )}
            </div>
          )}
          <p className="text-sm text-muted mb-4">
            Both parties must pay the arbitration fee to proceed.
            If one party does not pay within the deadline, they lose by default.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className={`p-3 rounded-lg border text-center ${dispute.clientFeePaid ? "border-success/30 bg-success/5" : "border-border bg-surface-secondary"}`}>
              <p className="text-xs text-muted mb-1">Client</p>
              {dispute.clientFeePaid
                ? <CheckCircle className="h-5 w-5 text-success mx-auto" />
                : <Clock className="h-5 w-5 text-warning mx-auto" />}
              <p className="text-xs font-medium mt-1">{dispute.clientFeePaid ? "Paid" : "Pending"}</p>
            </div>
            <div className={`p-3 rounded-lg border text-center ${dispute.agencyFeePaid ? "border-success/30 bg-success/5" : "border-border bg-surface-secondary"}`}>
              <p className="text-xs text-muted mb-1">Agency</p>
              {dispute.agencyFeePaid
                ? <CheckCircle className="h-5 w-5 text-success mx-auto" />
                : <Clock className="h-5 w-5 text-warning mx-auto" />}
              <p className="text-xs font-medium mt-1">{dispute.agencyFeePaid ? "Paid" : "Pending"}</p>
            </div>
          </div>

          {!myFeePaid && userRole !== "viewer" && (
            <Button
              onPress={handlePayFee}
              isDisabled={payingFee}
              className="bg-warning text-warning-foreground text-sm font-semibold rounded-lg px-5"
            >
              {payingFee ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing...</>
              ) : (
                <>Pay Arbitration Fee ({dispute.arbitrationFee?.toFixed(4) ?? ESTIMATED_ARBITRATION_FEE} ETH)</>
              )}
            </Button>
          )}

          {myFeePaid && !otherFeePaid && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for the other party to pay...
            </div>
          )}
        </SectionCard>
      )}

      {/* Kleros Review Phase */}
      {phase === "kleros_review" && (
        <SectionCard
          title="Kleros Court Review"
          icon={<Gavel className="h-5 w-5 text-accent" />}
          className="mb-6"
        >
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Case submitted to Kleros</p>
              <p className="text-sm text-muted mb-3">
                Decentralized jurors are reviewing the evidence. The ruling will be enforced automatically.
              </p>
              {dispute.klerosDisputeId && (
                <a
                  href={`https://kleros.io/cases/${dispute.klerosDisputeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                >
                  View on Kleros <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Resolved Phase */}
      {phase === "resolved" && (
        <SectionCard
          title="Resolved"
          icon={<CheckCircle className="h-5 w-5 text-success" />}
          className="mb-6 border-success/30"
        >
          <p className="text-sm text-muted">
            {dispute.ruling === 1
              ? "Client won -- milestone rejected and funds refunded."
              : dispute.ruling === 2
                ? "Agency won -- milestone approved and funds released."
                : "Dispute resolved."}
          </p>
        </SectionCard>
      )}

      {/* Evidence log (for all phases except discussion, which has its own thread) */}
      {phase !== "discussion" && dispute.evidence && dispute.evidence.length > 0 && (
        <SectionCard title="Evidence Log" className="mb-6">
          <div className="space-y-3">
            {dispute.evidence.map((ev, i) => (
              <div key={i} className="p-3 rounded-lg border border-border bg-surface-secondary">
                <div className="flex items-center gap-2 mb-1">
                  <EvidenceTag type={ev.type} />
                  <span className="text-xs text-muted capitalize">{ev.party}</span>
                </div>
                <p className="text-sm text-foreground">{ev.description}</p>
                {ev.uri && (
                  <a
                    href={ev.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1"
                  >
                    View evidence <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Evidence submission during non-discussion active phases */}
      {phase !== "resolved" && phase !== "discussion" && (
        <SectionCard title="Add Evidence" className="mb-6">
          <TextArea
            value={evidenceDesc}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEvidenceDesc(e.target.value)}
            placeholder="Add more evidence or arguments..."
            className="w-full resize-none mb-3"
          />
          <Button
            onPress={handleSubmitEvidence}
            isDisabled={submittingEvidence || !evidenceDesc.trim()}
            size="sm"
            className="bg-accent text-accent-foreground text-sm font-semibold rounded-lg px-5"
          >
            {submittingEvidence ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" />Add Evidence</>
            )}
          </Button>
        </SectionCard>
      )}
    </div>
  );
}
