# Tokeru — Landing Page Brief

> Everything a designer/developer needs to create the perfect landing page.

---

## 1. Product Summary

**Tokeru** turns service contracts into investable, tradeable digital assets. Agencies get paid upfront by selling tokenized contract rights to investors. Clients deposit escrow into smart contracts. Investors earn fixed returns when milestones are completed.

**One-liner:** "Turn your service contracts into investable assets."

**Tagline options:**
- "Get paid before you deliver. Invest before it ships."
- "Tokenized service contracts. On-chain escrow. Verifiable trust."
- "The institutional marketplace for service contract financing."

---

## 2. Target Audiences (in order of priority)

### Primary: Agencies (Service Providers)
- **Who:** Digital agencies, dev shops, consulting firms, creative studios, freelancers with $10K-$500K contracts
- **Pain:** Cash flow gaps — they deliver work over months but get paid on completion. Late payments. Client disputes.
- **Desire:** Get paid upfront. Reduce payment risk. Build verifiable reputation.
- **CTA:** "Create Contract" / "Get Funded"

### Secondary: Investors (Institutional + Retail)
- **Who:** DeFi-native investors, family offices, credit funds looking for real-world yield. Also smaller crypto investors.
- **Pain:** Yield farming is volatile and unsustainable. No access to service economy returns.
- **Desire:** Fixed-maturity returns backed by real work delivery. Transparent risk. Named counterparties.
- **CTA:** "Browse Marketplace" / "Start Investing"

### Tertiary: Clients (Buyers of Services)
- **Who:** Companies hiring agencies. They deposit escrow.
- **Pain:** Worry about paying for undelivered work. Want guarantees.
- **Desire:** Funds locked until work is verified. Dispute resolution if needed.
- **CTA:** "Accept Contract" (they arrive via invite link, not landing page)

---

## 3. Core Value Propositions

### For Agencies
1. **Get paid upfront** — Tokenize your contract, sell tokens to investors, receive capital before you deliver
2. **Build on-chain reputation** — Every completed contract, verified milestone, and client approval builds your verifiable score
3. **Reduce payment risk** — Client funds locked in smart contract escrow, not promises
4. **KYB verification** — EAS attestations prove your business is real without exposing private data

### For Investors
1. **Fixed-maturity returns** — Buy contract tokens at a discount (e.g., $0.90), receive $1.00 when milestones complete. Not APY — fixed return.
2. **Risk transparency** — Agency scores, completion rates, dispute history, on-chain verification — all visible before investing
3. **Milestone-based security** — Funds held in audited smart contracts, released only upon verified delivery
4. **Named counterparties** — You know who you're investing in. Verified agencies with track records, not anonymous pools.

### For Clients
1. **Escrow protection** — Your money is in a smart contract, not the agency's bank account
2. **Privacy** — Your identity is never exposed to investors or the public (ZKP via Unlink)
3. **Milestone control** — Approve or reject each deliverable. Dispute if needed.
4. **Refund guarantee** — Cancel anytime before milestones are completed

---

## 4. How It Works (3 Steps)

### Step 1: Create & Escrow
Agency creates a contract with milestones and pricing. Client deposits payment into smart contract escrow. Funds are locked — neither party can touch them unilaterally.

**Visual:** Contract document icon + lock/shield

### Step 2: Tokenize & Invest
Agency opens the contract for investment. Each $1 of contract value = 1 token. Investors buy tokens at a discount (e.g., $0.90 for $1.00 face value). Tokens are minted on-chain on demand.

**Visual:** Coins/tokens icon + chart trending up

### Step 3: Deliver & Earn
Agency delivers milestones. Client approves. Escrow releases automatically with fee splits. Investors earn their return. Agency reputation score updates.

**Visual:** Checkmark/verified icon + money flow

---

## 5. Tech Stack & Trust Architecture

### Three Layers (for a technical audience / architecture section)

**Layer 1: Contract Layer (Base Sepolia)**
- Smart contract escrow (ServiceContract.sol)
- ERC20 contract tokens (ContractToken.sol)
- Milestone state machine with on-chain proofs
- Fee splits: 2.5% platform + configurable BD commission

