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
} from "lucide-react";
import { useTokenDetail } from "@/hooks/use-marketplace";
import { postApi } from "@/hooks/use-api";
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

type TabKey = "overview" | "milestones" | "agency" | "security";

const TAB_LABELS: Record<TabKey, { label: string; icon: React.ReactNode }> = {
  overview: { label: "Overview", icon: <TrendingUp className="h-4 w-4" /> },
  milestones: { label: "Milestones", icon: <FileText className="h-4 w-4" /> },
  agency: { label: "Agency", icon: <Building2 className="h-4 w-4" /> },
  security: { label: "Security", icon: <ShieldCheck className="h-4 w-4" /> },
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader title="" backHref="/marketplace" backLabel="Back to Marketplace" />
        <div className="flex justify-center py-24">
          <Spinner size="lg" className="text-accent" />
        </div>
      </div>
    );
  }

  if (!apiToken) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader title="" backHref="/marketplace" backLabel="Back to Marketplace" />
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
  // Face value is always $1.00 per token
  const faceValuePerToken = 1.0;
  const parsedAmount = parseFloat(buyAmount) || 0;
  const totalCost = parsedAmount * pricePerToken;
  const faceValue = parsedAmount * faceValuePerToken;
  // Returns = (faceValue / cost - 1) * 100 = (1/pricePerToken - 1) * 100
  const yieldAmount = faceValue - totalCost;
  const yieldPercent =
    totalCost > 0 ? ((yieldAmount / totalCost) * 100).toFixed(1) : "0.0";
  const marketCap = pricePerToken * totalSupply;

  // Milestone payout calculations
  const totalPayouts = apiToken.milestones?.reduce((sum, m) => sum + m.amount, 0) ?? apiToken.totalValue;
  const completedPayouts = apiToken.milestones
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

  const agencyId = apiToken.agency.address;
  const agencyInitial = (apiToken.agency.name ?? "?").charAt(0).toUpperCase();
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

      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        {/* -- Left Column -- */}
        <div className="space-y-6">

          {/* Token Header — always visible above tabs */}
          <SectionCard>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs px-2 py-1 rounded bg-surface-secondary text-muted">
                {categoryLabel}
              </span>
              <StatusBadge status="approved" />
              {apiToken.agency.verified && (
                <span className="text-xs px-2 py-1 rounded bg-brand/10 text-brand font-medium">
                  Verified Agency
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold mb-1">{apiToken.title}</h1>
            <p className="text-sm text-muted mb-3">
              {apiToken.tokenName} ({apiToken.tokenSymbol})
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
              <a
                href={`https://thesignal.directory/agency/${agencyId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-accent"
              >
                <div className="h-6 w-6 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand">
                  {agencyInitial}
                </div>
                {apiToken.agency.name ?? "Unknown Agency"}
                <ExternalLink className="h-3 w-3" />
              </a>
              <span>
                Contract Value:{" "}
                <span className="font-medium text-foreground">
                  ${apiToken.totalValue.toLocaleString()}
                </span>
              </span>
            </div>
            <div className="mt-4">
              <LabeledProgress
                label={`Overall Completion — ${apiToken.completedMilestones}/${apiToken.totalMilestones} milestones`}
                value={apiToken.progress}
                color="accent"
              />
            </div>
          </SectionCard>

          {/* Tab Bar */}
          <div className="flex gap-1 border-b border-border">
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

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Token Economics */}
              <SectionCard title="Token Economics" icon={<TrendingUp className="h-5 w-5 text-accent" />}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-surface-secondary text-center">
                    <div className="text-xl font-bold text-accent">
                      ${pricePerToken.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-muted mt-1">Price per Token</div>
                  </div>
                  <div className="p-4 rounded-lg bg-surface-secondary text-center">
                    <div className="text-xl font-bold">
                      {totalSupply.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted mt-1">Total Supply</div>
                  </div>
                  <div className="p-4 rounded-lg bg-surface-secondary text-center col-span-2 sm:col-span-1">
                    <div className="text-xl font-bold">
                      ${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-muted mt-1">Market Cap</div>
                  </div>
                </div>
              </SectionCard>

              {/* Info box */}
              <div className="p-4 rounded-lg bg-accent/5 border border-accent/20 text-sm text-muted leading-relaxed">
                Each token represents a $1.00 claim on this contract&apos;s future milestone payouts.
                Buy at a discount, earn returns when milestones are completed and verified.
              </div>
            </div>
          )}

          {activeTab === "milestones" && (
            <div className="space-y-6">
              {/* Milestone summary row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-surface-secondary text-center">
                  <div className="text-lg font-bold">${totalPayouts.toLocaleString()}</div>
                  <div className="text-xs text-muted">Total Payouts</div>
                </div>
                <div className="p-3 rounded-lg bg-surface-secondary text-center">
                  <div className="text-lg font-bold text-success">${completedPayouts.toLocaleString()}</div>
                  <div className="text-xs text-muted">Completed</div>
                </div>
                <div className="p-3 rounded-lg bg-surface-secondary text-center">
                  <div className="text-lg font-bold text-warning">${remainingPayouts.toLocaleString()}</div>
                  <div className="text-xs text-muted">Remaining</div>
                </div>
              </div>

              {/* Milestones list */}
              {apiToken.exposure.showMilestones && apiToken.milestones && apiToken.milestones.length > 0 ? (
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
                              <span className="text-xs text-muted">{i + 1}</span>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{m.name}</div>
                            <div className="text-xs text-muted">
                              ${m.amount.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge
                            status={
                              m.status as "approved" | "delivered" | "pending"
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
                      Milestone details are private. {apiToken.completedMilestones} of {apiToken.totalMilestones} milestones completed.
                    </span>
                  </div>
                </SectionCard>
              ) : null}
            </div>
          )}

          {activeTab === "agency" && (
            <div className="space-y-6">
              <SectionCard title="Agency Profile" icon={<Building2 className="h-5 w-5 text-brand" />}>
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
                      {apiToken.agency.address.slice(0, 6)}...{apiToken.agency.address.slice(-4)}
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
                      <div className="text-xs text-muted">Reputation Score</div>
                    </div>
                    <RiskTierBadge score={apiToken.agency.score} />
                  </div>
                )}

                {/* Track record */}
                <div className="p-3 rounded-lg bg-surface-secondary text-sm text-muted leading-relaxed">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-brand" />
                    <span className="font-medium text-foreground">Track Record</span>
                  </div>
                  {apiToken.completedMilestones > 0
                    ? `${apiToken.completedMilestones} milestones completed across this contract.`
                    : "No milestones completed yet on this contract."}
                </div>

                {/* Link to full profile */}
                <div className="mt-4">
                  <a
                    href={`https://thesignal.directory/agency/${agencyId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                  >
                    View full agency profile
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Escrow mechanism */}
              <SectionCard title="Escrow Mechanism" icon={<ShieldCheck className="h-5 w-5 text-success" />}>
                <div className="p-4 rounded-lg bg-success/5 border border-success/20 text-sm text-muted leading-relaxed">
                  Funds are held in an audited smart contract. Released only upon verified milestone completion.
                  Each milestone payout is triggered on-chain, ensuring transparent and trustless fund distribution.
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
                        {apiToken.tokenAddress.slice(0, 6)}...{apiToken.tokenAddress.slice(-4)}
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
                              {new Date(d.createdAt).toISOString().slice(0, 10)}
                              {d.resolvedAt && (
                                <> · Resolved {new Date(d.resolvedAt).toISOString().slice(0, 10)}</>
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
                      <span>No disputes have been filed for this contract.</span>
                    </div>
                  </SectionCard>
                ) : (
                  <SectionCard title="Dispute History">
                    <div className="flex items-center gap-3 text-sm text-muted py-2">
                      <Lock className="h-4 w-4 flex-shrink-0" />
                      <span>Dispute history is not disclosed for this token.</span>
                    </div>
                  </SectionCard>
                )}
            </div>
          )}
        </div>

        {/* -- Right Column -- */}
        <div className="space-y-6">

          {/* Buy Card */}
          <SectionCard
            title="Invest in This Token"
            className="border-accent/30 sticky top-24 z-10"
          >
            {!deployedOnChain ? (
              /* Contract not deployed on-chain */
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="h-12 w-12 rounded-full bg-warning/15 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-warning" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-warning">Contract Not Available</p>
                    <p className="text-sm text-muted mt-1">
                      This contract&apos;s on-chain deployment is no longer available. The agency needs to re-tokenize it.
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
                    <p className="font-semibold text-success">Purchase Successful!</p>
                    <p className="text-sm text-muted mt-1">
                      You bought {buyResult.amount.toLocaleString()} {apiToken.tokenSymbol} for{" "}
                      ${buyResult.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETH
                    </p>
                    {buyResult.txHash && (
                      <p className="text-xs text-muted font-mono mt-1 break-all">
                        Tx: {buyResult.txHash.slice(0, 10)}...{buyResult.txHash.slice(-8)}
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
                  Buy more tokens
                </button>
              </div>
            ) : (
              /* Buy form */
              <div className="space-y-4">
                {/* How it works */}
                <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 text-xs text-muted leading-relaxed">
                  When you buy tokens, they are minted directly to your wallet. Each token represents a $1.00 claim on the contract&apos;s future payouts. You buy at a discount and earn returns when milestones are completed.
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted">Price per token</span>
                  <span className="font-bold text-lg text-accent">
                    ${pricePerToken.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETH
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Total supply</span>
                  <span>{totalSupply.toLocaleString()} {apiToken.tokenSymbol}</span>
                </div>

                <div className="h-px bg-border/50" />

                <div>
                  <label className="text-xs text-muted mb-1 block">
                    Number of tokens to buy
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 10"
                    value={buyAmount}
                    onChange={(e) => {
                      setBuyAmount(e.target.value);
                      setBuyError(null);
                    }}
                    variant="secondary"
                    className="w-full"
                  />
                </div>

                {/* Cost breakdown */}
                <div className="space-y-2 p-3 rounded-lg bg-surface-secondary text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Cost (ETH)</span>
                    <span className="font-medium">
                      ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Face value</span>
                    <span className="font-medium">
                      ${faceValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="h-px bg-border/50" />
                  <div className="flex justify-between font-semibold">
                    <span className="text-muted">Expected returns</span>
                    <span className={yieldAmount >= 0 ? "text-success" : "text-danger"}>
                      {yieldAmount >= 0 ? "+" : ""}
                      ${yieldAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                      ({yieldPercent}%)
                    </span>
                  </div>
                </div>

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
                        <Spinner size="sm" className="text-accent-foreground" />
                        Processing...
                      </span>
                    ) : `Buy ${buyAmount || "0"} ${apiToken.tokenSymbol}`}
                  </Button>
                ) : (
                  <Button
                    onPress={() => login()}
                    className="w-full bg-accent text-accent-foreground"
                  >
                    Connect Wallet to Buy
                  </Button>
                )}

                <p className="text-xs text-muted/70 text-center leading-relaxed">
                  Tokens represent claims on future contract payouts. Returns depend on successful milestone completion.
                </p>
                <p className="text-xs text-muted text-center">
                  Tokens are minted on Base Sepolia
                </p>
              </div>
            )}
          </SectionCard>

          {/* Condensed Agency link */}
          <button
            onClick={() => setActiveTab("agency")}
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
          </button>

          {/* Contract Info */}
          <SectionCard title="Contract Info">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Token</span>
                <span className="font-mono font-medium">{apiToken.tokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Supply</span>
                <span>{totalSupply.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Market Cap</span>
                <span>${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
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
