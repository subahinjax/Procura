"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { API_BASE_URL } from "@/lib/api";
import { PencilLine, Trash2 } from "lucide-react";
import { parseIndianDate, formatDateIndian } from "@/utils/dateUtils";

interface OBEntry {
  item_id: number | null;
  item_name: string;
  uom: string;
  dept_id: number | "";
  subdept_id: number | "";
  opening_qty: string;
  opening_date: string;
}

const today = new Date().toLocaleDateString("en-CA");

const emptyEntry = (): OBEntry => ({
  item_id: null, item_name: "", uom: "", dept_id: "", subdept_id: "", opening_qty: "", opening_date: today,
});

export default function OpeningBalancePage() {
  const { user, loading: authLoading } = useAuth();
  useAuthGuard();

  const [entries, setEntries]     = useState<OBEntry[]>([emptyEntry()]);
  const [existing, setExisting]   = useState<any[]>([]);
  const [allExisting, setAllExisting] = useState<any[]>([]);
  const [items, setItems]         = useState<any[]>([]);
  const [departments, setDepts]   = useState<any[]>([]);
  const [allSubdepts, setAllSubdepts] = useState<any[]>([]);
  const [saving, setSaving]       = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const [filterDept, setFilterDept]       = useState("");
  const [filterSubdept, setFilterSubdept] = useState("");
  const [filterItemId, setFilterItemId]   = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm]   = useState<OBEntry & { id?: number }>(emptyEntry());

  useEffect(() => {
    if (authLoading || !user) return;
    fetchData();
  }, [authLoading, user]);

  const fetchData = async (deptId?: string, subdeptId?: string, itemId?: string) => {
    setDataLoading(true);
    try {
      const params = new URLSearchParams();
      if (deptId)    params.set("dept_id", deptId);
      if (subdeptId) params.set("subdept_id", subdeptId);
      if (itemId)    params.set("item_id", itemId);
      const [itemRes, deptRes, subdeptRes, obRes, obAllRes] = await Promise.all([
        fetch(`/api/proxy/items`),
        fetch(`/api/proxy/department`),
        fetch(`/api/proxy/subdepartments/all`),
        fetch(`/api/proxy/stock/opening-balance${params.toString() ? "?" + params : ""}`),
        fetch(`/api/proxy/stock/opening-balance`),
      ]);
      if (itemRes.ok)    setItems(await itemRes.json());
      if (deptRes.ok)    setDepts(await deptRes.json());
      if (subdeptRes.ok) setAllSubdepts(await subdeptRes.json());
      if (obRes.ok)      setExisting(await obRes.json());
      if (obAllRes.ok)   setAllExisting(await obAllRes.json());
    } catch (err) {
      console.error("fetchData error:", err);
    } finally {
      setDataLoading(false);
    }
  };

  const refetchExisting = async (deptId?: string, subdeptId?: string, itemId?: string) => {
    const params = new URLSearchParams();
    if (deptId)    params.set("dept_id", deptId);
    if (subdeptId) params.set("subdept_id", subdeptId);
    if (itemId)    params.set("item_id", itemId);
    const [obRes, obAllRes] = await Promise.all([
      fetch(`/api/proxy/stock/opening-balance${params.toString() ? "?" + params : ""}`),
      fetch(`/api/proxy/stock/opening-balance`),
    ]);
    if (obRes.ok)    setExisting(await obRes.json());
    if (obAllRes.ok) setAllExisting(await obAllRes.json());
  };

  // Subdepts filtered to a given dept_id (for row selects in entry form)
  const subdeptsForDept = (deptId: number | "") =>
    deptId ? allSubdepts.filter(s => String(s.dept_id) === String(deptId)) : [];

  // Subdepts for the filter panel (based on filterDept selection)
  const filterSubdeptOptions = filterDept
    ? allSubdepts.filter(s => String(s.dept_id) === filterDept)
    : allSubdepts;

  const obItemOptions = Array.from(
    new Map(allExisting.map(ob => [ob.item_id, { item_id: ob.item_id, item_name: ob.item_name }])).values()
  ).sort((a, b) => a.item_name.localeCompare(b.item_name));

  const updateEntry = (i: number, field: keyof OBEntry, value: any) =>
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));

  const handleItemSelect = (i: number, itemCode: string) => {
    if (!itemCode) {
      setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, item_id: null, item_name: "", uom: "" } : e));
      return;
    }
    const item = items.find(it => String(it.item_code) === itemCode);
    if (item) {
      const entry = entries[i];
      setEntries(prev => prev.map((e, idx) => idx === i
        ? { ...e, item_id: item.item_code, item_name: item.item_name, uom: item.unit?.trim() || "" }
        : e));
      if (entry.dept_id) {
        const exists = allExisting.find(
          ob => String(ob.item_id) === itemCode && String(ob.dept_id) === String(entry.dept_id)
            && String(ob.subdept_id ?? "") === String(entry.subdept_id ?? "")
        );
        if (exists) {
          window.confirm(
            `Opening balance already exists for "${item.item_name}" in this department/sub-dept (Qty: ${Number(exists.opening_qty).toFixed(3)}).\n\nSelecting OK will update the existing balance on Save.`
          );
        }
      }
    }
  };

  const handleDeptSelect = (i: number, deptId: string) => {
    // Reset subdept when dept changes
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, dept_id: deptId ? Number(deptId) : "", subdept_id: "" } : e));
  };

  const handleSubdeptSelect = (i: number, subdeptId: string) => {
    const entry = entries[i];
    if (entry.item_id && entry.dept_id && subdeptId) {
      const exists = allExisting.find(
        ob => String(ob.item_id) === String(entry.item_id)
          && String(ob.dept_id) === String(entry.dept_id)
          && String(ob.subdept_id ?? "") === subdeptId
      );
      if (exists) {
        window.confirm(
          `Opening balance already exists for "${entry.item_name}" in this sub-department (Qty: ${Number(exists.opening_qty).toFixed(3)}).\n\nSelecting OK will update the existing balance on Save.`
        );
      }
    }
    updateEntry(i, "subdept_id", subdeptId ? Number(subdeptId) : "");
  };

  const handleSave = async () => {
    if (entries.some(e => !e.item_id || !e.dept_id || !e.subdept_id || !e.opening_qty || !e.opening_date))
      return alert("All fields are required for each row");
    if (entries.some(e => Number(e.opening_qty) < 0))
      return alert("Opening qty cannot be negative");
    const overwrites = entries.filter(e =>
      allExisting.find(
        ob => String(ob.item_id) === String(e.item_id)
          && String(ob.dept_id) === String(e.dept_id)
          && String(ob.subdept_id ?? "") === String(e.subdept_id ?? "")
      )
    );
    if (overwrites.length > 0) {
      const names = overwrites.map(e => `• ${e.item_name}`).join("\n");
      if (!window.confirm(`The following items already have opening balances and will be updated:\n\n${names}\n\nProceed?`)) return;
    } else {
      if (!window.confirm("Save opening balances?")) return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/proxy/stock/opening-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entries: entries.map(e => ({
            ...e,
            opening_qty: Number(e.opening_qty),
            subdept_id: e.subdept_id || null,
          })),
        }),
      });
      if (!res.ok) { alert((await res.json()).error || "Save failed"); return; }
      alert("Opening balances saved successfully");
      setEntries([emptyEntry()]);
      refetchExisting(filterDept || undefined, filterSubdept || undefined, filterItemId || undefined);
    } catch { alert("Something went wrong"); }
    finally { setSaving(false); }
  };

  const startEdit = (ob: any) => {
    setEditingId(ob.id);
    setEditForm({
      id: ob.id,
      item_id: ob.item_id,
      item_name: ob.item_name,
      uom: ob.unit_of_measure,
      dept_id: ob.dept_id,
      subdept_id: ob.subdept_id ?? "",
      opening_qty: String(ob.opening_qty),
      opening_date: parseIndianDate(ob.opening_date) || today,
    });
  };

  const cancelEdit = () => setEditingId(null);

  const handleUpdate = async () => {
    if (!editForm.opening_qty || Number(editForm.opening_qty) < 0)
      return alert("Opening qty must be 0 or greater");
    if (!window.confirm("Update this opening balance?")) return;
    try {
      const res = await fetch(`/api/proxy/stock/opening-balance/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          item_id: editForm.item_id,
          item_name: editForm.item_name,
          uom: editForm.uom,
          dept_id: editForm.dept_id,
          subdept_id: editForm.subdept_id || null,
          opening_qty: Number(editForm.opening_qty),
          opening_date: editForm.opening_date,
        }),
      });
      if (!res.ok) { alert((await res.json()).error || "Update failed"); return; }
      alert("Updated successfully");
      setEditingId(null);
      refetchExisting(filterDept || undefined, filterSubdept || undefined, filterItemId || undefined);
    } catch { alert("Something went wrong"); }
  };

  const handleDelete = async (id: number, item_name: string) => {
    if (!window.confirm(`Delete opening balance for "${item_name}"?`)) return;
    const res = await fetch(`/api/proxy/stock/opening-balance/${id}`, {
      method: "DELETE", credentials: "include",
    });
    if (!res.ok) { alert("Failed to delete"); return; }
    alert("Deleted successfully");
    refetchExisting(filterDept || undefined, filterSubdept || undefined, filterItemId || undefined);
  };

  const handleDeptFilter = (deptId: string) => {
    setFilterDept(deptId);
    setFilterSubdept(""); // reset subdept filter when dept changes
    refetchExisting(deptId || undefined, undefined, filterItemId || undefined);
  };

  const handleSubdeptFilter = (subdeptId: string) => {
    setFilterSubdept(subdeptId);
    refetchExisting(filterDept || undefined, subdeptId || undefined, filterItemId || undefined);
  };

  const handleItemFilter = (itemId: string) => {
    setFilterItemId(itemId);
    refetchExisting(filterDept || undefined, filterSubdept || undefined, itemId || undefined);
  };

  const clearFilters = () => {
    setFilterDept(""); setFilterSubdept(""); setFilterItemId("");
    refetchExisting();
  };

  if (authLoading || !user) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 bg-gray-100 rounded-xl shadow max-w-6xl mx-auto space-y-4">

      {/* ── Entry Form ── */}
      <div className="bg-white rounded-md shadow p-4">
        <h2 className="text-lg font-semibold text-white text-center bg-blue-600 py-2 rounded-md shadow mb-4">
          Opening Balance Entry
        </h2>
        <div className="flex justify-end mb-2">
          <button onClick={() => setEntries(p => [...p, emptyEntry()])}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
            + Add Row
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[800px]">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-2 text-left">Item</th>
                <th className="border px-2 py-2">Department</th>
                <th className="border px-2 py-2">Sub-Department</th>
                <th className="border px-2 py-2 w-20">UOM</th>
                <th className="border px-2 py-2 w-28">Opening Qty</th>
                <th className="border px-2 py-2 w-36">Opening Date</th>
                <th className="border px-2 py-2 w-8">×</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">
                    <select value={e.item_id ?? ""} onChange={ev => handleItemSelect(i, ev.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm">
                      <option value="">-- Select Item --</option>
                      {items.map(it => (
                        <option key={it.item_code} value={it.item_code}>{it.item_name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border px-2 py-1">
                    <select value={e.dept_id} onChange={ev => handleDeptSelect(i, ev.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm">
                      <option value="">-- Select Dept --</option>
                      {departments.map(d => (
                        <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border px-2 py-1">
                    <select
                      value={e.subdept_id}
                      onChange={ev => handleSubdeptSelect(i, ev.target.value)}
                      disabled={!e.dept_id}
                      className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-400">
                      <option value="">-- Sub-Dept (optional) --</option>
                      {subdeptsForDept(e.dept_id).map(s => (
                        <option key={s.subdept_id} value={s.subdept_id}>{s.subdept_name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border px-2 py-1">
                    <input value={e.uom} readOnly className="w-full border rounded px-2 py-1 text-sm bg-gray-50" />
                  </td>
                  <td className="border px-2 py-1">
                    <input type="number" value={e.opening_qty} min="0"
                      onChange={ev => updateEntry(i, "opening_qty", ev.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm text-right" />
                  </td>
                  <td className="border px-2 py-1">
                    <input type="date" value={e.opening_date}
                      onChange={ev => updateEntry(i, "opening_date", ev.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm" />
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {entries.length > 1 && (
                      <button onClick={() => setEntries(p => p.filter((_, idx) => idx !== i))}
                        className="text-red-500 hover:text-red-700 font-bold text-lg">×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save Opening Balances"}
          </button>
        </div>
      </div>

      {/* ── Existing List ── */}
      <div className="bg-white rounded-md shadow p-4">
        <h3 className="font-semibold text-gray-700 mb-3">Existing Opening Balances</h3>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <select value={filterDept} onChange={e => handleDeptFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-44">
            <option value="">-- All Departments --</option>
            {departments.map(d => (
              <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
            ))}
          </select>

          <select
            value={filterSubdept}
            onChange={e => handleSubdeptFilter(e.target.value)}
            disabled={filterSubdeptOptions.length === 0}
            className="border rounded px-3 py-2 text-sm w-48 disabled:bg-gray-50 disabled:text-gray-400">
            <option value="">-- All Sub-Depts --</option>
            {filterSubdeptOptions.map(s => (
              <option key={s.subdept_id} value={s.subdept_id}>{s.subdept_name}</option>
            ))}
          </select>

          <select value={filterItemId} onChange={e => handleItemFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-52">
            <option value="">-- All Items --</option>
            {obItemOptions.map(it => (
              <option key={it.item_id} value={it.item_id}>{it.item_name}</option>
            ))}
          </select>

          {(filterDept || filterSubdept || filterItemId) && (
            <button onClick={clearFilters}
              className="px-3 py-2 bg-gray-400 text-white text-sm rounded hover:bg-gray-500">
              Clear
            </button>
          )}
        </div>

        {dataLoading ? (
          <p className="text-center py-4 text-gray-400">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[820px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-2 text-left">Item Name</th>
                  <th className="border px-3 py-2">Department</th>
                  <th className="border px-3 py-2">Sub-Dept</th>
                  <th className="border px-3 py-2 w-16">UOM</th>
                  <th className="border px-3 py-2 text-right w-28">Opening Qty</th>
                  <th className="border px-3 py-2 w-32">Date</th>
                  <th className="border px-3 py-2">Entered By</th>
                  <th className="border px-3 py-2 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {existing.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-4 text-gray-400">No opening balances found</td></tr>
                ) : existing.map(ob => (
                  editingId === ob.id ? (
                    <tr key={ob.id} className="bg-yellow-50">
                      <td className="border px-2 py-1" colSpan={2}>
                        <span className="text-sm font-medium text-gray-700">{ob.item_name} — {ob.dept_name}</span>
                      </td>
                      {/* Sub-dept dropdown in edit row */}
                      <td className="border px-2 py-1">
                        <select
                          value={editForm.subdept_id}
                          disabled
                          onChange={e => setEditForm(f => ({ ...f, subdept_id: e.target.value ? Number(e.target.value) : "" }))}
                          className="w-full border rounded px-2 py-1 text-sm">
                          <option value="">-- None --</option>
                          {allSubdepts
                            .filter(s => String(s.dept_id) === String(editForm.dept_id))
                            .map(s => (
                              <option key={s.subdept_id} value={s.subdept_id}>{s.subdept_name}</option>
                            ))}
                        </select>
                      </td>
                      <td className="border px-2 py-1">
                        <input value={editForm.uom} readOnly className="w-full border rounded px-2 py-1 text-sm bg-gray-50" />
                      </td>
                      <td className="border px-2 py-1">
                        <input type="number" value={editForm.opening_qty} min="0"
                          onChange={e => setEditForm(f => ({ ...f, opening_qty: e.target.value }))}
                          className="w-full border rounded px-2 py-1 text-sm text-right" />
                      </td>
                      <td className="border px-2 py-1">
                        <input type="date" value={editForm.opening_date}
                          onChange={e => setEditForm(f => ({ ...f, opening_date: e.target.value }))}
                          className="w-full border rounded px-2 py-1 text-sm" />
                      </td>
                      <td className="border px-2 py-1">{ob.entered_by}</td>
                      <td className="border px-2 py-1">
                        <div className="flex gap-2 justify-center">
                          <button onClick={handleUpdate}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Save</button>
                          <button onClick={cancelEdit}
                            className="px-2 py-1 bg-gray-400 text-white text-xs rounded hover:bg-gray-500">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={ob.id} className="hover:bg-gray-50">
                      <td className="border px-3 py-2">{ob.item_name}</td>
                      <td className="border px-3 py-2">{ob.dept_name || `Dept ${ob.dept_id}`}</td>
                      <td className="border px-3 py-2 text-gray-500">{ob.subdept_name || "—"}</td>
                      <td className="border px-3 py-2 text-center">{ob.unit_of_measure}</td>
                      <td className="border px-3 py-2 text-right font-medium">{Number(ob.opening_qty).toFixed(3)}</td>
                      <td className="border px-3 py-2">{formatDateIndian(ob.opening_date)}</td>
                      <td className="border px-3 py-2">{ob.entered_by}</td>
                      <td className="border px-2 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <button title="Edit" onClick={() => startEdit(ob)}
                            className="transition-transform duration-200 hover:scale-125">
                            <PencilLine className="w-4 h-4 text-green-600 hover:text-green-800" />
                          </button>
                          <button title="Delete" onClick={() => handleDelete(ob.id, ob.item_name)}
                            className="transition-transform duration-200 hover:scale-125">
                            <Trash2 className="w-4 h-4 text-red-600 hover:text-red-800" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}