"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

type Approver = { id: number; designation: string; emp_name: string; sort_order: number; is_active: boolean };

export default function CSApproversPage() {
  const [list,    setList]    = useState<Approver[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    setLoading(true);
    // fetch ALL approvers (including inactive) for the master page
    fetch(`${API_BASE_URL}/api/cs-approvers/all`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => {
        // fallback to active-only if /all not implemented yet
        fetch(`${API_BASE_URL}/api/cs-approvers`, { credentials: "include" })
          .then(r => r.json()).then(d => setList(Array.isArray(d) ? d : []));
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const update = (id: number, patch: Partial<Approver>) =>
    setList(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));

  const addRow = () => {
    setList(prev => [...prev, {
      id: -(Date.now()),
      designation: "", emp_name: "",
      sort_order: prev.length + 1,
      is_active: true,
    }]);
  };

  const removeRow = (id: number) => setList(prev => prev.filter(a => a.id !== id));

  // FIX 1: Use POST for new rows (negative id), PUT for existing
  const handleSave = async () => {
    if (list.some(a => !a.designation.trim())) {
      setMsg({ ok: false, text: "All designation fields are required" });
      return;
    }
    setSaving(true); setMsg(null);
    try {
      const payload = list.map((a, i) => ({ ...a, sort_order: i + 1 }));
      const res = await fetch(`${API_BASE_URL}/api/cs-approvers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      setMsg({ ok: true, text: "Approvers saved successfully!" });
      setTimeout(() => setMsg(null), 3000);
      load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || "Save failed" });
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* FIX 3: Clean header — no extra text above */}
      <div className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-xl px-5 py-3 mb-5 flex items-center justify-between shadow">
        <div>
          <h1 className="font-bold text-base">CS Approvers / Verifiers</h1>
          <p className="text-blue-100 text-sm">Designations shown on CS report signatures</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 bg-white text-blue-700 font-semibold text-sm px-4 py-2 rounded-lg shadow hover:bg-blue-50 disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium mb-4 ${msg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {msg.ok ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>}
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10 text-gray-400"><Loader2 size={22} className="animate-spin"/></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-semibold uppercase">
                <th className="px-3 py-3 w-8 text-center">#</th>
                <th className="px-3 py-3 text-left">Designation *</th>
                <th className="px-3 py-3 text-left">Name (optional)</th>
                <th className="px-3 py-3 text-center w-16">Active</th>
                <th className="px-3 py-3 text-center w-12">Del</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a, i) => (
                <tr key={a.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-3 py-2 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2">
                    <input type="text" value={a.designation}
                      onChange={e => update(a.id, { designation: e.target.value })}
                      placeholder="e.g. COE"
                      className={`w-full h-8 border rounded px-2 text-sm focus:border-blue-500 focus:outline-none ${!a.designation.trim() ? "border-red-300" : "border-gray-300"}`}/>
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" value={a.emp_name || ""}
                      onChange={e => update(a.id, { emp_name: e.target.value })}
                      placeholder="Employee name"
                      className="w-full h-8 border border-gray-300 rounded px-2 text-sm focus:border-blue-500 focus:outline-none"/>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={a.is_active}
                      onChange={e => update(a.id, { is_active: e.target.checked })}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer"/>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => removeRow(a.id)}
                      className="p-1.5 rounded bg-red-50 text-red-500 hover:bg-red-100">
                      <Trash2 size={13}/>
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">No approvers yet. Click Add below.</td></tr>
              )}
            </tbody>
          </table>
          <div className="p-3 border-t border-gray-100">
            <button onClick={addRow}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50">
              <Plus size={14}/> Add Designation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
