"use client";
import { getRiskTier } from "@/lib/scoring";

const COLORS = {
  low: "bg-success/15 text-success border-success/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  high: "bg-danger/15 text-danger border-danger/30",
};

export function RiskTierBadge({ score }: { score: number | null }) {
  const tier = getRiskTier(score ?? 0);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${COLORS[tier.level]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {tier.label}
    </span>
  );
}
