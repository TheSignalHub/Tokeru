"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useApi, postApi } from "@/hooks/use-api";
import { PageHeader, SectionCard, EmptyState, StatusBadge, LabeledProgress } from "@/components/ui";
import { TrendingUp, Store, DollarSign, Target, BarChart3, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button, Input, Spinner } from "@heroui/react";
import { toast } from "sonner";

interface Holding {
  tokenAddress: string;
  contractId: string;
  contractTitle: string;
  tokenName: string;
  agencyName?: string;
  status: string;
  amount: number;
  buyPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  yieldPct: number;
  purchasedAt?: string;
  milestoneProgress: number;
  completedMilestones: number;
  totalMilestones: number;
  projectedValue: number;
  investedValue: number;
}

interface SellResponse {
  success: boolean;
  amount: number;
  salePrice: number;
  totalReceived: number;
  contractCompleted: boolean;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function holdingStatusLabel(status: string): string {
  if (status === "completed") return "claimable";
  if (status === "active") return "active";
  return status;
}

export default function PortfolioPage() {
  const { walletAddress, authenticated } = useAuth();
  const { data: holdings, loading, refresh } = useApi<Holding[]>(
    walletAddress ? `/api/users/${walletAddress}/holdings` : null,
  );

  const [sellFormOpen, setSellFormOpen] = useState<string | null>(null);
  const [sellAmount, setSellAmount] = useState("");
  const [selling, setSelling] = useState(false);

  if (!authenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <PageHeader title="Portfolio" description="Your token investments" />
        <EmptyState icon={<TrendingUp className="h-10 w-10" />} title="Sign in to view your portfolio" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <PageHeader title="Portfolio" description="Your contract token investments" />
        <div className="flex justify-center py-20">
          <Spinner className="text-accent" />
        </div>
      </div>
    );
  }

  const items = holdings ?? [];

  // Portfolio summary calculations
  const totalInvested = items.reduce((sum, h) => sum + h.investedValue, 0);
  const totalProjected = items.reduce((sum, h) => sum + h.projectedValue, 0);
  const totalReturn = totalProjected - totalInvested;
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  const activeContracts = items.filter((h) => h.status === "active").length;
  const claimableContracts = items.filter((h) => h.status === "completed").length;
  const avgProgress = items.length > 0
    ? items.reduce((sum, h) => sum + h.milestoneProgress, 0) / items.length
    : 0;

