"use client";

import { useState } from "react";
import {
  FileText,
  Coins,
  Shield,
  TrendingUp,
  Users,
  Scale,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowRight,
  Lock,
  CheckCircle,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, SectionCard } from "@/components/ui";

// ---------------------------------------------------------------------------
// FAQ Data
// ---------------------------------------------------------------------------

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_SECTIONS: { title: string; icon: React.ElementType; items: FAQItem[] }[] = [
  {
    title: "For Agencies",
    icon: FileText,
    items: [
      {
        question: "How do I get paid upfront?",
        answer:
          "Create a contract with milestones, then tokenize it. Investors buy your contract tokens at a discount (e.g., $0.90 for $1 face value). You receive capital immediately. When you deliver milestones and the client approves, investors earn their return.",
      },
      {
        question: "How does the reputation score work?",
        answer:
          "Your score is computed from three factors: completion rate (40%), dispute win rate (30%), and delivery quality (30%). It updates automatically when contracts complete, fail, or disputes resolve. Your score is stored on-chain via the AgencyProfile smart contract.",
      },
      {
        question: "What is KYB verification?",
        answer:
          "KYB (Know Your Business) verification creates an on-chain attestation via the Ethereum Attestation Service (EAS) proving your business is legitimate. Go to Account > Verify Your Agency. This gives investors confidence and improves your trust rating.",
      },
      {
        question: "What fees does the platform charge?",
        answer:
          "2.5% platform fee per milestone release, deducted automatically from escrow. If you have a Business Developer, their commission (0-20%) is also deducted. The remainder goes to you. All fees are transparent and enforced by the smart contract.",
      },
      {
        question: "Can I activate a secondary market for my tokens?",
        answer:
          "Yes. After tokenizing, you can optionally create a Uniswap V3 pool from the contract detail page. This lets investors trade your tokens on a real AMM. The platform seeds initial liquidity using 10% of the token supply.",
      },
    ],
  },
  {
    title: "For Investors",
    icon: TrendingUp,
    items: [
      {
        question: "How do returns work?",
        answer:
          "Each token has a $1.00 face value. You buy at a discount (e.g., $0.90). When the agency delivers milestones and the client approves, escrow funds are released. Your return is the difference: $0.10 per token = +11.1% fixed return. This is not APY -- it is a fixed-maturity return tied to real work delivery.",
      },
      {
        question: "What if the agency doesn't deliver?",
        answer:
          "Funds stay in smart contract escrow until milestones are approved. If the agency fails to deliver, the client can reject milestones or initiate a dispute. In the worst case, the contract is marked as failed and escrow is refunded to the client. Your investment is at risk only if the agency defaults.",
      },
      {
        question: "How do I evaluate risk?",
        answer:
          "Check the agency's risk tier (Low/Medium/High), reputation score, contract completion rate, and KYB verification status. All of this is visible on the marketplace listing and agency profile. Verified agencies with high scores and many completed contracts are lower risk.",
      },
      {
        question: "Can I sell my tokens before the contract completes?",
        answer:
          "If the agency has activated a Uniswap V3 pool for the contract, you can trade tokens on the secondary market. Otherwise, tokens are held until milestones complete. Check the contract detail page for pool availability.",
      },
      {
        question: "Where do I see my investments?",
        answer:
          "Go to Portfolio to see all your token holdings, current value, and returns. The Dashboard also shows a summary of your active investments.",
      },
    ],
  },
  {
    title: "For Clients",
    icon: Users,
    items: [
      {
        question: "Is my money safe?",
        answer:
          "Yes. Your deposit goes into an audited smart contract on Base, not to the agency or the platform. Funds are released only when you approve each milestone. You can cancel and get a refund anytime before milestones are completed.",
      },
      {
        question: "Is my identity private?",
        answer:
          "Yes. Your wallet address and identity are never exposed to investors or the public marketplace. When Unlink ZKP is enabled, even your deposit transaction is private -- your address never appears on-chain.",
      },
      {
        question: "What if I disagree with a deliverable?",
        answer:
          "You can reject a milestone with a reason. The agency can revise and re-submit, or start a dispute. Disputes go through an evidence-based arbitration process with fee deposits. If one party doesn't pay the arbitration fee, they lose by default.",
      },
      {
        question: "Can I get a refund?",
        answer:
          "Yes, as long as no milestones have been approved or delivered. Go to your contract detail page and use the refund option. The smart contract will return your full escrow deposit.",
      },
    ],
  },
  {
    title: "Security & Trust",
    icon: Shield,
    items: [
      {
        question: "How is escrow protected?",
        answer:
          "Escrow is held by the ServiceContract smart contract on Base. The contract enforces milestone-based release with automatic fee splits. Neither the agency, client, nor TrustSignal can unilaterally move funds. The contract code is open source and verifiable on BaseScan.",
      },
      {
        question: "What smart contracts are used?",
        answer:
          "Four contracts: ContractFactory (deploys new contracts), ServiceContract (escrow + milestones), ContractToken (ERC20 per contract), and AgencyProfile (on-chain reputation). All written in Solidity 0.8.24, compiled with Foundry, and tested with 27+ unit tests.",
      },
      {
        question: "What is EAS verification?",
        answer:
          "The Ethereum Attestation Service (EAS) is predeployed on Base. TrustSignal uses it to create verifiable KYB attestations for agencies. Anyone can verify an attestation independently on base-sepolia.easscan.org.",
      },
      {
        question: "What blockchain is this on?",
        answer:
          "Base Sepolia (testnet). Base is a Layer 2 built on Ethereum by Coinbase, using the OP Stack. Low fees, fast transactions, and access to Uniswap V3 for secondary market trading.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-border/50">
      {items.map((item, i) => (
        <div key={i}>
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between py-4 text-left hover:text-accent transition-colors"
          >
            <span className="text-sm font-medium pr-4">{item.question}</span>
            {openIndex === i ? (
              <ChevronUp className="h-4 w-4 text-muted shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted shrink-0" />
            )}
          </button>
          {openIndex === i && (
            <p className="text-sm text-muted leading-relaxed pb-4 pr-8">
              {item.answer}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <PageHeader
        title="Help Center"
        description="Everything you need to know about using TrustSignal"
      />

      {/* Quick start cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <Link
          href="/contracts/new"
          className="p-5 rounded-xl border border-border bg-surface hover:border-accent/50 hover:bg-surface-secondary transition-all group"
        >
          <FileText className="h-5 w-5 text-accent mb-3" />
          <p className="font-semibold text-sm mb-1 group-hover:text-accent transition-colors">
            Create a Contract
          </p>
          <p className="text-xs text-muted">
            Set up milestones and invite your client
          </p>
          <ArrowRight className="h-3.5 w-3.5 text-muted mt-3 group-hover:text-accent transition-colors" />
        </Link>
        <Link
          href="/marketplace"
          className="p-5 rounded-xl border border-border bg-surface hover:border-accent/50 hover:bg-surface-secondary transition-all group"
        >
          <TrendingUp className="h-5 w-5 text-accent mb-3" />
          <p className="font-semibold text-sm mb-1 group-hover:text-accent transition-colors">
            Start Investing
          </p>
          <p className="text-xs text-muted">
            Browse tokenized contracts and earn returns
          </p>
          <ArrowRight className="h-3.5 w-3.5 text-muted mt-3 group-hover:text-accent transition-colors" />
        </Link>
        <Link
          href="/profile"
          className="p-5 rounded-xl border border-border bg-surface hover:border-accent/50 hover:bg-surface-secondary transition-all group"
        >
          <Shield className="h-5 w-5 text-accent mb-3" />
          <p className="font-semibold text-sm mb-1 group-hover:text-accent transition-colors">
            Verify Your Agency
          </p>
          <p className="text-xs text-muted">
            Get KYB verified to build investor trust
          </p>
          <ArrowRight className="h-3.5 w-3.5 text-muted mt-3 group-hover:text-accent transition-colors" />
        </Link>
      </div>

      {/* Key concepts */}
      <SectionCard title="Key Concepts" className="mb-8">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex gap-3">
            <Lock className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Smart Contract Escrow</p>
              <p className="text-xs text-muted mt-0.5">
                Funds locked in audited contracts. Released per milestone. Neither party can take funds unilaterally.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Coins className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Contract Tokens (ERC20)</p>
              <p className="text-xs text-muted mt-0.5">
                Each $1 of contract value = 1 token. Investors buy at a discount. Tokens are minted on demand.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Milestone Verification</p>
              <p className="text-xs text-muted mt-0.5">
                Agency delivers proof. Client reviews and approves or rejects. Escrow releases automatically on approval.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Dispute Resolution</p>
              <p className="text-xs text-muted mt-0.5">
                Evidence-based arbitration with fee deposits. Default ruling if one party doesn't pay. Fair and transparent.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Wallet className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">On-Chain Reputation</p>
              <p className="text-xs text-muted mt-0.5">
                Agency score stored on AgencyProfile contract. Completions, failures, disputes — all verifiable.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Scale className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Risk Tiers</p>
              <p className="text-xs text-muted mt-0.5">
                Low / Medium / High based on agency score. Visible on every contract card for informed decisions.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* FAQ sections */}
      {FAQ_SECTIONS.map((section) => (
        <SectionCard
          key={section.title}
          title={section.title}
          icon={<section.icon className="h-5 w-5 text-accent" />}
          className="mb-6"
        >
          <FAQAccordion items={section.items} />
        </SectionCard>
      ))}

      {/* Footer links */}
      <div className="mt-10 p-6 rounded-xl border border-border bg-surface-secondary text-center">
        <p className="text-sm font-medium mb-2">Still have questions?</p>
        <p className="text-xs text-muted mb-4">
          Check the docs or reach out to the team.
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href="https://github.com/Antoinesrvt/eth-cc-idea"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-surface transition-colors"
          >
            GitHub <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/85 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
