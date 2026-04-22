"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDateIndian } from "@/utils/dateUtils";
import { formatAmount } from "@/utils/numberUtils";
import { API_BASE_URL } from "@/lib/api";
import { useRouter } from "next/navigation";

// ✅ FIX 1: import useAuthGuard — this page was missing it entirely
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { markInternalNav } from "@/hooks/useNavGuard";


type PO = {
  id: number;
  po_no: string;
  sup_name: string;
  po_date: string;
  grand_total: number;
  advance_required: boolean;
  actual_advance: number | null;
  advance_paid: number;
  pending_advance: number;
  total_paid: number;
  balance_amount: number;
  documents?: { file_name: string; file_path: string; }[];
};

export default function POList() {
  const [data, setData] = useState<PO[]>([]);
  const [filter, setFilter] = useState("all");
  const [pageloading, setPageLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  const router = useRouter();
  const { user, loading } = useAuth(); // ✅ FIX 2: single useAuth call (was called twice)

  // ✅ FIX 1: handles home/back navigation session check
  useAuthGuard();


// load function
// load purchase orders
const loadPOs = async () => {
  try {
    setPageLoading(true);

    const res = await fetch(`/api/purchase-orders/list?filter=${filter}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (res.status === 401) {
      router.replace("/session-expired");
      return;
    }

    if (!res.ok) throw new Error(`Failed to fetch POs: ${res.status}`);

    const rows: PO[] = await res.json();
    setData(Array.isArray(rows) ? rows : []);

  } catch (err) {
    console.error("❌ Error loading PO list:", err);
    setData([]);
  } finally {
    setPageLoading(false);
  }
};

// run when user or filter changes
useEffect(() => {
  if (loading || !user) return;

  setCurrentUser(user.username);
  loadPOs();

}, [loading, user, filter]);

  const totals = {
    grand_total:     data.reduce((s, r) => s + Number(r.grand_total || 0), 0),
    actual_advance:  data.reduce((s, r) => s + Number(r.actual_advance || 0), 0),
    advance_paid:    data.reduce((s, r) => s + Number(r.advance_paid || 0), 0),
    pending_advance: data.reduce((s, r) => s + Number(r.pending_advance || 0), 0),
    total_paid:      data.reduce((s, r) => s + Number(r.total_paid || 0), 0),
    balance_amount:  data.reduce((s, r) => s + Number(r.balance_amount || 0), 0),
  };

 if (loading || pageloading) {
    return <p className="text-center p-4">Loading purchase orders...</p>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Purchase Orders</h1>

      <div className="flex gap-2 mb-4">
        <Button onClick={() => setFilter("all")} variant={filter === "all" ? "default" : "outline"}>All PO</Button>
        <Button onClick={() => setFilter("advance-required")} variant={filter === "advance-required" ? "default" : "outline"}>Advance Required</Button>
        <Button onClick={() => setFilter("pending-advance")} variant={filter === "pending-advance" ? "default" : "outline"}>Pending Advance</Button>
        <Button onClick={() => setFilter("pending-full")} variant={filter === "pending-full" ? "default" : "outline"}>Pending Payment</Button>
        <Button onClick={() => setFilter("paid")} variant={filter === "paid" ? "default" : "outline"}>Fully Paid</Button>
      </div>

      {pageloading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="w-full text-sm text-left border">
            <colgroup>
              <col className="w-[10%]" /><col className="w-[15%]" /><col className="w-[7%]" />
              <col className="w-[3%]" /><col className="w-[10%]" /><col className="w-[10%]" />
              <col className="w-[10%]" /><col className="w-[10%]" /><col className="w-[10%]" />
              <col className="w-[10%]" /><col className="w-[1%]" />
            </colgroup>
            <thead className="bg-gray-100">
              <tr>
                <th className="px-1 py-2 border text-center">PO No</th>
                <th className="px-1 py-2 border text-center">Supplier</th>
                <th className="px-1 py-2 border text-center">PO Date</th>
                <th className="px-1 py-2 border text-center">Adv. Req</th>
                <th className="px-1 py-2 border text-center">PO Total</th>
                <th className="px-1 py-2 border text-center">Actual Advance</th>
                <th className="px-1 py-2 border text-center">Advance Paid</th>
                <th className="px-1 py-2 border text-center">Advance Due</th>
                <th className="px-1 py-2 border text-center">Total Paid</th>
                <th className="px-1 py-2 border text-center">Balance</th>
                <th className="px-1 py-2 border text-center">Payment</th>
                <th className="px-1 py-2 border text-center">Documents</th>
              </tr>
            </thead>
            <tbody>
              {data.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-1 py-2 border text-center">{po.po_no}</td>
                  <td className="px-1 py-2 border">{po.sup_name}</td>
                  <td className="px-1 py-2 border text-center">{formatDateIndian(po.po_date)}</td>
                  <td className="px-1 py-2 border text-center">{po.advance_required ? "Yes" : "No"}</td>
                  <td className="px-1 py-2 border text-right">₹ {formatAmount(po.grand_total)}</td>
                  <td className="px-1 py-2 border text-right">₹ {formatAmount(po.actual_advance ?? 0)}</td>
                  <td className="px-1 py-2 border text-right">₹ {formatAmount(po.advance_paid)}</td>
                  <td className="px-1 py-2 border text-right text-red-600 font-semibold">₹ {formatAmount(po.pending_advance)}</td>
                  <td className="px-1 py-2 border text-right">₹ {formatAmount(po.total_paid)}</td>
                  <td className="px-1 py-2 border text-right">₹ {formatAmount(po.balance_amount)}</td>
               <td className="px-1 py-2 border">
  <button
    className="text-blue-600 hover:underline"
onClick={() => {
  markInternalNav();
  sessionStorage.setItem("from_po_list", "true");
  router.push(`/po_accounts/po/${po.id}`);
}}
  >
    View
  </button>
</td>
                  <td className="border px-2 py-2">
                    {po.documents?.length ? (
                      <ul className="space-y-1">
                        {po.documents.map((doc, i) => (
                          <li key={i}>
                            <a href={`${API_BASE_URL}/download/po-document/${doc.file_path}`} className="text-blue-600 underline text-sm">
                              {doc.file_name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-blue-100 shadow-md z-10">
              <tr>
                <td colSpan={4} className="border px-2 py-2 font-bold text-center">Grand Total</td>
                <td className="border px-2 py-2 font-bold text-right">₹ {formatAmount(totals.grand_total)}</td>
                <td className="border px-2 py-2 font-bold text-right">₹ {formatAmount(totals.actual_advance)}</td>
                <td className="border px-2 py-2 font-bold text-right">₹ {formatAmount(totals.advance_paid)}</td>
                <td className="border px-2 py-2 font-bold text-right text-red-600">₹ {formatAmount(totals.pending_advance)}</td>
                <td className="border px-2 py-2 font-bold text-right">₹ {formatAmount(totals.total_paid)}</td>
                <td className="border px-2 py-2 font-bold text-right">₹ {formatAmount(totals.balance_amount)}</td>
                <td className="border px-2 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
