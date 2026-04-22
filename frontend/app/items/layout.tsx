"use client";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { hasAccess } from "@/lib/accessControl";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useAuthGuard();

  useEffect(() => {
    if (!loading && user && !hasAccess(user.user_type, "MASTER_MENU")) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!hasAccess(user.user_type, "MASTER_MENU")) {
    return <div className="flex items-center justify-center h-screen">Access Denied. Redirecting...</div>;
  }

  // ── No SidebarLayout wrapper — renders clean like Department/Category ──
  return <>{children}</>;
}
