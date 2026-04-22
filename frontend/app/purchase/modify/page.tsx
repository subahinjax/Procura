"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDateIndian } from "@/utils/dateUtils";
import { formatAmount } from "@/utils/numberUtils";
import { API_BASE_URL } from "@/lib/api";
import { Eye, PencilLine, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
// ✅ removed markInternalNav — using sessionStorage directly

export default function ModifyPOPage() {
  const [pos, setPos] = useState<any[]>([]);
  const [pageloading, setPageLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const router = useRouter();
  const { user, loading } = useAuth();

  useAuthGuard();

  const fetchPOs = async () => {
    try {
      setPageLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/purchase-orders`, {
        credentials: "include",
      });
      if (res.status === 401) {
        router.replace("/session-expired");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch purchase orders");
      const data = await res.json();
      setPos(data);
    } catch (err) {
      console.error("Error loading POs:", err);
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (loading || !user) return;
    setCurrentUser(user.username);
    fetchPOs();
  }, [loading, user]);

  if (loading || pageloading) {
    return <p className="text-center p-4">Loading purchase orders...</p>;
  }

  return (
    <div className="p-4 bg-gray-100 rounded-xl shadow">
      <h2 className="text-lg font-semibold mb-4 text-white text-center bg-blue-600 py-2 rounded-md shadow">
        Purchase Orders List
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
            <th className="px-4 py-2 border text-center">Documents</th>
          </tr>
        </thead>
        <tbody>
          {pos.map((po) => {
            const hasReleasedCopy = po.documents?.some((d: any) => d.doc_type === "PO_RELEASED");
            const canUploadReleasedCopy = po.status === "Approved" && !hasReleasedCopy;
            const canEdit =
              currentUser &&
              po.created_by?.trim().toLowerCase() === currentUser.trim().toLowerCase() &&
              !po.released_by &&
              po.status === "Draft";
            const canCancel =
              currentUser &&
              po.created_by?.trim().toLowerCase() === currentUser.trim().toLowerCase() &&
              !po.released_by &&
              po.status !== "Cancelled";

            return (
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
                  <div className="flex items-center justify-center gap-3">
                    {/* 👁 VIEW */}
                    <Link href={`/purchase/report/${po.id}`} target="_blank" rel="noopener noreferrer"
                      title="View PO" className="transition-transform duration-200 hover:scale-125">
                      <Eye className="w-5 h-5 text-blue-600 hover:text-blue-800" />
                    </Link>

                    {/* ✏ EDIT */}
                    {canEdit ? (
                      <button
                        title="Edit PO"
                        className="transition-transform duration-200 hover:scale-125"
                        onClick={() => {
                          sessionStorage.setItem("from_modify_list", "true");
                          router.push(`/purchase/modify/${po.id}`);
                        }}
                      >
                        <PencilLine className="w-5 h-5 text-green-600 hover:text-green-800" />
                      </button>
                    ) : (
                      <span title="Editing not allowed">
                        <PencilLine className="w-5 h-5 text-gray-400 cursor-not-allowed" />
                      </span>
                    )}

                    {/* ❌ CANCEL */}
                    {canCancel ? (
                      <button type="button" title="Cancel PO"
                        className="transition-transform duration-200 hover:scale-125"
                        onClick={async () => {
                          if (!window.confirm("Do you really want to cancel this PO?")) return;
                          try {
                            const res = await fetch(`${API_BASE_URL}/api/purchase-orders/${po.id}/cancel`,
                              { method: "PUT", credentials: "include" });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.message || "Cancel failed");
                            setPos(prev => prev.map(p => p.id === po.id ? { ...p, status: "Cancelled" } : p));
                          } catch (err: any) {
                            alert(err.message);
                          }
                        }}>
                        <XCircle className="w-5 h-5 text-red-600 hover:text-red-800" />
                      </button>
                    ) : (
                      <span title="Cannot cancel">
                        <XCircle className="w-5 h-5 text-gray-400 cursor-not-allowed" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="border px-2 py-2 align-top">
                  <ul className="space-y-1">
                    {po.documents?.map((doc: any, i: number) => (
                      <li key={i}>
                        <a href={`${API_BASE_URL}/download/po-document/${doc.file_path}`}
                          className="text-blue-600 underline text-sm" target="_blank" rel="noopener noreferrer">
                          {doc.file_name}
                        </a>
                      </li>
                    ))}
                    {canUploadReleasedCopy && (
                      <li>
                        <button className="text-sm text-green-700 underline hover:text-green-900"
                          onClick={() => router.push(`/purchase/released-upload/${po.id}`)}>
                          ⬆ Upload Released Copy
                        </button>
                      </li>
                    )}
                    {(!po.documents || po.documents.length === 0) && !canUploadReleasedCopy && (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </ul>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
