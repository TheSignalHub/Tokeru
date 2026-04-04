"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  Chip,
  Spinner,
  Button,
  Input,
} from "@heroui/react";
import {
  ShieldCheck,
  Pencil,
  Upload,
  FileCheck,
  FileClock,
  BadgeCheck,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/use-profile";
import { useApi } from "@/hooks/use-api";
import {
  PageHeader,
  SectionCard,
  LabeledProgress,
  StatusBadge,
  FormField,
  AgencySetupSection,
} from "@/components/ui";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DOCUMENT_LABELS = [
  "Business Registration",
  "KYC Verification",
  "Insurance Certificate",
  "Portfolio Proof",
  "Other",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/*  Edit Profile Form                                                  */
/* ------------------------------------------------------------------ */

function EditProfileForm({
  initialName,
  initialEmail,
  onSave,
  onCancel,
}: {
  initialName: string;
  initialEmail: string;
  onSave: (data: { name: string; email: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ name, email });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="max-w-sm"
        />
      </FormField>
      <FormField label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="max-w-sm"
        />
      </FormField>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" isDisabled={saving} size="sm">
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onPress={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Document Upload Section                                            */
/* ------------------------------------------------------------------ */

function DocumentUploadSection({
  attestations,
  onUpload,
}: {
  attestations: { label: string; verified: boolean; hash?: string }[];
  onUpload: (file: File, label: string) => Promise<void>;
}) {
  const [selectedLabel, setSelectedLabel] = useState(DOCUMENT_LABELS[0]);
  const [uploading, setUploading] = useState(false);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setLastHash(null);
    try {
      await onUpload(file, selectedLabel);
      setLastHash("Uploaded successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {attestations.length > 0 && (
        <div className="space-y-2">
          {attestations.map((att, idx) => (
            <div
              key={`${att.label}-${idx}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-secondary"
            >
              {att.verified ? (
                <FileCheck className="h-4 w-4 text-success shrink-0" />
              ) : (
                <FileClock className="h-4 w-4 text-warning shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {att.label}
                </p>
                {att.hash && (
                  <p className="text-xs text-muted font-mono truncate">
                    SHA-256: {att.hash}
                  </p>
                )}
              </div>
              <Chip
                size="sm"
                color={att.verified ? "success" : "warning"}
                variant="soft"
              >
                {att.verified ? "Verified" : "Pending"}
              </Chip>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <FormField label="Document Type">
          <select
            value={selectedLabel}
            onChange={(e) => setSelectedLabel(e.target.value)}
            className="h-10 px-3 rounded-md border border-border bg-surface text-foreground text-sm w-full max-w-[220px]"
          >
            {DOCUMENT_LABELS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={handleUpload}
            className="hidden"
            id="doc-upload"
          />
          <Button
            size="sm"
            variant="outline"
            isDisabled={uploading}
            onPress={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload Document
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      {lastHash && !error && (
        <p className="text-sm text-success">{lastHash}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KYB Verification Section                                           */
/* ------------------------------------------------------------------ */

function KYBVerificationSection({
  walletAddress,
  agencyProfile,
  onVerified,
}: {
  walletAddress: string;
  agencyProfile?: { verified?: boolean; companyName?: string; attestations?: { label: string; verified: boolean; hash?: string }[] };
  onVerified: () => void;
}) {
  const [jurisdiction, setJurisdiction] = useState("");
  const [companyName, setCompanyName] = useState(agencyProfile?.companyName ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ attestationUid: string; easScanUrl: string } | null>(null);

  const kybAttestation = agencyProfile?.attestations?.find(
    (a) => a.label === "KYB Verification" && a.hash,
  );
  const isVerified = agencyProfile?.verified && kybAttestation;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jurisdiction.trim() || !companyName.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${walletAddress}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jurisdiction: jurisdiction.trim(), companyName: companyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setResult({ attestationUid: data.attestationUid, easScanUrl: data.easScanUrl });
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify");
    } finally {
      setSubmitting(false);
    }
  };

  if (isVerified || result) {
    const uid = result?.attestationUid ?? kybAttestation?.hash ?? "";
    const scanUrl = result?.easScanUrl ?? `https://base-sepolia.easscan.org/attestation/view/${uid}`;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-success/30 bg-success/5">
          <BadgeCheck className="h-5 w-5 text-success shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-success">Verified Agency</p>
            <p className="text-xs text-muted font-mono truncate mt-0.5">
              Attestation: {uid.slice(0, 10)}...{uid.slice(-6)}
            </p>
          </div>
          <a
            href={scanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline shrink-0"
          >
            View on EASScan <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted">
        Verify your agency with an on-chain EAS attestation. This creates a public, verifiable proof of your business identity.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <FormField label="Company Name">
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Your company name"
            className="max-w-[240px]"
          />
        </FormField>
        <FormField label="Jurisdiction">
          <Input
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder="e.g. US, EU, SG"
            className="max-w-[180px]"
          />
        </FormField>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button
        type="submit"
        variant="primary"
        size="sm"
        isDisabled={submitting || !jurisdiction.trim() || !companyName.trim()}
      >
        {submitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            <BadgeCheck className="h-3.5 w-3.5" />
            Verify Your Agency
          </>
        )}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ProfilePage() {
  const {
    profile,
    team,
    loading: profileLoading,
    refresh: refreshProfile,
    updateProfile,
    updateAgencyProfile,
    inviteTeamMember,
    uploadDocument,
    walletAddress,
  } = useProfile();

  // Fetch contracts for stats
  const contractsUrl = walletAddress
    ? `/api/contracts?user=${encodeURIComponent(walletAddress)}`
    : null;
  const { data: rawContracts, loading } = useApi<Array<{ id: string; title: string; status: string; totalValue: number; createdAt: string }>>(contractsUrl);
  const apiContracts = rawContracts ?? [];

  const [editing, setEditing] = useState(false);

  // Wallet balance
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";
    fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [walletAddress, "latest"],
        id: 1,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.result) {
          setBalance((parseInt(data.result, 16) / 1e18).toString());
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [walletAddress]);

  /* ---- Derive stats from real data ---- */
  const completed = useMemo(
    () => apiContracts.filter((c) => c.status === "completed").length,
    [apiContracts],
  );
  const failed = useMemo(
    () => apiContracts.filter((c) => c.status === "failed").length,
    [apiContracts],
  );
  const totalVolume = useMemo(
    () => apiContracts.reduce((sum, c) => sum + c.totalValue, 0),
    [apiContracts],
  );
  const reputationScore = useMemo(() => {
    if (profile?.agencyProfile?.score != null) {
      return profile.agencyProfile.score;
    }
    if (apiContracts.length === 0) return 0;
    const completionRate =
      completed + failed > 0 ? (completed / (completed + failed)) * 100 : 0;
    return Math.round(completionRate);
  }, [profile?.agencyProfile?.score, apiContracts, completed, failed]);
  const onTimeDelivery = useMemo(() => {
    if (apiContracts.length === 0) return 0;
    return Math.round(
      (apiContracts.filter((c) => c.status === "completed").length /
        Math.max(apiContracts.length, 1)) *
        100,
    );
  }, [apiContracts]);

  /* ---- Score breakdown ---- */
  const completionRate =
    completed + failed > 0
      ? Math.round((completed / (completed + failed)) * 100)
      : 0;
  const disputeWinRate = 0;

  /* ---- Contract history ---- */
  const contractHistory = useMemo(() => {
    return apiContracts.map((c) => ({
      id: c.id,
      title: c.title,
      role: "agency" as const,
      value: c.totalValue,
      status: c.status,
      date: new Date(c.createdAt).toLocaleDateString("en-CA"),
    }));
  }, [apiContracts]);

  /* ---- Profile display values ---- */
  const profileName = profile?.name || "Your Profile";
  const attestations = profile?.agencyProfile?.attestations ?? [];

  if (loading || profileLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHeader
          title="Profile"
          description="Your account settings and agency profile"
          backHref="/dashboard"
          backLabel="Dashboard"
        />
        <div className="flex justify-center py-24">
          <Spinner size="lg" className="text-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title="Profile"
        description="Your account settings and agency profile"
        backHref="/dashboard"
        backLabel="Dashboard"
      />

      {/* ================================================================ */}
      {/*  Two-column layout                                               */}
      {/* ================================================================ */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* ---- Left column: Personal info + KYB ---- */}
        <div className="space-y-6">
          {/* Personal info card */}
          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Personal Info</h2>
                {!editing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => setEditing(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
              </div>

              {editing ? (
                <EditProfileForm
                  initialName={profile?.name ?? ""}
                  initialEmail={profile?.email ?? ""}
                  onSave={async (data) => {
                    await updateProfile(data);
                    setEditing(false);
                  }}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wider font-semibold">Name</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{profileName}</p>
                  </div>
                  {profile?.email && (
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wider font-semibold">Email</p>
                      <p className="text-sm text-foreground mt-0.5">{profile.email}</p>
                    </div>
                  )}
                  {walletAddress && (
                    <div>
                      <p className="text-xs text-muted uppercase tracking-wider font-semibold">Wallet</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-foreground font-mono">{truncateAddress(walletAddress)}</p>
                        {balance !== null && (
                          <Chip size="sm" variant="soft" color="success" className="text-xs font-mono">
                            {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH
                          </Chip>
                        )}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted uppercase tracking-wider font-semibold">Reputation Score</p>
                    <p className="text-sm font-bold text-foreground mt-0.5">{reputationScore}/100</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats summary */}
          <Card className="border border-border">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Contracts</p>
                  <p className="text-xl font-bold text-foreground mt-0.5">{apiContracts.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Completed</p>
                  <p className="text-xl font-bold text-foreground mt-0.5">{completed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Total Volume</p>
                  <p className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(totalVolume)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">On-Time</p>
                  <p className="text-xl font-bold text-foreground mt-0.5">{onTimeDelivery}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KYB Verification */}
          {profile?.roles?.includes("agency") && walletAddress && (
            <SectionCard
              title="KYB Verification"
              icon={<BadgeCheck className="h-4 w-4 text-accent" />}
            >
              <KYBVerificationSection
                walletAddress={walletAddress}
                agencyProfile={profile?.agencyProfile}
                onVerified={refreshProfile}
              />
            </SectionCard>
          )}
        </div>

        {/* ---- Right column: Agency profile + Documents ---- */}
        <div className="space-y-6">
          {/* Agency Profile Setup */}
          {profile?.roles?.includes("agency") && (
            <AgencySetupSection
              agencyProfile={profile?.agencyProfile}
              team={team}
              onSaveProfile={async (data) => {
                try {
                  await updateAgencyProfile(data);
                  toast.success("Agency profile saved");
                } catch (err) {
                  toast.error("Failed to save agency profile");
                  throw err;
                }
              }}
              onInviteMember={async (email, name, role) => {
                try {
                  await inviteTeamMember({ email, name, role });
                  toast.success("Invite sent");
                } catch (err) {
                  toast.error("Failed to send invite");
                  throw err;
                }
              }}
              onRefresh={refreshProfile}
            />
          )}

          {/* Legal Documents */}
          <SectionCard
            title="Legal Documents"
            icon={<ShieldCheck className="h-4 w-4 text-accent" />}
          >
            <DocumentUploadSection
              attestations={attestations}
              onUpload={async (file, label) => {
                try {
                  await uploadDocument(file, label);
                  toast.success("Document uploaded");
                } catch (err) {
                  toast.error("Failed to upload document");
                  throw err;
                }
              }}
            />
          </SectionCard>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  Score Breakdown (full width)                                     */}
      {/* ================================================================ */}
      <SectionCard title="Score Breakdown" className="mb-6">
        <div className="space-y-5">
          <LabeledProgress
            label="Completion Rate"
            value={completionRate}
            color={completionRate >= 80 ? "success" : "warning"}
          />
          <LabeledProgress
            label="Dispute Win Rate"
            value={disputeWinRate}
            color={disputeWinRate >= 80 ? "success" : "warning"}
          />
          <LabeledProgress
            label="On-Time Delivery"
            value={onTimeDelivery}
            color={onTimeDelivery >= 80 ? "success" : "warning"}
          />
        </div>
      </SectionCard>

      {/* ================================================================ */}
      {/*  Contract History (full width)                                    */}
      {/* ================================================================ */}
      <SectionCard title="Contract History" className="mb-6">
        {contractHistory.length > 0 ? (
          <div className="overflow-x-auto -mx-6 -mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                    Title
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                    Value
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {contractHistory.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-surface-secondary transition-colors"
                  >
                    <td className="px-6 py-3 font-medium text-foreground">
                      {c.title}
                    </td>
                    <td className="px-3 py-3">
                      <Chip size="sm" variant="soft" color="default">
                        as {c.role}
                      </Chip>
                    </td>
                    <td className="px-3 py-3 text-right text-foreground font-mono">
                      {formatCurrency(c.value)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge
                        status={
                          c.status as
                            | "active"
                            | "completed"
                            | "draft"
                            | "disputed"
                            | "failed"
                        }
                      />
                    </td>
                    <td className="px-6 py-3 text-right text-muted text-xs">
                      {c.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-8">No contract history yet.</p>
        )}
      </SectionCard>
    </div>
  );
}