  async function handleSell(contractId: string, maxAmount: number) {
    const parsed = parseFloat(sellAmount);
    if (!parsed || parsed <= 0 || parsed > maxAmount) {
      toast.error(`Enter a valid amount between 1 and ${maxAmount}`);
      return;
    }

    setSelling(true);
    try {
      const result = await postApi<SellResponse>(
        `/api/marketplace/${contractId}/sell`,
        { amount: parsed },
      );
      toast.success(
        `Sold ${result.amount} tokens at $${result.salePrice.toFixed(2)}/token ($${result.totalReceived.toFixed(2)} total)`,
      );
      setSellFormOpen(null);
      setSellAmount("");
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sale failed";
      toast.error(msg);
    } finally {
      setSelling(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader title="Portfolio" description="Your contract token investments" />

      {items.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-10 w-10" />}
          title="No investments yet"
          description="Browse the marketplace to find opportunities and start earning returns when milestones complete."
          action={
            <Link href="/marketplace" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground font-medium">
              <Store className="h-4 w-4" /> Browse Marketplace
            </Link>
          }
        />
      ) : (
        <>
          {/* Portfolio Summary */}
          <SectionCard>
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Portfolio Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                <div className="flex items-start gap-2">
                  <DollarSign className="h-4 w-4 text-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted">Total Invested</p>
                    <p className="text-sm font-bold">${totalInvested.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted">Projected Value</p>
                    <p className="text-sm font-bold">
                      ${totalProjected.toFixed(2)}
                      <span className="text-success ml-1 text-xs font-medium">(+${totalReturn.toFixed(2)})</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted">Expected Return</p>
                    <p className="text-sm font-bold text-success">+{totalReturnPct.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <BarChart3 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted">Active Contracts</p>
                    <p className="text-sm font-bold">{activeContracts}</p>
                  </div>
                </div>
                {claimableContracts > 0 && (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-muted">Completed</p>
                      <p className="text-sm font-bold text-success">{claimableContracts} (claimable)</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Average progress bar */}
              <div className="pt-2">
                <LabeledProgress
                  label="Avg Milestone Progress"
                  value={avgProgress * 100}
                  color="accent"
                />
              </div>
            </div>
          </SectionCard>

          {/* Holdings list */}
          <div className="mt-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted px-1">Your Holdings</h3>
            {items.map((h, i) => {
              const returnAmt = h.projectedValue - h.investedValue;
              const returnPct = h.investedValue > 0 ? (returnAmt / h.investedValue) * 100 : 0;
              const isOpen = sellFormOpen === h.contractId;
              const displayStatus = holdingStatusLabel(h.status);

              return (
                <SectionCard key={i}>
                  <div className="space-y-3">
                    {/* Header: token name, agency, status, time */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/marketplace/${h.contractId}`} className="hover:text-accent transition-colors">
                          <p className="font-semibold text-sm">{h.tokenName}</p>
                        </Link>
                        {h.agencyName && (
                          <p className="text-xs text-muted">{h.agencyName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {h.purchasedAt && (
                          <span className="text-xs text-muted">{timeAgo(h.purchasedAt)}</span>
                        )}
                        <StatusBadge status={displayStatus} />
                      </div>
                    </div>

                    {/* Investment details row */}
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted">Invested</p>
                        <p className="font-medium">${h.investedValue.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">Projected</p>
                        <p className="font-medium">${h.projectedValue.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">Return</p>
                        <p className="font-medium text-success">
                          +${returnAmt.toFixed(2)} (+{returnPct.toFixed(1)}%)
                        </p>
                      </div>
                    </div>

                    {/* Progress toward return bar */}
                    <div>
                      <div className="flex justify-between text-xs text-muted mb-1">
                        <span>
                          {h.completedMilestones}/{h.totalMilestones} milestones
                        </span>
                        <span>{Math.round(h.milestoneProgress * 100)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-500"
                          style={{ width: `${h.milestoneProgress * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Investment vs return visual bar */}
                    <div className="relative h-3 rounded-full overflow-hidden bg-surface-secondary">
                      <div
                        className="absolute inset-y-0 left-0 rounded-l-full bg-muted/30"
                        style={{ width: `${h.investedValue > 0 ? Math.min((h.investedValue / h.projectedValue) * 100, 100) : 0}%` }}
                      />
                      <div
                        className="absolute inset-y-0 right-0 rounded-r-full bg-success/40"
                        style={{ width: `${h.projectedValue > 0 ? Math.min((returnAmt / h.projectedValue) * 100, 100) : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted">
                      <span>${h.investedValue.toFixed(2)} cost</span>
                      <span className="text-success">+${returnAmt.toFixed(2)} return</span>
                    </div>

                    {/* Claim button for completed */}
                    {h.status === "completed" && (
                      <div>
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => {
                            if (isOpen) {
                              setSellFormOpen(null);
                              setSellAmount("");
                            } else {
                              setSellFormOpen(h.contractId);
                              setSellAmount("");
                            }
                          }}
                          className="text-xs border-success text-success w-full"
                        >
                          {isOpen ? "Cancel" : "Claim Tokens"}
                        </Button>
                      </div>
                    )}

                    {/* Claim form */}
                    {isOpen && (
                      <div className="space-y-3 pt-1">
                        <div className="p-3 rounded-lg bg-surface-secondary space-y-2">
                          <div className="flex justify-between text-xs text-muted">
                            <span>Available to claim</span>
                            <span>{h.amount} tokens</span>
                          </div>
                          <div className="flex justify-between text-xs text-muted">
                            <span>Sale price</span>
                            <span>${h.currentPrice.toFixed(2)}/token</span>
                          </div>
                          {sellAmount && parseFloat(sellAmount) > 0 && (
                            <div className="flex justify-between text-xs font-medium pt-1 border-t border-border/50">
                              <span>Estimated value</span>
                              <span>${(parseFloat(sellAmount) * h.currentPrice).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="1"
                            max={h.amount}
                            step="1"
                            placeholder={`Amount (max ${h.amount})`}
                            value={sellAmount}
                            onChange={(e) => setSellAmount(e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            size="sm"
                            onPress={() => handleSell(h.contractId, h.amount)}
                            isDisabled={selling || !sellAmount || parseFloat(sellAmount) <= 0}
                            className="bg-danger text-white"
                          >
                            {selling ? <Spinner size="sm" className="text-white" /> : "Claim $" + (parseFloat(sellAmount || "0") * 1).toFixed(2)}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </SectionCard>
              );
            })}
          </div>

          {/* Projected Returns Section */}
          <div className="mt-6">
            <SectionCard>
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Projected Returns</h3>
                <p className="text-sm text-muted">
                  If all contracts complete, you will earn{" "}
                  <span className="text-success font-semibold">+${totalReturn.toFixed(2)}</span>{" "}
                  total return on{" "}
                  <span className="font-semibold">${totalInvested.toFixed(2)}</span>{" "}
                  invested{" "}
                  <span className="text-success font-semibold">(+{totalReturnPct.toFixed(1)}%)</span>.
                </p>
                <div className="divide-y divide-border/50">
                  {items.map((h, i) => {
                    const returnAmt = h.projectedValue - h.investedValue;
                    const returnPct = h.investedValue > 0 ? (returnAmt / h.investedValue) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-muted">{h.tokenName}</span>
                        <span>
                          <span className="text-muted">${h.investedValue.toFixed(2)}</span>
                          <span className="mx-1.5 text-muted">-{">"}</span>
                          <span className="font-medium">${h.projectedValue.toFixed(2)}</span>
                          <span className="text-success ml-1.5 text-xs">(+{returnPct.toFixed(1)}%)</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
