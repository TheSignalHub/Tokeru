"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMarketplace } from "@/hooks/use-marketplace";
import { formatCurrency as formatCurrencyUtil } from "@/lib/utils/format";
import {
  FileText,
  Coins,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Building2,
  ShieldCheck,
  Lock,
  Zap,
  Eye,
  Clock,
  BadgeCheck,
  ExternalLink,
} from "lucide-react";
import { TokeruLogo } from "@/components/SignalLogo";

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 80, damping: 22 } },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const staggerFast = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

/* ------------------------------------------------------------------ */
/*  Glass utility                                                      */
/* ------------------------------------------------------------------ */

const glass = "bg-white/[0.03] backdrop-blur-xl border border-white/[0.08]";
const glassHover = "hover:bg-white/[0.06] hover:border-white/[0.14]";

/* ------------------------------------------------------------------ */
/*  Partner logos (text-only, no external deps)                         */
/* ------------------------------------------------------------------ */

const partners = ["Base", "EAS", "Unlink", "Uniswap V3", "Pinata", "Privy", "Kleros"];

/* ------------------------------------------------------------------ */
/*  How-It-Works cards                                                 */
/* ------------------------------------------------------------------ */

const steps = [
  {
    icon: Lock,
    title: "Create & Escrow",
    description: "Agency creates a service contract with milestones. Client locks payment in smart contract escrow on Base.",
    stat: "100%",
    statLabel: "Funds Secured",
  },
  {
    icon: Coins,
    title: "Tokenize & Invest",
    description: "Agency mints ERC20 tokens backed by contract value. Investors buy in at a discount on Uniswap V3.",
    stat: "+8-25%",
    statLabel: "Fixed Returns",
  },
  {
    icon: CheckCircle,
    title: "Deliver & Earn",
    description: "Agency delivers work. Client approves milestones. Escrow releases automatically. Reputation updates on-chain.",
    stat: "Zero",
    statLabel: "Counterparty Risk",
  },
];

/* ------------------------------------------------------------------ */
/*  Floating Navbar                                                    */
/* ------------------------------------------------------------------ */

