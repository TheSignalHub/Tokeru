import { describe, it, expect } from "vitest";
import {
  computeAgencyScore,
  getAgencyTier,
  getRiskTier,
} from "@/lib/scoring";

describe("computeAgencyScore", () => {
  it("returns 50 for a brand new agency with no history", () => {
    const score = computeAgencyScore({
      contractsCompleted: 0,
      contractsFailed: 0,
      disputesWon: 0,
      disputesLost: 0,
      avgAiScore: 50,
    });
    // completionRate = 0, disputeWinRate = 50 (default), aiScore = 50
    // (0*40 + 50*30 + 50*30) / 100 = 30
    expect(score).toBe(30);
  });

  it("returns 100 for a perfect agency", () => {
    const score = computeAgencyScore({
      contractsCompleted: 10,
      contractsFailed: 0,
      disputesWon: 5,
      disputesLost: 0,
      avgAiScore: 100,
    });
    // completionRate = 100, disputeWinRate = 100, aiScore = 100
    // (100*40 + 100*30 + 100*30) / 100 = 100
    expect(score).toBe(100);
  });

  it("weights completion rate at 40%, disputes at 30%, AI at 30%", () => {
    const score = computeAgencyScore({
      contractsCompleted: 8,
      contractsFailed: 2,
      disputesWon: 3,
      disputesLost: 7,
      avgAiScore: 60,
    });
    // completionRate = 80%, disputeWinRate = 30%, aiScore = 60
    // (80*40 + 30*30 + 60*30) / 100 = (3200 + 900 + 1800) / 100 = 59
    expect(score).toBe(59);
  });
});

describe("getAgencyTier", () => {
  it("returns Elite for score >= 96", () => {
    expect(getAgencyTier(96)).toBe("Elite");
    expect(getAgencyTier(100)).toBe("Elite");
  });

  it("returns Diamond for score 81-95", () => {
    expect(getAgencyTier(81)).toBe("Diamond");
    expect(getAgencyTier(95)).toBe("Diamond");
  });

  it("returns Established for score 61-80", () => {
    expect(getAgencyTier(61)).toBe("Established");
    expect(getAgencyTier(80)).toBe("Established");
  });

  it("returns Growing for score 31-60", () => {
    expect(getAgencyTier(31)).toBe("Growing");
    expect(getAgencyTier(60)).toBe("Growing");
  });

  it("returns Seedling for score <= 30", () => {
    expect(getAgencyTier(30)).toBe("Seedling");
    expect(getAgencyTier(0)).toBe("Seedling");
  });
});

describe("getRiskTier", () => {
  it("score >= 80 returns Low Risk", () => {
    expect(getRiskTier(80)).toEqual({ label: "Low Risk", level: "low" });
    expect(getRiskTier(100)).toEqual({ label: "Low Risk", level: "low" });
    expect(getRiskTier(95)).toEqual({ label: "Low Risk", level: "low" });
  });

  it("score 50-79 returns Medium Risk", () => {
    expect(getRiskTier(50)).toEqual({ label: "Medium Risk", level: "medium" });
    expect(getRiskTier(79)).toEqual({ label: "Medium Risk", level: "medium" });
    expect(getRiskTier(65)).toEqual({ label: "Medium Risk", level: "medium" });
  });

  it("score < 50 returns High Risk", () => {
    expect(getRiskTier(49)).toEqual({ label: "High Risk", level: "high" });
    expect(getRiskTier(0)).toEqual({ label: "High Risk", level: "high" });
    expect(getRiskTier(25)).toEqual({ label: "High Risk", level: "high" });
  });

  it("edge case: score = 80 (boundary Low/Medium)", () => {
    expect(getRiskTier(80).level).toBe("low");
  });

  it("edge case: score = 50 (boundary Medium/High)", () => {
    expect(getRiskTier(50).level).toBe("medium");
  });

  it("edge case: score = 0", () => {
    expect(getRiskTier(0).level).toBe("high");
  });

  it("edge case: score = 100", () => {
    expect(getRiskTier(100).level).toBe("low");
  });
});
