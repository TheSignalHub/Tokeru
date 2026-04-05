"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Clock,
  Shield,
  Users,
  ExternalLink,
  AlertCircle,
  TrendingUp,
  Lock,
  Briefcase,
  FileText,
  Building2,
  ShieldCheck,
  ArrowRight,
  Layers,
  ArrowLeftRight,
} from "lucide-react";
import { useTokenDetail } from "@/hooks/use-marketplace";
import { useApi, postApi } from "@/hooks/use-api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button, Input, Spinner } from "@heroui/react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LabeledProgress } from "@/components/ui/labeled-progress";
import { EmptyState } from "@/components/ui/empty-state";
import { RiskTierBadge } from "@/components/ui/risk-tier-badge";

interface BuyResponse {
  success: boolean;
  amount: number;
  pricePerToken: number;
  totalCost: number;
  tokenId: string;
  buyerAddress: string;
  txHash?: string;
}

interface SellResponse {
  success: boolean;
  amount: number;
  salePrice: number;
  totalReceived: number;
  contractCompleted: boolean;
}

interface TradeResponse {
  success: boolean;
  txHash: string;
  amountIn: string;
  amountOut: string;
  action: "buy" | "sell";
}

interface QuoteResponse {
  amountIn: string;
  estimatedOut: string;
  pricePerToken: number;
  poolExists: boolean;
}

interface HoldingItem {
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

type TabKey = "overview" | "milestones" | "agency" | "security";

const TAB_LABELS: Record<TabKey, { label: string; icon: React.ReactNode }> = {
  overview: {
    label: "Overview",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  milestones: {
    label: "Milestones",
    icon: <FileText className="h-4 w-4" />,
  },
  agency: { label: "Agency", icon: <Building2 className="h-4 w-4" /> },
  security: {
    label: "Security",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
};

export default function TokenDetailPage() {
  const params = useParams();
  const tokenId = params.tokenId as string;
  const { token: apiToken, loading } = useTokenDetail(tokenId);
  const { authenticated, walletAddress, login, getAuthToken } = useAuth();

  const [buyAmount, setBuyAmount] = useState("");
  const [buying, setBuying] = useState(false);
  const [buyResult, setBuyResult] = useState<BuyResponse | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [sellAmount, setSellAmount] = useState("");
  const [selling, setSelling] = useState(false);

  // Secondary market state
  const [tradeTab, setTradeTab] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [trading, setTrading] = useState(false);
  const [tradeQuote, setTradeQuote] = useState<QuoteResponse | null>(null);
  const [quotingTimer, setQuotingTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Fetch user holdings to show sell section
  const { data: userHoldings, refresh: refreshHoldings } = useApi<
    HoldingItem[]
  >(walletAddress ? `/api/users/${walletAddress}/holdings` : null);
  const myHolding = userHoldings?.find((h) => h.contractId === tokenId);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title=""
          backHref="/marketplace"
          backLabel="Back to Marketplace"
        />
        <div className="flex justify-center py-24">
          <Spinner size="lg" className="text-accent" />
        </div>
      </div>
    );
  }

  if (!apiToken) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title=""
          backHref="/marketplace"
          backLabel="Back to Marketplace"
        />
        <EmptyState
          icon={<AlertCircle className="h-12 w-12" />}
          title="Token not found"
          description="This token may have been removed or does not exist."
          action={
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium shadow-sm active:scale-[0.98] transition-all"
            >
              Back to Marketplace
            </Link>
          }
        />
      </div>
    );
  }

  const pricePerToken = apiToken.pricePerToken;
  const totalSupply = apiToken.totalSupply;
  const deployedOnChain = apiToken.deployedOnChain;
  const faceValuePerToken = 1.0;
  const parsedAmount = parseFloat(buyAmount) || 0;
  const totalCost = parsedAmount * pricePerToken;
  const faceValue = parsedAmount * faceValuePerToken;
  const yieldAmount = faceValue - totalCost;
  const yieldPercent =
    totalCost > 0 ? ((yieldAmount / totalCost) * 100).toFixed(1) : "0.0";
  const expectedReturnPct =
    pricePerToken > 0
      ? ((1 / pricePerToken - 1) * 100).toFixed(1)
      : "0.0";
  const marketCap = pricePerToken * totalSupply;
  const remainingTokens = Math.round(
    totalSupply * (1 - apiToken.progress / 100),
  );

