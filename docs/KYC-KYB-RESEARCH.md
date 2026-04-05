# Tokeru — KYC/KYB Verification Research

> Research conducted April 4, 2026 for ETHGlobal Cannes hackathon.
> Goal: let agencies prove legitimacy to investors without revealing private data.

## The Problem

Investors on Tokeru need confidence that agencies are real businesses, not scammers. But agencies don't want to publicly expose their company registration, tax ID, or founder identity. We need **verifiable trust without full disclosure**.

---

## Technologies Evaluated

### 1. Ethereum Attestation Service (EAS) ✅ SELECTED

**What:** Generic on-chain attestation infrastructure. Anyone can define a schema (structured data format) and make signed attestations. Think of it as a permissionless, on-chain notary.

**Why it's interesting:**
- **Already deployed on Base Sepolia** at predeploy addresses — zero deployment needed
  - EAS: `0x4200000000000000000000000000000000000021`
  - SchemaRegistry: `0x4200000000000000000000000000000000000020`
- Attestations are publicly verifiable on-chain — anyone can confirm "Agency X was verified by Platform Y"
- Supports both on-chain (public) and off-chain (private) attestations
- TypeScript SDK: `@ethereum-attestation-service/eas-sdk`
- Free (just gas, and Base Sepolia gas is free)
- Part of the OP Stack standard — Coinbase/Base actively promotes it

**How it works:**
1. Tokeru registers a KYB schema on EAS (e.g., `bool isVerified, string jurisdiction, uint256 verifiedAt`)
2. When an agency passes verification, Tokeru attests on-chain via EAS
3. The attestation UID is stored in the `AgencyProfile.sol` contract
4. Investors can verify the attestation independently on `base-sepolia.easscan.org`
5. No private data is on-chain — just the fact that verification passed

**Implementation:**
- SDK: `@ethereum-attestation-service/eas-sdk`
- Register schema → make attestations → verify attestations
- Integration effort: 2-3 hours
- Already on our chain (Base Sepolia)

---

### 2. World ID (Worldcoin)

**What:** Proof of personhood using iris biometrics (Orb) or device-level verification. Proves "this is a unique human" without revealing who.

**Why it's interesting:**
- $20,000 ETHGlobal Cannes bounty (largest single sponsor)
- Proves agency founder is a real, unique person — strong sybil resistance
- ZKP-native: no identity data leaves the user's device

**Why we didn't pick it (for now):**
- Proves personhood, NOT business legitimacy (no KYB)
- $17K prize requires building inside World App (mini-app framework) — architectural conflict with our Privy + Next.js setup
- $3K pool prize is more flexible but smaller
- Would complement EAS well as a secondary layer

**Implementation:** `@worldcoin/minikit-js` (MiniKit) or IDKit for standalone web apps. Medium effort.

---

### 3. Reclaim Protocol

**What:** zkTLS-based proofs of web2 data. Users prove facts from any HTTPS website (bank accounts, government registries, professional certifications) using ZKP generated from HTTPS traffic.

**Why it's interesting:**
- 200+ data providers, AI-generated provider creation
- No browser extension needed (unlike zkPass)
- Could prove: business registration from government site, revenue from banking platform, professional certifications
- 3M+ verifications with zero fraud

**Why we didn't pick it:**
- No ETHGlobal Cannes prize track
- Base Sepolia support uncertain
- Strong technology but less hackathon-aligned

**Implementation:** `@reclaimprotocol/reclaim-sdk`, ~1 hour integration claimed.

---

### 4. zkPass

**What:** Privacy oracle using zkTLS. Proves facts about web2 data (bank statements, business registrations) on-chain without revealing raw data.

**Why we didn't pick it:**
- Requires TransGate browser extension — UX friction for demos
- Base Sepolia support undocumented
- No ETHGlobal Cannes prize track

---

### 5. Privado ID (formerly Polygon ID)

**What:** ZKP-based verifiable credentials. Issuers grant credentials, holders generate ZK proofs of attributes.

**Why we didn't pick it:**
- Requires Docker-based issuer node — too heavy for a hackathon
- No native Base/Base Sepolia support (Polygon PoS/zkEVM only)
- Multi-step credential issuance flow
- No ETHGlobal Cannes prize

---

### 6. Gitcoin Passport (Human Passport)

**What:** Sybil resistance scoring. Aggregates stamps (Twitter, GitHub, ENS, on-chain activity) into a humanity score.

**Why we didn't pick it:**
- Sybil scoring, not business verification
- Tells you "this wallet belongs to a real active person" but not "this is a registered business"
- Could complement but not replace KYB verification
- Simple REST API, easy integration (~1 hour)

---

### 7. Self Protocol

**What:** ZKP identity verification using NFC-enabled passport/ID scanning. Users scan physical passport with phone NFC, ZK proof generated over document data.

**Why we didn't pick it:**
- Requires Celo deployment (not Base Sepolia)
- $10K prize but would require maintaining contracts on two chains
- NFC passport scanning is cool but hard to demo reliably
- Proves individual identity, not business legitimacy

---

### 8. Unlink SDK (already integrated)

**What:** ZKP shielded transfers. Privacy layer for token movements (deposit, transfer, withdraw via private pools).

**Status:** Already partially integrated for milestone payouts. NOT an identity/KYC solution — purely transactional privacy.

---

## Decision Matrix

| Criterion | EAS | World ID | Reclaim | zkPass | Privado | Passport | Self |
|---|---|---|---|---|---|---|---|
| KYB verification | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Base Sepolia | ✅ predeployed | ❌ World Chain | ❓ | ❓ | ❌ | ✅ API | ❌ Celo |
| Hackathon speed | ✅ 2-3h | ⚠️ medium | ✅ ~1h | ⚠️ extension | ❌ days | ✅ ~1h | ⚠️ medium |
| ZKP native | ❌ public | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Prize track | ❌ | ✅ $20K | ❌ | ❌ | ❌ | ❌ | ✅ $10K |
| Fits our arch | ✅ perfect | ⚠️ needs mini-app | ✅ | ⚠️ extension | ❌ | ✅ | ❌ Celo |

## Conclusion

**EAS is the clear winner** for this hackathon:
- Already deployed on our chain (zero setup)
- Fast integration (2-3 hours)
- Perfect fit: attest agency KYB on-chain → investors verify → trust established
- Composable with our existing `AgencyProfile.sol` attestation system

**Future additions** (post-hackathon):
- World ID for proof-of-personhood (complements EAS)
- Reclaim Protocol for ZKP-based KYB from government registries
- This would create a layered trust system: `EAS attestation + World ID personhood + Reclaim KYB proof`
