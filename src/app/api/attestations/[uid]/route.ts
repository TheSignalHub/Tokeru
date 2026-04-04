import { type NextRequest } from "next/server";
import { isEASConfigured, verifyAttestation } from "@/lib/eas";

/**
 * GET /api/attestations/[uid]
 * Public endpoint — anyone can verify an attestation by UID.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const { uid } = await params;

    if (!uid || !uid.startsWith("0x")) {
      return Response.json(
        { error: "Invalid attestation UID" },
        { status: 400 },
      );
    }

    if (!isEASConfigured()) {
      return Response.json(
        { error: "EAS is not configured" },
        { status: 503 },
      );
    }

    const result = await verifyAttestation(uid);

    return Response.json({
      uid,
      valid: result.valid,
      data: result.data ?? null,
      easScanUrl: `https://base-sepolia.easscan.org/attestation/view/${uid}`,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
