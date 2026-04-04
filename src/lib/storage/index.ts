import { createHash } from "crypto";
import { uploadToPinata, isPinataConfigured, getFromPinata } from "./pinata";
import { uploadToBlob, isBlobConfigured } from "./blob";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StorageResult {
  url: string;
  ipfsHash?: string;
  blobUrl?: string;
  contentHash: string;
  size: number;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

function computeHash(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function uploadFile(
  file: Buffer,
  filename: string,
  contentType: string,
): Promise<StorageResult> {
  const contentHash = computeHash(file);
  const size = file.length;

  let ipfsHash: string | undefined;
  let blobUrl: string | undefined;
  let primaryUrl: string | undefined;

  // Primary: try Pinata first
  if (isPinataConfigured()) {
    const pinataResult = await uploadToPinata(file, filename, contentType);
    if (pinataResult) {
      ipfsHash = pinataResult.cid;
      primaryUrl = pinataResult.url;
    }
  }

  // Fallback / dual-write: try Blob
  if (isBlobConfigured()) {
    // If Pinata succeeded, do the blob upload async (don't block)
    if (primaryUrl) {
      uploadToBlob(file, filename, contentType).then((result) => {
        if (result) {
          console.log("[storage] Dual-write to Blob succeeded:", result.url);
        }
      }).catch((err) => {
        console.error("[storage] Dual-write to Blob failed:", err);
      });
    } else {
      // Pinata failed or not configured — blob is the fallback
      const blobResult = await uploadToBlob(file, filename, contentType);
      if (blobResult) {
        blobUrl = blobResult.url;
        primaryUrl = blobResult.url;
      }
    }
  }

  if (!primaryUrl) {
    // Neither storage configured or both failed — return a data URL placeholder
    primaryUrl = `data:${contentType};hash=${contentHash}`;
    console.warn("[storage] No storage backend available. Using content hash as reference.");
  }

  return {
    url: primaryUrl,
    ipfsHash,
    blobUrl,
    contentHash,
    size,
  };
}

export async function uploadJSON(
  data: unknown,
  name: string,
): Promise<StorageResult> {
  const json = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(json, "utf-8");
  return uploadFile(buffer, `${name}.json`, "application/json");
}

export async function getFileUrl(contentHash: string): Promise<string | null> {
  // This would need a DB lookup to map contentHash -> ipfsHash or blobUrl
  // For now, return null — callers should use the stored URL from the document record
  void contentHash;
  return null;
}

export function isStorageConfigured(): boolean {
  return isPinataConfigured() || isBlobConfigured();
}
