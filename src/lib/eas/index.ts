import { EAS, SchemaRegistry, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { getDeployerSigner, getProvider } from "@/lib/blockchain/clients";

const EAS_ADDRESS = "0x4200000000000000000000000000000000000021";
const SCHEMA_REGISTRY_ADDRESS = "0x4200000000000000000000000000000000000020";

// KYB verification schema: verified status, jurisdiction, verification timestamp
const KYB_SCHEMA = "bool isVerified, string jurisdiction, string companyName, uint256 verifiedAt";

let _schemaUid: string | null = null;

export function isEASConfigured(): boolean {
  // EAS is predeployed, always available if blockchain is configured
  return !!process.env.DEPLOYER_PRIVATE_KEY;
}

/**
 * Register the KYB schema (idempotent — stores UID for reuse).
 * If the schema already exists on-chain, we compute its UID and reuse it.
 */
export async function getOrCreateSchema(): Promise<string> {
  if (_schemaUid) return _schemaUid;

  const signer = getDeployerSigner();
  const schemaRegistry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
  schemaRegistry.connect(signer);

  // Compute the deterministic UID for this schema
  const resolverAddress = "0x0000000000000000000000000000000000000000";
  const revocable = true;
  const computedUid = SchemaRegistry.getSchemaUID(KYB_SCHEMA, resolverAddress, revocable);

  // Check if schema already exists
  try {
    const existing = await schemaRegistry.getSchema({ uid: computedUid });
    if (existing && existing.uid === computedUid) {
      _schemaUid = computedUid;
      return _schemaUid;
    }
  } catch {
    // Schema doesn't exist yet — register it
  }

  try {
    const tx = await schemaRegistry.register({
      schema: KYB_SCHEMA,
      resolverAddress,
      revocable,
    });
    _schemaUid = await tx.wait();
    return _schemaUid!;
  } catch (err: unknown) {
    // If registration failed because schema already exists, use computed UID
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already") || message.includes("exists")) {
      _schemaUid = computedUid;
      return _schemaUid;
    }
    throw err;
  }
}

/**
 * Create a KYB attestation for an agency.
 */
export async function attestAgencyKYB(params: {
  agencyAddress: string;
  jurisdiction: string;
  companyName: string;
}): Promise<{ uid: string; txHash: string }> {
  const signer = getDeployerSigner();
  const eas = new EAS(EAS_ADDRESS);
  eas.connect(signer);

  const schemaUid = await getOrCreateSchema();
  const schemaEncoder = new SchemaEncoder(KYB_SCHEMA);

  const now = BigInt(Math.floor(Date.now() / 1000));

  const encodedData = schemaEncoder.encodeData([
    { name: "isVerified", value: true, type: "bool" },
    { name: "jurisdiction", value: params.jurisdiction, type: "string" },
    { name: "companyName", value: params.companyName, type: "string" },
    { name: "verifiedAt", value: now, type: "uint256" },
  ]);

  const tx = await eas.attest({
    schema: schemaUid,
    data: {
      recipient: params.agencyAddress,
      expirationTime: BigInt(0),
      revocable: true,
      data: encodedData,
    },
  });

  const uid = await tx.wait();
  const receipt = tx.receipt;
  const txHash = receipt?.hash ?? "";

  return { uid, txHash };
}

/**
 * Verify an attestation by UID.
 */
export async function verifyAttestation(uid: string): Promise<{
  valid: boolean;
  data?: {
    isVerified: boolean;
    jurisdiction: string;
    companyName: string;
    verifiedAt: number;
  };
}> {
  const provider = getProvider();
  const eas = new EAS(EAS_ADDRESS);
  eas.connect(provider);

  try {
    const attestation = await eas.getAttestation(uid);

    // Check if it's been revoked
    const isRevoked = attestation.revocationTime > BigInt(0);
    if (isRevoked) {
      return { valid: false };
    }

    // Decode the data
    const schemaEncoder = new SchemaEncoder(KYB_SCHEMA);
    const decoded = schemaEncoder.decodeData(attestation.data);

    const isVerified = decoded.find((d) => d.name === "isVerified")?.value.value as boolean;
    const jurisdiction = decoded.find((d) => d.name === "jurisdiction")?.value.value as string;
    const companyName = decoded.find((d) => d.name === "companyName")?.value.value as string;
    const verifiedAt = Number(decoded.find((d) => d.name === "verifiedAt")?.value.value ?? 0);

    return {
      valid: true,
      data: { isVerified, jurisdiction, companyName, verifiedAt },
    };
  } catch (err) {
    console.error("[EAS] verifyAttestation failed:", err instanceof Error ? err.message : err);
    return { valid: false };
  }
}

/**
 * Revoke an attestation (if agency is flagged).
 */
export async function revokeAttestation(uid: string): Promise<string> {
  const signer = getDeployerSigner();
  const eas = new EAS(EAS_ADDRESS);
  eas.connect(signer);

  const schemaUid = await getOrCreateSchema();

  const tx = await eas.revoke({
    schema: schemaUid,
    data: { uid },
  });

  await tx.wait();
  const receipt = tx.receipt;
  return receipt?.hash ?? "";
}
