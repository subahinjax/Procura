"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { formatDateIndian } from "@/utils/dateUtils";
import { formatAmount } from "@/utils/numberUtils";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard"; // ✅ FIX 1: add guard

export default function ImportPOPage() {
  const [pos, setPos] = useState<any[]>([]);
  const [locloading, setLoading] = useState(true);
  const router = useRouter();
  const { user, loading } = useAuth();

  // ✅ FIX 1: handles home/back navigation session check
  useAuthGuard();

  // ✅ FIX 2: removed duplicate auth check useEffect — useAuthGuard handles it
  // ✅ FIX 3: removed pageshow listener — conflicts with AuthContext listener
  // ✅ FIX 4: removed duplicate fetchPOs useEffect — was fetching twice on mount

  // 📦 Single fetch — only when user is authenticated
  useEffect(() => {
    if (loading || !user) return;

    const fetchPOs = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/purchase-orders`, {
          credentials: "include",
        });

        if (res.status === 401) {
          // ✅ FIX 5: session-expired not login
          router.replace("/session-expired");
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch purchase orders");

        const data = await res.json();
        setPos(data);
      } catch (err) {
        console.error("Error loading POs:", err);
        alert("Failed to load Purchase Orders");
      } finally {
        setLoading(false);
      }
    };

    fetchPOs();
  }, [loading, user, router]);

  const handleSelect = (poId: number) => {
    if (!window.confirm("Do you want to copy this Purchase Order?")) return;
    router.replace(`/purchase/create?mode=create&copyId=${poId}`);
  };

  if (loading || !user) {
    return <div>Checking authentication...</div>;
  }

  if (locloading) {
    return <p className="text-center p-4">Loading purchase orders...</p>;
  }

  return (
    <div className="p-4 bg-gray-100 rounded-xl shadow">
      <h2 className="text-lg font-semibold mb-4 text-white text-center bg-blue-600 py-2 rounded-md shadow">
        Import Purchase Order
      </h2>
      <table className="w-full border-collapse bg-white shadow-sm rounded-md">
        <thead className="bg-gray-200">
          <tr>
            <th className="px-4 py-2 border">PO No</th>
            <th className="px-4 py-2 border">Supplier</th>
            <th className="px-4 py-2 border">Date</th>
            <th className="px-4 py-2 border">Sub Total</th>
            <th className="px-4 py-2 border">GST Total</th>
            <th className="px-4 py-2 border">Grand Total</th>
            <th className="px-4 py-2 border">Status</th>
            <th className="px-4 py-2 border text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {pos.map((po) => (
            <tr key={po.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{po.po_no}</td>
              <td className="border px-4 py-2">{po.sup_name}</td>
              <td className="border px-4 py-2">{formatDateIndian(po.po_date)}</td>
              <td className="border px-4 py-2 text-right">{formatAmount(po.sub_total)}</td>
              <td className="border px-4 py-2 text-right">{formatAmount(po.gst_total)}</td>
              <td className="border px-4 py-2 text-right">{formatAmount(po.grand_total)}</td>
              <td className="border px-4 py-2 text-center font-semibold">
                {po.status === "Draft"     && <span className="text-yellow-700">Draft</span>}
                {po.status === "Approved"  && <span className="text-green-700">Approved</span>}
                {po.status === "Released"  && <span className="text-blue-700">Released</span>}
                {po.status === "Cancelled" && <span className="text-red-700">Cancelled</span>}
              </td>
              <td className="border px-3 py-2">
                <div className="flex items-center justify-center gap-4">
                  <Link href={`/purchase/report/${po.id}`} target="_blank" rel="noopener noreferrer" title="View PO"
                    className="transition-transform duration-200 hover:scale-125">
                    <Eye className="w-5 h-5 text-blue-600 hover:text-blue-800" />
                  </Link>
                  <button onClick={() => handleSelect(po.id)} title="Select to Import"
                    className="transition-transform duration-200 hover:scale-125">
                    <Copy className="w-5 h-5 text-green-600 hover:text-green-800" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {pos.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-gray-500 py-4">No Purchase Orders found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
