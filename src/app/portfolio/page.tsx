"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useApi, postApi } from "@/hooks/use-api";
import { PageHeader, SectionCard, EmptyState, StatCard } from "@/components/ui";
import { TrendingUp, Store, CalendarClock } from "lucide-react";
import Link from "next/link";
import { Button, Input, Spinner } from "@heroui/react";
import { toast } from "sonner";

interface Holding {
  tokenAddress: string;
  contractId: string;
  contractTitle: string;
  tokenName: string;
  amount: number;
  buyPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
}

interface SellResponse {
  success: boolean;
  amount: number;
  salePrice: number;
  totalReceived: number;
  contractCompleted: boolean;
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
      <div className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
        <Spinner className="text-accent" />
      </div>
    );
  }

  const items = holdings ?? [];
  const totalValue = items.reduce((sum, h) => sum + h.amount * h.currentPrice, 0);
  const totalCost = items.reduce((sum, h) => sum + h.amount * h.buyPrice, 0);
  const totalPnl = totalValue - totalCost;
  const activeContracts = items.length;
  const avgReturn = totalCost > 0 ? ((totalPnl / totalCost) * 100) : 0;

  async function handleSell(contractId: string, maxAmount: number, buyPrice: number) {
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
          description="Buy contract tokens on the marketplace to start earning returns when milestones complete."
          action={
            <Link href="/marketplace" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground font-medium">
              <Store className="h-4 w-4" /> Browse Marketplace
            </Link>
          }
        />
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard value={`$${totalCost.toFixed(2)}`} label="Total Invested" />
            <StatCard value={`$${totalValue.toFixed(2)}`} label="Total Value" color={totalPnl >= 0 ? "success" : "danger"} />
            <StatCard value={activeContracts} label="Active Contracts" color="accent" />
            <StatCard
              value={`${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(1)}%`}
              label="Avg Return"
              color={avgReturn >= 0 ? "success" : "danger"}
            />
          </div>

          {/* Holdings list */}
          <SectionCard>
            <div className="divide-y divide-border/50 -mx-6 -mb-4">
              {items.map((h, i) => {
                const value = h.amount * h.currentPrice;
                const isOpen = sellFormOpen === h.contractId;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-surface-secondary transition-colors">
                      <Link href={`/marketplace/${h.contractId}`} className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{h.tokenName}</p>
                        <p className="text-xs text-muted">{h.amount} tokens at ${h.buyPrice.toFixed(2)}</p>
                      </Link>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-sm">${value.toFixed(2)}</p>
                          <p className={`text-xs ${h.pnl >= 0 ? "text-success" : "text-danger"}`}>
                            {h.pnl >= 0 ? "+" : ""}{h.pnlPct}%
                          </p>
                        </div>
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
                          className="text-xs border-border"
                        >
                          {isOpen ? "Cancel" : "Sell"}
                        </Button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-6 pb-4 space-y-3">
                        <div className="p-3 rounded-lg bg-surface-secondary space-y-2">
                          <div className="flex justify-between text-xs text-muted">
                            <span>Available to sell</span>
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
                            onPress={() => handleSell(h.contractId, h.amount, h.buyPrice)}
                            isDisabled={selling || !sellAmount || parseFloat(sellAmount) <= 0}
                            className="bg-danger text-white"
                          >
                            {selling ? <Spinner size="sm" className="text-white" /> : "Sell"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Upcoming Payouts section */}
          <div className="mt-6">
            <SectionCard>
              <div className="flex items-start gap-3">
                <CalendarClock className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-sm mb-1">Upcoming Payouts</h3>
                  <p className="text-sm text-muted">
                    Payouts are released as milestones are approved by clients.{" "}
                    <Link href="/marketplace" className="text-accent hover:underline font-medium">Learn more</Link>
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
