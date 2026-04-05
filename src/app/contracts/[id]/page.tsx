"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle, Clock, AlertTriangle, XCircle,
  Coins, Upload, ExternalLink, Loader2, Eye, ShieldAlert, Wallet, Zap, Mail, BadgeCheck,
  ChevronDown, Copy, MessageCircle,
} from "lucide-react";
import {
  useContract,
  approveMilestone,
  rejectMilestone,
} from "@/hooks/use-contracts";
import { useAuth } from "@/hooks/use-auth";
import { postApi, useApi } from "@/hooks/use-api";
import {
  Card, CardContent, CardHeader, Button, Spinner, TextArea,
} from "@heroui/react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { truncateMiddle, formatCurrency } from "@/lib/utils/format";
import {
  StatusBadge, LabeledProgress, PageHeader,
} from "@/components/ui";
import type { Milestone } from "@/lib/types";

type UserRole = "agency" | "client" | "investor" | "public";

/* ── Tab types ───────────────────────────────────────────────────────────── */
type TabId = "overview" | "milestones" | "tokenization" | "activity";

interface TabProps {
  contract: NonNullable<ReturnType<typeof useContract>["contract"]>;
  escrow: ReturnType<typeof useContract>["escrow"];
  blockchainEvents: ReturnType<typeof useContract>["blockchainEvents"];
  userRole: UserRole;
  deposited: number;
  released: number;
  escrowPct: number;
  id: string;
  exposure: { showDescription: boolean; showMilestones: boolean; showDisputeHistory: boolean };
  // Milestone action state (for MilestonesTab)
  approvingId: number | null;
  rejectingId: number | null;
  rejectReason: string;
  showRejectForm: number | null;
  setShowRejectForm: (id: number | null) => void;
  setRejectReason: (reason: string) => void;
  handleApprove: (milestoneId: number) => void;
  handleReject: (milestoneId: number) => void;
  // Pool state (for TokenizationTab)
  poolStatus: "idle" | "loading" | "success" | "error";
  setPoolStatus: (s: "idle" | "loading" | "success" | "error") => void;
  poolLoading: boolean;
  setPoolLoading: (b: boolean) => void;
  refresh: () => void;
  getAuthToken: () => Promise<string | null>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab 1: Overview
   ═══════════════════════════════════════════════════════════════════════════ */
function OverviewTab({ contract, escrow, userRole, deposited, released, escrowPct, exposure }: TabProps) {
  const milestones = contract.milestones ?? [];
  const approved = milestones.filter((m) => m.status === "approved").length;

  return (
    <div className="space-y-6">
      {/* Escrow status card */}
      {(userRole === "agency" || userRole === "client") && (
        <Card className="border border-border bg-surface rounded-xl shadow-sm overflow-hidden">
          <div
            className="h-1.5 bg-gradient-to-r from-accent to-success transition-all duration-500"
            style={{ width: `${escrowPct}%` }}
          />
          <CardContent className="p-5 sm:p-6">
            <h2 className="text-base font-bold mb-4 tracking-tight">Escrow Status</h2>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: "Deposited", value: formatCurrency(deposited), color: "text-success" },
                { label: "Released", value: formatCurrency(released), color: "text-accent" },
                { label: "Locked", value: formatCurrency(deposited - released), color: "text-foreground" },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-3 rounded-lg bg-surface-secondary border border-border/60 text-center">
                  <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
                  <div className="text-xs text-muted mt-0.5 font-medium uppercase tracking-wider">{label}</div>
                </div>
              ))}
            </div>
            <LabeledProgress label="Payout Progress" value={escrowPct} color="success" />
          </CardContent>
        </Card>
      )}
      {userRole === "investor" && (
        <Card className="border border-border rounded-xl shadow-sm overflow-hidden">
          <CardContent className="p-5">
            <LabeledProgress label="Contract Progress" value={escrowPct} />
          </CardContent>
        </Card>
      )}

      {/* Milestone summary table */}
      <Card className="border border-border bg-surface rounded-xl shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <h2 className="text-base font-bold mb-4 tracking-tight">Milestone Summary</h2>
          {userRole === "investor" && !exposure.showMilestones ? (
            <p className="text-sm text-muted">Milestone details are private. {approved}/{milestones.length} milestones completed.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left">
                    <th className="pb-2 font-semibold text-muted text-xs uppercase tracking-wider">Milestone</th>
                    <th className="pb-2 font-semibold text-muted text-xs uppercase tracking-wider text-right">Amount</th>
                    <th className="pb-2 font-semibold text-muted text-xs uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {milestones.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2.5 text-foreground font-medium">{m.name}</td>
                      <td className="py-2.5 text-right text-muted tabular-nums">{formatCurrency(m.amount)}</td>
                      <td className="py-2.5 text-right">
                        <StatusBadge status={m.status as "pending" | "delivered" | "approved" | "rejected" | "disputed"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contract stats */}
      <Card className="border border-border bg-surface rounded-xl shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <h2 className="text-base font-bold mb-4 tracking-tight">Contract Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider mb-1">Total Value</p>
              <p className="font-bold text-foreground">{formatCurrency(contract.totalValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider mb-1">Created</p>
              <p className="font-bold text-foreground">
                {contract.createdAt ? new Date(contract.createdAt).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider mb-1">Agency</p>
              <p className="font-bold text-foreground">
                {userRole === "agency" ? "You" : truncateMiddle(contract.agency, 6, 4)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wider mb-1">Client</p>
              <p className="font-bold text-foreground">
                {userRole === "investor" || userRole === "public"
                  ? "Private"
                  : userRole === "client"
                    ? "You"
                    : truncateMiddle(contract.client, 6, 4)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab 2: Milestones (interactive timeline)
   ═══════════════════════════════════════════════════════════════════════════ */
function MilestonesTab(props: TabProps) {
  const {
    contract, userRole, id, exposure,
    approvingId, rejectingId, rejectReason, showRejectForm,
    setShowRejectForm, setRejectReason, handleApprove, handleReject,
  } = props;

  const [expandedDeliverable, setExpandedDeliverable] = useState<number | null>(null);

  function getActionLabel(m: Milestone): { text: string; highlight: "agency" | "client" | null } {
    switch (m.status) {
      case "pending": return { text: "Waiting for agency to deliver", highlight: "agency" };
      case "delivered": return { text: "Waiting for client review", highlight: "client" };
      case "rejected": return { text: "Waiting for agency response", highlight: "agency" };
      case "approved": return { text: "Completed", highlight: null };
      case "disputed": return { text: "In dispute", highlight: null };
      default: return { text: "", highlight: null };
    }
  }

  function getMilestoneTimeline(m: Milestone) {
    const events: { label: string; date?: Date }[] = [];
    if (m.deliveredAt) events.push({ label: "Delivered", date: new Date(m.deliveredAt) });
    if (m.approvedAt) events.push({ label: "Approved", date: new Date(m.approvedAt) });
    if (m.status === "rejected") events.push({ label: "Rejected" });
    if (m.status === "disputed") events.push({ label: "Disputed" });
    return events;
  }

  // Milestones that need client review
  const deliveredMilestones = contract.milestones.filter((m) => m.status === "delivered");

  if (userRole === "investor" && !exposure.showMilestones) {
    return (
      <Card className="border border-border rounded-xl p-5">
        <p className="text-sm text-muted">
          Milestone details are private. {contract.milestones.filter(m => m.status === "approved").length}/{contract.milestones.length} milestones completed.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Review Required banner for client */}
      {userRole === "client" && deliveredMilestones.length > 0 && (
        <div className="space-y-3">
          {deliveredMilestones.map((m) => (
            <Card
              key={`review-${m.id}`}
              className="border border-warning/40 bg-warning/10 rounded-xl shadow-sm"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-warning">ACTION REQUIRED</p>
                    <p className="text-sm text-foreground mt-1">
                      &ldquo;{m.name}&rdquo; has been delivered and needs your review.
                      Approve to release funds or reject with feedback.
                    </p>
                    <button
                      onClick={() => {
                        const el = document.getElementById(`milestone-card-${m.id}`);
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", block: "center" });
                          setExpandedDeliverable(m.id);
                        }
                      }}
                      className="mt-3 inline-flex items-center gap-2 h-8 px-4 rounded-lg bg-warning text-warning-foreground text-sm font-semibold hover:bg-warning/85 active:scale-[0.98] transition-all"
                    >
                      Review Deliverable
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    <div className="relative pl-7">
      {contract.milestones.length > 1 && (
        <div className="absolute left-[11px] top-5 bottom-5 w-px bg-gradient-to-b from-success/40 to-border/20" />
      )}
      <div className="space-y-4">
        {contract.milestones.map((m, i) => {
          const isApproved = m.status === "approved";
          const isDelivered = m.status === "delivered";
          const isRejected = m.status === "rejected";
          const isDisputed = m.status === "disputed";
          const isPending = m.status === "pending";
          const actionInfo = getActionLabel(m);
          const timeline = getMilestoneTimeline(m);

          return (
            <motion.div
              key={m.id ?? i}
              id={`milestone-card-${m.id}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 160 }}
              className="relative"
            >
              {/* Timeline dot */}
              <div className="absolute -left-7 top-4 z-10 w-5 h-5 flex items-center justify-center">
                {isApproved ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : isDelivered ? (
                  <Clock className="h-5 w-5 text-warning" />
                ) : isRejected ? (
                  <XCircle className="h-5 w-5 text-danger" />
                ) : isDisputed ? (
                  <ShieldAlert className="h-5 w-5 text-danger" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-border bg-surface" />
                )}
              </div>

              <Card
                className={`border rounded-xl shadow-sm transition-all ${
                  isDelivered ? "border-warning/40 bg-warning/5"
                  : isApproved ? "border-success/30 bg-success/5"
                  : isRejected ? "border-danger/30 bg-danger/5"
                  : isDisputed ? "border-danger/30 bg-danger/5"
                  : "border-border bg-surface hover:border-accent/30"
                }`}
              >
                <CardContent className="p-4">
                  {/* Milestone header */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">{m.name}</div>
                      <div className="text-xs text-muted mt-0.5 font-medium">{formatCurrency(m.amount)}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <StatusBadge status={m.status as "pending" | "delivered" | "approved" | "rejected" | "disputed"} />
                    </div>
                  </div>

                  {/* Who needs to act */}
                  {actionInfo.text && !isApproved && (
                    <div className={`mt-2 text-xs font-medium px-2 py-1 rounded-md inline-block ${
                      actionInfo.highlight === userRole
                        ? "bg-accent/10 text-accent border border-accent/20"
                        : "text-muted"
                    }`}>
                      {actionInfo.highlight === userRole ? "Your turn: " : ""}
                      {actionInfo.text}
                    </div>
                  )}

                  {/* Proof hash */}
                  {m.proofHash && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted font-medium">
                        Proof: <code className="font-mono text-accent">{truncateMiddle(m.proofHash, 8, 6)}</code>
                      </p>
                    </div>
                  )}

                  {/* Timeline events */}
                  {timeline.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-3">
                      {timeline.map((ev) => (
                        <span key={ev.label} className="text-xs text-muted">
                          {ev.label}
                          {ev.date && (
                            <span className="ml-1 font-mono text-foreground/60">
                              {new Date(ev.date).toLocaleDateString()}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* ── Role-based actions ─────────────────────────── */}
                  {/* AGENCY actions */}
                  {userRole === "agency" && (
                    <>
                      {isPending && (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <Link
                            href={`/contracts/${id}/deliver`}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-accent border border-accent/30 rounded-lg px-4 py-2 hover:bg-accent/5 active:scale-[0.98] transition-all"
                          >
                            <Upload className="h-3.5 w-3.5" /> Submit Deliverable
                          </Link>
                        </div>
                      )}
                      {isDelivered && (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <p className="text-xs text-muted italic">Awaiting client review</p>
                        </div>
                      )}
                      {isRejected && (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Link
                              href={`/contracts/${id}/dispute?milestone=${m.id}`}
                              className="flex-1 inline-flex items-center justify-center h-9 px-4 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
                            >
                              <MessageCircle className="h-4 w-4 mr-2" /> Respond to Rejection
                            </Link>
                            <Link
                              href={`/contracts/${id}/deliver`}
                              className="flex-1 inline-flex items-center justify-center h-9 px-4 rounded-lg border border-border text-muted text-sm font-semibold hover:text-foreground hover:border-accent/50 active:scale-[0.98] transition-all"
                            >
                              Accept &amp; Revise
                            </Link>
                          </div>
                          <p className="text-xs text-muted mt-2">
                            If you cannot reach agreement, you can escalate to arbitration.
                          </p>
                        </div>
                      )}
                      {isDisputed && (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <Link href={`/contracts/${id}/dispute`} className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
                            <ExternalLink className="h-3.5 w-3.5" /> View Review
                          </Link>
                        </div>
                      )}
                    </>
                  )}

                  {/* CLIENT actions */}
                  {userRole === "client" && (
                    <>
                      {isPending && (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <p className="text-xs text-muted italic">Waiting for agency to deliver</p>
                        </div>
                      )}
                      {isDelivered && (
                        <>
                          {/* Deliverable preview */}
                          <div className="mt-4 pt-4 border-t border-border/50">
                            <button
                              onClick={() => setExpandedDeliverable(expandedDeliverable === m.id ? null : m.id)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Deliverable
                              <ChevronDown className={`h-3 w-3 transition-transform ${expandedDeliverable === m.id ? "rotate-180" : ""}`} />
                            </button>
                            <AnimatePresence>
                              {expandedDeliverable === m.id && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-2 p-3 rounded-lg bg-surface-secondary border border-border/60 space-y-2">
                                    {m.proofHash && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted font-medium">Proof hash:</span>
                                        <code className="text-xs font-mono text-accent">{truncateMiddle(m.proofHash, 10, 8)}</code>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(m.proofHash!);
                                            toast.success("Proof hash copied");
                                          }}
                                          className="text-muted hover:text-foreground transition-colors"
                                          title="Copy proof hash"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </button>
                                      </div>
                                    )}
                                    {m.deliveredAt && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted font-medium">Delivered:</span>
                                        <span className="text-xs text-foreground/80">
                                          {new Date(m.deliveredAt).toLocaleString("en-US", {
                                            month: "short", day: "numeric", year: "numeric",
                                            hour: "2-digit", minute: "2-digit",
                                          })}
                                        </span>
                                      </div>
                                    )}
                                    <Link
                                      href={`/contracts/${id}/deliver`}
                                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1"
                                    >
                                      <ExternalLink className="h-3 w-3" /> View delivery page
                                    </Link>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 mt-3">
                            <Button
                              onPress={() => handleApprove(m.id)}
                              isDisabled={approvingId === m.id}
                              className="flex-1 bg-success text-success-foreground text-sm font-semibold rounded-lg shadow-sm shadow-success/20 active:scale-[0.98]"
                            >
                              {approvingId === m.id ? (
                                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Approving...</>
                              ) : (
                                <><CheckCircle className="h-4 w-4 mr-2" /> Approve</>
                              )}
                            </Button>
                            <Button
                              onPress={() => {
                                setShowRejectForm(showRejectForm === m.id ? null : m.id);
                                setRejectReason("");
                              }}
                              className="flex-1 bg-danger/10 text-danger text-sm font-semibold rounded-lg border border-danger/30 hover:bg-danger/15 active:scale-[0.98]"
                              variant="ghost"
                            >
                              <XCircle className="h-4 w-4 mr-2" /> Reject
                            </Button>
                          </div>

                          {/* Reject form (inline) */}
                          <AnimatePresence>
                            {showRejectForm === m.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 p-3 rounded-lg border border-danger/20 bg-danger/5 space-y-3">
                                  <label className="text-xs font-semibold text-danger">Rejection Reason</label>
                                  <p className="text-[11px] text-muted leading-snug">
                                    Explain what needs to change. The agency can revise and re-submit.
                                  </p>
                                  <TextArea
                                    value={rejectReason}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectReason(e.target.value)}
                                    placeholder="Explain why this deliverable does not meet requirements..."
                                    className="w-full resize-none text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      onPress={() => handleReject(m.id)}
                                      isDisabled={rejectingId === m.id || !rejectReason.trim()}
                                      className="bg-danger text-danger-foreground text-sm font-semibold rounded-lg px-4"
                                      size="sm"
                                    >
                                      {rejectingId === m.id ? (
                                        <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Rejecting...</>
                                      ) : (
                                        "Confirm Rejection"
                                      )}
                                    </Button>
                                    <Button
                                      onPress={() => { setShowRejectForm(null); setRejectReason(""); }}
                                      variant="ghost"
                                      className="text-sm text-muted"
                                      size="sm"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </>
                      )}
                      {isRejected && (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <p className="text-xs text-muted italic">Awaiting agency response</p>
                        </div>
                      )}
                      {isDisputed && (
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <Link href={`/contracts/${id}/dispute`} className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
                            <ExternalLink className="h-3.5 w-3.5" /> View Review
                          </Link>
                        </div>
                      )}
                    </>
                  )}

                  {/* INVESTOR sees read-only dispute indicator */}
                  {userRole === "investor" && isDisputed && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <span className="inline-flex items-center gap-1.5 text-xs text-danger font-medium">
                        <ShieldAlert className="h-3.5 w-3.5" /> Dispute in progress
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab 3: Tokenization (agency only)
   ═══════════════════════════════════════════════════════════════════════════ */
function TokenizationTab(props: TabProps) {
  const { contract, userRole, id, exposure, poolStatus, setPoolStatus, poolLoading, setPoolLoading } = props;
  const isTokenized = !!contract.tokenizationExposure;

  // Parse token details from exposure
  const tokenDetails = contract.tokenizationExposure
    ? (JSON.parse(contract.tokenizationExposure) as { tokenName?: string; tokenSymbol?: string; totalSupply?: number; pricePerToken?: number; showDescription: boolean; showMilestones: boolean; showDisputeHistory: boolean })
    : null;

  return (
    <div className="space-y-6">
      {/* Token info card */}
      {isTokenized && contract.tokenAddress ? (
        <Card className="border border-brand/30 bg-brand/5 rounded-xl shadow-sm">
          <CardHeader className="px-5 pt-5 pb-2 flex items-center gap-2">
            <Coins className="h-4 w-4 text-brand" />
            <p className="text-sm font-bold">Deal Overview</p>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3 text-sm">
            {tokenDetails?.tokenName && (
              <div className="flex items-center justify-between">
                <span className="text-muted font-medium">Token Name</span>
                <span className="font-semibold text-foreground">{tokenDetails.tokenName}</span>
              </div>
            )}
            {tokenDetails?.tokenSymbol && (
              <div className="flex items-center justify-between">
                <span className="text-muted font-medium">Symbol</span>
                <span className="font-mono font-semibold text-foreground">{tokenDetails.tokenSymbol}</span>
              </div>
            )}
            {tokenDetails?.totalSupply != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted font-medium">Total Supply</span>
                <span className="font-semibold text-foreground tabular-nums">{tokenDetails.totalSupply.toLocaleString()}</span>
              </div>
            )}
            {tokenDetails?.pricePerToken != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted font-medium">Price per Token</span>
                <span className="font-semibold text-foreground tabular-nums">{formatCurrency(tokenDetails.pricePerToken)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted font-medium">Token Address</span>
              <span className="font-mono text-xs text-accent flex items-center gap-1 cursor-pointer hover:underline">
                {truncateMiddle(contract.tokenAddress, 6, 4)} <ExternalLink className="h-3 w-3" />
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted font-medium">Network</span>
              <span className="font-semibold text-foreground">Base Sepolia</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted font-medium">Status</span>
              {contract.onChainAddress ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-success">
                  <CheckCircle className="h-3.5 w-3.5" /> On-chain
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" /> DB only -- deploy when ready
                </span>
              )}
            </div>
            <Link
              href={`/marketplace/${id}`}
              className="flex items-center justify-center h-9 rounded-md bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/85 active:scale-[0.98] transition-all mt-2"
            >
              View on Marketplace
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border bg-surface rounded-xl shadow-sm">
          <CardContent className="p-6 text-center space-y-4">
            <Coins className="h-10 w-10 text-brand mx-auto" />
            <h3 className="font-bold text-lg">Tokenize This Contract</h3>
            <p className="text-sm text-muted max-w-md mx-auto">
              Open this contract for investor participation. Set your price and let investors buy tokens backed by contract value.
            </p>
            <Link
              href={`/contracts/${id}/tokenize`}
              className="inline-flex items-center gap-2 h-10 px-6 rounded-lg bg-brand text-brand-foreground text-sm font-semibold shadow-md shadow-brand/20 hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Coins className="h-4 w-4" /> Tokenize Contract
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Open Secondary Market */}
      {isTokenized && contract.tokenAddress && userRole === "agency" && (
        <Card className="border border-border bg-surface rounded-xl shadow-sm">
          <CardContent className="p-5 space-y-3">
            <h3 className="text-sm font-bold">Secondary Market</h3>
            {poolStatus === "success" ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-success/10 text-success text-sm font-medium">
                <CheckCircle className="h-4 w-4 shrink-0" />
                Secondary market is live. Investors can now trade tokens.
              </div>
            ) : poolStatus === "error" ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 rounded-md bg-danger/10 text-danger text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Market activation failed
                </div>
                <button
                  onClick={() => setPoolStatus("idle")}
                  className="flex items-center justify-center w-full h-9 rounded-md bg-surface-secondary text-sm font-semibold border border-brand/40 text-brand hover:bg-brand/10 active:scale-[0.98] transition-all"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <button
                  disabled={poolStatus === "loading"}
                  onClick={async () => {
                    setPoolStatus("loading");
                    setPoolLoading(true);
                    try {
                      const res = await fetch(`/api/contracts/${id}/pool`, {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...(typeof window !== "undefined" && localStorage.getItem("trustsignal_wallet")
                            ? { "X-Wallet-Address": localStorage.getItem("trustsignal_wallet")! }
                            : {}),
                        },
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error);
                      setPoolStatus("success");
                    } catch {
                      setPoolStatus("error");
                    } finally {
                      setPoolLoading(false);
                    }
                  }}
                  className="flex items-center justify-center w-full h-9 rounded-md bg-surface-secondary text-sm font-semibold border border-brand/40 text-brand hover:bg-brand/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {poolStatus === "loading" ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Opening market...</>
                  ) : (
                    "Open Secondary Market"
                  )}
                </button>
                {poolStatus === "idle" && (
                  <p className="text-[11px] text-muted text-center">Enable secondary market trading so investors can buy and sell tokens</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Investor visibility settings */}
      {isTokenized && (
        <Card className="border border-border bg-surface rounded-xl shadow-sm">
          <CardContent className="p-5 space-y-3">
            <h3 className="text-sm font-bold">Investor Visibility</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: "Contract description", enabled: exposure.showDescription },
                { label: "Milestone details", enabled: exposure.showMilestones },
                { label: "Dispute history", enabled: exposure.showDisputeHistory },
              ].map(({ label, enabled }) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <span className="text-muted">{label}</span>
                  <span className={`text-xs font-semibold ${enabled ? "text-success" : "text-muted"}`}>
                    {enabled ? "Visible" : "Hidden"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Marketplace link */}
      {isTokenized && (
        <div className="text-center">
          <Link
            href={`/marketplace/${id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
          >
            View marketplace listing <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tab 4: Activity
   ═══════════════════════════════════════════════════════════════════════════ */
function ActivityTab({ contract, blockchainEvents }: TabProps) {
  return (
    <div className="space-y-6">
      {/* Blockchain events */}
      <Card className="border border-border bg-surface rounded-xl shadow-sm">
        <CardHeader className="px-5 pt-5 pb-2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent" />
          <p className="text-sm font-bold">On-Chain Activity</p>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {blockchainEvents.length > 0 ? (
            <div className="space-y-2">
              {blockchainEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        evt.status === "confirmed" ? "bg-success"
                        : evt.status === "failed" ? "bg-danger"
                        : "bg-warning"
                      }`}
                    />
                    <span className="text-muted capitalize">{evt.operation.replace(/_/g, " ")}</span>
                  </div>
                  {evt.txHash ? (
                    <a
                      href={`https://sepolia.basescan.org/tx/${evt.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-accent hover:underline flex items-center gap-1"
                    >
                      {evt.txHash.slice(0, 6)}...{evt.txHash.slice(-4)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className={evt.status === "failed" ? "text-danger" : "text-muted"}>
                      {evt.status === "failed" ? "failed" : "pending"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted py-4 text-center">No on-chain events recorded yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Dispute history */}
      {contract.status === "disputed" && (
        <Card className="border border-danger/30 bg-danger/5 rounded-xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-4 w-4 text-danger" />
              <h3 className="text-sm font-bold text-danger">Active Dispute</h3>
            </div>
            <p className="text-sm text-muted mb-3">This contract has an active dispute that requires attention.</p>
            <Link
              href={`/contracts/${contract.id}/dispute`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-danger hover:underline"
            >
              View Dispute Details <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { walletAddress, authenticated, login, getAuthToken } = useAuth();
  const { contract, escrow, blockchainEvents, loading, error, refresh } = useContract(id);

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolStatus, setPoolStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  // ─── Role detection ─────────────────────────────────────────────────────────
  const isTokenized = !!contract?.tokenizationExposure;
  const userRole: UserRole =
    contract?.agency?.toLowerCase() === walletAddress?.toLowerCase() ? "agency"
    : contract?.client?.toLowerCase() === walletAddress?.toLowerCase() ? "client"
    : (authenticated && isTokenized) ? "investor"
    : "public";

  const exposure = contract?.tokenizationExposure
    ? (JSON.parse(contract.tokenizationExposure) as { showDescription: boolean; showMilestones: boolean; showDisputeHistory: boolean })
    : { showDescription: false, showMilestones: false, showDisputeHistory: false };

  // ─── Agency verification status ──────────────────────────────────────────
  const agencyVerifyUrl = contract?.agency ? `/api/users/${contract.agency}/verify` : null;
  const { data: agencyVerification } = useApi<{
    verified: boolean;
    attestationUid: string | null;
    easScanUrl: string | null;
  }>(agencyVerifyUrl);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleApprove = async (milestoneId: number) => {
    setApprovingId(milestoneId);
    setActionError(null);
    try {
      await approveMilestone(id, milestoneId);
      toast.success("Milestone approved");
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to approve milestone";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (milestoneId: number) => {
    if (!rejectReason.trim()) return;
    setRejectingId(milestoneId);
    setActionError(null);
    try {
      await rejectMilestone(id, milestoneId, rejectReason.trim());
      toast.success("Milestone rejected");
      setShowRejectForm(null);
      setRejectReason("");
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reject milestone";
      setActionError(msg);
      toast.error(msg);
    } finally {
      setRejectingId(null);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" className="text-accent" />
      </div>
    );
  }

  // ─── Invite required ──────────────────────────────────────────────────────
  if (error?.includes("invitation to join")) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <Card className="border border-warning/30 bg-warning/5 rounded-xl shadow-none">
          <CardContent className="p-6 text-center">
            <Mail className="h-8 w-8 text-warning mx-auto mb-3" />
            <p className="font-medium mb-2">This contract requires an invitation</p>
            <p className="text-sm text-muted">
              Check your email for the invite link from the contract creator,
              or ask them to share the invite URL with you.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (error || !contract) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <Card className="border border-danger/30 bg-danger/5 rounded-xl shadow-none">
          <CardContent className="p-6 text-center text-danger font-medium">
            {error ?? "Contract not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const deposited = escrow?.depositedAmount ?? 0;
  const released = escrow?.releasedAmount ?? 0;
  const escrowPct = contract.totalValue > 0 ? Math.round((released / contract.totalValue) * 100) : 0;

  // ─── Build visible tabs ────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
  ];
  if (userRole === "agency" || userRole === "client") {
    tabs.push({ id: "milestones", label: "Milestones" });
  }
  if (userRole === "agency" && (contract.status === "active" || contract.status === "completed")) {
    tabs.push({ id: "tokenization", label: "Tokenization" });
  }
  if (userRole === "agency" || userRole === "client") {
    tabs.push({ id: "activity", label: "Activity" });
  }

  // Ensure activeTab is valid for current role
  const validTabIds = tabs.map((t) => t.id);
  const currentTab = validTabIds.includes(activeTab) ? activeTab : "overview";

  const tabProps: TabProps = {
    contract, escrow, blockchainEvents, userRole, deposited, released, escrowPct, id, exposure,
    approvingId, rejectingId, rejectReason, showRejectForm,
    setShowRejectForm, setRejectReason, handleApprove, handleReject,
    poolStatus, setPoolStatus, poolLoading, setPoolLoading,
    refresh, getAuthToken,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back */}
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
              {contract.title}
            </h1>
            <StatusBadge status={contract.status as "draft" | "active" | "completed" | "disputed"} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              Agency:{" "}
              {userRole === "agency" ? (
                <Link href={`/agency/${contract.agency}`} className="font-semibold text-accent hover:underline">You</Link>
              ) : (
                <Link href={`/agency/${contract.agency}`} className="font-semibold text-foreground hover:text-accent transition-colors">{truncateMiddle(contract.agency, 6, 4)}</Link>
              )}
              {agencyVerification?.verified && agencyVerification.easScanUrl && (
                <a
                  href={agencyVerification.easScanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-semibold hover:bg-success/20 transition-colors"
                  title="Verified on EAS"
                >
                  <BadgeCheck className="h-3 w-3" /> Verified
                </a>
              )}
            </span>
            {userRole !== "investor" && userRole !== "public" && (
              <>
                <span className="w-px h-3 bg-border" />
                <span>
                  Client:{" "}
                  <span className={`font-semibold ${userRole === "client" ? "text-accent" : "text-foreground"}`}>
                    {userRole === "client" ? "You" : truncateMiddle(contract.client, 6, 4)}
                  </span>
                </span>
              </>
            )}
            {userRole === "investor" && (
              <>
                <span className="w-px h-3 bg-border" />
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <Eye className="h-3 w-3" /> Viewing as investor
                </span>
              </>
            )}
          </div>
        </div>
        {userRole === "agency" && contract.status === "active" && !isTokenized && (
          <Link
            href={`/contracts/${id}/tokenize`}
            className="shrink-0 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-brand-foreground text-sm font-semibold shadow-md shadow-brand/20 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Coins className="h-4 w-4" /> Tokenize
          </Link>
        )}
        {isTokenized && (
          <Link
            href={`/marketplace/${id}`}
            className="shrink-0 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-surface-secondary text-accent text-sm font-semibold border border-border/60 hover:bg-default active:scale-[0.98] transition-all"
          >
            <ExternalLink className="h-4 w-4" /> View Deal
          </Link>
        )}
      </div>

      {/* Action error */}
      <AnimatePresence>
        {actionError && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mb-6">
            <div className="flex items-center gap-3 p-4 rounded-xl border border-danger/30 bg-danger/5 text-sm text-danger font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {actionError}
              <button onClick={() => setActionError(null)} className="ml-auto text-danger/60 hover:text-danger">
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Contract completion banner ─────────────────────────────────────── */}
      {contract.status === "completed" && (
        <div className="p-4 rounded-xl bg-success/10 border border-success/20 flex items-center gap-3 mb-6">
          <CheckCircle className="h-6 w-6 text-success shrink-0" />
          <div>
            <p className="font-semibold text-success">Contract Complete</p>
            <p className="text-sm text-success/80">All milestones approved. Funds released to agency.</p>
          </div>
          {userRole === "agency" && !contract.tokenizationExposure && (
            <Link href={`/contracts/${id}/tokenize`} className="ml-auto shrink-0">
              <Button size="sm" className="bg-accent text-accent-foreground">Tokenize</Button>
            </Link>
          )}
        </div>
      )}

      {/* ── Contract lifecycle progress bar ────────────────────────────────── */}
      {contract.status !== "cancelled" && (
        <div className="mb-6">
          {(() => {
            const steps = ["Draft", "Deposit", "Active", "Completed"];
            const statusToStep: Record<string, number> = {
              draft: 0, invited: 0, pending_deposit: 1, active: 2, completed: 3, disputed: 2,
            };
            const currentStep = statusToStep[contract.status] ?? 0;
            const isDisputed = contract.status === "disputed";
            return (
              <div className="flex items-center gap-0">
                {steps.map((label, i) => {
                  const isDone = i < currentStep;
                  const isActive = i === currentStep;
                  const isLast = i === steps.length - 1;
                  return (
                    <div key={label} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center flex-1 min-w-0">
                        <div className={`h-2 w-full rounded-full ${
                          isDone ? "bg-success"
                          : isActive ? (isDisputed ? "bg-danger" : "bg-accent")
                          : "bg-border"
                        }`} />
                        <span className={`text-xs mt-1 font-medium ${
                          isDone ? "text-success"
                          : isActive ? (isDisputed ? "text-danger" : "text-accent")
                          : "text-muted"
                        }`}>
                          {isActive && isDisputed && label === "Active" ? "Disputed" : label}
                        </span>
                      </div>
                      {!isLast && <div className="w-2 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Phase banner */}
      {contract.status !== "completed" && contract.status !== "cancelled" && (
        <div className={`p-4 rounded-xl flex items-center gap-3 mb-6 text-sm ${
          contract.status === "disputed" ? "bg-danger/10 border border-danger/20 text-danger" :
          contract.status === "active" ? "bg-accent/10 border border-accent/20 text-accent" :
          contract.status === "pending_deposit" ? "bg-warning/10 border border-warning/20 text-warning" :
          contract.status === "invited" ? "bg-info/10 border border-info/20 text-info" :
          "bg-surface-secondary border border-border text-muted"
        }`}>
          {(contract.status === "draft" || contract.status === "invited") && contract.inviteToken && userRole === "agency" && (
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 shrink-0" />
                <span>
                  {contract.inviteEmail
                    ? <>Invitation sent to <strong>{contract.inviteEmail}</strong>. Waiting for them to join.</>
                    : <>Share this link with your client to join the contract.</>
                  }
                </span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
                <code className="text-xs font-mono flex-1 truncate select-all">
                  {typeof window !== "undefined" ? `${window.location.origin}/contracts/invite/${contract.inviteToken}` : ""}
                </code>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/contracts/invite/${contract.inviteToken}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Invite link copied!");
                  }}
                  className="shrink-0 px-2 py-1 rounded text-xs font-medium bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
          {contract.status === "pending_deposit" && userRole === "client" && (
            <>
              <Wallet className="h-5 w-5 shrink-0" />
              <span>Deposit escrow to activate this contract. <Link href={`/contracts/${id}/deposit`} className="underline font-semibold">Deposit now</Link></span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto border-danger text-danger"
                onPress={async () => {
                  if (!confirm("Are you sure? This will cancel the contract and refund remaining escrow.")) return;
                  try {
                    await getAuthToken();
                    await postApi(`/api/contracts/${id}/refund`, {});
                    toast.success("Contract cancelled and refund initiated");
                    refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Cancellation failed");
                  }
                }}
              >
                Cancel & Refund
              </Button>
            </>
          )}
          {contract.status === "pending_deposit" && userRole !== "client" && (
            <><Clock className="h-5 w-5 shrink-0" /><span>Waiting for client to deposit escrow.</span></>
          )}
          {contract.status === "active" && (
            <>
              <CheckCircle className="h-5 w-5 shrink-0" />
              <span>Contract is active. {contract.milestones.filter(m => m.status === "pending").length} milestone{contract.milestones.filter(m => m.status === "pending").length !== 1 ? "s" : ""} pending.</span>
              {userRole === "client" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto border-danger text-danger"
                  onPress={async () => {
                    if (!confirm("Are you sure? This will cancel the contract and refund remaining escrow.")) return;
                    try {
                      await getAuthToken();
                      await postApi(`/api/contracts/${id}/refund`, {});
                      toast.success("Contract cancelled and refund initiated");
                      refresh();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Cancellation failed");
                    }
                  }}
                >
                  Cancel & Refund
                </Button>
              )}
            </>
          )}
          {contract.status === "disputed" && (
            <><AlertTriangle className="h-5 w-5 shrink-0" /><span>Dispute in progress. <Link href={`/contracts/${id}/dispute`} className="underline font-semibold">View dispute</Link></span></>
          )}
          {contract.status === "failed" && (
            <>
              <XCircle className="h-5 w-5 shrink-0" />
              <span>Contract failed. Escrow refundable.</span>
              {userRole === "client" && (
                <Button
                  size="sm"
                  className="ml-auto bg-danger text-danger-foreground"
                  onPress={async () => {
                    try {
                      await getAuthToken();
                      await postApi(`/api/contracts/${id}/refund`, {});
                      toast.success("Refund initiated");
                      refresh();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Refund failed");
                    }
                  }}
                >
                  Request Refund
                </Button>
              )}
            </>
          )}
          {(contract.status === "draft") && (
            <><Clock className="h-5 w-5 shrink-0" /><span>Contract created. Waiting for counterparty.</span></>
          )}
        </div>
      )}

      {userRole !== "public" ? (
        <div className="grid lg:grid-cols-[1fr_300px] gap-6">
          {/* ── Main content with tabs ─────────────────────────────────────── */}
          <div className="min-w-0">
            {/* Tab bar */}
            <div className="flex border-b border-border mb-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                    currentTab === tab.id
                      ? "border-accent text-accent"
                      : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {currentTab === "overview" && <OverviewTab {...tabProps} />}
            {currentTab === "milestones" && <MilestonesTab {...tabProps} />}
            {currentTab === "tokenization" && <TokenizationTab {...tabProps} />}
            {currentTab === "activity" && <ActivityTab {...tabProps} />}
          </div>

          {/* ── Sidebar ───────────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Quick actions — only for agency/client */}
            {(userRole === "agency" || userRole === "client") && (
              <Card className="border border-border bg-surface rounded-xl shadow-sm sticky top-6">
                <CardHeader className="px-5 pt-5 pb-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">Quick Actions</p>
                </CardHeader>
                <CardContent className="px-5 pb-5 flex flex-col gap-2">
                  {userRole === "client" && deposited < contract.totalValue && (
                    <Link
                      href={`/contracts/${id}/deposit`}
                      className="flex items-center justify-center h-9 rounded-lg bg-accent text-accent-foreground text-sm font-semibold shadow-sm shadow-accent/20 hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                      Deposit Escrow
                    </Link>
                  )}
                  {userRole === "agency" && (
                    <Link
                      href={`/contracts/${id}/deliver`}
                      className="flex items-center justify-center h-9 rounded-lg bg-accent text-accent-foreground text-sm font-semibold shadow-sm shadow-accent/20 hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                      Submit Deliverable
                    </Link>
                  )}
                  {userRole === "agency" && contract.status === "active" && !isTokenized && (
                    <div className="space-y-1.5">
                      <Link
                        href={`/contracts/${id}/tokenize`}
                        className="flex items-center justify-center h-9 rounded-lg bg-brand/10 text-brand text-sm font-semibold hover:bg-brand/20 active:scale-[0.98] transition-all"
                      >
                        Tokenize Contract
                      </Link>
                      <p className="text-[11px] text-muted text-center leading-snug">
                        Open this contract for investor participation. Set your price and let investors buy tokens.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Role indicator */}
            <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface-secondary text-xs text-muted">
              {userRole === "agency" && (
                <><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><p>You are the agency delivering this contract.</p></>
              )}
              {userRole === "client" && (
                <><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><p>You are the client. Only you and the agency can see contract details.</p></>
              )}
              {userRole === "investor" && (
                <><Eye className="h-4 w-4 shrink-0 mt-0.5" /><p>You are viewing as an investor. Some details may be hidden by the agency.</p></>
              )}
            </div>

            {/* Condensed contract value card */}
            <Card className="border border-border bg-surface rounded-xl shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted font-medium">Contract Value</span>
                  <span className="font-bold">{formatCurrency(contract.totalValue)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted font-medium">Status</span>
                  <StatusBadge status={contract.status as "draft" | "active" | "completed" | "disputed"} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="col-span-full">
          <Card className="border border-border rounded-xl p-8 text-center">
            <Eye className="h-12 w-12 mx-auto text-muted mb-4" />
            <h3 className="text-lg font-bold mb-2">Contract Preview</h3>
            <p className="text-muted text-sm mb-1">
              {contract.milestones.filter(m => m.status === "approved").length}/{contract.milestones.length} milestones completed
            </p>
            <p className="text-muted text-sm mb-6">Total value: {formatCurrency(contract.totalValue)}</p>
            <Button onPress={() => login()} className="bg-accent text-accent-foreground">
              Sign in to view full details
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
