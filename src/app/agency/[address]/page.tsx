"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  Chip,
  Spinner,
} from "@heroui/react";
import {
  BadgeCheck,
  Globe,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useApi } from "@/hooks/use-api";
import {
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/ui";
import { getRiskTier } from "@/lib/scoring";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AgencyUser {
  address: string;
  name: string | null;
  email: string | null;
  roles: string[];
  agencyProfile?: {
    companyName?: string;
    description?: string;
    website?: string;
    categories?: string[];
    score: number;
    verified: boolean;
    attestations?: { label: string; verified: boolean; hash?: string }[];
  };
  contractsAsAgency: {
    id: string;
    title: string;
    status: string;
    totalValue: number;
    createdAt: string;
    tokenized?: boolean;
  }[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function RiskTierBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const tier = getRiskTier(score);
  const colorMap: Record<string, "success" | "warning" | "danger" | "default"> = {
    low: "success",
    medium: "warning",
    high: "danger",
  };
  return (
    <Chip size="sm" variant="soft" color={colorMap[tier.level] ?? "default"} className="text-xs font-semibold">
      {tier.label}
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AgencyProfilePage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const { walletAddress } = useAuth();

  const { data: agency, loading } = useApi<AgencyUser>(`/api/users/${address}`);

  const isOwnAgency = walletAddress?.toLowerCase() === address.toLowerCase();

  const contracts = agency?.contractsAsAgency ?? [];
  // Only show public contracts (active, completed, tokenized)
  const publicContracts = useMemo(
    () => contracts.filter((c) => ["active", "completed"].includes(c.status)),
    [contracts],
  );

  const completed = useMemo(
    () => contracts.filter((c) => c.status === "completed").length,
    [contracts],
  );
  const disputed = useMemo(
    () => contracts.filter((c) => c.status === "disputed").length,
    [contracts],
  );
  const totalVolume = useMemo(
    () => contracts.reduce((sum, c) => sum + c.totalValue, 0),
    [contracts],
  );
  const disputeRate = contracts.length > 0
    ? Math.round((disputed / contracts.length) * 100)
    : 0;

  const score = agency?.agencyProfile?.score ?? 0;
  const companyName = agency?.agencyProfile?.companyName || agency?.name || "Unknown Agency";

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title="Agency Profile"
          backHref="/marketplace"
          backLabel="Marketplace"
        />
        <div className="flex justify-center py-24">
          <Spinner size="lg" className="text-accent" />
        </div>
      </div>
    );
  }

  if (!agency) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title="Agency Profile"
          backHref="/marketplace"
          backLabel="Marketplace"
        />
        <div className="text-center py-24">
          <p className="text-muted text-sm">Agency not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title=""
        backHref="/marketplace"
        backLabel="Marketplace"
      />

      {/* ================================================================ */}
      {/*  Agency Header                                                   */}
      {/* ================================================================ */}
      <Card className="border border-border mb-8">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* Avatar */}
            <div className="h-16 w-16 rounded-xl bg-brand/20 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-brand">
                {companyName.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  {companyName}
                </h1>
                {agency.agencyProfile?.verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-semibold">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
                <RiskTierBadge score={score} />
              </div>

              <p className="text-sm text-muted font-mono mt-1">
                {truncateAddress(address)}
              </p>

              {agency.agencyProfile?.description && (
                <p className="text-sm text-muted mt-3 max-w-2xl">
                  {agency.agencyProfile.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 mt-3">
                {agency.agencyProfile?.website && (
                  <a
                    href={agency.agencyProfile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {agency.agencyProfile.website.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {agency.agencyProfile?.categories && agency.agencyProfile.categories.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {agency.agencyProfile.categories.map((cat) => (
                      <Chip key={cat} size="sm" variant="soft" className="text-xs">
                        {cat}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>

              {isOwnAgency && (
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-md text-sm font-medium text-accent border border-accent/30 hover:bg-accent/10 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Agency Profile
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/*  Track Record Stats                                              */}
      {/* ================================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Card className="border border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted uppercase tracking-wider font-semibold">Score</p>
            <p className="text-2xl font-bold text-foreground mt-1">{score}/100</p>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted uppercase tracking-wider font-semibold">Completed</p>
            <p className="text-2xl font-bold text-foreground mt-1">{completed}</p>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted uppercase tracking-wider font-semibold">Volume</p>
            <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalVolume)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted uppercase tracking-wider font-semibold">Dispute Rate</p>
            <p className="text-2xl font-bold text-foreground mt-1">{disputeRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/*  Contract History                                                */}
      {/* ================================================================ */}
      <SectionCard title="Contract History" className="mb-8">
        {publicContracts.length > 0 ? (
          <div className="overflow-x-auto -mx-6 -mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Title</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Value</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {publicContracts.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-secondary transition-colors">
                    <td className="px-6 py-3 font-medium text-foreground">{c.title}</td>
                    <td className="px-3 py-3 text-right text-foreground font-mono">{formatCurrency(c.totalValue)}</td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge status={c.status as "active" | "completed" | "draft" | "disputed" | "failed"} />
                    </td>
                    <td className="px-6 py-3 text-right text-muted text-xs">
                      {new Date(c.createdAt).toLocaleDateString("en-CA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-8">No public contracts yet.</p>
        )}
      </SectionCard>
    </div>
  );
}
