# Tokeru (溶ける)

**Melt frozen service contracts into liquid, investable assets.**

Built for [ETHGlobal Cannes 2026](https://ethglobal.com/events/cannes2026).

## What It Does

Tokeru turns service contracts into tokenized, tradeable digital assets backed by on-chain escrow.

- **Agencies** create contracts with milestones, get funded upfront by selling tokens to investors
- **Clients** deposit escrow privately via ZKP. Funds release only upon milestone approval
- **Investors** buy tokens at a discount, earn fixed returns (+8-25%) when milestones complete

## Live Demo

**App:** [[tokeru.xyz](https://idt-app.vercel.app/)]([[https://tokeru.xyz](https://idt-app.vercel.app/)](https://idt-app.vercel.app/)) (Vercel deployment URL)
**Chain:** Base Sepolia
**Contracts:** Verified on [BaseScan](https://sepolia.basescan.org)

## Architecture

```
Base Sepolia
├── ContractFactory.sol    — deploys ServiceContract + ContractToken pairs
├── ServiceContract.sol    — escrow, milestones, fee splits
├── ContractToken.sol      — ERC20 per deal (mint on demand)
├── AgencyProfile.sol      — on-chain reputation (score, attestations)
├── EAS (predeployed)      — KYB verification attestations
├── Uniswap V3             — optional secondary market
└── Unlink SDK             — ZKP shielded deposits/transfers
```

## Key Features

| Feature | Description |
|---|---|
| **Milestone Escrow** | Smart contract holds funds, releases per milestone with 2.5% platform fee |
| **Mint-on-Demand Tokens** | 1 token = $1 face value. Investors buy at discount, earn fixed return |
| **ZKP Privacy** | Client identity never on-chain (Unlink shielded deposits) |
| **On-Chain Reputation** | Agency score, completions, disputes stored on AgencyProfile.sol |
| **EAS Verification** | KYB attestations on Base via Ethereum Attestation Service |
| **Dispute Resolution** | Discussion (48h) → Evidence → Fee → Arbitration with settlements |
| **Notifications** | DB-backed + email at every lifecycle step |
| **Investor Sell/Redeem** | Burn tokens at face value when contract completes |
| **File Storage** | Pinata (IPFS) + Vercel Blob dual-write with SHA-256 content hashes |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, HeroUI v3, Tailwind CSS v4, Framer Motion |
| Auth | Privy (email, Google, Telegram, embedded wallets) |
| Chain | Base Sepolia (ethers.js v6) |
| Contracts | Solidity 0.8.24, Foundry, 4 contracts, 27 tests |
| Database | Neon Postgres + Drizzle ORM (10 tables) |
| Privacy | Unlink SDK (ZKP shielded transfers) |
| Attestations | EAS SDK (predeployed on Base) |
| DEX | Uniswap V3 (optional secondary market) |
| Storage | Pinata (IPFS) + Vercel Blob |
| Email | Resend (14 notification types) |

## Quick Start

```bash
# Install
pnpm install

# Local development (Anvil fork of Base Sepolia)
anvil --fork-url https://sepolia.base.org     # Terminal 1
./scripts/deploy-local.sh                      # Terminal 2
# Paste output addresses into .env.local
pnpm dev                                       # Terminal 3

# Deploy to Base Sepolia testnet
ENV=testnet ./scripts/deploy.sh
```

## Project Structure

```
src/
├── app/                18 pages + 25 API routes
├── components/         UI components (HeroUI) + sidebar + logo
├── hooks/              useAuth, useApi, useContracts, useMarketplace, useProfile
└── lib/
    ├── auth/           Privy middleware
    ├── blockchain/     ethers.js providers, ABIs, contract wrappers
    ├── db/             Drizzle ORM (10 tables)
    ├── eas/            Ethereum Attestation Service
    ├── email/          Resend (14 notification types)
    ├── notifications/  DB-backed notification system
    ├── payments/       Escrow math + fee calculations
    ├── privacy/        Unlink SDK (ZKP)
    ├── scoring/        Agency score computation
    ├── storage/        Pinata + Blob dual-write
    ├── types/          TypeScript interfaces
    └── uniswap/        Uniswap V3 pool + swap

contracts/
├── src/
│   ├── ContractFactory.sol
│   ├── ServiceContract.sol
│   ├── ContractToken.sol
│   └── AgencyProfile.sol
├── test/               27 unit tests
└── script/             Deploy scripts
```

## Environment Variables

```bash
# Required
NEXT_PUBLIC_PRIVY_APP_ID=         # Privy auth
PRIVY_APP_SECRET=                 # Privy server
DATABASE_URL=                     # Neon Postgres
RPC_URL=                          # Base Sepolia RPC
CHAIN_ID=84532                    # Base Sepolia
DEPLOYER_PRIVATE_KEY=             # Contract deployer
CONTRACT_FACTORY_ADDRESS=         # After deployment
PAYMENT_TOKEN_ADDRESS=            # USDC address
PLATFORM_TREASURY=                # Fee recipient
AGENCY_PROFILE_ADDRESS=           # After deployment

# Optional (graceful degradation)
RESEND_API_KEY=                   # Email notifications
UNLINK_API_KEY=                   # ZKP privacy
PINATA_JWT=                       # IPFS storage
BLOB_READ_WRITE_TOKEN=            # Vercel Blob
```

## License

MIT
