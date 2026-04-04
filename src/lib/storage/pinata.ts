import { PinataSDK } from "pinata";

let _pinata: PinataSDK | null = null;

function getPinata(): PinataSDK | null {
  if (!process.env.PINATA_JWT) return null;
  if (!_pinata) {
    _pinata = new PinataSDK({
      pinataJwt: process.env.PINATA_JWT,
      pinataGateway:
        process.env.PINATA_GATEWAY_URL ?? "gateway.pinata.cloud",
    });
  }
  return _pinata;
}

export function isPinataConfigured(): boolean {
  return !!process.env.PINATA_JWT;
}

export async function uploadToPinata(
  file: Buffer,
  filename: string,
  contentType: string,
): Promise<{ cid: string; url: string } | null> {
  const pinata = getPinata();
  if (!pinata) return null;

  try {
    const uint8 = new Uint8Array(file);
    const blob = new Blob([uint8], { type: contentType });
    const uploadFile = new File([blob], filename, { type: contentType });
    const result = await pinata.upload.public.file(uploadFile);
    const gateway =
      process.env.PINATA_GATEWAY_URL ?? "gateway.pinata.cloud";
    const url = `https://${gateway}/ipfs/${result.cid}`;
    return { cid: result.cid, url };
  } catch (err) {
    console.error("[pinata] Upload failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getFromPinata(cid: string): Promise<string> {
  const gateway =
    process.env.PINATA_GATEWAY_URL ?? "gateway.pinata.cloud";
  return `https://${gateway}/ipfs/${cid}`;
}
