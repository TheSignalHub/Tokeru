import { type NextRequest } from "next/server";
import { db, ensureInit } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { uploadFile } from "@/lib/storage";
import { randomUUID } from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  try {
    await ensureInit();
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { address } = await params;

    const authWallet = auth.user!.walletAddress;
    if (!authWallet || authWallet.toLowerCase() !== address.toLowerCase()) {
      return Response.json(
        { error: "Forbidden: address mismatch" },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const label = formData.get("label") as string | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    if (!label) {
      return Response.json({ error: "No label provided" }, { status: 400 });
    }

    // Convert File to Buffer for storage layer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const storageResult = await uploadFile(
      buffer,
      file.name,
      file.type || "application/octet-stream",
    );

    // Store document record in DB
    const doc = await db.documents.createDocument({
      id: randomUUID(),
      contractId: address, // user-level doc, keyed by address
      type: "attestation" as "contract_terms" | "deliverable" | "evidence",
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      contentHash: storageResult.contentHash,
      ipfsHash: storageResult.ipfsHash,
      blobUrl: storageResult.blobUrl,
      url: storageResult.url,
      size: storageResult.size,
    });

    return Response.json({
      label,
      verified: false,
      hash: doc.contentHash,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