**Layer 2: Trust Layer**
- On-chain agency reputation (AgencyProfile.sol) — completions, failures, disputes, score
- EAS attestations for KYB verification (predeployed on Base)
- Risk tier system: Low / Medium / High based on agency score
- File storage with SHA-256 content hashes (Pinata IPFS + Vercel Blob)

**Layer 3: Privacy & Resolution**
- ZKP private deposits via Unlink SDK (client identity never on-chain)
- Evidence-based dispute system with arbitration fee mechanism
- Kleros court integration planned (decentralized arbitration)

### Key Technologies
| Tech | Purpose |
|------|---------|
| Base Sepolia (OP Stack L2) | Smart contract execution, low fees |
| Solidity 0.8.24 + Foundry | 4 audited contracts (Factory, ServiceContract, ContractToken, AgencyProfile) |
| EAS (Ethereum Attestation Service) | KYB verification attestations |
| Uniswap V3 | Optional secondary market for token trading |
| Unlink SDK | ZKP shielded deposits (client privacy) |
| Privy | Authentication (email, Google, Telegram, embedded wallets) |
| Next.js 16 + React 19 | Frontend |
| Neon Postgres + Drizzle ORM | Database |
| Pinata (IPFS) + Vercel Blob | Decentralized file storage |
| Resend | Transactional email (14 notification types) |

---

## 6. Key Numbers / Stats (for social proof section)

For hackathon/demo, use aspirational or protocol-level stats:

- "Smart contract escrow — funds locked until verified delivery"
- "27 Solidity tests passing — audited contract suite"
- "4 smart contracts — Factory, ServiceContract, ContractToken, AgencyProfile"
- "On-chain reputation — every contract builds verifiable trust"
- "ZKP privacy — client identity never exposed"
- "EAS verified — KYB attestations on Base"

---

## 7. Competitive Differentiation

| Feature | Tokeru | Traditional Escrow | DeFi Lending |
|---------|------------|-------------------|-------------|
| Asset type | Service contracts | N/A | Crypto collateral |
| Return model | Fixed maturity (+8-25%) | N/A | Variable APY |
| Counterparty | Named, verified agencies | Unknown | Anonymous pools |
| Risk metric | Agency score + track record | Trust | TVL + utilization |
| Privacy | ZKP (client hidden) | Full KYC both sides | Pseudonymous |
| Dispute | Evidence-based arbitration | Legal/courts | None (liquidation) |
| Payment | Milestone-based release | Lump sum | Interest accrual |

---

## 8. User Flow Visualization

```
AGENCY FLOW:
Create Contract → Client Deposits Escrow → Deliver Milestones → Get Paid
                          ↓
                   Tokenize Contract
                          ↓
              Investors Buy Tokens (agency gets capital upfront)
                          ↓
              Milestones Complete → Investors Earn Returns

INVESTOR FLOW:
Browse Marketplace → Evaluate Agency (score, track record, verification)
        ↓
   Buy Tokens at Discount → Hold → Milestones Complete → Receive $1/token
        ↓
   Optional: Trade on Uniswap V3 Secondary Market
```

---

## 9. Trust Signals to Display

1. **"On-Chain Escrow"** — Funds held in audited smart contracts on Base
2. **"Verified Agencies"** — KYB attestations via EAS (Ethereum Attestation Service)
3. **"ZKP Privacy"** — Client identity protected by zero-knowledge proofs (Unlink)
4. **"Milestone-Based Release"** — Funds unlock only when work is verified and approved
5. **"On-Chain Reputation"** — Agency scores computed from real contract performance, stored on-chain
6. **"Open Source"** — Smart contracts verifiable on BaseScan

---

## 10. Page Sections (Recommended Order)

### Hero
- Headline: "Turn Your Service Contracts Into Investable Assets"
- Subheadline: "Agencies get funded upfront. Investors earn fixed returns. Smart contract escrow protects everyone."
- Two CTAs: "Create Contract" (primary) + "Browse Marketplace" (secondary)
- Background: subtle gradient or abstract mesh, professional not flashy

