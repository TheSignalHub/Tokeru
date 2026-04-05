import { ethers } from "ethers";
import { getDeployerSigner } from "./clients";
import { CHAIN_CONFIG } from "./config";
import { AGENCY_PROFILE_ABI } from "./abis";

function getAgencyProfileContract(): ethers.Contract | null {
  const addr = CHAIN_CONFIG.agencyProfileAddress;
  if (!addr || addr === ethers.ZeroAddress) return null;
  const signer = getDeployerSigner();
  return new ethers.Contract(addr, AGENCY_PROFILE_ABI, signer);
}

/**
 * Record a contract completion on-chain (best-effort).
 */
export async function recordCompletion(
  agency: string,
  volume: number,
  score: number,
): Promise<string | null> {
  const contract = getAgencyProfileContract();
  if (!contract) return null;
  try {
    const volumeWei = ethers.parseUnits(volume.toString(), 18);
    const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
    const tx = await contract.recordCompletion(agency, volumeWei, boundedScore);
    const receipt = await tx.wait(1);
    return receipt.hash;
  } catch (err) {
    console.error("[AgencyProfile] recordCompletion failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Record a contract failure on-chain (best-effort).
 */
export async function recordFailure(
  agency: string,
  score: number,
): Promise<string | null> {
  const contract = getAgencyProfileContract();
  if (!contract) return null;
  try {
    const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
    const tx = await contract.recordFailure(agency, boundedScore);
    const receipt = await tx.wait(1);
    return receipt.hash;
  } catch (err) {
    console.error("[AgencyProfile] recordFailure failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Record a dispute result on-chain (best-effort).
 */
export async function recordDisputeResult(
  agency: string,
  won: boolean,
  score: number,
): Promise<string | null> {
  const contract = getAgencyProfileContract();
  if (!contract) return null;
  try {
    const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
    const tx = await contract.recordDisputeResult(agency, won, boundedScore);
    const receipt = await tx.wait(1);
    return receipt.hash;
  } catch (err) {
    console.error("[AgencyProfile] recordDisputeResult failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Add a ZKP attestation proof hash on-chain (best-effort).
 */
export async function addAttestation(
  agency: string,
  proofHash: string,
): Promise<string | null> {
  const contract = getAgencyProfileContract();
  if (!contract) return null;
  try {
    const tx = await contract.addAttestation(agency, proofHash);
    const receipt = await tx.wait(1);
    return receipt.hash;
  } catch (err) {
    console.error("[AgencyProfile] addAttestation failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
