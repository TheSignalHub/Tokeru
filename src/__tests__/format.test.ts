import { describe, it, expect, vi, afterEach } from "vitest";
import {
  timeAgo,
  formatCurrency,
  truncateMiddle,
  formatPercent,
} from "@/lib/utils/format";

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for less than 60 seconds ago", () => {
    vi.useFakeTimers();
    const now = new Date("2026-04-04T12:00:00Z");
    vi.setSystemTime(now);

    expect(timeAgo(new Date("2026-04-04T11:59:30Z"))).toBe("just now");
    expect(timeAgo(new Date("2026-04-04T11:59:55Z"))).toBe("just now");
  });

  it("returns minutes ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00Z"));

    expect(timeAgo(new Date("2026-04-04T11:55:00Z"))).toBe("5m ago");
    expect(timeAgo(new Date("2026-04-04T11:30:00Z"))).toBe("30m ago");
  });

  it("returns hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00Z"));

    expect(timeAgo(new Date("2026-04-04T09:00:00Z"))).toBe("3h ago");
    expect(timeAgo(new Date("2026-04-04T00:00:00Z"))).toBe("12h ago");
  });

  it("returns days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00Z"));

    expect(timeAgo(new Date("2026-04-03T12:00:00Z"))).toBe("1d ago");
    expect(timeAgo(new Date("2026-04-01T12:00:00Z"))).toBe("3d ago");
  });

  it("returns weeks ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00Z"));

    expect(timeAgo(new Date("2026-03-21T12:00:00Z"))).toBe("2w ago");
  });

  it("returns formatted date for more than 30 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00Z"));

    const result = timeAgo(new Date("2026-01-01T12:00:00Z"));
    // Should be a formatted date string, not a relative time
    expect(result).not.toContain("ago");
    expect(result).not.toBe("just now");
  });

  it("accepts string dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00Z"));

    expect(timeAgo("2026-04-04T11:55:00Z")).toBe("5m ago");
  });
});

describe("formatCurrency", () => {
  it("formats basic integer", () => {
    expect(formatCurrency(1000)).toBe("$1,000");
  });

  it("formats large numbers with commas", () => {
    expect(formatCurrency(45000)).toBe("$45,000");
    expect(formatCurrency(1234567)).toBe("$1,234,567");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("uses custom symbol", () => {
    expect(formatCurrency(100, "USDC ")).toBe("USDC 100");
  });

  it("formats decimals", () => {
    const result = formatCurrency(99.99);
    expect(result).toContain("99");
  });
});

describe("truncateMiddle", () => {
  it("truncates a long address", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const result = truncateMiddle(addr);
    expect(result).toBe("0x1234\u2026567890abcdef12345678".slice(0, 6) + "\u2026" + addr.slice(-4));
  });

  it("returns empty string for empty input", () => {
    expect(truncateMiddle("")).toBe("");
  });

  it("returns short strings unchanged", () => {
    expect(truncateMiddle("0x1234")).toBe("0x1234");
  });
});

describe("formatPercent", () => {
  it("formats integer percentage", () => {
    expect(formatPercent(75)).toBe("75%");
  });

  it("formats with decimal places", () => {
    expect(formatPercent(75.5, 1)).toBe("75.5%");
  });

  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0%");
  });
});
