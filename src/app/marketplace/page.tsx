"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  SlidersHorizontal,
  Store,
  CheckCircle,
  TrendingUp,
  Clock,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import { useMarketplace, type MarketplaceListing } from "@/hooks/use-marketplace";
import {
  Card,
  CardContent,
  Button,
  Chip,
  Spinner,
  SearchField,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
} from "@heroui/react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils/format";
import { RiskTierBadge } from "@/components/ui/risk-tier-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getRiskTier } from "@/lib/scoring";

// ── Local display type ────────────────────────────────────────────────────────
type ActiveListing = {
  id: string;
  title: string;
  category: string;
  agencyName: string;
  agencyAddress: string;
  agencyVerified: boolean;
  agencyScore: number | null;
  score: number;
  totalValue: number;
  value: string;
  tokenPrice: string;
  pricePerToken: number;
  totalSupply: number;
  completedMilestones: number;
  totalMilestones: number;
  progress: number;
  expectedReturn: number;
};

// ── Animation variants ────────────────────────────────────────────────────────
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 220, damping: 22 },
  },
};

const CATEGORIES = [
  "All Categories",
  "Development",
  "Design",
  "Marketing",
  "Legal",
];
const RISK_FILTERS = [
  { label: "All Risk", value: "all" },
  { label: "Low Risk", value: "low" },
  { label: "Medium Risk", value: "medium" },
  { label: "High Risk", value: "high" },
];

