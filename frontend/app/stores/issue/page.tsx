"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { API_BASE_URL } from "@/lib/api";
import { formatDateIndian } from "@/utils/dateUtils";
import { Pencil, Trash2 } from "lucide-react";

interface IssueDetail {
  item_id: number | null;
  item_name: string;
  quantity_issued: string;
  unit_of_measure: string;
  stock_balance: number | null;
  remarks: string;
}

const emptyDetail = (): IssueDetail => ({
  item_id: null, item_name: "", quantity_issued: "",
  unit_of_measure: "", stock_balance: null, remarks: "",
});

export default function IssuePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  useAuthGuard();

  const today = new Date().toISOString().split("T")[0];

  // List
  const [issues, setIssues]           = useState<any[]>([]);
  const [listLoading, setListLoading]  = useState(true);
  const [filterDept, setFilterDept]    = useState("");
  const [filterItemId, setFilterItemId] = useState("");

  // Form
  const [editId, setEditId]             = useState<number | null>(null);
  const [issue_number, setIssueNumber]  = useState("");
  const [to_dept_id, setToDeptId]       = useState<number | "">("");
  const [to_subdept_id, setToSubdeptId] = useState<number | "">("");
  const [remarks, setRemarks]           = useState("");
  const [details, setDetails]           = useState<IssueDetail[]>([emptyDetail()]);
  const [saving, setSaving]             = useState(false);

  // Dropdowns
  const [departments, setDepts]         = useState<any[]>([]);
  const [allSubdepts, setAllSubdepts]   = useState<any[]>([]);
  const [filteredSubs, setFilteredSubs] = useState<any[]>([]);
  const [storeItems, setStoreItems]     = useState<any[]>([]);  // for new form (stock > 0)
  const [allStoreItems, setAllStoreItems] = useState<any[]>([]); // for edit (includes zero-stock)
  const [issueItemNames, setIssueItemNames] = useState<any[]>([]); // for list filter

  useEffect(() => {
    if (authLoading || !user) return;
    fetchDropdowns();
    fetchIssues();
    fetchIssueNumber();
  }, [authLoading, user]);

  useEffect(() => {
    setFilteredSubs(to_dept_id
      ? allSubdepts.filter(s => String(s.dept_id) === String(to_dept_id))
      : []);
  }, [to_dept_id, allSubdepts]);

  const fetchDropdowns = async () => {
    const [deptRes, subRes, itemRes, allItemRes] = await Promise.all([
      fetch(`/api/proxy/department`),
      fetch(`/api/proxy/subdepartments/all`),
      fetch(`/api/proxy/stock/items-for-issue`),
      fetch(`/api/proxy/stock/items-for-issue?all=true`),
    ]);
    if (deptRes.ok)    setDepts(await deptRes.json());
    if (subRes.ok)     setAllSubdepts(await subRes.json());
    if (itemRes.ok)    setStoreItems(await itemRes.json());
    if (allItemRes.ok) {
      const all = await allItemRes.json();
      setAllStoreItems(all);
      setIssueItemNames(all); // use for list filter dropdown
    }
  };

  const fetchIssues = async (deptId?: string, itemId?: string) => {
    setListLoading(true);
    try {
      const params = new URLSearchParams();
      if (deptId)  params.set("dept_id", deptId);
      if (itemId)  params.set("item_id", itemId);
      const url = `/api/proxy/issue${params.toString() ? "?" + params.toString() : ""}`;
      const res = await fetch(url);
      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (res.ok) setIssues(await res.json());
    } finally { setListLoading(false); }
  };

  const fetchIssueNumber = async () => {
    const res = await fetch(`/api/proxy/issue/new-number`);
    if (res.ok) setIssueNumber((await res.json()).issue_number);
  };

  const resetForm = () => {
    setEditId(null);
    setToDeptId(""); setToSubdeptId(""); setRemarks("");
    setDetails([emptyDetail()]);
  };

  const openEditForm = async (id: number) => {
    const res = await fetch(`/api/proxy/issue/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    const h = data.header;
    setEditId(id);
    setIssueNumber(h.issue_number);
    setToDeptId(h.to_dept_id);
    setToSubdeptId(h.to_subdept_id || "");
    setRemarks(h.remarks || "");
    // Use allStoreItems for edit so zero-stock items still appear in dropdown
    // stock_balance for edit = current_qty + original_qty_issued (since original was deducted already)
    // This gives the true available balance if this issue is reversed
    setDetails(data.details.map((d: any) => {
      const stockItem = allStoreItems.find(it => String(it.item_id) === String(d.item_id));
      const currentQty = stockItem ? Number(stockItem.current_qty) : 0;
      const originalQty = Number(d.quantity_issued);
      return {
        item_id: d.item_id,
        item_name: d.item_name,
        quantity_issued: String(originalQty),
        unit_of_measure: d.unit_of_measure || "",
        // effective balance = what would be available if this issue were reversed
        stock_balance: currentQty + originalQty,
        remarks: d.remarks || "",
      };
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = async () => {
    resetForm();
    await fetchIssueNumber();
  };

  const updateDetail = (i: number, field: keyof IssueDetail, value: any) =>
    setDetails(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d));

  // Use allStoreItems in edit mode so zero-stock items show in dropdown
  const activeItems = editId !== null ? allStoreItems : storeItems;

const isDuplicateItem = (itemId: string, currentIndex: number) => {
  return details.some((d, idx) =>
    idx !== currentIndex && String(d.item_id) === String(itemId)
  );
};


const handleItemSelect = (i: number, itemId: string) => {
  if (!itemId) {
    setDetails(prev => prev.map((d, idx) => idx === i ? emptyDetail() : d));
    return;
  }

  // 🚫 BLOCK DUPLICATE
  if (isDuplicateItem(itemId, i)) {
    alert("This item is already selected in another row");
    return;
  }

  const item = activeItems.find(it => String(it.item_id) === itemId);

  if (item) {
    setDetails(prev => prev.map((d, idx) => {
      if (idx !== i) return d;

      return {
        ...d,
        item_id: item.item_id,
        item_name: item.item_name,
        unit_of_measure: item.unit_of_measure || "",
        stock_balance: Number(item.current_qty),
      };
    }));
  }
};

  // Block save if any qty > stock balance
  const hasExcessQty = details.some(
    d => d.stock_balance !== null && Number(d.quantity_issued) > d.stock_balance
  );


  const handleSave = async () => {
    if (!to_dept_id) return alert("Select a department to issue to");
    if (!details.some(d => d.item_id)) return alert("Add at least one item");
    if (details.some(d => !d.item_id || !d.quantity_issued)) return alert("All rows must have item and quantity");
    if (details.some(d => Number(d.quantity_issued) <= 0)) return alert("Quantity must be greater than 0");

// 🚫 Duplicate check (final safety)
const itemIds = details.map(d => d.item_id).filter(Boolean);
const uniqueIds = new Set(itemIds);

if (itemIds.length !== uniqueIds.size) {
  alert("Duplicate items are not allowed");
  return;
}


    // Hard block: any item exceeds stock balance
    if (hasExcessQty) {
      const excess = details.filter(d => d.stock_balance !== null && Number(d.quantity_issued) > d.stock_balance);
      const names = excess.map(d => `• ${d.item_name}: Issue ${d.quantity_issued}, Balance ${d.stock_balance}`).join("\n");
      alert(`Cannot save — issue qty exceeds available stock balance:\n\n${names}`);
      return;
    }

    if (!window.confirm("Save this issue?")) return;
    setSaving(true);
    try {
      const payload = {
        issue_date: today, to_dept_id,
        to_subdept_id: to_subdept_id || null,
        remarks: remarks || null,
        details: details.map(d => ({
          item_id: d.item_id, item_name: d.item_name,
          quantity_issued: Number(d.quantity_issued),
          unit_of_measure: d.unit_of_measure || null,
          remarks: d.remarks || null,
        })),
      };
      const res = await fetch(
        editId ? `/api/proxy/issue/${editId}` : `/api/proxy/issue`,
        { method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify(payload) }
      );
      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (!res.ok) { alert((await res.json()).error || "Save failed"); return; }
      alert(`Issue ${editId ? "updated" : "created"} successfully`);
      resetForm();
      // Refresh items + issue number + list
      const [numRes, itemRes, allItemRes] = await Promise.all([
        fetch(`/api/proxy/issue/new-number`),
        fetch(`/api/proxy/stock/items-for-issue`),
        fetch(`/api/proxy/stock/items-for-issue?all=true`),
      ]);
      if (numRes.ok)    setIssueNumber((await numRes.json()).issue_number);
      if (itemRes.ok)   setStoreItems(await itemRes.json());
      if (allItemRes.ok) {
        const all = await allItemRes.json();
        setAllStoreItems(all);
        setIssueItemNames(all);
      }
      fetchIssues(filterDept || undefined, filterItemId || undefined);
    } catch { alert("Something went wrong"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, num: string) => {
    if (!window.confirm(`Delete Issue ${num}?`)) return;
    const res = await fetch(`/api/proxy/issue/${id}`, { method: "DELETE", credentials: "include" });
    if (res.status === 401) { router.replace("/session-expired"); return; }
    if (!res.ok) { alert("Failed to delete"); return; }
    alert("Deleted successfully");
    // Refresh list + stock items together so nil-stock items update immediately
    const [itemRes, allItemRes] = await Promise.all([
      fetch(`/api/proxy/stock/items-for-issue`),
      fetch(`/api/proxy/stock/items-for-issue?all=true`),
    ]);
    if (itemRes.ok)    setStoreItems(await itemRes.json());
    if (allItemRes.ok) {
      const all = await allItemRes.json();
      setAllStoreItems(all);
      setIssueItemNames(all);
    }
    fetchIssues(filterDept || undefined, filterItemId || undefined);
  };

  const handleDeptFilter = (deptId: string) => {
    setFilterDept(deptId);
    fetchIssues(deptId || undefined, filterItemId || undefined);
  };

  const handleItemFilter = (itemId: string) => {
    setFilterItemId(itemId);
    fetchIssues(filterDept || undefined, itemId || undefined);
  };

  const clearFilters = () => {
    setFilterDept(""); setFilterItemId("");
    fetchIssues();
  };

  if (authLoading || !user) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 bg-gray-100 rounded-xl shadow max-w-5xl mx-auto space-y-4">

      {/* ── Form ── */}
      <div className="bg-white rounded-md shadow p-4">
        <h2 className="text-lg font-semibold text-white text-center bg-blue-600 py-2 rounded-md shadow mb-4">
          {editId ? `Edit Issue — ${issue_number}` : "New Issue"}
        </h2>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issue Number</label>
            <input value={issue_number} readOnly
              className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
            <input value={today} readOnly
              className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Department</label>
            <input value="Stores" readOnly
              className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issue To Dept *</label>
            <select value={to_dept_id}
              onChange={e => { setToDeptId(e.target.value ? Number(e.target.value) : ""); setToSubdeptId(""); }}
              className="w-full border rounded px-3 py-2">
              <option value="">-- Select Department --</option>
              {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sub Department</label>
            <select value={to_subdept_id}
              onChange={e => setToSubdeptId(e.target.value ? Number(e.target.value) : "")}
              disabled={!to_dept_id} className="w-full border rounded px-3 py-2">
              <option value="">-- Select Sub Dept --</option>
              {filteredSubs.map(s => <option key={s.subdept_id} value={s.subdept_id}>{s.subdept_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <input value={remarks} onChange={e => setRemarks(e.target.value)}
              className="w-full border rounded px-3 py-2" placeholder="Optional" />
          </div>
        </div>

        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium text-gray-700 text-sm">Items to Issue</h4>
          <button onClick={() => setDetails(p => [...p, emptyDetail()])}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
            + Add Row
          </button>
        </div>

        <table className="w-full border-collapse text-sm mb-4">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-2 text-left">Item</th>
              <th className="border px-2 py-2 w-28">Stock Balance</th>
              <th className="border px-2 py-2 w-28">Qty Issued</th>
              <th className="border px-2 py-2 w-20">UOM</th>
              <th className="border px-2 py-2">Remarks</th>
              <th className="border px-2 py-2 w-8">×</th>
            </tr>
          </thead>
          <tbody>
            {details.map((d, i) => {
              const isExcess = d.stock_balance !== null && Number(d.quantity_issued) > d.stock_balance;
              return (
                <tr key={i} className={isExcess ? "bg-red-50" : ""}>
                  <td className="border px-2 py-1">
                    <select value={d.item_id ?? ""} onChange={e => handleItemSelect(i, e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm">
                      <option value="">-- Select Item --</option>
                      {activeItems.map(it => (
                        <option key={it.item_id} value={it.item_id}>
                          {it.item_name}{Number(it.current_qty) <= 0 ? " (No Stock)" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {d.stock_balance !== null
                      ? <span className={`text-sm font-medium ${d.stock_balance <= 0 ? "text-red-500" : "text-blue-700"}`}>
                          {Number(d.stock_balance).toFixed(3)}
                        </span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="border px-2 py-1">
                    <input type="number" value={d.quantity_issued} min="0"
                      onChange={e => updateDetail(i, "quantity_issued", e.target.value)}
                      className={`w-full border rounded px-2 py-1 text-sm text-right ${
                        isExcess ? "border-red-500 bg-red-100 text-red-700 font-semibold" : ""
                      }`} />
                    {isExcess && (
                      <p className="text-red-600 text-xs mt-0.5">Exceeds balance</p>
                    )}
                  </td>
                  <td className="border px-2 py-1">
                    <input value={d.unit_of_measure} readOnly
                      className="w-full border rounded px-2 py-1 text-sm bg-gray-50" />
                  </td>
                  <td className="border px-2 py-1">
                    <input value={d.remarks} onChange={e => updateDetail(i, "remarks", e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm" />
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {details.length > 1 && (
                      <button onClick={() => setDetails(p => p.filter((_, idx) => idx !== i))}
                        className="text-red-500 hover:text-red-700 font-bold text-lg">×</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {hasExcessQty && (
          <div className="mb-3 px-3 py-2 bg-red-100 border border-red-400 rounded text-red-700 text-sm">
            ⚠ Issue quantity exceeds available stock balance. Please correct before saving.
          </div>
        )}

        <div className="flex justify-end gap-3">
          {editId && (
            <button onClick={handleCancelEdit}
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">
              Cancel Edit
            </button>
          )}
          <button onClick={handleSave} disabled={saving || hasExcessQty}
            className={`px-6 py-2 rounded text-white font-medium ${
              hasExcessQty
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            }`}>
            {saving ? "Saving..." : editId ? "Update Issue" : "Save Issue"}
          </button>
        </div>
      </div>

      {/* ── Issue List ── */}
      <div className="bg-white rounded-md shadow p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-gray-700">Issue List</h3>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Department</label>
            <select value={filterDept} onChange={e => handleDeptFilter(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-48">
              <option value="">-- All Departments --</option>
              {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Item</label>
            <select value={filterItemId} onChange={e => handleItemFilter(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-56">
              <option value="">-- All Items --</option>
              {issueItemNames.map(it => (
                <option key={it.item_id} value={it.item_id}>{it.item_name}</option>
              ))}
            </select>
          </div>
          {(filterDept || filterItemId) && (
            <button onClick={clearFilters}
              className="px-3 py-2 bg-gray-400 text-white text-sm rounded hover:bg-gray-500 self-end">
              Clear
            </button>
          )}
        </div>

        {listLoading ? (
          <p className="text-center py-6 text-gray-400">Loading...</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="border px-3 py-2">Issue No</th>
                <th className="border px-3 py-2">Date</th>
                <th className="border px-3 py-2">To Dept</th>
                <th className="border px-3 py-2">Items Issued</th>
                <th className="border px-3 py-2">Issued By</th>
                <th className="border px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-gray-400">No issues found</td></tr>
              ) : issues.map(iss => (
                <tr key={iss.id} className="hover:bg-gray-50 align-top">
                  <td className="border px-3 py-2 font-medium whitespace-nowrap">{iss.issue_number}</td>
                  <td className="border px-3 py-2 whitespace-nowrap">{formatDateIndian(iss.issue_date)}</td>
                  <td className="border px-3 py-2 whitespace-nowrap">
                    {iss.to_dept_name || "—"}
                    {iss.to_subdept_name && (
                      <span className="text-gray-400 text-xs block">{iss.to_subdept_name}</span>
                    )}
                  </td>
                  <td className="border px-3 py-2">
                    {(() => {
                      const itemList = Array.isArray(iss.items)
                        ? iss.items
                        : (typeof iss.items === 'string' ? JSON.parse(iss.items) : []);
                      return itemList.length > 0
                        ? itemList.map((it: any, idx: number) => (
                            <div key={idx} className="text-xs py-0.5">
                              <span className="font-medium">{it.item_name || '—'}</span>
                              {" — "}
                              <span className="text-blue-700">{Number(it.quantity_issued || 0).toFixed(3)} {it.unit_of_measure || ''}</span>
                            </div>
                          ))
                        : <span className="text-gray-400">—</span>;
                    })()}
                  </td>
                  <td className="border px-3 py-2 whitespace-nowrap">{iss.issued_by}</td>
                  <td className="border px-2 py-2">
                    <div className="flex items-center justify-center gap-3">
                      <button title="Edit" onClick={() => openEditForm(iss.id)}
                        className="transition-transform duration-200 hover:scale-125">
                        <Pencil className="w-5 h-5 text-green-600 hover:text-green-800" />
                      </button>
                      <button title="Delete" onClick={() => handleDelete(iss.id, iss.issue_number)}
                        className="transition-transform duration-200 hover:scale-125">
                        <Trash2 className="w-5 h-5 text-red-600 hover:text-red-800" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
