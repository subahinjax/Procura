"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Eye, Pencil, Trash2, CheckCircle2,
  Clock, FileText, Loader2,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { formatDateIndian } from "@/utils/dateUtils";

export default function CSListPage() {
  const router = useRouter();
  const [list,     setList]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cslist`, { credentials: "include" });
      if (res.ok) setList(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number, csNo: string) => {
    if (!confirm(`Delete ${csNo}? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cs/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) setList(prev => prev.filter(r => r.id !== id));
      else { const d = await res.json(); alert(d.error || "Delete failed"); }
    } finally { setDeleting(null); }
  };

  const handleFinalize = async (id: number) => {
    if (!confirm("Finalize this CS? It will be locked and cannot be edited.")) return;
    const res = await fetch(`${API_BASE_URL}/api/cs/${id}/finalize`, {
      method: "PATCH", credentials: "include",
    });
    if (res.ok) load();
    else { const d = await res.json(); alert(d.error || "Failed"); }
  };

  return (
    // FIX 4: text-sm base (up from text-xs)
    <div className="p-4 max-w-6xl mx-auto text-sm">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-xl px-5 py-3 mb-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-2">
          <FileText size={20} />
          <div>
            <h1 className="font-bold text-base leading-tight">Comparative Statements</h1>
            <p className="text-blue-100 text-sm">Supplier quotation comparison</p>
          </div>
        </div>
        <button onClick={() => router.push("/purchase/cs/create")}
          className="flex items-center gap-1.5 bg-white text-blue-700 font-semibold text-sm px-4 py-2 rounded-lg shadow hover:bg-blue-50 transition-colors">
          <Plus size={16} /> New CS
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
            <Loader2 size={20} className="animate-spin" /> Loading…
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText size={40} strokeWidth={1} className="mb-3 opacity-30" />
            <p className="text-sm font-semibold text-gray-500">No comparative statements yet</p>
            <button onClick={() => router.push("/purchase/cs/create")}
              className="mt-3 flex items-center gap-1 text-blue-600 text-sm hover:underline">
              <Plus size={14} /> Create your first CS
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              {/* FIX 4: text-sm headers (up from text-xs) */}
              <tr className="bg-gray-50 border-b border-gray-100 text-sm text-gray-600 font-semibold uppercase tracking-wide">
                <th className="px-4 py-3 text-left">CS No.</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Department</th>
                {/* FIX 4: renamed Description → Purpose, removed Linked PO */}
                <th className="px-4 py-3 text-left">Purpose</th>
                <th className="px-4 py-3 text-left">Suppliers</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(row => {
                // FIX 1: include sup4 in supplier pills
                const supPills = [
                  row.sup1_name ? { slot: 1, name: row.sup1_name } : null,
                  row.sup2_name ? { slot: 2, name: row.sup2_name } : null,
                  row.sup3_name ? { slot: 3, name: row.sup3_name } : null,
                  row.sup4_name ? { slot: 4, name: row.sup4_name } : null,
                ].filter(Boolean) as { slot: number; name: string }[];

                return (
                  <tr key={row.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-blue-50/30 transition-colors">

                    {/* FIX 4: text-sm for all cells */}
                    <td className="px-4 py-3 font-mono text-sm font-medium text-gray-800">
                      {row.cs_no}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateIndian(row.cs_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.dept_name || "—"}
                    </td>
                    {/* FIX 4: renamed to Purpose */}
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate">
                      {row.description || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {supPills.map(s => (
                          <span key={s.slot}
                            className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded truncate max-w-[100px]"
                            title={s.name}>
                            S{s.slot}: {s.name.slice(0, 14)}{s.name.length > 14 ? "…" : ""}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                        row.status === "Finalized"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {row.status === "Finalized"
                          ? <><CheckCircle2 size={11} /> Finalized</>
                          : <><Clock size={11} /> Draft</>}
                      </span>
                    </td>
                    {/* FIX 4: Linked PO column removed */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => router.push(`/purchase/cs/${row.id}`)}
                          title="View"
                          className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">
                          <Eye size={14} />
                        </button>
                        {row.status === "Draft" && (
                          <button onClick={() => router.push(`/purchase/cs/${row.id}?edit=1`)}
                            title="Edit"
                            className="p-1.5 rounded bg-amber-50 text-amber-600 hover:bg-amber-100">
                            <Pencil size={14} />
                          </button>
                        )}
                        {row.status === "Draft" && (
                          <button onClick={() => handleFinalize(row.id)}
                            title="Finalize"
                            className="p-1.5 rounded bg-green-50 text-green-600 hover:bg-green-100">
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        {row.status === "Draft" && (
                          <button onClick={() => handleDelete(row.id, row.cs_no)}
                            disabled={deleting === row.id}
                            title="Delete"
                            className="p-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50">
                            {deleting === row.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