// ── Sort ──────────────────────────────────────────────────────────────────────
type SortOption = "default" | "score" | "value" | "progress" | "return";
const SORT_CYCLE: SortOption[] = [
  "default",
  "score",
  "value",
  "progress",
  "return",
];
const SORT_LABELS: Record<SortOption, string> = {
  default: "Sort",
  score: "Score",
  value: "Value",
  progress: "Progress",
  return: "Return",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [riskFilter, setRiskFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  const { listings, loading } = useMarketplace();

  const activeData = useMemo<ActiveListing[]>(() => {
    return listings.map((c: MarketplaceListing): ActiveListing => {
      const price = c.pricePerToken ?? 1;
      const supply = c.totalSupply ?? c.totalValue;
      const ret = price > 0 ? ((1 / price - 1) * 100) : 0;
      return {
        id: c.tokenId,
        title: c.title,
        category:
          c.category.charAt(0).toUpperCase() + c.category.slice(1),
        agencyName: c.agency.name ?? "Unknown Agency",
        agencyAddress: c.agency.address,
        agencyVerified: c.agency.verified,
        agencyScore: c.agency.score,
        score: c.avgScore ?? 0,
        totalValue: c.totalValue,
        value: formatCurrency(c.totalValue),
        tokenPrice: formatCurrency(price, "$"),
        pricePerToken: price,
        totalSupply: supply,
        completedMilestones: c.completedMilestones,
        totalMilestones: c.totalMilestones,
        progress: Math.round(
          (c.completedMilestones / Math.max(c.totalMilestones, 1)) * 100,
        ),
        expectedReturn: ret,
      };
    });
  }, [listings]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const result = activeData.filter((c) => {
      if (category !== "All Categories" && c.category !== category)
        return false;
      if (
        riskFilter !== "all" &&
        getRiskTier(c.agencyScore ?? 0).level !== riskFilter
      )
        return false;
      if (
        q &&
        !c.title.toLowerCase().includes(q) &&
        !c.agencyName.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
    if (sortBy === "score") result.sort((a, b) => b.score - a.score);
    else if (sortBy === "value")
      result.sort(
        (a, b) =>
          parseFloat(b.value.replace(/[$,]/g, "")) -
          parseFloat(a.value.replace(/[$,]/g, "")),
      );
    else if (sortBy === "progress")
      result.sort((a, b) => b.progress - a.progress);
    else if (sortBy === "return")
      result
        .sort(
          (a, b) => (1 / a.pricePerToken - 1 - (1 / b.pricePerToken - 1)),
        )
        .reverse();
    return result;
  }, [search, category, riskFilter, sortBy, activeData]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /** Estimated duration in days based on total milestones */
  function estimatedDuration(totalMilestones: number): string {
    const days = totalMilestones * 30;
    return `${days} days`;
  }

  /** Remaining tokens for display */
  function remainingTokens(c: ActiveListing): string {
    const remaining = Math.round(
      c.totalSupply * (1 - c.progress / 100),
    );
    return remaining.toLocaleString();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Page header */}
      <div className="mb-10 text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          Contract <span className="text-accent">Marketplace</span>
        </h1>
        <p className="text-muted text-base leading-relaxed">
          Browse tokenized service contracts. Fixed returns backed by on-chain
          escrow.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-8 bg-surface border border-border rounded-xl p-3 shadow-sm">
        {/* Search */}
        <div className="flex-1">
          <SearchField
            aria-label="Search contracts"
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            className="w-full"
          >
            <SearchField.Group className="bg-surface-secondary border border-border rounded-lg px-3 py-2 focus-within:border-accent transition-colors">
              <SearchField.SearchIcon className="h-4 w-4 text-muted shrink-0" />
              <SearchField.Input
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
                placeholder="Search contracts or agencies..."
              />
              <SearchField.ClearButton className="text-muted hover:text-foreground" />
            </SearchField.Group>
          </SearchField>
        </div>

        {/* Category */}
        <Select
          aria-label="Category"
          selectedKey={category}
          onSelectionChange={(key) => {
            setCategory(key as string);
            setPage(1);
          }}
        >
          <SelectTrigger className="bg-surface-secondary border border-border text-foreground text-sm rounded-lg px-3 py-2 outline-none hover:border-accent/50 focus:border-accent transition-colors min-w-[160px] flex items-center justify-between gap-2">
            <SelectValue />
            <SelectIndicator />
          </SelectTrigger>
          <SelectPopover className="bg-surface border border-border rounded-lg shadow-lg">
            <ListBox className="p-1 outline-none">
              {CATEGORIES.map((c) => (
                <ListBox.Item
                  key={c}
                  id={c}
                  className="px-3 py-2 text-sm rounded cursor-pointer hover:bg-surface-secondary outline-none focus:bg-surface-secondary selected:bg-accent/10 selected:text-accent"
                >
                  {c}
                </ListBox.Item>
              ))}
            </ListBox>
          </SelectPopover>
        </Select>

        {/* Risk Tier */}
        <Select
          aria-label="Risk tier"
          selectedKey={riskFilter}
          onSelectionChange={(key) => {
            setRiskFilter(key as string);
            setPage(1);
          }}
        >
          <SelectTrigger className="bg-surface-secondary border border-border text-foreground text-sm rounded-lg px-3 py-2 outline-none hover:border-accent/50 focus:border-accent transition-colors min-w-[140px] flex items-center justify-between gap-2">
            <SelectValue />
            <SelectIndicator />
          </SelectTrigger>
          <SelectPopover className="bg-surface border border-border rounded-lg shadow-lg">
            <ListBox className="p-1 outline-none">
              {RISK_FILTERS.map((f) => (
                <ListBox.Item
                  key={f.value}
                  id={f.value}
                  className="px-3 py-2 text-sm rounded cursor-pointer hover:bg-surface-secondary outline-none focus:bg-surface-secondary selected:bg-accent/10 selected:text-accent"
                >
                  {f.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </SelectPopover>
        </Select>

        <Button
          variant="secondary"
          className="shrink-0 gap-2"
          onPress={() => {
            const idx = SORT_CYCLE.indexOf(sortBy);
            setSortBy(SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]);
            setPage(1);
          }}
        >
          <ArrowUpDown className="h-4 w-4" /> {SORT_LABELS[sortBy]}
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" className="text-accent" />
        </div>
      )}

      {/* Grid */}
      {!loading && (
        <>
          {activeData.length === 0 ? (
            <EmptyState
              icon={<Store className="h-12 w-12" />}
              title="No contracts tokenized yet"
              description="No contracts tokenized yet. Be the first agency to tokenize."
              action={
                <Link
                  href="/contracts/new"
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium shadow-sm active:scale-[0.98] transition-all"
                >
                  Create Contract
                </Link>
              }
            />
          ) : (
            <>
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                initial="hidden"
                animate="show"
                variants={container}
              >
                {paged.map((c) => (
                  <motion.div key={c.id} variants={item}>
                    <Link
                      href={`/marketplace/${c.id}`}
                      className="block h-full group outline-none"
                    >
                      <Card className="h-full flex flex-col bg-surface border border-border rounded-xl shadow-sm hover:border-accent/40 hover:shadow-[0_8px_28px_rgba(var(--accent-rgb,99,102,241),0.12)] hover:-translate-y-0.5 transition-all duration-300">
                        <CardContent className="flex flex-col flex-1 gap-5 p-5">
                          {/* Top row: category + risk */}
                          <div className="flex items-center justify-between gap-2">
                            <Chip
                              size="sm"
                              variant="soft"
                              className="text-xs font-semibold shrink-0"
                            >
                              {c.category}
                            </Chip>
                            <RiskTierBadge score={c.agencyScore} />
                          </div>

                          {/* Title + agency */}
                          <div>
                            <h3 className="font-bold text-base leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                              {c.title}
                            </h3>
                            <p className="text-xs text-muted mt-1.5 truncate flex items-center gap-1">
                              by{" "}
                              <span
                                className="font-semibold text-foreground"
                              >
                                {c.agencyName}
                              </span>
                              {c.agencyVerified && (
                                <CheckCircle className="h-3 w-3 text-success shrink-0" />
                              )}
                            </p>
                          </div>

                          {/* 3 metric boxes */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col items-center p-3 rounded-lg bg-surface-secondary">
                              <TrendingUp className="h-3.5 w-3.5 text-success mb-1" />
                              <span className="text-sm font-bold text-success">
                                {c.expectedReturn > 0
                                  ? `+${c.expectedReturn.toFixed(1)}%`
                                  : "0%"}
                              </span>
                              <span className="text-[10px] text-muted mt-0.5">
                                Return
                              </span>
                            </div>
                            <div className="flex flex-col items-center p-3 rounded-lg bg-surface-secondary">
                              <Clock className="h-3.5 w-3.5 text-muted mb-1" />
                              <span className="text-sm font-bold text-foreground">
                                {estimatedDuration(c.totalMilestones)}
                              </span>
                              <span className="text-[10px] text-muted mt-0.5">
                                Duration
                              </span>
                            </div>
                            <div className="flex flex-col items-center p-3 rounded-lg bg-surface-secondary">
                              <DollarSign className="h-3.5 w-3.5 text-muted mb-1" />
                              <span className="text-sm font-bold text-foreground">
                                {c.value}
                              </span>
                              <span className="text-[10px] text-muted mt-0.5">
                                Value
                              </span>
                            </div>
                          </div>

                          {/* Milestone progress bar */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-muted">
                              <span>Milestones</span>
                              <span className="tabular-nums">
                                {c.completedMilestones}/{c.totalMilestones}{" "}
                                complete
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-surface-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-accent transition-all duration-500"
                                style={{ width: `${c.progress}%` }}
                              />
                            </div>
                          </div>

                          {/* Price + remaining */}
                          <p className="text-xs text-muted">
                            <span className="font-medium text-foreground">
                              {c.tokenPrice}
                            </span>
                            /token{" "}
                            <span className="mx-1 text-border">|</span>{" "}
                            {remainingTokens(c)} remaining
                          </p>

                          {/* CTA */}
                          <div className="mt-auto pt-3 border-t border-border/60">
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent group-hover:gap-2.5 transition-all">
                              View Deal
                              <ArrowRight className="h-4 w-4" />
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>

              {/* Empty filter state */}
              {filtered.length === 0 && (
                <div className="text-center py-20 space-y-4">
                  <SlidersHorizontal className="h-10 w-10 text-muted mx-auto" />
                  <p className="text-muted font-medium">
                    No contracts match your filters.
                  </p>
                  <Button
                    variant="ghost"
                    onPress={() => {
                      setSearch("");
                      setCategory("All Categories");
                      setRiskFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              )}

              {/* Pagination */}
              {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-10 bg-surface border border-border rounded-xl px-4 py-3">
                  <Button
                    variant="ghost"
                    isDisabled={page <= 1}
                    onPress={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted tabular-nums">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    isDisabled={page >= totalPages}
                    onPress={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
