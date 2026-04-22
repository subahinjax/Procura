"use client";
import SidebarLayout from "@/components/SidebarLayout";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";

export default function PurchaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isReportPage = pathname.startsWith("/purchase/report");

  useAuthGuard();

  if (loading || !user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // ❌ No sidebar for report pages
  if (isReportPage) {
    return <>{children}</>;
  }

  // ✅ Purchase Order sidebar — no Accounts Payment here
  const menuItems = [
    { label: "Create PO", href: "/purchase/create" },
    { label: "View / Modify PO", href: "/purchase/modify" },
    { label: "Import PO", href: "/purchase/importPO" },
    { label: "Comparative Statement", href: "/purchase/cs" },
  ];

  return (
    <SidebarLayout title="Purchase Order" menuItems={menuItems}>
      {children}
    </SidebarLayout>
  );
}
