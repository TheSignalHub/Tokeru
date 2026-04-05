# Tokeru — Architecture

## Single-Chain Model (Base Sepolia)

Tokeru currently runs on **Base Sepolia** (local dev: Anvil fork at `localhost:8545`). The Anvil fork inherits all deployed contracts from Base Sepolia, including Uniswap V3.

```
┌─────────────────────────────────────────────────────┐
│  BASE SEPOLIA (Chain 84532) / Anvil fork (31337)    │
│                                                     │
│  ContractFactory (singleton)                        │
│    └── createDeal() deploys per-deal:               │
│                                                     │
│  ServiceContract (per-deal orchestrator)             │
│    ├── Escrow: client deposits USDC                 │
│    ├── Milestones: state machine                    │
│    ├── Fee splits: platform + BD + agency           │
│    └── Controls ContractToken minting               │
│                                                     │
│  ContractToken (per-deal ERC20)                     │
│    └── Traded on Uniswap V3 after tokenization      │
│                                                     │
│  AgencyProfile (singleton)                           │
│    ├── On-chain agency reputation                    │
│    ├── Records: completions, failures, disputes      │
│    ├── Stores score (0-100) and attestation hashes   │
│    └── Owner-only writes (platform deployer)         │
│                                                     │
│  Uniswap V3 (from Base Sepolia)                     │
│    ├── Factory: 0x4752ba5DBc23f44D87826276BF6Fd6b1C │
│    ├── Router:  0x94cC0AaC535CCDB3C01d678...         │
│    └── NonfungiblePositionManager: 0x27F971cb...     │
│                                                     │
│  EAS (predeployed on Base)                           │
│    ├── EAS: 0x4200000000000000000000000000000021      │
│    ├── SchemaRegistry: 0x42000000000000000000000020   │
│    └── KYB attestations for agency verification      │
│                                                     │
│  Test USDC (ContractToken deployed as tUSDC)         │
│    └── Minted by deploy script for testing           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Data Placement

| Data | Where | Why |
|---|---|---|
| Contract terms, milestones, deadlines | DB (Postgres) | Fast reads for UI |
| Client identity (name, address) | DB only | **NEVER exposed to investors** |
| Escrow (client's USDC) | On-chain (ServiceContract) | Trustless custody |
| Deliverable proofs | DB + on-chain hash | Proof of submission |
| ContractToken (ERC20) | On-chain | Deployed by factory, traded on Uniswap |
| Token marketplace | Uniswap V3 pools | Real AMM liquidity |
| Agency reputation | DB + on-chain (AgencyProfile.sol) | Score, completions, disputes synced on-chain |
| Documents / evidence | DB + Pinata (IPFS) + Vercel Blob | Dual-write: Pinata primary, Blob fallback |
| KYB verification | On-chain (EAS attestation) | Revocable attestation on Base |
| Disputes | DB | Discussion + evidence + fees work; Kleros court ruling stubbed |
| Notifications | DB + email | DB-backed notifications + Resend email at every lifecycle step |
| Holdings | DB | Investor portfolio tracking (token holdings per contract) |
| Settlements | DB | Settlement proposals within dispute discussion phase |

## The Complete Flow

### 1. Contract Creation (DB-only)
```
Agency calls POST /api/contracts
  → Contract saved to DB as "draft"
  → NO on-chain deployment yet
  → Invite email sent to counterparty
  → DB notification created
```

### 2. Escrow Deposit (triggers on-chain deployment)
```
Client calls POST /api/contracts/[id]/deposit
  → ContractFactory.createDeal() on-chain
  → ServiceContract + ContractToken deployed atomically
  → Addresses stored in DB
  → ERC20 approve + ServiceContract.depositEscrow() on-chain
  → Contract status: Draft → Active
  → Notifications sent to all parties
```

### 3. Milestone Delivery & Approval
```
Agency: POST /api/contracts/[id]/deliver (with proof)
  → ServiceContract.submitDeliverable() on-chain
  → Milestone: pending → delivered

Client: POST /api/contracts/[id]/approve
  → ServiceContract.approveMilestone() on-chain
  → Fee split: 2.5% platform + BD% + agency remainder
  → Optional: Unlink private transfer to agency
