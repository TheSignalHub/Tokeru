import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "crypto";

// We test the storage module by importing its pure functions and mocking
// the underlying providers (Pinata, Blob). The module checks env vars
// at call time, so we can manipulate process.env in each test.

describe("isStorageConfigured", () => {
  beforeEach(() => {
    // Clear storage env vars
    delete process.env.PINATA_JWT;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    // Reset module cache so env changes take effect
    vi.resetModules();
  });

  it("returns false when no env vars are set", async () => {
    delete process.env.PINATA_JWT;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const { isStorageConfigured } = await import("@/lib/storage");
    expect(isStorageConfigured()).toBe(false);
  });

  it("returns true when PINATA_JWT is set", async () => {
    process.env.PINATA_JWT = "test-jwt";
    const { isStorageConfigured } = await import("@/lib/storage");
    expect(isStorageConfigured()).toBe(true);
    delete process.env.PINATA_JWT;
  });

  it("returns true when BLOB_READ_WRITE_TOKEN is set", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const { isStorageConfigured } = await import("@/lib/storage");
    expect(isStorageConfigured()).toBe(true);
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });
});

describe("content hash computation is deterministic", () => {
  it("produces the same sha256 hash for the same input", () => {
    const data = Buffer.from("hello world");
    const hash1 = createHash("sha256").update(data).digest("hex");
    const hash2 = createHash("sha256").update(data).digest("hex");
    expect(hash1).toBe(hash2);
    // Known SHA-256 of "hello world"
    expect(hash1).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
    );
  });

  it("produces different hashes for different inputs", () => {
    const hash1 = createHash("sha256")
      .update(Buffer.from("file-a"))
      .digest("hex");
    const hash2 = createHash("sha256")
      .update(Buffer.from("file-b"))
      .digest("hex");
    expect(hash1).not.toBe(hash2);
  });
});

describe("uploadFile", () => {
  beforeEach(() => {
    delete process.env.PINATA_JWT;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    vi.resetModules();
  });

  it("returns correct structure when no storage is configured (fallback)", async () => {
    // No PINATA_JWT, no BLOB_READ_WRITE_TOKEN — forces the data: URL fallback
    delete process.env.PINATA_JWT;
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const { uploadFile } = await import("@/lib/storage");
    const content = Buffer.from("test file content");
    const result = await uploadFile(content, "test.txt", "text/plain");

    // Verify structure
    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("contentHash");
    expect(result).toHaveProperty("size");
    expect(typeof result.url).toBe("string");
    expect(typeof result.contentHash).toBe("string");
    expect(typeof result.size).toBe("number");

    // Verify content hash matches manual computation
    const expectedHash = createHash("sha256").update(content).digest("hex");
    expect(result.contentHash).toBe(expectedHash);

    // Verify size matches buffer length
    expect(result.size).toBe(content.length);

    // When no storage configured, URL should be a data: placeholder
    expect(result.url).toContain("data:");
    expect(result.url).toContain(expectedHash);

    // Optional fields should be undefined when no providers are configured
    expect(result.ipfsHash).toBeUndefined();
    expect(result.blobUrl).toBeUndefined();
  });

  it("returns deterministic contentHash for same input", async () => {
    delete process.env.PINATA_JWT;
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const { uploadFile } = await import("@/lib/storage");
    const content = Buffer.from("deterministic test");

    const result1 = await uploadFile(content, "a.txt", "text/plain");
    const result2 = await uploadFile(content, "b.txt", "text/plain");

    // Same content, different filenames -> same content hash
    expect(result1.contentHash).toBe(result2.contentHash);
    expect(result1.size).toBe(result2.size);
  });
});
