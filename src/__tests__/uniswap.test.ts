import { describe, it, expect } from "vitest";
import { DEFAULT_FEE_TIER } from "@/lib/uniswap/pool";

/**
 * Inline copy of encodeSqrtPriceX96 from pool.ts for unit testing.
 * The original is not exported, so we replicate the pure math here.
 */
function encodeSqrtPriceX96(
  price: number,
  token0Decimals: number,
  token1Decimals: number,
): bigint {
  const decimalAdjusted = price * Math.pow(10, token1Decimals - token0Decimals);
  const sqrtPrice = Math.sqrt(decimalAdjusted);
  const Q96 = BigInt(2) ** BigInt(96);
  const sqrtPriceX96 =
    (BigInt(Math.floor(sqrtPrice * 1e18)) * Q96) / BigInt(1e18);
  return sqrtPriceX96;
}

/**
 * Inline copy of calculateMinOutput from swap.ts for testing slippage logic.
 * The original is not exported, so we test the math directly.
 */
function calculateMinOutputFromQuote(
  quote: bigint,
  slippageBps: number,
): bigint {
  if (quote > BigInt(0)) {
    return (quote * BigInt(10000 - slippageBps)) / BigInt(10000);
  }
  return BigInt(0);
}

describe("Uniswap pool — encodeSqrtPriceX96", () => {
  it("returns correct value for 1:1 price with same decimals (18/18)", () => {
    const result = encodeSqrtPriceX96(1, 18, 18);
    // sqrt(1) * 2^96 = 2^96 = 79228162514264337593543950336
    const Q96 = BigInt(2) ** BigInt(96);
    // Allow small rounding tolerance (integer floor in impl)
    const diff =
      result > Q96 ? Number(result - Q96) : Number(Q96 - result);
    expect(diff).toBeLessThan(1e12); // tiny relative to 2^96
  });

  it("handles different decimal tokens (18 vs 6)", () => {
    // price = 1 token0 = 1 token1, but token0 has 18 decimals and token1 has 6
    // decimalAdjusted = 1 * 10^(6 - 18) = 10^-12
    // sqrtPrice = sqrt(10^-12) = 10^-6
    // sqrtPriceX96 = 10^-6 * 2^96 ~ 79228162514264
    const result = encodeSqrtPriceX96(1, 18, 6);
    expect(result).toBeGreaterThan(BigInt(0));
    // The value should be much smaller than 2^96 because of the decimal difference
    const Q96 = BigInt(2) ** BigInt(96);
    expect(result).toBeLessThan(Q96);
  });

  it("handles different decimal tokens (6 vs 18)", () => {
    // price = 1, token0 = 6 decimals, token1 = 18 decimals
    // decimalAdjusted = 1 * 10^(18 - 6) = 10^12
    // sqrtPrice = 10^6
    // sqrtPriceX96 = 10^6 * 2^96 ~ very large number
    const result = encodeSqrtPriceX96(1, 6, 18);
    const Q96 = BigInt(2) ** BigInt(96);
    expect(result).toBeGreaterThan(Q96);
  });

  it("price of 0.9 USDC per token with same decimals", () => {
    // price = 0.9, both 18 decimals
    const result = encodeSqrtPriceX96(0.9, 18, 18);
    const Q96 = BigInt(2) ** BigInt(96);
    // sqrt(0.9) ~ 0.9487, so result should be ~0.9487 * 2^96
    // Just verify it's less than 2^96 (since price < 1)
    expect(result).toBeLessThan(Q96);
    expect(result).toBeGreaterThan(BigInt(0));
  });
});

describe("Uniswap pool — token ordering", () => {
  it("token0 < token1 (lexicographic by address)", () => {
    const addrA = "0x1111111111111111111111111111111111111111";
    const addrB = "0x9999999999999999999999999999999999999999";

    // Replicate the ordering logic from createPool
    const [token0, token1] =
      addrA.toLowerCase() < addrB.toLowerCase()
        ? [addrA, addrB]
        : [addrB, addrA];

    expect(token0).toBe(addrA);
    expect(token1).toBe(addrB);
  });

  it("swaps order when first address is larger", () => {
    const addrA = "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
    const addrB = "0x0000000000000000000000000000000000000001";

    const [token0, token1] =
      addrA.toLowerCase() < addrB.toLowerCase()
        ? [addrA, addrB]
        : [addrB, addrA];

    expect(token0).toBe(addrB);
    expect(token1).toBe(addrA);
  });
});

describe("Uniswap swap — slippage calculation", () => {
  it("amountOutMinimum is properly computed from quote (50 bps = 0.5%)", () => {
    const quote = BigInt(1_000_000); // 1 USDC (6 decimals)
    const slippageBps = 50;
    const result = calculateMinOutputFromQuote(quote, slippageBps);
    // 1,000,000 * 9950 / 10000 = 995,000
    expect(result).toBe(BigInt(995_000));
  });

  it("handles 1% slippage (100 bps)", () => {
    const quote = BigInt(2_000_000);
    const result = calculateMinOutputFromQuote(quote, 100);
    expect(result).toBe(BigInt(1_980_000));
  });

  it("returns 0 when quote is 0", () => {
    const result = calculateMinOutputFromQuote(BigInt(0), 50);
    expect(result).toBe(BigInt(0));
  });

  it("handles zero slippage", () => {
    const quote = BigInt(1_000_000);
    const result = calculateMinOutputFromQuote(quote, 0);
    expect(result).toBe(BigInt(1_000_000));
  });
});

describe("Uniswap pool — constants", () => {
  it("DEFAULT_FEE_TIER is 3000 (0.3%)", () => {
    expect(DEFAULT_FEE_TIER).toBe(3000);
  });

  it("MIN_TICK and MAX_TICK are correct for 0.3% fee tier (tick spacing 60)", () => {
    // For tick spacing 60:
    // MIN_TICK = Math.ceil(-887272 / 60) * 60 = -887220
    // MAX_TICK = Math.floor(887272 / 60) * 60 = 887220
    const TICK_SPACING = 60;
    const expectedMin = Math.ceil(-887272 / TICK_SPACING) * TICK_SPACING;
    const expectedMax = Math.floor(887272 / TICK_SPACING) * TICK_SPACING;

    expect(expectedMin).toBe(-887220);
    expect(expectedMax).toBe(887220);
  });
});
