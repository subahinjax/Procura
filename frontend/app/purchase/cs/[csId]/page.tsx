"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, Printer } from "lucide-react";
import CreateCSForm from "../create/CreateCSForm";
import { API_BASE_URL } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function CSDetailPage() {
  const { csId }     = useParams();
  const searchParams = useSearchParams();
  const isEditMode   = searchParams.get("edit") === "1";

  const [csData,     setCsData]     = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const router = useRouter();

  // ── fetch / refetch CS data ────────────────────────────────────────────────
  const fetchCS = useCallback(() => {
    if (!csId) return;
    setLoading(true);
    fetch(`/api/proxy/cs/${csId}`, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error("CS not found"); return r.json(); })
      .then(data => { setCsData(data); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [csId]);

  useEffect(() => { fetchCS(); }, [fetchCS]);

  // ── called by CreateCSForm after a successful save ─────────────────────────
  // Switches back to view mode and re-fetches fresh data from server
  const handleSaved = useCallback(() => {
    // Push view URL (removes ?edit=1) then refetch
    window.history.replaceState(null, "", `/purchase/cs/${csId}`);
    fetchCS();
  }, [csId, fetchCS]);

  const handleFinalize = async () => {
    if (!confirm("Finalize this CS? It will be locked and cannot be edited.")) return;
    setFinalizing(true);
    const res = await fetch(`/api/proxy/cs/${csId}/finalize`, {
      method: "PATCH", credentials: "include",
    });
    if (res.ok) fetchCS();   // refetch to get Finalized status
    setFinalizing(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
      <Loader2 size={22} className="animate-spin" /> Loading CS…
    </div>
  );
  if (error)   return <p className="p-8 text-red-500">{error}</p>;
  if (!csData) return null;

  const isFinalized = csData.header.status === "Finalized";
  // After handleSaved, isEditMode becomes false (URL no longer has ?edit=1)
  const mode = isEditMode && !isFinalized ? "edit" : "view";

  return (
    <div className="p-4 max-w-6xl mx-auto">

      {/* Status bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${
            isFinalized ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}>
            {isFinalized
              ? <><CheckCircle2 size={12} /> Finalized</>
              : <><Loader2 size={12} /> Draft</>}
          </span>
          <span className="text-xs text-gray-500 font-mono">{csData.header.cs_no}</span>
        </div>

        <div className="flex gap-2">
          {/* Print Report button — always visible */}
          <button
            onClick={() => router.push(`/purchase/cs/report/${csId}`)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-medium">
            <Printer size={12} /> Print Report
          </button>
          {!isFinalized && (
            <button
              onClick={handleFinalize}
              disabled={finalizing}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 font-medium disabled:opacity-50">
              {finalizing
                ? <Loader2 size={12} className="animate-spin" />
                : <CheckCircle2 size={12} />}
              Finalize
            </button>
          )}
        </div>
      </div>

      <CreateCSForm existingCS={csData} mode={mode} onSaved={handleSaved} />
    </div>
  );
}
