import { put } from "@vercel/blob";

export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export async function uploadToBlob(
  file: Buffer,
  filename: string,
  contentType: string,
): Promise<{ url: string } | null> {
  if (!isBlobConfigured()) return null;

  try {
    const blob = await put(filename, file, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { url: blob.url };
  } catch (err) {
    console.error("[blob] Upload failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getFromBlob(url: string): Promise<string> {
  return url;
}
