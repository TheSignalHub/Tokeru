import { getDb } from "./client";
import { documents as documentsTable } from "./schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateDocumentInput {
  id: string;
  contractId: string;
  milestoneId?: number;
  type: "contract_terms" | "deliverable" | "evidence";
  filename?: string;
  contentType?: string;
  contentHash: string;
  ipfsHash?: string;
  blobUrl?: string;
  url: string;
  size?: number;
  extractedText?: string;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createDocument(doc: CreateDocumentInput) {
  const db = getDb();
  const row = {
    id: doc.id,
    contractId: doc.contractId,
    milestoneId: doc.milestoneId ?? null,
    type: doc.type,
    filename: doc.filename ?? null,
    contentType: doc.contentType ?? null,
    contentHash: doc.contentHash,
    ipfsHash: doc.ipfsHash ?? null,
    blobUrl: doc.blobUrl ?? null,
    url: doc.url,
    size: doc.size ?? null,
    extractedText: doc.extractedText ?? null,
    createdAt: new Date().toISOString(),
  };
  await db.insert(documentsTable).values(row);
  return row;
}

export async function findByContract(contractId: string) {
  const db = getDb();
  return db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.contractId, contractId));
}

export async function findByMilestone(contractId: string, milestoneId: number) {
  const db = getDb();
  return db
    .select()
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.contractId, contractId),
        eq(documentsTable.milestoneId, milestoneId),
      ),
    );
}

export async function findByHash(contentHash: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.contentHash, contentHash));
  return rows[0] ?? null;
}
