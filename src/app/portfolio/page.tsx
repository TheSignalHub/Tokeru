"use client";

import { useAuth } from "@/hooks/use-auth";
import { useApi } from "@/hooks/use-api";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui";
import { TrendingUp, Store } from "lucide-react";
import Link from "next/link";
import { Spinner } from "@heroui/react";

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

export default function PortfolioPage() {
  const { walletAddress, authenticated } = useAuth();
  const { data: holdings, loading } = useApi<Holding[]>(
    walletAddress ? `/api/users/${walletAddress}/holdings` : null,
  );

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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader title="Portfolio" description="Your contract token investments" />

      {items.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-10 w-10" />}
          title="No investments yet"
          description="Buy contract tokens on the marketplace to start earning yield."
          action={
            <Link href="/marketplace" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground font-medium">
              <Store className="h-4 w-4" /> Browse Marketplace
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-6 p-4 rounded-lg bg-surface border border-border">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Total Portfolio Value</p>
            <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
            <p className={`text-sm ${totalPnl >= 0 ? "text-success" : "text-danger"}`}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} ({totalCost > 0 ? ((totalPnl / totalCost) * 100).toFixed(1) : "0"}%)
            </p>
          </div>
          <SectionCard>
            <div className="divide-y divide-border/50 -mx-6 -mb-4">
              {items.map((h, i) => {
                const value = h.amount * h.currentPrice;
                return (
                  <Link key={i} href={`/marketplace/${h.contractId}`} className="flex items-center justify-between px-6 py-4 hover:bg-surface-secondary transition-colors">
                    <div>
                      <p className="font-medium text-sm">{h.tokenName}</p>
                      <p className="text-xs text-muted">{h.amount} tokens @ ${h.buyPrice.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">${value.toFixed(2)}</p>
                      <p className={`text-xs ${h.pnl >= 0 ? "text-success" : "text-danger"}`}>
                        {h.pnl >= 0 ? "+" : ""}{h.pnlPct}%
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
