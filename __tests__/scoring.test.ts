import { describe, it, expect } from "vitest";
import { computeAgencyScore, getAgencyTier } from "@/lib/scoring";

describe("computeAgencyScore", () => {
  it("returns 100 with perfect record", () => {
    // 10 completed, 0 failed => completionRate=100
    // 0 disputes total => disputeWinRate defaults to 50
    // avgAiScore=0 => aiScore defaults to 50
    // score = (100*40 + 50*30 + 50*30)/100 = (4000+1500+1500)/100 = 70
    // With perfect AI score:
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

  it("returns 0 with zero contracts", () => {
    const score = computeAgencyScore({
      contractsCompleted: 0,
      contractsFailed: 0,
      disputesWon: 0,
      disputesLost: 0,
      avgAiScore: 0,
    });
    // completionRate = 0 (no contracts)
    // disputeWinRate = 50 (default when no disputes)
    // aiScore = 50 (default when 0)
    // (0*40 + 50*30 + 50*30)/100 = 3000/100 = 30
    expect(score).toBe(30);
  });

  it("handles mixed record correctly", () => {
    const score = computeAgencyScore({
      contractsCompleted: 7,
      contractsFailed: 3,
      disputesWon: 2,
      disputesLost: 3,
      avgAiScore: 60,
    });
    // completionRate = 7/10 * 100 = 70
    // disputeWinRate = 2/5 * 100 = 40
    // aiScore = 60
    // (70*40 + 40*30 + 60*30)/100 = (2800 + 1200 + 1800)/100 = 58
    expect(score).toBe(58);
  });

  it("handles only disputes with no completions", () => {
    const score = computeAgencyScore({
      contractsCompleted: 0,
      contractsFailed: 0,
      disputesWon: 1,
      disputesLost: 4,
      avgAiScore: 0,
    });
    // completionRate = 0 (no contracts)
    // disputeWinRate = 1/5 * 100 = 20
    // aiScore = 50 (default)
    // (0*40 + 20*30 + 50*30)/100 = (0 + 600 + 1500)/100 = 21
    expect(score).toBe(21);
  });

  it("defaults avgAiScore to 50 when 0", () => {
    const scoreWith0 = computeAgencyScore({
      contractsCompleted: 5,
      contractsFailed: 5,
      disputesWon: 0,
      disputesLost: 0,
      avgAiScore: 0,
    });
    // completionRate = 50, disputeWinRate = 50, aiScore = 50
    // (50*40 + 50*30 + 50*30)/100 = 5000/100 = 50
    expect(scoreWith0).toBe(50);
  });

  it("handles all failures", () => {
    const score = computeAgencyScore({
      contractsCompleted: 0,
      contractsFailed: 10,
      disputesWon: 0,
      disputesLost: 5,
      avgAiScore: 10,
    });
    // completionRate = 0
    // disputeWinRate = 0
    // aiScore = 10
    // (0 + 0 + 10*30)/100 = 300/100 = 3
    expect(score).toBe(3);
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

  it("returns Seedling for score 0-30", () => {
    expect(getAgencyTier(0)).toBe("Seedling");
    expect(getAgencyTier(30)).toBe("Seedling");
  });

  it("handles exact boundaries", () => {
    expect(getAgencyTier(30)).toBe("Seedling");
    expect(getAgencyTier(31)).toBe("Growing");
    expect(getAgencyTier(60)).toBe("Growing");
    expect(getAgencyTier(61)).toBe("Established");
    expect(getAgencyTier(80)).toBe("Established");
    expect(getAgencyTier(81)).toBe("Diamond");
    expect(getAgencyTier(95)).toBe("Diamond");
    expect(getAgencyTier(96)).toBe("Elite");
  });
});