  // Milestone payout calculations
  const totalPayouts =
    apiToken.milestones?.reduce((sum, m) => sum + m.amount, 0) ??
    apiToken.totalValue;
  const completedPayouts =
    apiToken.milestones
      ?.filter((m) => m.status === "approved")
      .reduce((sum, m) => sum + m.amount, 0) ?? 0;
  const remainingPayouts = totalPayouts - completedPayouts;

  async function handleBuy() {
    if (!buyAmount || parsedAmount <= 0) return;
    if (!walletAddress) return;

    setBuying(true);
    setBuyError(null);
    setBuyResult(null);

    try {
      const token = await getAuthToken();
      const result = await postApi<BuyResponse>(
        `/api/marketplace/${tokenId}/buy`,
        {
          amount: parsedAmount,
        },
      );
      setBuyResult(result);
      setBuyAmount("");
      toast.success("Purchase successful!");
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Purchase failed";
      if (msg.includes("Unauthorized")) {
        msg = "Please sign in to buy tokens.";
      } else if (msg.includes("address must match")) {
        msg = "Wallet address mismatch. Please reconnect your wallet.";
      }
      setBuyError(msg);
      toast.error(msg);
    } finally {
      setBuying(false);
    }
  }

  async function handleSell() {
    const parsed = parseFloat(sellAmount);
    if (!parsed || parsed <= 0) return;
    if (!walletAddress || !myHolding) return;
    if (parsed > myHolding.amount) {
      toast.error(`You only hold ${myHolding.amount} tokens`);
      return;
    }

    setSelling(true);
    try {
      const result = await postApi<SellResponse>(
        `/api/marketplace/${tokenId}/sell`,
        { amount: parsed },
      );
      toast.success(
        `Sold ${result.amount} tokens at $${result.salePrice.toFixed(2)}/token ($${result.totalReceived.toFixed(2)} total)`,
      );
      setSellAmount("");
      refreshHoldings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sale failed";
      toast.error(msg);
    } finally {
      setSelling(false);
    }
  }

