"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

/**
 * useAuthGuard
 * 
 * Handles: redirect to /login if not authenticated on mount.
 * 
 * visibilitychange + pageshow are handled ONCE in AuthContext at root level.
 * Do NOT add them here — would cause duplicate listeners per page.
 */
export default function useAuthGuard() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, loading, router]);
}
