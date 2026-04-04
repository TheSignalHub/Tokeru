"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { Menu, Search, Bell, User, Check, FileText } from "lucide-react";
import { SignalLogo } from "./SignalLogo";
import { useAuth } from "@/hooks/use-auth";
import { buildHeaders } from "@/hooks/use-api";

interface Notification {
  id: number;
  userAddress: string;
  type: string;
  title: string;
  message: string;
  contractId: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface TopBarProps {
  onMenuToggle: () => void;
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { authenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { headers: buildHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [authenticated, fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleMarkAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { ...buildHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // silent
    }
  }

  async function handleMarkRead(id: number) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { ...buildHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  }

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
          {/* Notifications bell */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="relative p-2 rounded-md text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger" />
              )}
            </button>

            {/* Dropdown panel */}
            {open && (
              <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border border-border/40 bg-background shadow-lg z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
                    >
                      <Check className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted">
                    No notifications yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 text-sm transition-colors ${
                          n.read ? "opacity-60" : "bg-accent/5"
                        }`}
                      >
                        {n.contractId ? (
                          <Link
                            href={`/contracts/${n.contractId}`}
                            onClick={() => {
                              if (!n.read) handleMarkRead(n.id);
                              setOpen(false);
                            }}
                            className="block"
                          >
                            <div className="flex items-start gap-2">
                              <FileText className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{n.title}</p>
                                <p className="text-muted text-xs mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-muted text-xs mt-1">{timeAgo(n.createdAt)}</p>
                              </div>
                            </div>
                          </Link>
                        ) : (
                          <div className="flex items-start gap-2">
                            <FileText className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{n.title}</p>
                              <p className="text-muted text-xs mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-muted text-xs mt-1">{timeAgo(n.createdAt)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Link
            href="/profile"
            className="p-2 rounded-md text-muted hover:text-foreground hover:bg-surface-secondary transition-colors lg:flex hidden"
            aria-label="Account"
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
          aria-label="Account"
        >
          <User className="h-4 w-4" />
        </Link>
      )}
    </header>
  );
}
