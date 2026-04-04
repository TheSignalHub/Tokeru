"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Landing page: no sidebar, full-width
  if (pathname === "/") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-md bg-surface border border-border shadow-sm"
        >
          <Menu className="h-5 w-5" />
        </button>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
