"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Store,
  FileText,
  TrendingUp,
  PlusCircle,
  LogOut,
  Loader2,
  Wallet,
  User,
  HelpCircle,
  X,
  ChevronDown,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { SignalLogo } from "./SignalLogo";
import { useAuth } from "@/hooks/use-auth";

const mainNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/contracts", label: "Contracts", icon: FileText },
  { href: "/portfolio", label: "Portfolio", icon: TrendingUp },
];

function isActive(pathname: string, href: string) {
  if (href === "/contracts") {
    return pathname === "/contracts" || pathname.startsWith("/contracts/");
  }
  return pathname === href || pathname.startsWith(href + "/");
}

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { login, logout, authenticated, ready, displayName, walletAddress } =
    useAuth();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  const navLink = (
    item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> },
    closeMobile?: boolean
  ) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeMobile ? onClose : undefined}
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          active
            ? "bg-accent/10 text-accent border-l-2 border-accent -ml-px"
            : "text-muted hover:text-foreground hover:bg-surface-secondary"
        }`}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {item.label}
      </Link>
    );
  };

  const sidebarContent = (closeMobile: boolean) => (
    <div className="flex flex-col h-full">
      {/* Logo + close on mobile */}
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <Link href="/" className="flex items-center gap-2 group" onClick={closeMobile ? onClose : undefined}>
          <SignalLogo size={28} className="rounded-md" />
          <span className="text-base font-bold tracking-tight group-hover:text-accent transition-colors">
            TrustSignal
          </span>
        </Link>
        {closeMobile && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* User info with dropdown */}
      <div className="px-4 py-3" ref={userMenuRef}>
        {!ready ? (
          <div className="flex items-center gap-2 text-muted text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : authenticated ? (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 hover:bg-surface-secondary transition-colors text-left"
            >
              <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {displayName ?? "Account"}
                </p>
                {walletAddress && (
                  <p className="text-xs text-muted truncate">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                )}
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-muted shrink-0 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border/40 bg-background shadow-lg z-50 py-1">
                <Link
                  href="/profile"
                  onClick={() => {
                    setUserMenuOpen(false);
                    if (closeMobile) onClose();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
                >
                  <User className="h-4 w-4" />
                  Account
                </Link>
                <Link
                  href="/help"
                  onClick={() => {
                    setUserMenuOpen(false);
                    if (closeMobile) onClose();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
                >
                  <HelpCircle className="h-4 w-4" />
                  Help
                </Link>
                <div className="border-t border-border/40 my-1" />
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted">Theme</span>
                  <ThemeToggle />
                </div>
                <div className="border-t border-border/40 my-1" />
                <button
                  onClick={() => {
                    logout();
                    setUserMenuOpen(false);
                    if (closeMobile) onClose();
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={login}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/85 transition-colors"
          >
            <Wallet className="h-4 w-4" />
            Sign in
          </button>
        )}
      </div>

      {/* New Contract button */}
      {authenticated && (
        <div className="px-4 pb-3">
          <Link
            href="/contracts/new"
            onClick={closeMobile ? onClose : undefined}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/85 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            New Contract
          </Link>
        </div>
      )}

      {/* Main navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {mainNav.map((item) => navLink(item, closeMobile))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 border-r border-border/40 bg-background">
        {sidebarContent(false)}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={onClose}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-60 bg-background border-r border-border/40 lg:hidden">
            {sidebarContent(true)}
          </aside>
        </>
      )}
    </>
  );
}
