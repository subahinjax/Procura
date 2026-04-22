"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { API_BASE_URL } from "@/lib/api";
import { formatDateIndian } from "@/utils/dateUtils";
import { Eye, PencilLine, Trash2 } from "lucide-react";

export default function GRNListPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [grns, setGrns] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // ── View modal state ──
  const [viewGrn, setViewGrn] = useState<any | null>(null);
  const [viewDetails, setViewDetails] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useAuthGuard();

  useEffect(() => {
    if (loading || !user) return;
    fetchGRNs();
  }, [loading, user]);

  const fetchGRNs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/grn`, { credentials: "include" });
      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (!res.ok) throw new Error("Failed to fetch GRNs");
      const data = await res.json();
      setGrns(data);
    } catch (err) {
      console.error("Error fetching GRNs:", err);
    } finally {
      setPageLoading(false);
    }
  };

  // ── Open view modal: fetch full GRN + its items ──
const handleView = async (grn: any) => {
  setViewGrn(grn);
  setViewDetails([]);
  setModalLoading(true);
  try {
    const res = await fetch(`${API_BASE_URL}/api/grn/${grn.id}`, { credentials: "include" });
    if (res.status === 401) { router.replace("/session-expired"); return; }
    if (!res.ok) throw new Error("Failed to fetch GRN details");
    const data = await res.json();

    setViewGrn(data.header);       // ← was: data
    setViewDetails(data.details);  // ← was: data.items
  } catch (err) {
    console.error("Error fetching GRN details:", err);
  } finally {
    setModalLoading(false);
  }
};

  const handleDelete = async (id: number, grn_number: string) => {
    if (!window.confirm(`Delete GRN ${grn_number}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/grn/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (!res.ok) throw new Error("Failed to delete");
      setGrns(prev => prev.filter(g => g.id !== id));
      alert("GRN deleted successfully");
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading || pageLoading) return <p className="text-center p-4">Loading...</p>;

  return (
    <div className="p-4 bg-gray-100 rounded-xl shadow">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white text-center bg-blue-600 py-2 px-6 rounded-md shadow">
          GRN List
        </h2>
        <button
          onClick={() => {
            sessionStorage.setItem("from_grn_list", "true");
            router.push("/stores/grn/create");
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          + New GRN
        </button>
      </div>

      <table className="w-full border-collapse bg-white shadow-sm rounded-md">
        <thead className="bg-gray-200">
          <tr>
            <th className="px-4 py-2 border">GRN No</th>
            <th className="px-4 py-2 border">Date</th>
            <th className="px-4 py-2 border">Supplier</th>
            <th className="px-4 py-2 border">PO No</th>
            <th className="px-4 py-2 border">Department</th>
            <th className="px-4 py-2 border">Sub Dept.</th>
            <th className="px-4 py-2 border">Created By</th>
            <th className="px-4 py-2 border text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {grns.length === 0 ? (
            <tr><td colSpan={8} className="text-center py-6 text-gray-400">No GRNs found</td></tr>
          ) : grns.map((grn) => (
            <tr key={grn.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2 font-medium">{grn.grn_number}</td>
              <td className="border px-4 py-2">{formatDateIndian(grn.grn_date)}</td>
              <td className="border px-4 py-2">{grn.supplier_name}</td>
              <td className="border px-4 py-2">{grn.po_no || "—"}</td>
              <td className="border px-4 py-2">{grn.dept_name || "—"}</td>
              <td className="border px-4 py-2">{grn.subdept_name || "—"}</td>
              <td className="border px-4 py-2">{grn.created_by}</td>
              <td className="border px-3 py-2">
                {(() => {
                  const isLocked = grn.invoice_status === "COMPLETE";
                  return (
                    <div className="flex items-center justify-center gap-3">

                      {/* View — opens modal */}
                      <button
                        title="View GRN"
                        onClick={() => handleView(grn)}
                        className="transition-transform duration-200 hover:scale-125"
                      >
                        <Eye className="w-5 h-5 text-blue-600 hover:text-blue-800" />
                      </button>

                      {/* Edit — disabled when COMPLETE */}
                      <button
                        title={isLocked ? "Cannot edit — Invoice is COMPLETE" : "Edit GRN"}
                        onClick={() => {
                          if (isLocked) {
                            alert(`GRN ${grn.grn_number} is fully invoiced (COMPLETE) and cannot be edited.`);
                            return;
                          }
                          sessionStorage.setItem("from_grn_list", "true");
                          router.push(`/stores/grn/${grn.id}`);
                        }}
                        className={`transition-transform duration-200 ${isLocked ? "opacity-40 cursor-not-allowed" : "hover:scale-125"}`}
                      >
                        <PencilLine className={`w-5 h-5 ${isLocked ? "text-gray-400" : "text-green-600 hover:text-green-800"}`} />
                      </button>

                      {/* Delete — disabled when COMPLETE */}
                      <button
                        title={isLocked ? "Cannot delete — Invoice is COMPLETE" : "Delete GRN"}
                        onClick={() => {
                          if (isLocked) {
                            alert(`GRN ${grn.grn_number} is fully invoiced (COMPLETE) and cannot be deleted.`);
                            return;
                          }
                          handleDelete(grn.id, grn.grn_number);
                        }}
                        className={`transition-transform duration-200 ${isLocked ? "opacity-40 cursor-not-allowed" : "hover:scale-125"}`}
                      >
                        <Trash2 className={`w-5 h-5 ${isLocked ? "text-gray-400" : "text-red-600 hover:text-red-800"}`} />
                      </button>

                    </div>
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── View Modal ── */}
      {viewGrn && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-xs text-gray-400">GRN No</p>
                <h3 className="text-lg font-bold text-gray-800">{viewGrn.grn_number}</h3>
              </div>
              <button
                onClick={() => { setViewGrn(null); setViewDetails([]); }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            {modalLoading ? (


              <p className="text-center py-10 text-gray-400">Loading...</p>
            ) : (
              <>
                {/* Header details grid */}
                <div className="grid grid-cols-3 gap-3 text-sm mb-4 bg-gray-50 rounded-lg p-3">
{[
  ["GRN Date",       formatDateIndian(viewGrn.grn_date)],
  ["Supplier",       viewGrn.supplier_name || "—"],
  ["DC Number",      viewGrn.dc_number || "—"],
  ["DC Date",        viewGrn.dc_date ? formatDateIndian(viewGrn.dc_date) : "—"],
  ["Gate Entry No",  viewGrn.gate_entry_no || "—"],
  ["Gate Entry Date",viewGrn.gate_entry_date ? formatDateIndian(viewGrn.gate_entry_date) : "—"],
  ["Invoice Status", viewGrn.invoice_status || "—"],
  ["Created By",     viewGrn.created_by || "—"],
].map(([label, value]) => (
  <div key={label}>
    <p className="text-xs text-gray-400">{label}</p>
    <p className="font-medium text-gray-800">{value}</p>
  </div>
))}
                </div>

                {/* Items table */}
                <h4 className="font-semibold text-gray-700 mb-2 text-sm">Items</h4>
                <table className="w-full border-collapse text-xs mb-4">
<thead className="bg-gray-100">
  <tr>
    <th className="border px-2 py-1.5 text-left">Item</th>
    <th className="border px-2 py-1.5 text-left">Description</th>
    <th className="border px-2 py-1.5 text-right w-24">Qty Received</th>
    <th className="border px-2 py-1.5 text-right w-24">Invoiced Qty</th>
    <th className="border px-2 py-1.5 text-right w-20">UOM</th>
  </tr>
</thead>
<tbody>
  {viewDetails.length === 0 ? (
    <tr>
      <td colSpan={5} className="text-center py-4 text-gray-400">No items found</td>
    </tr>
  ) : viewDetails.map((item, i) => (
    <tr key={i} className="border-b hover:bg-gray-50">
      <td className="border px-2 py-1.5">{item.item_name}</td>
      <td className="border px-2 py-1.5 text-gray-500">{item.description || "—"}</td>
      <td className="border px-2 py-1.5 text-right">{Number(item.quantity_received).toFixed(3)}</td>
      <td className="border px-2 py-1.5 text-right">{Number(item.invoiced_qty).toFixed(3)}</td>
      <td className="border px-2 py-1.5 text-right">{item.unit_of_measure || "—"}</td>
    </tr>
  ))}
</tbody>
                </table>

                {/* Remarks */}
                {viewGrn.remarks && (
                  <p className="mt-3 text-xs text-gray-500 italic">Remarks: {viewGrn.remarks}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}