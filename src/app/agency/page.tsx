"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@heroui/react";

export default function AgencyRedirectPage() {
  const router = useRouter();
  const { walletAddress, ready, authenticated } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (authenticated && walletAddress) {
      router.replace(`/agency/${walletAddress}`);
    } else {
      router.replace("/profile");
    }
  }, [ready, authenticated, walletAddress, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner size="lg" className="text-accent" />
    </div>
  );
}
