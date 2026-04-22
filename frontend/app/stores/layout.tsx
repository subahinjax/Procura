"use client";
import SidebarLayout from "@/components/SidebarLayout";
import { hasAccess } from "@/lib/accessControl";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function StoresLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useAuthGuard();

  const userType = user?.user_type?.toUpperCase() ?? "";
  const isGatePassOnlyUser = ["HOD", "GENERAL", "APPROVER"].includes(userType);

  // If gate-pass-only user is NOT already on an allowed path, block render
  const allowedPaths = ["/stores/rgp", "/stores/nrgp"];
  const isOnAllowedPath = allowedPaths.some(p => pathname?.startsWith(p));

  useEffect(() => {
    if (!loading && user && isGatePassOnlyUser && !isOnAllowedPath) {
      router.replace("/stores/rgp");
    }
  }, [loading, user, isGatePassOnlyUser, isOnAllowedPath]);

  if (loading || !user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Block render until redirect completes for gate-pass-only users on wrong path
  if (isGatePassOnlyUser && !isOnAllowedPath) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  // Access check for non-gate-pass users
  if (!isGatePassOnlyUser && !hasAccess(userType, "STORES_GRN")) {
    return (
      <div className="flex items-center justify-center h-screen">
        Access Denied. Redirecting...
      </div>
    );
  }

  const gatePassMenu = [
    { label: "Returnable Gate Pass",     href: "/stores/rgp"  },
    { label: "Non Returnable Gate Pass", href: "/stores/nrgp" },
  ];

  const fullMenu = [
    { label: "GRN Entry",                href: "/stores/grn"             },
    { label: "Invoice Entry",            href: "/stores/invoice"         },
    { label: "Issue",                    href: "/stores/issue"           },
    { label: "Opening Balance",          href: "/stores/opening-balance" },
    { label: "Stock Report",             href: "/stores/stock-report"    },
    { label: "Returnable Gate Pass",     href: "/stores/rgp"             },
    { label: "Non Returnable Gate Pass", href: "/stores/nrgp"            },
  ];

  return (
    <SidebarLayout title="Stores" menuItems={isGatePassOnlyUser ? gatePassMenu : fullMenu}>
      {children}
    </SidebarLayout>
  );
}