  // Fetch quote when trade amount changes (debounced)
  function fetchQuote(action: "buy" | "sell", amount: string) {
    if (quotingTimer) clearTimeout(quotingTimer);
    const parsedAmt = parseFloat(amount);
    if (!parsedAmt || parsedAmt <= 0) {
      setTradeQuote(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/marketplace/${tokenId}/quote?action=${action}&amount=${parsedAmt}`,
        );
        if (res.ok) {
          const data: QuoteResponse = await res.json();
          setTradeQuote(data);
        }
      } catch {
        // ignore quote errors silently
      }
    }, 400);
    setQuotingTimer(timer);
  }

  async function handleTrade() {
    const parsedAmt = parseFloat(tradeAmount);
    if (!parsedAmt || parsedAmt <= 0) return;
    if (!walletAddress) return;

    setTrading(true);
    try {
      const token = await getAuthToken();
      const result = await postApi<TradeResponse>(
        `/api/marketplace/${tokenId}/trade`,
        { action: tradeTab, amount: parsedAmt },
      );
      toast.success(
        `${tradeTab === "buy" ? "Bought" : "Sold"} ~${result.amountOut} ${tradeTab === "buy" ? "tokens" : "USDC"} (tx: ${result.txHash.slice(0, 10)}...)`,
      );
      setTradeAmount("");
      setTradeQuote(null);
      refreshHoldings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Trade failed";
      toast.error(msg);
    } finally {
      setTrading(false);
    }
  }

  const agencyId = apiToken.agency.address;
  const agencyInitial = (apiToken.agency.name ?? "?")
    .charAt(0)
    .toUpperCase();
  const categoryLabel =
    apiToken.category.charAt(0).toUpperCase() + apiToken.category.slice(1);

  const baseScanBaseUrl = "https://sepolia.basescan.org";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title=""
        backHref="/marketplace"
        backLabel="Back to Marketplace"
      />

      <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        {/* -- Left Column -- */}
        <div className="space-y-6 min-w-0">
          {/* Deal Header */}
          <SectionCard>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs px-2.5 py-1 rounded-md bg-surface-secondary text-muted font-medium">
                {categoryLabel}
              </span>
              <RiskTierBadge score={apiToken.agency.score} />
              <StatusBadge status="approved" />
              {apiToken.agency.verified && (
                <span className="text-xs px-2.5 py-1 rounded-md bg-brand/10 text-brand font-medium">
                  Verified Agency
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold mb-1">{apiToken.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted mt-2">
              <Link
                href={`/agency/${agencyId}`}
                className="flex items-center gap-2 hover:text-accent transition-colors"
              >
                <div className="h-6 w-6 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand">
                  {agencyInitial}
                </div>
                {apiToken.agency.name ?? "Unknown Agency"}
                {apiToken.agency.verified && (
                  <CheckCircle className="h-3 w-3 text-success" />
                )}
              </Link>
              <span className="text-border">|</span>
              <span>
                Deal Size:{" "}
                <span className="font-semibold text-foreground">
                  ${apiToken.totalValue.toLocaleString()}
                </span>
              </span>
            </div>
            <div className="mt-4">
              <LabeledProgress
                label={`${apiToken.completedMilestones}/${apiToken.totalMilestones} milestones complete`}
                value={apiToken.progress}
                color="accent"
              />
            </div>
          </SectionCard>

          {/* Tab Bar */}
          <div className="flex gap-1 border-b border-border overflow-x-auto whitespace-nowrap">
            {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {TAB_LABELS[tab].icon}
                {TAB_LABELS[tab].label}
              </button>
            ))}
          </div>

          {/* ── Overview Tab ── */}
          {activeTab === "overview" && (
            <div className="space-y-6 min-h-[400px]">
              {/* Deal Terms */}
              <SectionCard
                title="Deal Terms"
                icon={<Layers className="h-5 w-5 text-accent" />}
              >
                <div className="divide-y divide-border/50">
                  {[
                    {
                      label: "Face Value",
                      value: "$1.00 per token",
                    },
                    {
                      label: "Purchase Price",
                      value: `$${pricePerToken.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per token`,
                    },
                    {
                      label: "Expected Return",
                      value: `+${expectedReturnPct}%`,
                      highlight: true,
                    },
                    {
                      label: "Deal Size",
                      value: `$${apiToken.totalValue.toLocaleString()}`,
                    },
                    {
                      label: "Token Supply",
                      value: `${totalSupply.toLocaleString()} tokens`,
                    },
                    {
                      label: "Remaining",
                      value: `${remainingTokens.toLocaleString()} tokens`,
                    },
                    {
                      label: "Structure",
                      value: "Milestone-based",
                    },
                    {
                      label: "Escrow",
                      value: "Smart contract (Base)",
                    },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <span className="text-sm text-muted">{row.label}</span>
                      <span
                        className={`text-sm font-semibold ${row.highlight ? "text-success" : "text-foreground"}`}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Payout Schedule */}
              {apiToken.exposure.showMilestones &&
              apiToken.milestones &&
              apiToken.milestones.length > 0 ? (
                <SectionCard
                  title="Payout Schedule"
                  icon={<FileText className="h-5 w-5 text-accent" />}
                >
                  <div className="space-y-2">
                    {apiToken.milestones.map((m, i) => {
                      const isComplete = m.status === "approved";
                      const isDelivered = m.status === "delivered";
                      return (
                        <div
                          key={`payout-${m.id}`}
                          className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary"
                        >
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isComplete
                                ? "bg-success/15 text-success"
                                : isDelivered
                                  ? "bg-warning/15 text-warning"
                                  : "bg-surface text-muted border border-border"
                            }`}
                          >
                            {isComplete ? (
                              <CheckCircle className="h-3.5 w-3.5" />
                            ) : (
                              <span>M{i + 1}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">
                              {m.name}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                            ${m.amount.toLocaleString()}
                          </span>
                          <div className="w-16 shrink-0">
                            <div className="h-1.5 w-full rounded-full bg-border/50 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isComplete ? "bg-success" : "bg-border"}`}
                                style={{
                                  width: isComplete ? "100%" : "0%",
                                }}
                              />
                            </div>
                            <span
                              className={`text-[10px] mt-0.5 block text-right ${isComplete ? "text-success" : isDelivered ? "text-warning" : "text-muted"}`}
                            >
                              {isComplete
                                ? "Done"
                                : isDelivered
                                  ? "Review"
                                  : "Pending"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              ) : !apiToken.exposure.showMilestones ? (
                <SectionCard
                  title="Payout Schedule"
                  icon={<FileText className="h-5 w-5 text-accent" />}
                >
                  <div className="flex items-center gap-3 text-sm text-muted py-2">
                    <Lock className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Milestone details are private.{" "}
                      {apiToken.completedMilestones} of{" "}
                      {apiToken.totalMilestones} milestones completed.
                    </span>
                  </div>
                </SectionCard>
              ) : null}

              {/* How It Works */}
              <SectionCard
                title="How It Works"
                icon={<ArrowRight className="h-5 w-5 text-accent" />}
              >
                <ol className="space-y-3">
                  {[
                    `Buy tokens at $${pricePerToken.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${((1 - pricePerToken) * 100).toFixed(0)}% discount)`,
                    "Agency delivers milestones on the contract",
                    "Client approves deliverables -- escrow releases funds",
                    "Redeem or sell tokens at $1.00 face value",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-accent/10 text-accent text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-muted leading-relaxed">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 p-3 rounded-lg bg-success/5 border border-success/20">
                  <p className="text-sm font-semibold text-success">
                    Net return: $
                    {(faceValuePerToken - pricePerToken).toFixed(2)} per
                    token (+{expectedReturnPct}%)
                  </p>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── Milestones Tab ── */}
          {activeTab === "milestones" && (
            <div className="space-y-6 min-h-[400px]">
              {/* Milestone summary row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-surface-secondary text-center">
                  <div className="text-lg font-bold">
                    ${totalPayouts.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted">Total Payouts</div>
                </div>
                <div className="p-3 rounded-lg bg-surface-secondary text-center">
                  <div className="text-lg font-bold text-success">
                    ${completedPayouts.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted">Completed</div>
                </div>
                <div className="p-3 rounded-lg bg-surface-secondary text-center">
                  <div className="text-lg font-bold text-warning">
                    ${remainingPayouts.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted">Remaining</div>
                </div>
              </div>

              {/* Milestones list */}
              {apiToken.exposure.showMilestones &&
              apiToken.milestones &&
              apiToken.milestones.length > 0 ? (
                <SectionCard title="Milestones">
                  <div className="space-y-3">
                    {apiToken.milestones.map((m, i) => (
                      <div
                        key={`milestone-${m.id}`}
                        className="flex items-center justify-between p-4 rounded-lg bg-surface-secondary border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              m.status === "approved"
                                ? "bg-success/15"
                                : m.status === "delivered"
                                  ? "bg-warning/15"
                                  : "bg-default"
                            }`}
                          >
                            {m.status === "approved" ? (
                              <CheckCircle className="h-4 w-4 text-success" />
                            ) : m.status === "delivered" ? (
                              <Clock className="h-4 w-4 text-warning" />
                            ) : (
                              <span className="text-xs text-muted">
                                {i + 1}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium">
                              {m.name}
                            </div>
                            <div className="text-xs text-muted">
                              ${m.amount.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge
                            status={
                              m.status as
                                | "approved"
                                | "delivered"
                                | "pending"
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              ) : !apiToken.exposure.showMilestones ? (
                <SectionCard title="Milestones">
                  <div className="flex items-center gap-3 text-sm text-muted py-2">
                    <Lock className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Milestone details are private.{" "}
                      {apiToken.completedMilestones} of{" "}
                      {apiToken.totalMilestones} milestones completed.
                    </span>
                  </div>
                </SectionCard>
              ) : null}
            </div>
          )}

          {/* ── Agency Tab ── */}
          {activeTab === "agency" && (
            <div className="space-y-6 min-h-[400px]">
              <SectionCard
                title="Agency Profile"
                icon={<Building2 className="h-5 w-5 text-brand" />}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-14 w-14 rounded-full bg-brand/20 flex items-center justify-center text-lg font-bold text-brand">
                    {agencyInitial}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">
                        {apiToken.agency.name ?? "Unknown Agency"}
                      </span>
                      {apiToken.agency.verified && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted mt-0.5">
                      {apiToken.agency.address.slice(0, 6)}...
                      {apiToken.agency.address.slice(-4)}
                    </div>
                  </div>
                </div>

                {/* Score + Risk tier */}
                {apiToken.agency.score != null && (
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-surface-secondary text-center">
                      <div className="text-2xl font-bold text-success">
                        {apiToken.agency.score}
                      </div>
                      <div className="text-xs text-muted">
                        Reputation Score
                      </div>
                    </div>
                    <RiskTierBadge score={apiToken.agency.score} />
                  </div>
                )}

                {/* Track record */}
                <div className="p-3 rounded-lg bg-surface-secondary text-sm text-muted leading-relaxed">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-brand" />
                    <span className="font-medium text-foreground">
                      Track Record
                    </span>
                  </div>
                  {apiToken.completedMilestones > 0
                    ? `${apiToken.completedMilestones} milestones completed across this contract.`
                    : "No milestones completed yet on this contract."}
                </div>

                {/* Link to full profile */}
                <div className="mt-4">
                  <Link
                    href={`/agency/${agencyId}`}
                    className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                  >
                    View full agency profile
                  </Link>
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── Security Tab ── */}
          {activeTab === "security" && (
            <div className="space-y-6 min-h-[400px]">
              {/* Escrow mechanism */}
              <SectionCard
                title="Escrow Mechanism"
                icon={<ShieldCheck className="h-5 w-5 text-success" />}
              >
                <div className="p-4 rounded-lg bg-success/5 border border-success/20 text-sm text-muted leading-relaxed">
                  Funds are held in an audited smart contract. Released only
                  upon verified milestone completion. Each milestone payout is
                  triggered on-chain, ensuring transparent and trustless fund
                  distribution.
                </div>
              </SectionCard>

              {/* Smart contract details */}
              <SectionCard title="On-Chain Deployment">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Token Address</span>
                    {apiToken.tokenAddress ? (
                      <a
                        href={`${baseScanBaseUrl}/token/${apiToken.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent font-mono text-xs flex items-center gap-1 hover:underline"
                      >
                        {apiToken.tokenAddress.slice(0, 6)}...
                        {apiToken.tokenAddress.slice(-4)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted italic">N/A</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Network</span>
                    <span className="font-medium">Base Sepolia</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted">Deployment Status</span>
                    {deployedOnChain ? (
                      <span className="flex items-center gap-1.5 text-success text-xs font-medium">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Deployed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-warning text-xs font-medium">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Not Deployed
                      </span>
                    )}
                  </div>
                  {apiToken.agency.verified && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted">EAS Attestation</span>
                      <a
                        href={`https://base-sepolia.easscan.org/address/${apiToken.agency.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent text-xs flex items-center gap-1 hover:underline"
                      >
                        View on EASScan
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Dispute History */}
              {apiToken.exposure.showDisputeHistory &&
              apiToken.disputes &&
              apiToken.disputes.length > 0 ? (
                <SectionCard title="Dispute History">
                  <div className="space-y-3">
                    {apiToken.disputes.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-surface-secondary border border-border/50"
                      >
                        <div>
                          <div className="text-sm font-medium capitalize">
                            {d.phase.replace(/_/g, " ")}
                          </div>
                          <div className="text-xs text-muted">
                            Opened{" "}
                            {new Date(d.createdAt)
                              .toISOString()
                              .slice(0, 10)}
                            {d.resolvedAt && (
                              <>
                                {" "}
                                -- Resolved{" "}
                                {new Date(d.resolvedAt)
                                  .toISOString()
                                  .slice(0, 10)}
                              </>
                            )}
                          </div>
                        </div>
                        <StatusBadge
                          status={
                            d.status === "resolved"
                              ? "approved"
                              : d.status === "pending"
                                ? "pending"
                                : "delivered"
                          }
                        />
                      </div>
                    ))}
                  </div>
                </SectionCard>
              ) : apiToken.exposure.showDisputeHistory ? (
                <SectionCard title="Dispute History">
                  <div className="flex items-center gap-3 text-sm text-muted py-2">
                    <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                    <span>
                      No disputes have been filed for this contract.
                    </span>
                  </div>
                </SectionCard>
              ) : (
                <SectionCard title="Dispute History">
                  <div className="flex items-center gap-3 text-sm text-muted py-2">
                    <Lock className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Dispute history is not disclosed for this token.
                    </span>
                  </div>
                </SectionCard>
              )}
            </div>
          )}
        </div>

        {/* -- Right Column -- */}
        <div className="space-y-6 self-start sticky top-24 z-10 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {/* Buy Card */}
          <SectionCard
            title="Invest in this Deal"
            className="border-accent/30"
          >
            {!deployedOnChain ? (
              /* Contract not deployed on-chain */
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="h-12 w-12 rounded-full bg-warning/15 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-warning" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-warning">
                      Contract Not Available
                    </p>
                    <p className="text-sm text-muted mt-1">
                      This contract&apos;s on-chain deployment is no longer
                      available. The agency needs to re-tokenize it.
                    </p>
                  </div>
                </div>
                <Link
                  href="/marketplace"
                  className="flex items-center justify-center gap-2 w-full h-10 px-4 rounded-md bg-surface-secondary text-foreground font-medium shadow-sm active:scale-[0.98] transition-all text-sm border border-border"
                >
                  Back to Marketplace
                </Link>
              </div>
            ) : buyResult ? (
              /* Success state */
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="h-12 w-12 rounded-full bg-success/15 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-success" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-success">
                      Investment Successful
                    </p>
                    <p className="text-sm text-muted mt-1">
                      You invested in{" "}
                      {buyResult.amount.toLocaleString()}{" "}
                      {apiToken.tokenSymbol} for $
                      {buyResult.totalCost.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    {buyResult.txHash && (
                      <p className="text-xs text-muted font-mono mt-1 break-all">
                        Tx: {buyResult.txHash.slice(0, 10)}...
                        {buyResult.txHash.slice(-8)}
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  href="/portfolio"
                  className="flex items-center justify-center gap-2 w-full h-10 px-4 rounded-md bg-accent text-accent-foreground font-medium shadow-sm active:scale-[0.98] transition-all text-sm"
                >
                  <Briefcase className="h-4 w-4" />
                  View My Portfolio
                </Link>
                <button
                  onClick={() => setBuyResult(null)}
                  className="w-full text-xs text-muted hover:text-foreground text-center py-1 transition-colors"
                >
                  Invest again
                </button>
              </div>
            ) : (
              /* Buy form */
              <div className="space-y-4">
                {/* Key deal metrics */}
                <div className="divide-y divide-border/50 text-sm">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted">Price per token</span>
                    <span className="font-bold text-accent">
                      $
                      {pricePerToken.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted">Face value</span>
                    <span className="font-medium">$1.00</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted">Expected return</span>
                    <span className="font-semibold text-success">
                      +{expectedReturnPct}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted">Remaining</span>
                    <span className="font-medium">
                      {remainingTokens.toLocaleString()} tokens
                    </span>
                  </div>
                </div>

                {/* Input */}
                <div>
                  <label className="text-xs text-muted mb-1 block">
                    Number of tokens
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 100"
                      value={buyAmount}
                      onChange={(e) => {
                        setBuyAmount(e.target.value);
                        setBuyError(null);
                      }}
                      variant="secondary"
                      className="w-full"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">
                      tokens
                    </span>
                  </div>
                </div>

                {/* Cost breakdown table */}
                {parsedAmount > 0 && (
                  <div className="divide-y divide-border/50 p-3 rounded-lg bg-surface-secondary text-sm">
                    <div className="flex justify-between pb-2">
                      <span className="text-muted">
                        {parsedAmount.toLocaleString()} x $
                        {pricePerToken.toFixed(2)}
                      </span>
                      <span className="font-medium">
                        $
                        {totalCost.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted">Face value at maturity</span>
                      <span className="font-medium">
                        $
                        {faceValue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 font-semibold">
                      <span className="text-muted">Estimated return</span>
                      <span
                        className={
                          yieldAmount >= 0 ? "text-success" : "text-danger"
                        }
                      >
                        {yieldAmount >= 0 ? "+" : ""}$
                        {yieldAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        ({yieldPercent}%)
                      </span>
                    </div>
                  </div>
                )}

                {buyError && (
                  <div className="flex items-center gap-2 text-xs text-danger bg-danger/10 rounded-lg p-3">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {buyError}
                  </div>
                )}

                {authenticated && walletAddress ? (
                  <Button
                    onPress={handleBuy}
                    isDisabled={buying || !buyAmount || parsedAmount <= 0}
                    className="w-full bg-accent text-accent-foreground"
                  >
                    {buying ? (
                      <span className="flex items-center gap-2">
                        <Spinner
                          size="sm"
                          className="text-accent-foreground"
                        />
                        Processing...
                      </span>
                    ) : (
                      `Invest ${buyAmount ? parsedAmount.toLocaleString() : "0"} tokens`
                    )}
                  </Button>
                ) : (
                  <Button
                    onPress={() => login()}
                    className="w-full bg-accent text-accent-foreground"
                  >
                    Connect Wallet to Invest
                  </Button>
                )}

                <p className="text-xs text-muted/70 text-center leading-relaxed">
                  Your capital is protected by smart contract escrow.
                </p>
              </div>
            )}
          </SectionCard>

          {/* Claim Card -- only visible if user holds tokens AND contract completed */}
          {authenticated && myHolding && myHolding.amount > 0 && (
            <SectionCard
              title={apiToken.status === "completed" ? "Claim Tokens" : "Your Holdings"}
              className={apiToken.status === "completed" ? "border-success/30" : "border-border"}
            >
              <div className="space-y-4">
                <div className="divide-y divide-border/50 text-sm">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted">Your holdings</span>
                    <span className="font-medium">
                      {myHolding.amount} {apiToken.tokenSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted">Buy price</span>
                    <span>${myHolding.buyPrice.toFixed(2)}/token</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted">Face value</span>
                    <span className="font-medium text-success">$1.00/token</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted">Your return</span>
                    <span className="font-medium text-success">
                      +{((1 / myHolding.buyPrice - 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {apiToken.status !== "completed" ? (
                  <p className="text-xs text-muted p-3 rounded-lg bg-surface-secondary">
                    Tokens can be redeemed at $1.00/token once all milestones are completed.
                    Contract is currently in progress.
                  </p>
                ) : (
                  <>
                <div>
                  <label className="text-xs text-muted mb-1 block">
                    Number of tokens to claim
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max={myHolding.amount}
                    step="1"
                    placeholder={`Max ${myHolding.amount}`}
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    variant="secondary"
                    className="w-full"
                  />
                </div>

                {sellAmount && parseFloat(sellAmount) > 0 && (
                  <div className="p-3 rounded-lg bg-surface-secondary text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted">Tokens to sell</span>
                      <span>{parseFloat(sellAmount)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-muted">Estimated value</span>
                      <span>
                        $
                        {(
                          parseFloat(sellAmount) * myHolding.currentPrice
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  onPress={handleSell}
                  isDisabled={
                    selling ||
                    !sellAmount ||
                    parseFloat(sellAmount) <= 0
                  }
                  className="w-full bg-success text-success-foreground"
                >
                  {selling ? (
                    <span className="flex items-center gap-2">
                      <Spinner size="sm" />
                      Processing...
                    </span>
                  ) : (
                    `Claim ${sellAmount || "0"} tokens ($${(parseFloat(sellAmount || "0") * 1).toFixed(2)})`
                  )}
                </Button>

                <p className="text-xs text-muted/70 text-center leading-relaxed">
                  Tokens redeemed at face value ($1.00/token).
                </p>
                  </>
                )}
              </div>
            </SectionCard>
          )}

          {/* Secondary Market */}
          <SectionCard
            title="Secondary Market"
            icon={<ArrowLeftRight className="h-5 w-5 text-accent" />}
          >
            {apiToken.pool ? (
              <div className="space-y-4">
                <p className="text-xs text-muted">Trade on Uniswap V3</p>
                <div className="divide-y divide-border/50 text-sm">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted">Pool</span>
                    <a
                      href={`${baseScanBaseUrl}/address/${apiToken.pool.poolAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent font-mono text-xs flex items-center gap-1 hover:underline"
                    >
                      {apiToken.pool.poolAddress.slice(0, 6)}...
                      {apiToken.pool.poolAddress.slice(-4)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted">Liquidity</span>
                    <span className="font-medium text-foreground">
                      {BigInt(apiToken.pool.liquidity) > BigInt(0) ? "Active" : "Empty"}
                    </span>
                  </div>
                </div>

                {/* Buy / Sell tabs */}
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <button
                    onClick={() => {
                      setTradeTab("buy");
                      setTradeQuote(null);
                      if (tradeAmount) fetchQuote("buy", tradeAmount);
                    }}
                    className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                      tradeTab === "buy"
                        ? "bg-success/15 text-success"
                        : "bg-surface-secondary text-muted hover:text-foreground"
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => {
                      setTradeTab("sell");
                      setTradeQuote(null);
                      if (tradeAmount) fetchQuote("sell", tradeAmount);
                    }}
                    className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                      tradeTab === "sell"
                        ? "bg-danger/15 text-danger"
                        : "bg-surface-secondary text-muted hover:text-foreground"
                    }`}
                  >
                    Sell
                  </button>
                </div>

                {/* Amount input */}
                <div>
                  <label className="text-xs text-muted mb-1 block">
                    {tradeTab === "buy" ? "USDC to spend" : "Tokens to sell"}
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder={tradeTab === "buy" ? "e.g. 100" : "e.g. 50"}
                      value={tradeAmount}
                      onChange={(e) => {
                        setTradeAmount(e.target.value);
                        fetchQuote(tradeTab, e.target.value);
                      }}
                      variant="secondary"
                      className="w-full"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted pointer-events-none">
                      {tradeTab === "buy" ? "USDC" : "tokens"}
                    </span>
                  </div>
                </div>

                {/* Quote display */}
                {tradeQuote && tradeQuote.poolExists && parseFloat(tradeAmount) > 0 && (
                  <div className="p-3 rounded-lg bg-surface-secondary text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted">Estimated output</span>
                      <span className="font-medium">
                        ~{Number(tradeQuote.estimatedOut).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}{" "}
                        {tradeTab === "buy" ? "tokens" : "USDC"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Price per token</span>
                      <span className="font-medium">
                        ${tradeQuote.pricePerToken.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Slippage</span>
                      <span className="font-medium">0.5%</span>
                    </div>
                  </div>
                )}

                {/* Trade button */}
                {authenticated && walletAddress ? (
                  <Button
                    onPress={handleTrade}
                    isDisabled={trading || !tradeAmount || parseFloat(tradeAmount) <= 0}
                    className={`w-full ${
                      tradeTab === "buy"
                        ? "bg-success text-success-foreground"
                        : "bg-danger text-danger-foreground"
                    }`}
                  >
                    {trading ? (
                      <span className="flex items-center gap-2">
                        <Spinner size="sm" />
                        Processing...
                      </span>
                    ) : (
                      `${tradeTab === "buy" ? "Buy" : "Sell"} on Uniswap`
                    )}
                  </Button>
                ) : (
                  <Button
                    onPress={() => login()}
                    className="w-full bg-accent text-accent-foreground"
                  >
                    Connect Wallet to Trade
                  </Button>
                )}

                <p className="text-[11px] text-muted/70 text-center leading-relaxed">
                  Secondary market prices may differ from the primary market.
                </p>
              </div>
            ) : (
              <div className="py-2 space-y-2">
                <p className="text-sm text-muted">
                  No Uniswap pool available yet.
                </p>
                <p className="text-xs text-muted/70">
                  Trade on the primary market above.
                </p>
              </div>
            )}
          </SectionCard>

          {/* Condensed Agency link */}
          <Link
            href={`/agency/${agencyId}`}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-surface hover:border-brand/50 transition-colors text-left"
          >
            <div className="h-8 w-8 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand">
              {agencyInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {apiToken.agency.name ?? "Unknown Agency"}
              </div>
              <div className="text-xs text-muted">
                {apiToken.agency.verified ? "Verified" : "Unverified"}
              </div>
            </div>
            {apiToken.agency.verified && (
              <CheckCircle className="h-4 w-4 text-brand flex-shrink-0" />
            )}
          </Link>

          {/* Contract Info */}
          <SectionCard title="Contract Info">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Token</span>
                <span className="font-mono font-medium">
                  {apiToken.tokenSymbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Supply</span>
                <span>{totalSupply.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Market Cap</span>
                <span>
                  $
                  {marketCap.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Holders</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Private
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Client</span>
                <span className="text-muted italic">Private</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Token Address</span>
                <span className="text-accent font-mono text-xs flex items-center gap-1">
                  {apiToken.tokenAddress
                    ? `${apiToken.tokenAddress.slice(0, 6)}...${apiToken.tokenAddress.slice(-4)}`
                    : "N/A"}
                  {apiToken.tokenAddress && (
                    <ExternalLink className="h-3 w-3" />
                  )}
                </span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
