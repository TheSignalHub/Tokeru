"use client";

import Link from "next/link";
import { Menu, Search, Bell, User } from "lucide-react";
import { SignalLogo } from "./SignalLogo";
import { useAuth } from "@/hooks/use-auth";

interface TopBarProps {
  onMenuToggle: () => void;
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { authenticated } = useAuth();

  return (
    <header className="h-14 shrink-0 border-b border-border/40 bg-background/90 backdrop-blur-lg flex items-center px-4 gap-3">
      {/* Mobile: hamburger */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile: centered logo */}
      <div className="lg:hidden flex-1 flex justify-center">
        <Link href="/" className="flex items-center gap-2">
          <SignalLogo size={24} className="rounded-md" />
          <span className="text-sm font-bold tracking-tight">TrustSignal</span>
        </Link>
      </div>

      {/* Desktop: search */}
      <div className="hidden lg:flex flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search contracts, agencies..."
            className="w-full pl-9 pr-3 py-1.5 rounded-md bg-surface-secondary border border-border/40 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition-colors"
            disabled
          />
        </div>
      </div>

      {/* Desktop spacer */}
      <div className="hidden lg:block flex-1" />

      {/* Right side: bell + avatar */}
      {authenticated && (
        <div className="flex items-center gap-1.5">
          <button
            className="p-2 rounded-md text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <Link
            href="/profile"
            className="p-2 rounded-md text-muted hover:text-foreground hover:bg-surface-secondary transition-colors lg:flex hidden"
            aria-label="Settings"
          >
            <User className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Mobile: avatar */}
      {authenticated && (
        <Link
          href="/profile"
          className="lg:hidden p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
          aria-label="Settings"
        >
          <User className="h-4 w-4" />
        </Link>
      )}
    </header>
  );
}
