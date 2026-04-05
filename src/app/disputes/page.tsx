"use client";

import { useState } from "react";
import Link from "next/link";
import { Shield, CheckCircle, Clock, AlertTriangle, MessageCircle } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { Spinner } from "@heroui/react";
import { PageHeader } from "@/components/ui";
import type { Dispute, DisputePhase } from "@/lib/types";

interface EnrichedDispute extends Dispute {
  contractTitle: string;
  milestoneName: string;
}

type FilterTab = "all" | "discussion" | "evidence" | "kleros_payment" | "resolved";

const filterTabs: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "discussion", label: "Discussion" },
  { id: "evidence", label: "Evidence" },
  { id: "kleros_payment", label: "Payment" },
  { id: "resolved", label: "Resolved" },
];

function phaseIcon(phase: DisputePhase) {
  switch (phase) {
    case "resolved":
      return <CheckCircle className="h-4 w-4 text-success" />;
    case "discussion":
      return <MessageCircle className="h-4 w-4 text-accent" />;
    case "evidence":
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    default:
      return <Clock className="h-4 w-4 text-muted" />;
  }
}

function phaseLabel(phase: DisputePhase): string {
  switch (phase) {
    case "discussion": return "Discussion";
    case "evidence": return "Evidence";
    case "kleros_payment": return "Fee Payment";
    case "kleros_review": return "Under Review";
    case "resolved": return "Resolved";
    default: return phase;
  }
}

export default function DisputesPage() {
  const { data, loading: isLoading } = useApi<{ disputes: EnrichedDispute[] }>("/api/disputes");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const disputes = data?.disputes ?? [];

  const filtered = activeFilter === "all"
    ? disputes
    : disputes.filter((d) => {
        if (activeFilter === "resolved") return d.phase === "resolved";
        if (activeFilter === "kleros_payment") return d.phase === "kleros_payment" || d.phase === "kleros_review";
        return d.phase === activeFilter;
      });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title="Disputes"
        description="All disputes across your contracts"
      />

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-border/40 overflow-x-auto">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeFilter === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" className="text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-secondary p-12 text-center">
          <Shield className="h-12 w-12 text-success mx-auto mb-3" />
          <p className="text-lg font-semibold text-foreground mb-1">
            {activeFilter === "all" ? "No disputes -- that's great!" : "No disputes in this category"}
          </p>
          <p className="text-sm text-muted">
            {activeFilter === "all"
              ? "None of your contracts have active disputes."
              : "Try selecting a different filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <Link
              key={d.id}
              href={`/contracts/${d.contractId}/dispute`}
              className="block rounded-xl border border-border bg-surface p-4 hover:border-accent/40 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {d.contractTitle}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Milestone: {d.milestoneName}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {phaseIcon(d.phase)}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    d.phase === "resolved"
                      ? "bg-success/10 text-success"
                      : d.phase === "discussion"
                        ? "bg-accent/10 text-accent"
                        : "bg-warning/10 text-warning"
                  }`}>
                    {phaseLabel(d.phase)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted">
                <span>Initiated by {d.initiatedBy}</span>
                <span>{new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                <span>{d.evidence.length} evidence item{d.evidence.length !== 1 ? "s" : ""}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
