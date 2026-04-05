import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("isUnlinkConfigured", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules so isUnlinkConfigured re-reads process.env
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns false when no env vars are set", async () => {
    delete process.env.UNLINK_API_KEY;
    delete process.env.DEPLOYER_PRIVATE_KEY;
    delete process.env.EVM_PRIVATE_KEY;

    const { isUnlinkConfigured } = await import("@/lib/privacy/unlink");
    expect(isUnlinkConfigured()).toBe(false);
  });

  it("returns false when only UNLINK_API_KEY is set (no private key)", async () => {
    process.env.UNLINK_API_KEY = "test-api-key";
    delete process.env.DEPLOYER_PRIVATE_KEY;
    delete process.env.EVM_PRIVATE_KEY;

    const { isUnlinkConfigured } = await import("@/lib/privacy/unlink");
    expect(isUnlinkConfigured()).toBe(false);
  });

  it("returns true with UNLINK_API_KEY + DEPLOYER_PRIVATE_KEY", async () => {
    process.env.UNLINK_API_KEY = "test-api-key";
    process.env.DEPLOYER_PRIVATE_KEY = "0xdeadbeef";
    delete process.env.EVM_PRIVATE_KEY;

    const { isUnlinkConfigured } = await import("@/lib/privacy/unlink");
    expect(isUnlinkConfigured()).toBe(true);
  });

  it("returns true with UNLINK_API_KEY + EVM_PRIVATE_KEY", async () => {
    process.env.UNLINK_API_KEY = "test-api-key";
    process.env.EVM_PRIVATE_KEY = "0xcafebabe";
    delete process.env.DEPLOYER_PRIVATE_KEY;

    const { isUnlinkConfigured } = await import("@/lib/privacy/unlink");
    expect(isUnlinkConfigured()).toBe(true);
  });

  it("returns true when both private keys are set", async () => {
    process.env.UNLINK_API_KEY = "test-api-key";
    process.env.EVM_PRIVATE_KEY = "0xcafebabe";
    process.env.DEPLOYER_PRIVATE_KEY = "0xdeadbeef";

    const { isUnlinkConfigured } = await import("@/lib/privacy/unlink");
    expect(isUnlinkConfigured()).toBe(true);
  });
});
