"use client";
import SidebarLayout from "@/components/SidebarLayout";
import { hasAccess } from "@/lib/accessControl";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PoAccountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useAuthGuard();

  // ✅ Block non-accounts users from entire /po_accounts section
  useEffect(() => {
    if (!loading && user && !hasAccess(user.user_type, "ACCOUNTS_PAY")) {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!hasAccess(user.user_type, "ACCOUNTS_PAY")) {
    return <div className="flex items-center justify-center h-screen">Access Denied. Redirecting...</div>;
  }

  // ✅ Accounts sidebar — only Account Payment
  const menuItems = [
    { label: "Account Payment", href: "/po_accounts" },
  ];

  return (
    <SidebarLayout title="Accounts" menuItems={menuItems}>
      {children}
    </SidebarLayout>
  );
}