### Social Proof Bar
- Key stats/badges: "Built on Base" + "EAS Verified" + "ZKP Privacy" + "Smart Contract Escrow"

### How It Works (3 steps)
- Create & Escrow → Tokenize & Invest → Deliver & Earn
- Clean icons, brief text, connecting arrows or flow line

### For Agencies (value prop section)
- Get paid upfront
- Build verifiable reputation
- Reduce payment risk
- CTA: "Create Your First Contract"

### For Investors (value prop section)
- Fixed-maturity returns (not APY)
- Named, verified counterparties
- Milestone-based security
- Example: "$10,000 invested at $0.90/token → $11,111 returned → +11.1% fixed return"
- CTA: "Browse the Marketplace"

### Featured Contracts (live data)
- Pull from marketplace API — show 3 tokenized contracts
- Each card: agency name, risk tier, expected return, milestone progress
- If no contracts: "No contracts yet — be the first"

### Architecture / Trust
- Three-layer diagram: Contract Layer + Trust Layer + Privacy Layer
- Key tech logos: Base, EAS, Unlink, Uniswap, Solidity
- "27 tests passing. Open source contracts."

### For Clients (brief section)
- "Your funds are safe. Locked in smart contracts until you approve delivery."
- Privacy guarantee: "Your identity is never exposed to investors."
- Dispute resolution: "Evidence-based arbitration if you disagree."

### CTA Section (bottom)
- "Ready to get started?"
- Two buttons: "Create Contract" + "Browse Marketplace"
- Or email capture for waitlist

### Footer
- Logo + tagline
- Links: Docs, GitHub, Support
- Social: X, LinkedIn, Telegram
- Legal: Terms, Privacy
- "Built on Base Sepolia | Powered by EAS"

---

## 11. Design Direction

### Mood
- **Institutional, not degen.** Think Maple Finance meets Linear.
- Professional, clean, trustworthy. Navy/dark backgrounds or crisp white.
- Data-rich but organized. Progressive disclosure.
- No gamification, no memes, no crypto jargon on the surface.

### Color Palette (from existing theme — OKLCH)
- **Brand:** Deep forest green (`oklch(0.35 0.08 160)`)
- **Accent:** Sea green (`oklch(0.55 0.14 160)`) — CTAs, highlights
- **Success:** Bright emerald — positive returns, completed milestones
- **Warning:** Warm amber — medium risk, pending actions
- **Danger:** Coral red — high risk, errors, disputes
- **Background:** Light: white / Dark: `oklch(0.13 0.015 260)`
- **Surface:** Cards, panels — subtle elevation from background
- **Muted:** Secondary text — `oklch(0.556 0.015 286)`

### Typography
- Font: Geist Sans (already loaded) — clean, modern, professional
- Mono: Geist Mono — for addresses, hashes, code
- Headline: 48-72px bold
- Body: 16-18px regular
- Small: 14px for secondary text
- Generous whitespace — let content breathe

### Icons
- Lucide React — consistent line-weight icon set
- No emojis anywhere
- Icons in rounded containers for feature cards

### Animations
- Framer Motion (already integrated)
- Subtle: fade-up on scroll, stagger children
- No flashy transitions — professional motion design
- Hover effects: slight elevation, border color change

---

## 12. Current Landing Page File

The existing landing page is at `src/app/page.tsx` (470 lines). It renders full-width (no sidebar — the AppShell component handles this). It uses Framer Motion for animations, pulls featured contracts from the marketplace API, and has sections for Hero, How It Works, Why Tokeru, Find Your Role, Featured Contracts, Architecture, and Footer.

### Current component imports available:
- `SignalLogo` — brand logo component
- `useMarketplace()` — hook for fetching live marketplace data
- Framer Motion — `motion` components
- All Lucide icons
- `formatCurrency()` — utility for $ formatting

### Rendering context:
- The page is a "use client" component (client-side rendering for animations + data fetching)
- It renders WITHOUT the sidebar (AppShell detects `pathname === "/"`)
- Full viewport width available
- Dark mode supported via CSS custom properties (`:root` / `.dark`)
