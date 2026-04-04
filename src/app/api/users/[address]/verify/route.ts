import { type NextRequest } from "next/server";
import { z } from "zod";
import { db, ensureInit } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isEASConfigured, attestAgencyKYB, verifyAttestation } from "@/lib/eas";
import { addAttestation } from "@/lib/blockchain/agency-profile";

const VerifySchema = z.object({
  jurisdiction: z.string().min(1, "Jurisdiction is required"),
  companyName: z.string().min(1, "Company name is required"),
});

/**
 * POST /api/users/[address]/verify
 * Create an EAS attestation for agency KYB verification.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    await ensureInit();
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { address } = await params;

    // Verify the caller owns this address
    const authWallet = auth.user!.walletAddress;
    if (!authWallet || authWallet.toLowerCase() !== address.toLowerCase()) {
      return Response.json(
        { error: "Forbidden: address mismatch" },
        { status: 403 },
      );
    }

    // Check the user exists and is an agency
    const user = await db.users.findByAddress(address);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }
    if (!user.roles?.includes("agency")) {
      return Response.json(
        { error: "Only agencies can be verified" },
        { status: 400 },
      );
    }

    // Check EAS is configured
    if (!isEASConfigured()) {
      return Response.json(
        { error: "EAS is not configured (missing DEPLOYER_PRIVATE_KEY)" },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { jurisdiction, companyName } = parsed.data;

    // Create EAS attestation
    const { uid, txHash } = await attestAgencyKYB({
      agencyAddress: address,
      jurisdiction,
      companyName,
    });

    // Record attestation on-chain in AgencyProfile contract (best-effort)
    await addAttestation(address, uid).catch((err) => {
      console.error("[verify] addAttestation on-chain failed:", err instanceof Error ? err.message : err);
    });

    // Update DB: mark as verified, store attestation UID
    const existingAttestations = user.agencyProfile?.attestations ?? [];
    await db.users.updateAgencyScore(address, {
      verified: true,
      companyName,
      attestations: [
        ...existingAttestations,
        { label: "KYB Verification", verified: true, hash: uid },
      ],
    });

    return Response.json({
      success: true,
      attestationUid: uid,
      txHash,
      easScanUrl: `https://base-sepolia.easscan.org/attestation/view/${uid}`,
    });
  } catch (error) {
    console.error("[verify] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/users/[address]/verify
 * Return verification status + attestation UID for an agency.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    await ensureInit();
    const { address } = await params;

    const user = await db.users.findByAddress(address);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const verified = user.agencyProfile?.verified ?? false;
    const attestations = user.agencyProfile?.attestations ?? [];

    // Find the KYB attestation
    const kybAttestation = attestations.find(
      (a) => a.label === "KYB Verification" && a.hash,
    );

    let attestationData = null;
    if (kybAttestation?.hash && isEASConfigured()) {
      try {
        const result = await verifyAttestation(kybAttestation.hash);
        if (result.valid) {
          attestationData = result.data;
        }
      } catch {
        // On-chain verification failed — just return DB status
      }
    }

    return Response.json({
      verified,
      attestationUid: kybAttestation?.hash ?? null,
      easScanUrl: kybAttestation?.hash
        ? `https://base-sepolia.easscan.org/attestation/view/${kybAttestation.hash}`
        : null,
      attestationData,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
