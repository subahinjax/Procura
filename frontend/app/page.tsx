"use client";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import SidebarLayout from "@/components/SidebarLayout";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard"; // ✅ FIX 1: import the guard

type Summary = {
  total: number;
  released: number;
  approved: number;
  draft: number;
  cancel: number;
};

export default function PurchasePage() {
  const { user, loading, refreshUser } = useAuth(); // ✅ FIX 2: import refreshUser from context
  const router = useRouter();

  // ✅ FIX 1: handles home button + back navigation session check
  useAuthGuard();

  const [activeSection, setActiveSection] = useState<string | null>("dashboard");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [highestRateItem, setHighestRateItem] = useState<any>(null);
  const [highestValueItem, setHighestValueItem] = useState<any>(null);
  const [topSupplier, setTopSupplier] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // ✅ FIX 3: removed redundant pageshow listener — useAuthGuard handles this
  // ✅ FIX 4: removed duplicate login redirect useEffect — useAuthGuard handles this

  // ---------------- Dashboard fetch ----------------
  useEffect(() => {
    if (loading || !user) return;

    setDashboardLoading(true);

    fetch(`/api/dashboard/purchase`)
      .then(res => {
        if (res.status === 401) {
          // ✅ FIX 5: redirect to session-expired not login
          router.replace("/session-expired");
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setSummary(data.summary);
        setHighestRateItem(data.highestRateItem);
        setHighestValueItem(data.highestValueItem);
        setTopSupplier(data.topSupplier);
      })
      .catch(err => console.error("Dashboard fetch error:", err))
      .finally(() => setDashboardLoading(false));
  }, [loading, user, router]);

  // ✅ EARLY RETURN AFTER ALL HOOKS
  if (loading || !user) {
    return <div>Checking authentication...</div>;
  }

  // ---------------- Render ----------------
  return (
    <SidebarLayout
      title="Dashboard"
      activeSection={activeSection}
      setActiveSection={setActiveSection}
    >
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Purchase Dashboard</h1>

        {dashboardLoading  ? (
          <p className="text-gray-500">Loading dashboard...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardCard title="Total POs" value={summary?.total ?? 0} />
              <DashboardCard title="Released POs" value={summary?.released ?? 0} />
              <DashboardCard title="Approved POs" value={summary?.approved ?? 0} />
              <DashboardCard title="Draft POs" value={summary?.draft ?? 0} />
              <DashboardCard title="Cancel POs" value={summary?.cancel ?? 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <InsightCard
                title="Highest Rate Item"
                label={highestRateItem?.item_name || "—"}
                value={formatCurrency(highestRateItem?.highest_rate)}
              />

              <InsightCard
                title="Highest Purchase Value Item"
                label={highestValueItem?.item_name || "—"}
                value={formatCurrency(highestValueItem?.total_value)}
              />

              <InsightCard
                title="Top Supplier"
                label={topSupplier?.supplier_name || "—"}
                value={formatCurrency(topSupplier?.total_value)}
              />
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}

/* ---------- Helpers ---------- */
function formatCurrency(amount?: number | string) {
  if (amount === null || amount === undefined) return "₹0.00";

  const value = Number(amount);

  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}



/* ---------- UI Components ---------- */
function DashboardCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function InsightCard({ title, label, value }: { title: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-medium">{value}</p>
    </div>
  );
}