```

### 4. Tokenization (3 Separate Steps — Agency only)
```
Step 1 — Tokenize (DB-only):
  Agency calls POST /api/contracts/[id]/tokenize
  → Contract marked as tokenized in DB
  → Agency chooses exposure settings (what investors see)
  → No on-chain action yet

Step 2 — Buy (mint on demand):
  Investor calls POST /api/marketplace/[tokenId]/buy
  → ContractToken.mint() on-chain
  → USDC → ContractToken swap via Uniswap V3
  → Real AMM execution

Step 3 — Pool (optional):
  Agency calls POST /api/contracts/[id]/pool
  → Uniswap V3 pool created (ContractToken/USDC)
  → Initial liquidity added (full-range position)
```

### 5. Investor Sell/Redeem
```
Investor sells tokens:
  → ContractToken.burn() on-chain (burn mechanism)
  → Holdings updated in DB
  → Or: redeem proportional value at contract completion
```

### 6. Dispute (Full flow — court ruling stubbed)
```
Either party: POST /api/contracts/[id]/dispute
  → Discussion phase (48h negotiation window)
  → Settlement proposals can be made
  → Escalation requires confirmation with cost warning
  → Evidence submission period
  → Both pay arbitration fee (1-month deadline)
  → Default ruling if one doesn't pay
  → Kleros court ruling NOT YET WIRED (future: requires Arbitrum)
  → Notifications at every phase transition
```

## Privacy (Unlink ZKP — Optional)

When configured (`UNLINK_API_KEY`), escrow deposits and agency payouts can use Unlink's shielded pools for on-chain privacy:
- `privateDeposit()` — client deposits USDC into shielded pool
- `privateTransfer()` — milestone payout to agency (private)
- `privateWithdraw()` — agency withdraws to their wallet

## What Investors Can NEVER See

- Client name or wallet address
- Full contract terms or deliverable proofs
- Fee split configuration (BD%, platform%)
- Escrow balance details

Investors see only what the agency chose to expose during tokenization (via `TokenizationExposure` settings).

## AgencyProfile.sol (On-Chain Reputation)

Singleton contract that stores agency reputation on-chain. Owner-only writes (platform deployer).

```
AgencyProfile.sol
  ├── recordCompletion(agency, volume, score)  — on contract completion
  ├── recordFailure(agency, score)             — on contract failure
  ├── recordDisputeResult(agency, won, score)  — on dispute resolution
  ├── addAttestation(agency, proofHash)        — ZKP attestation hashes
  └── setVerified(agency, verified)            — KYC/KYB flag
```

Stores per-agency: contractsCompleted, contractsFailed, disputesWon, disputesLost, totalVolume, score (0-100), verified flag, attestation hashes.

Wrapper: `src/lib/blockchain/agency-profile.ts` — all calls are best-effort (failure logged, never blocks UI).

## File Storage (Pinata + Blob Dual-Write)

`src/lib/storage/` provides dual-write file storage:

```
uploadFile(buffer, filename, contentType) → StorageResult
  1. Try Pinata (IPFS) → returns CID + gateway URL
  2. If Pinata succeeds: dual-write to Blob async (non-blocking)
  3. If Pinata fails/unconfigured: fall back to Vercel Blob
  4. If both fail: return data URL placeholder with content hash
```

Files are recorded in the `documents` table (DB) with: IPFS hash, Blob URL, SHA-256 content hash, extracted text, and metadata.

## EAS Attestations (KYB Verification)

`src/lib/eas/` uses the Ethereum Attestation Service (predeployed on Base) for KYB verification.

```
Agency verification flow:
  POST /api/users/[address]/verify
  → attestAgencyKYB(address, jurisdiction, companyName)
  → EAS.attest() on-chain (schema: isVerified, jurisdiction, companyName, verifiedAt)
  → Attestation UID stored in user profile (DB)
  → Verifiable by anyone via verifyAttestation(uid)
  → Revocable if agency is flagged
```

Schema UID is computed deterministically and registered once. EAS contracts are predeployed at `0x4200...0021` (EAS) and `0x4200...0020` (SchemaRegistry) on Base.

## What's Stubbed

- **Kleros court ruling** — requires Arbitrum; discussion + evidence + fee payment + settlement all work, court ruling is stubbed
- **AI document extraction** — placeholder for automatic contract term extraction from uploaded documents
tation verification page
