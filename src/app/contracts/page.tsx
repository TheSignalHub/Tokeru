"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { FileText, PlusCircle, Loader2, Search } from "lucide-react";
import { useContracts } from "@/hooks/use-contracts";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import type { ServiceContract } from "@/lib/types";

const STATUS_TABS = ["all", "draft", "active", "completed", "disputed"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

function tabLabel(tab: StatusTab): string {
  return tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1);
}

function getUserRole(contract: ServiceContract, walletAddress: string): string {
  const addr = walletAddress.toLowerCase();
  if (contract.agency.toLowerCase() === addr) return "Agency";
  if (contract.client.toLowerCase() === addr) return "Client";
  if (contract.bd?.toLowerCase() === addr) return "BD";
  return "Party";
}

function getProgress(contract: ServiceContract): string {
  const total = contract.milestones.length;
  if (total === 0) return "0/0";
  const approved = contract.milestones.filter((m) => m.status === "approved").length;
  return `${approved}/${total}`;
}

function formatDate(date: string | Date | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatValue(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function ContractsPage() {
  const { walletAddress } = useAuth();
  const { contracts, loading, error } = useContracts();
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = contracts;
    if (activeTab !== "all") {
      list = list.filter((c) => c.status === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [contracts, activeTab, search]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 mb-8">
        <PageHeader
          title="Contracts"
          description="Manage all your service contracts in one place."
        />
        <Link
          href="/contracts/new"
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/85 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          New Contract
        </Link>
      </div>

      {/* Search + status tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search contracts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-md bg-surface-secondary border border-border/40 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition-colors"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-foreground hover:bg-surface-secondary"
              }`}
            >
              {tabLabel(tab)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
        </div>
      ) : error ? (
        <SectionCard>
          <p className="text-danger text-sm">{error}</p>
        </SectionCard>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted mb-3" />
            <p className="text-muted text-sm">
              {contracts.length === 0
                ? "No contracts yet -- create your first one."
                : "No contracts match the current filter."}
            </p>
            {contracts.length === 0 && (
              <Link
                href="/contracts/new"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/85 transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
                Create Contract
              </Link>
            )}
          </div>
        </SectionCard>
      ) : (
        <SectionCard>
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_0.8fr] gap-4 px-4 pb-2 border-b border-border/40 text-xs font-medium text-muted uppercase tracking-wide">
            <span>Title</span>
            <span>Role</span>
            <span>Value</span>
            <span>Status</span>
            <span>Created</span>
            <span>Progress</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/30">
            {filtered.map((c) => (
              <Link
                key={c.id}
                href={`/contracts/${c.id}`}
                className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_0.8fr] gap-2 md:gap-4 px-4 py-3 hover:bg-surface-secondary/60 transition-colors rounded-md"
              >
                <span className="font-medium text-sm truncate">{c.title}</span>
                <span className="text-sm text-muted">
                  {walletAddress ? getUserRole(c, walletAddress) : "-"}
                </span>
                <span className="text-sm">{formatValue(c.totalValue)}</span>
                <span>
                  <StatusBadge status={c.status} />
                </span>
                <span className="text-sm text-muted">{formatDate(c.createdAt)}</span>
                <span className="text-sm text-muted">{getProgress(c)}</span>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