function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(95vw,72rem)]"
    >
      <div className={`rounded-2xl px-6 py-3 flex items-center justify-between ${glass}`}>
        <Link href="/" className="flex items-center gap-2.5">
          <TokeruLogo size={28} className="rounded object-cover" />
          <span className="font-semibold text-foreground tracking-tight text-lg">Tokeru</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
          <Link href="/marketplace" className="hover:text-foreground transition-colors">Marketplace</Link>
          <Link href="/contracts/new" className="hover:text-foreground transition-colors">For Agencies</Link>
          <Link href="/marketplace" className="hover:text-foreground transition-colors">For Investors</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/marketplace"
            className="hidden sm:inline-flex px-4 py-2 rounded-xl text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
          >
            Browse
          </Link>
          <Link
            href="/contracts/new"
            className="px-5 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-semibold shadow-[0_2px_10px_rgba(46,139,87,0.3)] hover:shadow-[0_4px_16px_rgba(46,139,87,0.4)] transition-all active:scale-[0.97]"
          >
            Launch App
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero Section                                                       */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden min-h-screen flex flex-col justify-center">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-15%] w-[60%] h-[60%] rounded-full bg-brand/8 blur-[140px] animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full bg-accent/8 blur-[130px] animate-[pulse_10s_ease-in-out_infinite_2s]" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[40%] h-[30%] rounded-full bg-success/5 blur-[100px] animate-[pulse_12s_ease-in-out_infinite_4s]" />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <motion.div
        className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 relative z-10 text-center"
        initial="hidden"
        animate="show"
        variants={staggerContainer}
      >
        <motion.div variants={fadeUp} className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-brand/10 border border-brand/20 text-sm font-medium mb-10">
          <TokeruLogo size={18} className="rounded object-cover" />
          <span className="text-foreground/70">Intellectual Deliverable Tokenization</span>
        </motion.div>

        <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.08]">
          Melt Your Contracts
          <br />
          Into{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-success to-brand">
            Liquid Assets
          </span>
        </motion.h1>

        <motion.p variants={fadeUp} className="mt-7 text-lg sm:text-xl text-muted max-w-2xl mx-auto tracking-tight leading-relaxed">
          Agencies get funded upfront. Investors earn fixed returns.
          Frozen cashflow, unlocked.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-12 flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/contracts/new"
            className="flex items-center gap-2.5 px-8 py-4 rounded-xl bg-accent text-accent-foreground font-semibold shadow-[0_4px_20px_rgba(46,139,87,0.35)] hover:shadow-[0_6px_28px_rgba(46,139,87,0.45)] hover:bg-accent/90 transition-all active:scale-[0.97]"
          >
            Create Contract <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/marketplace"
            className={`flex items-center gap-2.5 px-8 py-4 rounded-xl font-semibold transition-all active:scale-[0.97] ${glass} ${glassHover}`}
          >
            Browse Marketplace
          </Link>
        </motion.div>
      </motion.div>

      {/* Brand bar marquee */}
      <div className="relative z-10 border-t border-white/[0.06] py-6 overflow-hidden">
        <div className="flex animate-[marquee_30s_linear_infinite] gap-16 items-center whitespace-nowrap">
          {[...partners, ...partners].map((p, i) => (
            <span key={`${p}-${i}`} className="text-sm font-medium text-muted/50 tracking-widest uppercase shrink-0">
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  How It Works                                                       */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  return (
    <section className="relative py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[40%] rounded-full bg-accent/5 blur-[120px]" />
      </div>
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainer}
      >
        <motion.p variants={fadeUp} className="text-accent text-sm font-semibold tracking-widest uppercase text-center mb-3">
          Protocol
        </motion.p>
        <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl font-bold tracking-tight text-center mb-5">
          The Institutional Marketplace for Contract Financing
        </motion.h2>
        <motion.p variants={fadeUp} className="text-muted text-center mb-20 max-w-xl mx-auto text-lg tracking-tight">
          Three steps from service agreement to liquid, investable token.
        </motion.p>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <motion.div
              variants={fadeUp}
              key={step.title}
              className={`group rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 ${glass} ${glassHover}`}
            >
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-accent/10 border border-accent/20 mb-6 transition-colors group-hover:bg-accent/20">
                <step.icon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold mb-3 tracking-tight">{step.title}</h3>
              <p className="text-muted tracking-tight leading-relaxed mb-8">{step.description}</p>
              <div className="border-t border-white/[0.08] pt-6">
                <div className="text-3xl font-bold tracking-tight text-accent">{step.stat}</div>
                <div className="text-sm text-muted mt-1">{step.statLabel}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  For Agencies (chess: card left, text right)                         */
/* ------------------------------------------------------------------ */

function ForAgencies() {
  return (
    <section className="py-32 border-t border-white/[0.06]">
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainer}
      >
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: mock contract card */}
          <motion.div variants={fadeUp} className={`rounded-2xl p-8 ${glass}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-success" />
                <span className="text-xs font-mono text-muted uppercase tracking-widest">Active Contract</span>
              </div>
              <span className="text-xs font-mono text-accent">TSG-2024-0047</span>
            </div>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Contract Value</span>
                <span className="font-semibold font-mono">$125,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Milestones</span>
                <span className="font-semibold font-mono">3 / 5</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Escrowed</span>
                <span className="font-semibold text-success font-mono">$125,000</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mb-6">
              <div className="h-full w-[60%] rounded-full bg-gradient-to-r from-accent to-success" />
            </div>
            <div className={`rounded-xl p-4 ${glass}`}>
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold">Tokenized</span>
              </div>
              <div className="flex justify-between text-xs text-muted">
                <span>10,000 TSG-47 tokens</span>
                <span className="text-accent">$12.50 / token</span>
              </div>
            </div>
          </motion.div>

          {/* Right: text */}
          <motion.div variants={fadeUp}>
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-xs font-semibold text-accent uppercase tracking-widest">
                For Agencies
              </span>
              <span className="text-sm text-muted font-medium">Scale Faster</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
              Get Paid Before You Even Deliver
            </h2>
            <p className="text-muted text-lg tracking-tight leading-relaxed mb-8">
              Tokenize your service contracts and sell tokens to investors on Uniswap V3.
              Get upfront capital while your team delivers the work. No more 30-90 day payment cycles.
            </p>
            <ul className="space-y-4 mb-10">
              {[
                "On-chain reputation that compounds with every completed contract",
                "100% of contract value locked in smart contract escrow",
                "KYB verification via EAS attestations on Base",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-foreground/80 tracking-tight">
                  <div className="h-2 w-2 rounded-full bg-success mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/contracts/new"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-accent text-accent-foreground font-semibold shadow-[0_4px_16px_rgba(46,139,87,0.3)] hover:shadow-[0_6px_24px_rgba(46,139,87,0.4)] transition-all active:scale-[0.97]"
            >
              Create Your First Contract <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  For Investors (reverse chess: text left, card right)                */
/* ------------------------------------------------------------------ */

function ForInvestors() {
  const statBoxes = [
    { value: "8-25%", label: "Fixed Returns" },
    { value: "100%", label: "Milestone-Backed" },
    { value: "Zero", label: "Anonymous Pools" },
    { value: "24/7", label: "Secondary Market" },
  ];

  return (
    <section className="py-32 border-t border-white/[0.06]">
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainer}
      >
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: text */}
          <motion.div variants={fadeUp}>
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-xs font-semibold text-brand uppercase tracking-widest">
                For Investors
              </span>
              <span className="text-sm text-muted font-medium">Yield</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
              Real-World Yield. Fixed Returns.
            </h2>
            <p className="text-muted text-lg tracking-tight leading-relaxed mb-10">
              Buy contract tokens at a discount. When milestones complete and escrow releases,
              you receive face value. Transparent risk scoring, on-chain reputation, and milestone-backed security.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-10">
              {statBoxes.map((s) => (
                <div key={s.label} className={`rounded-xl p-5 ${glass}`}>
                  <div className="text-2xl font-bold tracking-tight text-accent">{s.value}</div>
                  <div className="text-xs text-muted mt-1 tracking-tight">{s.label}</div>
                </div>
              ))}
            </div>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-accent text-accent-foreground font-semibold shadow-[0_4px_16px_rgba(46,139,87,0.3)] hover:shadow-[0_6px_24px_rgba(46,139,87,0.4)] transition-all active:scale-[0.97]"
            >
              Browse the Marketplace <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>

          {/* Right: mock marketplace card */}
          <motion.div variants={fadeUp} className={`rounded-2xl p-8 ${glass}`}>
            <div className="flex items-center justify-between mb-6">
              <span className="px-2.5 py-1 rounded-md bg-success/15 text-success text-xs font-mono font-semibold border border-success/20">
                Score: 87
              </span>
              <span className="text-xs text-muted font-mono">Low Risk</span>
            </div>
            <h3 className="font-semibold text-lg mb-1 tracking-tight">Brand Strategy & GTM Execution</h3>
            <p className="text-sm text-muted mb-6">by Apex Digital Agency</p>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Contract Value</span>
                <span className="font-semibold font-mono">$85,000</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Token Price</span>
                <span className="font-semibold text-accent font-mono">$7.65</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Expected Return</span>
                <span className="font-semibold text-success font-mono">+11.8%</span>
              </div>
            </div>
            <div className="mb-6">
              <div className="flex justify-between text-xs text-muted mb-2">
                <span>Milestone Progress</span>
                <span>2 / 4</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full w-[50%] rounded-full bg-gradient-to-r from-accent to-success" />
              </div>
            </div>
            <div className={`rounded-xl p-4 flex items-center justify-between ${glass}`}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium">Escrow Verified</span>
              </div>
              <ExternalLink className="h-4 w-4 text-muted" />
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Trust Numbers                                                      */
/* ------------------------------------------------------------------ */

function TrustNumbers() {
  return (
    <section className="py-32 border-t border-white/[0.06] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[50%] rounded-full bg-brand/5 blur-[140px]" />
      </div>
      <motion.div
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainer}
      >
        <motion.p variants={fadeUp} className="text-accent text-sm font-semibold tracking-widest uppercase mb-3">
          Protocol Security
        </motion.p>
        <motion.div variants={fadeUp} className="mb-4">
          <span className="text-8xl sm:text-9xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-accent to-brand">
            27
          </span>
        </motion.div>
        <motion.p variants={fadeUp} className="text-xl text-muted mb-16 tracking-tight">
          Solidity tests passing across escrow, tokenization, and dispute resolution
        </motion.p>
        <motion.div variants={fadeUp} className={`rounded-2xl p-8 inline-flex flex-wrap justify-center gap-12 ${glass}`}>
          <div className="text-center">
            <div className="text-3xl font-bold tracking-tight text-foreground">100%</div>
            <div className="text-sm text-muted mt-1">On-chain Reputation</div>
          </div>
          <div className="h-12 w-px bg-white/[0.08] hidden sm:block" />
          <div className="text-center">
            <div className="text-3xl font-bold tracking-tight text-foreground">ZKP</div>
            <div className="text-sm text-muted mt-1">Protected Client Privacy</div>
          </div>
          <div className="h-12 w-px bg-white/[0.08] hidden sm:block" />
          <div className="text-center">
            <div className="text-3xl font-bold tracking-tight text-foreground">EAS</div>
            <div className="text-sm text-muted mt-1">KYB Attestations</div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Featured Contracts (live data)                                     */
/* ------------------------------------------------------------------ */

function FeaturedContracts() {
  const { listings } = useMarketplace();

  const featured = useMemo(() => {
    return listings.slice(0, 3).map((c) => ({
      id: c.tokenId,
      title: c.title,
      agency: c.agency.name ?? c.agency.address.slice(0, 10) + "...",
      score: c.avgScore ?? 0,
      value: formatCurrencyUtil(c.totalValue),
      progress: Math.round((c.completedMilestones / Math.max(c.totalMilestones, 1)) * 100),
      tokenPrice: formatCurrencyUtil(c.totalValue / 10_000, "$"),
      tokensAvailable: Math.max(0, 10_000 - Math.round(c.progress * 100)).toLocaleString(),
    }));
  }, [listings]);

  return (
    <section className="py-32 border-t border-white/[0.06]">
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainer}
      >
        <motion.p variants={fadeUp} className="text-accent text-sm font-semibold tracking-widest uppercase text-center mb-3">
          Live Marketplace
        </motion.p>
        <motion.h2 variants={fadeUp} className="text-4xl sm:text-5xl font-bold tracking-tight text-center mb-6">
          Featured Contracts
        </motion.h2>

        {featured.length === 0 ? (
          <motion.div variants={fadeUp} className="text-center mt-12">
            <p className="text-muted text-lg mb-8 tracking-tight">No contracts tokenized yet -- be the first.</p>
            <Link
              href="/contracts/new"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-accent text-accent-foreground font-semibold shadow-[0_4px_16px_rgba(46,139,87,0.3)] transition-all active:scale-[0.97]"
            >
              Create Contract <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        ) : (
          <>
            <motion.div variants={fadeUp} className="flex justify-center mb-12">
              <Link href="/marketplace" className="group flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors">
                View all contracts <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {featured.map((c) => (
                <motion.div variants={fadeUp} key={c.id}>
                  <Link
                    href={`/marketplace/${c.id}`}
                    className={`block rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 group ${glass} ${glassHover}`}
                  >
                    <div className="flex items-center justify-between mb-5">
                      <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-success/15 text-success border border-success/20">
                        Score: {c.score}
                      </span>
                      <span className="text-sm font-semibold text-muted font-mono">{c.value}</span>
                    </div>
                    <h3 className="font-semibold text-lg mb-1.5 tracking-tight group-hover:text-accent transition-colors">{c.title}</h3>
                    <p className="text-sm text-muted mb-6 tracking-tight">by {c.agency}</p>
                    <div className="mb-4">
                      <div className="flex justify-between text-xs font-medium text-muted mb-2 tracking-tight">
                        <span>Completion</span><span>{c.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${c.progress}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                          className="h-full rounded-full bg-gradient-to-r from-accent to-success"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-sm mt-6 pt-6 border-t border-white/[0.08] font-medium">
                      <span className="text-muted">{c.tokenPrice}/token</span>
                      <span className="text-foreground">{c.tokensAvailable} available</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  CTA Section                                                        */
/* ------------------------------------------------------------------ */

function CTASection() {
  return (
    <section className="py-32 border-t border-white/[0.06] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/3 w-[50%] h-[60%] rounded-full bg-accent/6 blur-[150px]" />
      </div>
      <motion.div
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        variants={staggerContainer}
      >
        <motion.div variants={fadeUp} className={`rounded-3xl p-12 sm:p-16 text-center ${glass}`}>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-5 leading-tight">
            Ready to Tokenize Your Next Service Contract?
          </h2>
          <p className="text-muted text-lg tracking-tight mb-10 max-w-lg mx-auto">
            Join the institutional marketplace for contract financing. Get started in minutes.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/contracts/new"
              className="flex items-center gap-2.5 px-8 py-4 rounded-xl bg-accent text-accent-foreground font-semibold shadow-[0_4px_20px_rgba(46,139,87,0.35)] hover:shadow-[0_6px_28px_rgba(46,139,87,0.45)] transition-all active:scale-[0.97]"
            >
              Create Contract <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/marketplace"
              className={`flex items-center gap-2.5 px-8 py-4 rounded-xl font-semibold transition-all active:scale-[0.97] ${glass} ${glassHover}`}
            >
              Browse Marketplace
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Footer                                                             */
/* ------------------------------------------------------------------ */

function Footer() {
  const columns = [
    {
      title: "Marketplace",
      links: [
        { label: "Browse Contracts", href: "/marketplace" },
        { label: "Create Contract", href: "/contracts/new" },
        { label: "Dashboard", href: "/dashboard" },
        { label: "Portfolio", href: "/portfolio" },
      ],
    },
    {
      title: "Protocol",
      links: [
        { label: "Smart Contracts", href: "#" },
        { label: "Escrow System", href: "#" },
        { label: "Tokenization", href: "#" },
        { label: "Dispute Resolution", href: "#" },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Documentation", href: "#" },
        { label: "API Reference", href: "#" },
        { label: "Security", href: "#" },
        { label: "Brand Kit", href: "#" },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/[0.06] py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <TokeruLogo size={28} className="rounded object-cover" />
              <span className="font-semibold text-foreground tracking-tight text-lg">Tokeru</span>
            </div>
            <p className="text-sm text-muted tracking-tight leading-relaxed mb-6">
              Institutional marketplace for intellectual deliverable tokenization. Built on Base.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://x.com/thesignaldir" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground transition-colors text-sm font-medium">X</a>
              <a href="https://www.linkedin.com/company/105974279/" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground transition-colors text-sm font-medium">LinkedIn</a>
              <a href="https://t.me/thesignaldirectory#" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground transition-colors text-sm font-medium">Telegram</a>
              <a href="https://discord.com/invite/DyMtfph9rA" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-foreground transition-colors text-sm font-medium">Discord</a>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-semibold text-sm text-foreground/80 uppercase tracking-widest mb-4">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-muted hover:text-foreground transition-colors tracking-tight">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted/60">
          <span>2024-2025 Tokeru. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <span>Terms of Service</span>
            <span>Privacy Policy</span>
            <span className="font-mono uppercase tracking-widest">Built on Base | Kleros | Uniswap V3</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Page (default export)                                              */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  return (
    <div className="overflow-x-hidden">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <Navbar />
      <Hero />
      <HowItWorks />
      <ForAgencies />
      <ForInvestors />
      <TrustNumbers />
      <FeaturedContracts />
      <CTASection />
      <Footer />
    </div>
  );
}
