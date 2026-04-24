"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { API_BASE_URL } from "@/lib/api";
import { PencilLine, Trash2, Eye, Plus, X, Check, ChevronDown, ChevronRight } from "lucide-react";

// mas_dept:    dept_id VARCHAR(10) PK, dept_name VARCHAR(100)
// mas_subdept: subdept_id INTEGER PK, dept_id VARCHAR(10), subdept_name VARCHAR(100)
interface Dept    { dept_id: string; dept_name: string; subdept_count: number; }
interface Subdept { subdept_id: number; dept_id: string; dept_name: string; subdept_name: string; }

// ── View Modal — shows all subdepts of a dept ─────────────────────────────────
function ViewModal({ dept, subdepts, onClose }: {
  dept: Dept; subdepts: Subdept[]; onClose: () => void;
}) {
  const mine = subdepts.filter(s => s.dept_id === dept.dept_id);
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-1">
          <div>
            <p className="text-xs text-gray-400 font-mono">Dept ID: {dept.dept_id}</p>
            <h3 className="text-lg font-bold text-gray-800">{dept.dept_name}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          {mine.length} Sub-Department{mine.length !== 1 ? "s" : ""}
        </p>
        <div className="overflow-y-auto flex-1 border rounded">
          {mine.length === 0
            ? <p className="text-sm text-gray-400 italic p-4">No sub-departments yet</p>
            : (
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="border-b px-3 py-2 text-left text-xs text-gray-500 font-semibold w-24">ID</th>
                    <th className="border-b px-3 py-2 text-left text-xs text-gray-500 font-semibold">Sub-Department</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map(s => (
                    <tr key={s.subdept_id} className="hover:bg-gray-50 border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-gray-400">{s.subdept_id}</td>
                      <td className="px-3 py-2 text-gray-800">{s.subdept_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal — edit dept name and/or a subdept ──────────────────────────────
function EditModal({ dept, subdepts, onSave, onClose, isAdmin }: {
  dept: Dept; subdepts: Subdept[];
  onSave: (deptName: string, editSub: { subdept_id: number; subdept_name: string } | null) => Promise<void>;
  onClose: () => void; isAdmin: boolean;
}) {
  const mine = subdepts.filter(s => s.dept_id === dept.dept_id);
  const [deptName, setDeptName]     = useState(dept.dept_name);
  const [editSubId, setEditSubId]   = useState<number | null>(null);
  const [editSubName, setEditSubName] = useState("");
  const [saving, setSaving]         = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(deptName, editSubId ? { subdept_id: editSubId, subdept_name: editSubName } : null);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Edit Department</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">×</button>
        </div>

        {/* Dept Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department Name <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2 items-center">
            <span className="text-xs font-mono bg-gray-100 px-2 py-2 rounded border text-gray-500 shrink-0">{dept.dept_id}</span>
            <input value={deptName} onChange={e => setDeptName(e.target.value)}
              className="flex-1 border rounded px-3 py-2 text-sm" />
          </div>
        </div>

        {/* SubDepts list — pick one to edit */}
        <div className="flex-1 overflow-y-auto">
          <p className="text-sm font-medium text-gray-700 mb-2">Sub-Departments ({mine.length})</p>
          {mine.length === 0
            ? <p className="text-sm text-gray-400 italic">No sub-departments</p>
            : (
              <div className="space-y-1 border rounded p-2 max-h-52 overflow-y-auto">
                {mine.map(s => (
                  <div key={s.subdept_id}
                    onClick={() => { setEditSubId(s.subdept_id); setEditSubName(s.subdept_name); }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm
                      ${editSubId === s.subdept_id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"}`}>
                    <span className="font-mono text-xs text-gray-400 w-16 shrink-0">{s.subdept_id}</span>
                    {editSubId === s.subdept_id
                      ? <input value={editSubName} onChange={e => setEditSubName(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 border rounded px-2 py-0.5 text-sm" autoFocus />
                      : <span className="text-gray-700">{s.subdept_name}</span>}
                  </div>
                ))}
              </div>
            )}
          {editSubId && (
            <p className="text-xs text-blue-600 mt-1">
              Editing sub-dept <span className="font-mono">{editSubId}</span> — click another row to switch
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4 pt-3 border-t">
          <button onClick={onClose} className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving || !deptName.trim()}
            className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
            <Check className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Modal — add dept + optional subdepts in one step ──────────────────────
function AddModal({ depts, onSave, onClose }: {
  depts: Dept[];
  onSave: (data: {
    mode: "new_dept" | "existing_dept";
    dept_id?: string; dept_name?: string; dept_range?: string;
    subdepts: string[];
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode]         = useState<"new_dept" | "existing_dept">("new_dept");
  const [deptName, setDeptName] = useState("");
  const [deptRange, setDeptRange] = useState("academic");
  const [selDeptId, setSelDeptId] = useState("");
  const [subRows, setSubRows]   = useState<string[]>([""]);
  const [saving, setSaving]     = useState(false);

  const addSubRow    = () => setSubRows(p => [...p, ""]);
  const removeSubRow = (i: number) => setSubRows(p => p.filter((_, idx) => idx !== i));
  const updateSub    = (i: number, val: string) => setSubRows(p => p.map((v, idx) => idx === i ? val : v));

  const handleSave = async () => {
    if (mode === "new_dept" && !deptName.trim()) return alert("Department name is required");
    if (mode === "existing_dept" && !selDeptId) return alert("Select a department");


    const validSubs = subRows.map(s => s.trim()).filter(Boolean);
    if (validSubs.length === 0) return alert("At least one sub-department is required.");
    const seen = new Set<string>();
    for (const name of validSubs) {
      const key = name.toLowerCase();
      if (seen.has(key)) return alert(`Duplicate sub-department name: "${name}"`);
      seen.add(key);
    }

    setSaving(true);
    await onSave({
      mode,
      dept_id:    mode === "existing_dept" ? selDeptId : undefined,
      dept_name:  mode === "new_dept" ? deptName : undefined,
      dept_range: mode === "new_dept" ? deptRange : undefined,
      subdepts: validSubs,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Add Department / Sub-Department</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">×</button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setMode("new_dept")}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === "new_dept" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            New Department
          </button>
          <button onClick={() => setMode("existing_dept")}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === "existing_dept" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            Existing Department
          </button>
        </div>

        {/* New dept fields */}
        {mode === "new_dept" && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Department Name <span className="text-red-500">*</span></label>
              <input value={deptName} onChange={e => setDeptName(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. Mechanical Engineering" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
              <select value={deptRange} onChange={e => setDeptRange(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm">
                <option value="academic">Academic (1xxx)</option>
                <option value="admin">Admin (2xxx)</option>
              </select>
            </div>
          </div>
        )}

        {/* Existing dept select */}
        {mode === "existing_dept" && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
            <select value={selDeptId} onChange={e => setSelDeptId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="">-- Select Department --</option>
              {depts.map(d => (
                <option key={d.dept_id} value={d.dept_id}>{d.dept_id} — {d.dept_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Sub-departments */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">
              Sub-Departments <span className="text-gray-400 text-xs"></span>
            </label>
            <button onClick={addSubRow}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
          </div>
          <div className="space-y-2">
            {subRows.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                <input value={s} onChange={e => updateSub(i, e.target.value)}
                  placeholder="Sub-department name"
                  className="flex-1 border rounded px-3 py-1.5 text-sm" />
                {subRows.length > 1 && (
                  <button onClick={() => removeSubRow(i)}
                    className="text-red-400 hover:text-red-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t">
          <button onClick={onClose} className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
            <Check className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DeptMasterPage() {
  const router  = useRouter();
  const { user, loading: authLoading } = useAuth();
  useAuthGuard();
  const isAdmin = user?.user_type?.toUpperCase() === "ADMIN";

  const [depts, setDepts]       = useState<Dept[]>([]);
  const [subdepts, setSubdepts] = useState<Subdept[]>([]);
  const [loading, setLoading]   = useState(true);

  // Filters
  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState(""); // academic | admin | ""
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Modals
  const [addModal, setAddModal]   = useState(false);
  const [viewDept, setViewDept]   = useState<Dept | null>(null);
  const [editDept, setEditDept]   = useState<Dept | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    loadAll();
  }, [authLoading, user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dRes, sRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/department/all`,    { credentials: "include" }),
        fetch(`${API_BASE_URL}/api/subdepartments/all`, { credentials: "include" }),
      ]);
      if (dRes.status === 401 || sRes.status === 401) { router.replace("/session-expired"); return; }
      if (dRes.ok) setDepts(await dRes.json());
      if (sRes.ok) setSubdepts(await sRes.json());
    } finally { setLoading(false); }
  };

  // Toggle row expand
  const toggleExpand = (dept_id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(dept_id) ? next.delete(dept_id) : next.add(dept_id);
      return next;
    });
  };

  // Delete dept
  const deleteDept = async (dept: Dept) => {
    if (dept.subdept_count > 0)
      return alert(`Cannot delete "${dept.dept_name}" — it has ${dept.subdept_count} sub-department(s). Delete sub-departments first.`);
    if (!window.confirm(`Delete department "${dept.dept_name}" (ID: ${dept.dept_id})?`)) return;
    const res = await fetch(`${API_BASE_URL}/api/department/${dept.dept_id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { alert((await res.json()).error || "Failed to delete"); return; }
    await loadAll();
  };

  // Delete subdept
  const deleteSubdept = async (sub: Subdept) => {
    if (!window.confirm(`Delete sub-department "${sub.subdept_name}"?`)) return;
    const res = await fetch(`${API_BASE_URL}/api/subdepartment/${sub.subdept_id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { alert((await res.json()).error || "Failed to delete"); return; }
    await loadAll();
  };

  // Save from Add Modal — single step create dept + subdepts
  const handleAdd = async (data: {
    mode: "new_dept" | "existing_dept";
    dept_id?: string; dept_name?: string; dept_range?: string;
    subdepts: string[];
  }) => {
    try {
      let dept_id = data.dept_id;

      // Step 1 — create dept if new
      if (data.mode === "new_dept") {
        const res = await fetch(`${API_BASE_URL}/api/department`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dept_name: data.dept_name, dept_range: data.dept_range }),
        });
         if (!res.ok) {
          const err = await res.json();
          alert(err.error || "Failed to create department");
          return;
        }
        dept_id = (await res.json()).dept_id;
      }

      // Step 2 — create each subdept
      for (const name of data.subdepts) {
        const res = await fetch(`${API_BASE_URL}/api/subdepartment`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dept_id, subdept_name: name }),
        });
         if (!res.ok) {
          const err = await res.json();
          alert(`Sub-department "${name}": ${err.error || "Failed to save"}`);
          return;
        }
      }

      setAddModal(false);
      await loadAll();
      // Auto-expand the new/selected dept
      if (dept_id) setExpandedIds(prev => new Set([...prev, dept_id!]));
    } catch { alert("Something went wrong"); }
  };

  // Save from Edit Modal
  const handleEdit = async (deptName: string, editSub: { subdept_id: number; subdept_name: string } | null) => {
    if (!editDept) return;
    try {
      // Update dept name if changed
      if (deptName !== editDept.dept_name) {
        const res = await fetch(`${API_BASE_URL}/api/department/${editDept.dept_id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify({ dept_name: deptName }),
        });
        if (!res.ok) { alert((await res.json()).error || "Failed to update department"); return; }
      }
      // Update subdept if selected
      if (editSub) {
        const res = await fetch(`${API_BASE_URL}/api/subdepartment/${editSub.subdept_id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dept_id: editDept.dept_id, subdept_name: editSub.subdept_name }),
        });
        if (!res.ok) { alert((await res.json()).error || "Failed to update sub-department"); return; }
      }
      setEditDept(null);
      await loadAll();
    } catch { alert("Something went wrong"); }
  };

  // ── Filtered / grouped data ───────────────────────────────────────────────
  const filteredDepts = depts.filter(d => {
    const matchSearch = !search
      || d.dept_name.toLowerCase().includes(search.toLowerCase())
      || d.dept_id.includes(search);
    const matchType = !typeFilter
      || (typeFilter === "academic" && parseInt(d.dept_id) < 2000)
      || (typeFilter === "admin"    && parseInt(d.dept_id) >= 2000);
    return matchSearch && matchType;
  });

  const getSubdepts = (dept_id: string) =>
    subdepts.filter(s => s.dept_id === dept_id);

  if (authLoading || !user) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 bg-gray-100 min-h-screen max-w-5xl mx-auto space-y-4">

      {/* Modals */}
      {viewDept && <ViewModal dept={viewDept} subdepts={subdepts} onClose={() => setViewDept(null)} />}
      {editDept && (
        <EditModal dept={editDept} subdepts={subdepts}
          onSave={handleEdit} onClose={() => setEditDept(null)} isAdmin={isAdmin} />
      )}
      {addModal && (
        <AddModal depts={depts} onSave={handleAdd} onClose={() => setAddModal(false)} />
      )}

      {/* ── Header card ── */}
      <div className="bg-white rounded-xl shadow px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Department Master</h1>
          <p className="text-xs text-gray-400">
            {depts.length} departments · {subdepts.length} sub-departments
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search dept..."
            className="border rounded-lg px-3 py-2 text-sm w-44 outline-none focus:ring-2 focus:ring-blue-200" />
          {/* Type filter */}
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200">
            <option value="">All Types</option>
            <option value="academic">Academic</option>
            <option value="admin">Admin</option>
          </select>
          {/* Expand / Collapse all */}
          <button
            onClick={() => {
              if (expandedIds.size > 0) setExpandedIds(new Set());
              else setExpandedIds(new Set(filteredDepts.map(d => d.dept_id)));
            }}
            className="border rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            {expandedIds.size > 0 ? "Collapse All" : "Expand All"}
          </button>
          {/* Add button — admin only */}
          {isAdmin && (
            <button onClick={() => setAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
              <Plus className="w-4 h-4" /> Add
            </button>
          )}
        </div>
      </div>

      {/* ── Main Table ── */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-700 text-white">
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide w-8"></th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide w-24">Dept ID</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Department</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Sub-Department</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide w-24">Type</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : filteredDepts.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No departments found</td></tr>
            ) : filteredDepts.map(d => {
              const subs      = getSubdepts(d.dept_id);
              const expanded  = expandedIds.has(d.dept_id);
              const isAcademic = parseInt(d.dept_id) < 2000;

              return (
                <React.Fragment key={d.dept_id}>
                  {/* ── Dept row ── */}
                  <tr
                    className="border-b bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                    onClick={() => subs.length > 0 && toggleExpand(d.dept_id)}>
                    {/* Expand toggle */}
                    <td className="px-2 py-3 text-center">
                      {subs.length > 0
                        ? (expanded
                          ? <ChevronDown className="w-4 h-4 text-blue-500 mx-auto" />
                          : <ChevronRight className="w-4 h-4 text-blue-400 mx-auto" />)
                        : <span className="text-gray-300 text-xs mx-auto block text-center">—</span>}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-500 font-medium">{d.dept_id}</td>
                    <td className="px-3 py-3 font-semibold text-gray-800">
                      {d.dept_name}
                      {subs.length > 0 && (
                        <span className="ml-2 text-xs bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded-full font-normal">
                          {subs.length}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs italic">
                      {subs.length === 0 ? "No sub-departments" : `${subs.length} sub-department${subs.length > 1 ? "s" : ""} — click to expand`}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isAcademic ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                        {isAcademic ? "Academic" : "Admin"}
                      </span>
                    </td>
                    <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button title="View sub-departments" onClick={() => setViewDept(d)}
                          className="p-1.5 rounded hover:bg-gray-200 transition-colors">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {isAdmin && (
                          <>
                            <button title="Edit" onClick={() => setEditDept(d)}
                              className="p-1.5 rounded hover:bg-green-100 transition-colors">
                              <PencilLine className="w-4 h-4 text-green-600" />
                            </button>
                            <button title="Delete" onClick={() => deleteDept(d)}
                              className="p-1.5 rounded hover:bg-red-100 transition-colors">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* ── Sub-dept rows — shown when expanded ── */}
                  {expanded && subs.map((s, si) => (
                    <tr key={`sub-${s.subdept_id}`}
                      className={`border-b transition-colors ${si % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-purple-50`}>
                      <td className="px-2 py-2.5"></td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{s.subdept_id}</td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs pl-6">↳ {d.dept_name}</td>
                      <td className="px-3 py-2.5 text-gray-700">{s.subdept_name}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-600">Sub-Dept</span>
                      </td>
                      <td className="px-2 py-2.5">
                        {isAdmin && (
                          <div className="flex items-center justify-center gap-1">
                            <button title="Edit sub-department"
                              onClick={() => setEditDept(d)}
                              className="p-1.5 rounded hover:bg-green-100 transition-colors">
                              <PencilLine className="w-4 h-4 text-green-600" />
                            </button>
                            <button title="Delete sub-department"
                              onClick={() => deleteSubdept(s)}
                              className="p-1.5 rounded hover:bg-red-100 transition-colors">
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <p className="text-xs text-gray-400 text-right">
        Showing {filteredDepts.length} of {depts.length} departments
      </p>
    </div>
  );
}
