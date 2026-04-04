export function computeAgencyScore(profile: {
  contractsCompleted: number;
  contractsFailed: number;
  disputesWon: number;
  disputesLost: number;
  avgAiScore: number;
}): number {
  const totalContracts = profile.contractsCompleted + profile.contractsFailed;
  const completionRate = totalContracts > 0 ? (profile.contractsCompleted / totalContracts) * 100 : 0;
  const totalDisputes = profile.disputesWon + profile.disputesLost;
  const disputeWinRate = totalDisputes > 0 ? (profile.disputesWon / totalDisputes) * 100 : 50;
  const aiScore = profile.avgAiScore || 50;
  return Math.round((completionRate * 40 + disputeWinRate * 30 + aiScore * 30) / 100);
}

export function getAgencyTier(score: number): string {
  if (score >= 96) return "Elite";
  if (score >= 81) return "Diamond";
  if (score >= 61) return "Established";
  if (score >= 31) return "Growing";
  return "Seedling";
}

export function getRiskTier(score: number): { label: string; level: "low" | "medium" | "high" } {
  if (score >= 80) return { label: "Low Risk", level: "low" };
  if (score >= 50) return { label: "Medium Risk", level: "medium" };
  return { label: "High Risk", level: "high" };
}
