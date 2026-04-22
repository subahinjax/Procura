"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { API_BASE_URL } from "@/lib/api";
import { formatDateIndian } from "@/utils/dateUtils";
import { hasAccess } from "@/lib/accessControl";
import { PencilLine, Trash2, Send, CheckCircle, XCircle, ShieldCheck, Eye } from "lucide-react";

interface NRGPDetail {
  item_id: number | null;
  item_name: string;
  unit_of_measure: string;
  quantity: string;
  stock_qty: number | null;
  stock_error: boolean;
}
const emptyDetail = (): NRGPDetail => ({
  item_id: null, item_name: "", unit_of_measure: "", quantity: "", stock_qty: null, stock_error: false,
});

const REASONS = ["SALE", "SCRAP", "DONATION", "REPAIR_SEND", "SAMPLE", "OTHER"];
const REASON_LABEL: Record<string, string> = {
  SALE: "Sale", SCRAP: "Scrap Disposal", DONATION: "Donation",
  REPAIR_SEND: "Sent for Repair", SAMPLE: "Sample", OTHER: "Other",
};
const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600", PENDING_HOD: "bg-yellow-100 text-yellow-800",
  HOD_APPROVED: "bg-blue-100 text-blue-700", STORES_VERIFIED: "bg-purple-100 text-purple-700",
  APPROVED: "bg-green-100 text-green-800", REJECTED: "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", PENDING_HOD: "Pending HOD", HOD_APPROVED: "HOD Approved",
  STORES_VERIFIED: "Stores Verified", APPROVED: "Approved", REJECTED: "Rejected",
};

const Req = () => <span className="text-red-500 ml-0.5">*</span>;


function ApprovalModal({ title, onConfirm, onCancel, label, color }: any) {
  const [remarks, setRemarks] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
        <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (optional)</label>
        <textarea value={remarks} onChange={e => setRemarks(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm h-24" placeholder="Enter remarks..." />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">Cancel</button>
          <button onClick={() => onConfirm(remarks)} className={`px-6 py-2 text-white rounded font-medium ${color || "bg-blue-600 hover:bg-blue-700"}`}>{label}</button>
        </div>
      </div>
    </div>
  );
}

function ViewModal({ row, items, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Gate Pass — {row.nrgp_number}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">×</button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          {[
            ["NRGP Number", row.nrgp_number], ["Date", formatDateIndian(row.nrgp_date)],
            ["Reason", REASON_LABEL[row.reason] || row.reason],
            ["Department", row.dept_name || "—"], ["Vehicle No", row.vehicle_no || "—"],
            ["Party Name", row.supplier_name || "—"], ["Contact Person", row.contact_person || "—"],
            ["Phone", row.contact_phone || "—"], ["Address", row.address || "—"],
            ["Remarks", row.remarks || "—"],
            ["Status", STATUS_LABEL[row.approval_status] || row.approval_status],
            ["Stock Deducted", row.stock_deducted ? "Yes" : "No"],
          ].map(([l, v]) => (
            <div key={l}><span className="font-medium text-gray-500">{l}: </span><span>{v}</span></div>
          ))}
        </div>
        <h4 className="font-medium text-gray-700 mb-2 border-t pt-3">Items</h4>
        <table className="w-full border-collapse text-sm mb-4">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2 text-left">Item</th>
              <th className="border px-3 py-2 w-20">UOM</th>
              <th className="border px-3 py-2 w-28 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, i: number) => (
              <tr key={i}>
                <td className="border px-3 py-2">{it.item_name}</td>
                <td className="border px-3 py-2 text-center">{it.unit_of_measure}</td>
                <td className="border px-3 py-2 text-right">{Number(it.quantity).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h4 className="font-medium text-gray-700 mb-2 border-t pt-3">Approval Trail</h4>
        <div className="space-y-1 text-sm">
          {[
            { label: "Created by",      by: row.created_by,         at: row.created_at,         rmk: null },
            { label: "HOD Approved",    by: row.hod_approved_by,    at: row.hod_approved_at,    rmk: row.hod_remarks },
            { label: "Stores Verified", by: row.stores_verified_by, at: row.stores_verified_at, rmk: row.stores_remarks },
            { label: "Admin Approved",  by: row.admin_approved_by,  at: row.admin_approved_at,  rmk: row.admin_remarks },
            { label: `Rejected (${row.rejected_stage || ""})`, by: row.rejected_by, at: row.rejected_at, rmk: row.rejected_remarks },
          ].filter(s => s.by).map((s, i) => (
            <div key={i} className="flex gap-2 flex-wrap text-gray-600">
              <span className="font-medium text-gray-700 w-32 shrink-0">{s.label}:</span>
              <span>{s.by}{s.at ? ` · ${new Date(s.at).toLocaleDateString("en-IN")}` : ""}</span>
              {s.rmk && <span className="italic text-gray-400">· {s.rmk}</span>}
            </div>
          ))}
        </div>
        {row.rejected_remarks && (
          <div className="mt-3 px-3 py-2 bg-red-50 rounded text-sm text-red-700">
            <span className="font-medium">Rejection Reason:</span> {row.rejected_remarks}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NRGPPage() {
  const router   = useRouter();
  const { user, loading: authLoading } = useAuth();
  useAuthGuard();
  const today    = new Date().toISOString().split("T")[0];
  const userType = (user?.user_type || "").toUpperCase();
  const isAdmin  = userType === "ADMIN";

  const [list, setList]                 = useState<any[]>([]);
  const [listLoading, setListLoading]   = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [departments, setDepts]         = useState<any[]>([]);
  const [allSubdepts, setAllSubdepts]   = useState<any[]>([]);
  const [filteredSubs, setFilteredSubs] = useState<any[]>([]);
  const [masItems, setMasItems]         = useState<any[]>([]);

  // Form
  const [editId, setEditId]                = useState<number | null>(null);
  const [nrgp_number, setNrgpNumber]       = useState("");
  const [reason, setReason]                = useState("");
  const [dept_id, setDeptId]               = useState<number | "">("");
  const [subdept_id, setSubdeptId]         = useState<number | "">("");
  const [vehicle_no, setVehicleNo]         = useState("");
  const [supplier_name, setSupplierName]   = useState("");
  const [contact_person, setContactPerson] = useState("");
  const [contact_phone, setContactPhone]   = useState("");
  const [address, setAddress]              = useState("");
  const [remarks, setRemarks]              = useState("");
  const [details, setDetails]              = useState<NRGPDetail[]>([emptyDetail()]);
  const [saving, setSaving]                = useState(false);

  const stockCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [approvalModal, setApprovalModal]  = useState<any>(null);
  const [viewModal, setViewModal]          = useState<{ row: any; items: any[] } | null>(null);



  useEffect(() => {
    setFilteredSubs(dept_id ? allSubdepts.filter(s => String(s.dept_id) === String(dept_id)) : []);
  }, [dept_id, allSubdepts]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchDropdowns(); fetchList(); fetchNumber();
  }, [authLoading, user]);

  const fetchDropdowns = async () => {
    const [dRes, subRes, itemRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/department`,         { credentials: "include" }),
      fetch(`${API_BASE_URL}/api/subdepartments/all`, { credentials: "include" }),
      fetch(`${API_BASE_URL}/api/items`,              { credentials: "include" }),
    ]);
    if (dRes.ok)    setDepts(await dRes.json());
    if (subRes.ok)  setAllSubdepts(await subRes.json());
    if (itemRes.ok) setMasItems(await itemRes.json());
  };

  const fetchList = async (status?: string, rsn?: string) => {
    setListLoading(true);
    try {
      const p = new URLSearchParams();
      if (status) p.set("status", status);
      if (rsn)    p.set("reason", rsn);
      const qs = p.toString() ? "?" + p.toString() : "";
      const res = await fetch(`${API_BASE_URL}/api/nrgp${qs}`, { credentials: "include" });
      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (res.ok) setList(await res.json());
    } finally { setListLoading(false); }
  };

  const fetchNumber = async () => {
    const res = await fetch(`${API_BASE_URL}/api/nrgp/new-number`, { credentials: "include" });
    if (res.ok) setNrgpNumber((await res.json()).nrgp_number);
  };

  const resetForm = () => {
    setEditId(null); setReason(""); setDeptId(""); setSubdeptId("");
    setVehicleNo(""); setSupplierName(""); setContactPerson("");
    setContactPhone(""); setAddress(""); setRemarks(""); setDetails([emptyDetail()]);
  };

const checkStockForRow = async (
  i: number,
  itemId: number | null,
  qty: string,
  deptId: number | "",
  subDeptId: number | ""
) => {
  if (!itemId || !deptId || !subDeptId || !qty || Number(qty) <= 0) {
    setDetails(p =>
      p.map((d, idx) =>
        idx === i
          ? { ...d, stock_qty: null, stock_error: false }
          : d
      )
    );
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/stock/check-availability?dept_id=${deptId}&subdept_id=${subDeptId}&item_id=${itemId}&qty=${qty}`,
      { credentials: "include" }
    );

    if (!res.ok) return;

    const data = await res.json();

    setDetails(p =>
      p.map((d, idx) =>
        idx === i
          ? {
              ...d,
              stock_qty: data.current_qty,
              stock_error: !data.available,
            }
          : d
      )
    );
  } catch {
    // silent
  }
};

const hasDuplicateItems = () => {
  const ids = details
    .filter(d => d.item_id)
    .map(d => d.item_id);

  const unique = new Set(ids);
  return unique.size !== ids.length;
};


  const handleItemSelect = (i: number, itemCode: string) => {
    if (!itemCode) { setDetails(p => p.map((d, idx) => idx === i ? emptyDetail() : d)); return; }

  // ❌ Check duplicate BEFORE setting
  const alreadyExists = details.some(
    (d, idx) => idx !== i && String(d.item_id) === String(itemCode)
  );

  if (alreadyExists) {
    alert("This item is already selected in another row");
    return;
  }

const item = masItems.find(it => String(it.item_code) === String(itemCode));
if (item) {
  const existingQty = details[i].quantity;

  setDetails(p => p.map((d, idx) => idx === i ? {
    ...d,
    item_id: item.item_code,
    item_name: item.item_name || "",
    unit_of_measure: item.unit ? item.unit.trim() : "",
    stock_qty: null,
    stock_error: false,
  } : d));

  if (existingQty && dept_id && subdept_id) {
    checkStockForRow(i, item.item_code, String(existingQty), dept_id, subdept_id);
  }
}
};



const handleQtyChange = (i: number, val: string) => {
  setDetails(p => p.map((d, idx) => idx === i ? { ...d, quantity: val, stock_error: false } : d));
  const itemId = details[i].item_id;
  if (itemId && dept_id && subdept_id && val && Number(val) > 0) {
    if (stockCheckTimer.current) clearTimeout(stockCheckTimer.current);
    stockCheckTimer.current = setTimeout(
      () => checkStockForRow(i, itemId, val, dept_id, subdept_id),
      400
    );
  }
};

// 2. handleDeptChange — simplified, no stale state
const handleDeptChange = (newDeptId: number | "") => {
  setDeptId(newDeptId);
  setSubdeptId("");
  setDetails(p => p.map(d => ({ ...d, stock_qty: null, stock_error: false })));
};

const handleSubDeptChange = (newSubDeptId: number | "") => {
  setSubdeptId(newSubDeptId);

  if (!newSubDeptId) {
    setDetails(p => p.map(d => ({ ...d, stock_qty: null, stock_error: false })));
    return;
  }

  details.forEach((d, i) => {
    if (d.item_id && d.quantity && dept_id) {
      checkStockForRow(i, d.item_id, d.quantity, dept_id, newSubDeptId);
    }
  });
};


  const openEdit = async (id: number) => {
    const res = await fetch(`${API_BASE_URL}/api/nrgp/${id}`, { credentials: "include" });
    if (!res.ok) { alert("Failed to load gate pass"); return; }
    const data = await res.json();
    const h = data.header;
    setEditId(id); setNrgpNumber(h.nrgp_number); setReason(h.reason || "");
    setVehicleNo(h.vehicle_no || ""); setSupplierName(h.supplier_name || "");
    setContactPerson(h.contact_person || ""); setContactPhone(h.contact_phone || "");
    setAddress(h.address || ""); setRemarks(h.remarks || "");
    setDeptId(h.dept_id ? Number(h.dept_id) : "");
    setSubdeptId(h.subdept_id ? Number(h.subdept_id) : ""); // ✅ set directly, no setTimeout
    const loaded: NRGPDetail[] = data.details.map((d: any) => ({
      item_id: d.item_id || null, item_name: d.item_name || "",
      unit_of_measure: d.unit_of_measure || "", quantity: String(d.quantity),
      stock_qty: null, stock_error: false,
    }));
    setDetails(loaded);
    if (h.dept_id && h.subdept_id) {
      loaded.forEach((d, i) => {
        if (d.item_id && d.quantity) checkStockForRow(i, d.item_id, d.quantity, Number(h.dept_id), Number(h.subdept_id));
      });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validate = (): string | null => {
    if (!reason)               return "Reason is required";
    if (!dept_id)              return "Department is required";
    if (!subdept_id)           return "Sub Department is required";
    if (!vehicle_no.trim())    return "Vehicle No is required";
    if (!supplier_name.trim()) return "Party / Recipient Name is required";
    if (!contact_person.trim()) return "Contact Person is required";
    if (!contact_phone.trim()) return "Contact Phone is required";
    if (!address.trim())       return "Address is required";
if (hasDuplicateItems()) {
  return "Duplicate items are not allowed";
}
    const validRows = details.filter(d => d.item_id);
    if (!validRows.length)     return "Add at least one item";
    for (const d of validRows) {
      if (!d.quantity || Number(d.quantity) <= 0) return "All items must have quantity > 0";
    }
    if (details.some(d => d.stock_error)) {
      const bad = details.filter(d => d.stock_error).map(d => d.item_name).join(", ");
      return `Insufficient stock for: ${bad}`;
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) return alert(err);
    if (!window.confirm("Save this Gate Pass as Draft?")) return;
    setSaving(true);
    try {
      const validRows = details.filter(d => d.item_id);
      const payload = {
        nrgp_date: today, reason, dept_id: dept_id || null, subdept_id: subdept_id || null,
        vehicle_no, supplier_name, contact_person, contact_phone, address, remarks: remarks || null,
        details: validRows.map(d => ({
          item_id: d.item_id, item_name: d.item_name,
          unit_of_measure: d.unit_of_measure || null, quantity: Number(d.quantity), remarks: null,
        })),
      };
      const url    = editId ? `${API_BASE_URL}/api/nrgp/${editId}` : `${API_BASE_URL}/api/nrgp`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(payload),
      });
      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (!res.ok) { alert((await res.json()).error || "Save failed"); return; }
      alert(`Gate Pass ${editId ? "updated" : "saved as Draft"}`);
      resetForm(); await fetchNumber(); fetchList(filterStatus || undefined, filterReason || undefined);
    } catch { alert("Something went wrong"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, num: string) => {
    if (!isAdmin) { alert("Only Admin can delete gate passes"); return; }
    if (!window.confirm(`Delete Gate Pass ${num}?`)) return;
    const res = await fetch(`${API_BASE_URL}/api/nrgp/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { alert((await res.json()).error || "Failed"); return; }
    fetchList(filterStatus || undefined, filterReason || undefined);
  };

  const handleSubmit = async (id: number) => {
    if (!window.confirm("Submit for HOD Approval?")) return;
    const res = await fetch(`${API_BASE_URL}/api/nrgp/${id}/submit`, { method: "POST", credentials: "include" });
    if (!res.ok) { alert((await res.json()).error || "Failed"); return; }
    alert("Submitted for HOD Approval");
    fetchList(filterStatus || undefined, filterReason || undefined);
  };

  const handleApprovalAction = async (remarksVal: string) => {
    if (!approvalModal) return;
    const res = await fetch(`${API_BASE_URL}/api/nrgp/${approvalModal.id}/${approvalModal.action}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ remarks: remarksVal }),
    });
    if (res.status === 401) { router.replace("/session-expired"); return; }
    const data = await res.json();
    if (!res.ok) { alert(data.error || "Action failed"); setApprovalModal(null); return; }
    if (data.approval_status === "APPROVED") alert("✅ APPROVED — Stock deducted from Department");
    else alert(`Status: ${STATUS_LABEL[data.approval_status] || data.approval_status}`);
    setApprovalModal(null); fetchList(filterStatus || undefined, filterReason || undefined);
  };

  const hasStockErrors = details.some(d => d.stock_error);
  if (authLoading || !user) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 bg-gray-100 rounded-xl shadow max-w-5xl mx-auto space-y-4">
      {approvalModal && <ApprovalModal {...approvalModal} onConfirm={handleApprovalAction} onCancel={() => setApprovalModal(null)} />}
      {viewModal && <ViewModal row={viewModal.row} items={viewModal.items} onClose={() => setViewModal(null)} />}

      {/* ── FORM ── */}
      <div className="bg-white rounded-md shadow p-4">
        <h2 className="text-lg font-semibold text-white text-center bg-red-600 py-2 rounded-md mb-4">
          {editId ? `Edit NRGP — ${nrgp_number}` : "New Non-Returnable Gate Pass (NRGP)"}
        </h2>
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          ⚠️ Stock deducted from your <strong>Department</strong> only after <strong>Admin final approval</strong>.
        </div>
        {hasStockErrors && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-700">
            ⚠️ Insufficient stock for one or more items. Adjust quantities before saving.
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Row 1 — Number, Date, Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NRGP Number</label>
            <input value={nrgp_number} readOnly className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input value={today} readOnly className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason <Req /></label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">-- Select Reason --</option>
              {REASONS.map(r => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
            </select>
          </div>
          {/* Row 2 — Dept, SubDept, Vehicle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department <Req /></label>
            <select value={dept_id} onChange={e => handleDeptChange(e.target.value ? Number(e.target.value) : "")}
              className="w-full border rounded px-3 py-2">
              <option value="">-- Select --</option>
              {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sub Department</label>
            <select value={subdept_id} onChange={e => handleSubDeptChange(e.target.value ? Number(e.target.value) : "")}
              disabled={!dept_id} className="w-full border rounded px-3 py-2">
              <option value="">-- Select --</option>
              {filteredSubs.map(s => <option key={s.subdept_id} value={s.subdept_id}>{s.subdept_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle No <Req /></label>
            <input value={vehicle_no} onChange={e => setVehicleNo(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          {/* Row 3 — Party details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Party / Recipient Name <Req /></label>
            <input value={supplier_name} onChange={e => setSupplierName(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person <Req /></label>
            <input value={contact_person} onChange={e => setContactPerson(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone <Req /></label>
            <input value={contact_phone} onChange={e => setContactPhone(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          {/* Row 4 — Address */}
          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address <Req /></label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
              className="w-full border rounded px-3 py-2 resize-none" placeholder="Full address..." />
          </div>
          {/* Row 5 — Remarks */}
          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <input value={remarks} onChange={e => setRemarks(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
        </div>

        {/* Items */}
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium text-gray-700 text-sm">Items <Req /></h4>
          <button onClick={() => setDetails(p => [...p, emptyDetail()])}
            disabled={!dept_id}
            title={!dept_id ? "Select department first" : "Add row"}
            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
            + Add Row
          </button>
        </div>
        {!dept_id && (
          <div className="mb-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
            Please select a Department before adding items.
          </div>
        )}
        <table className="w-full border-collapse text-sm mb-4">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-2 text-left">Item Name <Req /></th>
              <th className="border px-2 py-2 w-20">UOM</th>
              <th className="border px-2 py-2 w-28">Quantity <Req /></th>
              <th className="border px-2 py-2 w-28">Stock Avail.</th>
              <th className="border px-2 py-2 w-8">×</th>
            </tr>
          </thead>
          <tbody>
            {details.map((d, i) => (
              <tr key={i} className={d.stock_error ? "bg-red-50" : ""}>
                <td className="border px-2 py-1">
                  <select value={d.item_id ?? ""}
                    disabled={!dept_id}
                    onChange={e => handleItemSelect(i, e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed">
                    <option value="">-- Select Item --</option>
                    {masItems.map(it => <option key={it.item_code} value={it.item_code}>{it.item_name}</option>)}
                  </select>
                </td>
                <td className="border px-2 py-1">
                  <input value={d.unit_of_measure} readOnly
                    className="w-full border rounded px-2 py-1 text-sm bg-gray-50 text-gray-600 cursor-not-allowed" />
                </td>
                <td className="border px-2 py-1">
                  <input type="number" value={d.quantity} min="0"
                    disabled={!d.item_id}
                    onChange={e => handleQtyChange(i, e.target.value)}
                    className={`w-full border rounded px-2 py-1 text-sm text-right disabled:bg-gray-100 disabled:cursor-not-allowed ${d.stock_error ? "border-red-400" : ""}`} />
                  {d.stock_error && <div className="text-xs text-red-600 mt-0.5">Exceeds stock</div>}
                </td>
                <td className="border px-2 py-1 text-center">
                  {d.stock_qty !== null
                    ? <span className={`text-xs font-medium ${d.stock_error ? "text-red-600" : "text-green-700"}`}>
                        {Number(d.stock_qty).toFixed(3)} {d.unit_of_measure}
                      </span>
                    : <span className="text-xs text-gray-400">{dept_id ? "—" : "Select dept"}</span>}
                </td>
                <td className="border px-2 py-1 text-center">
                  {details.length > 1 && (
                    <button onClick={() => setDetails(p => p.filter((_, idx) => idx !== i))}
                      className="text-red-500 hover:text-red-700 font-bold text-lg leading-none">×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end gap-3">
          {editId && (
            <button onClick={async () => { resetForm(); await fetchNumber(); }}
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">Cancel</button>
          )}
          <button onClick={handleSave} disabled={saving || hasStockErrors}
            className={`px-6 py-2 text-white rounded disabled:opacity-50 ${hasStockErrors ? "bg-gray-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"}`}>
            {saving ? "Saving..." : editId ? "Update Draft" : "Save as Draft"}
          </button>
        </div>
      </div>

      {/* ── LIST ── */}
      <div className="bg-white rounded-md shadow p-4">
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <h3 className="font-semibold text-gray-700">NRGP List</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <label className="text-sm text-gray-600">Status:</label>
              <select value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value); fetchList(e.target.value || undefined, filterReason || undefined); }}
                className="border rounded px-2 py-1.5 text-sm">
                <option value="">All</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-sm text-gray-600">Reason:</label>
              <select value={filterReason}
                onChange={e => { setFilterReason(e.target.value); fetchList(filterStatus || undefined, e.target.value || undefined); }}
                className="border rounded px-2 py-1.5 text-sm">
                <option value="">All</option>
                {REASONS.map(r => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
              </select>
            </div>
          </div>
        </div>

        {listLoading ? <p className="text-center py-6 text-gray-400">Loading...</p> : (
          <div className="space-y-2">
            {list.length === 0 ? <p className="text-center py-6 text-gray-400">No records found</p>
              : list.map(r => {
                const items = Array.isArray(r.items) ? r.items : (typeof r.items === "string" ? JSON.parse(r.items) : []);
                const isDraft          = r.approval_status === "DRAFT";
                const isPendingHod     = r.approval_status === "PENDING_HOD";
                const isHodApproved    = r.approval_status === "HOD_APPROVED";
                const isStoresVerified = r.approval_status === "STORES_VERIFIED";
                const isOwner          = r.created_by === user?.username;

                const showSubmit = isDraft && (isOwner || isAdmin);
                const showHod    = isPendingHod  && hasAccess(userType, "GP_HOD_APPROVE");
                const showStores = isHodApproved && hasAccess(userType, "GP_STORES_VERIFY");
                const showAdmin  = isStoresVerified && hasAccess(userType, "GP_ADMIN_APPROVE");

                return (
                  <div key={r.id} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">{r.nrgp_number}</span>
                          <span className="text-sm text-gray-500">{formatDateIndian(r.nrgp_date)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.approval_status] || ""}`}>
                            {STATUS_LABEL[r.approval_status] || r.approval_status}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            {REASON_LABEL[r.reason] || r.reason}
                          </span>
                          {r.stock_deducted && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">Stock Deducted</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5 truncate">
                          {r.supplier_name || "—"}{r.dept_name ? ` · ${r.dept_name}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* View — always */}
                        <button title="View" onClick={() => setViewModal({ row: r, items })} className="transition-transform hover:scale-125">
                          <Eye className="w-5 h-5 text-gray-500 hover:text-gray-700" />
                        </button>
                        {/* Submit */}
                        {showSubmit && (
                          <button title="Submit for HOD Approval" onClick={() => handleSubmit(r.id)} className="transition-transform hover:scale-125">
                            <Send className="w-5 h-5 text-red-600" />
                          </button>
                        )}
                        {/* HOD */}
                        {showHod && (
                          <>
                            <button title="HOD Approve" onClick={() => setApprovalModal({ id: r.id, action: "hod-approve", title: `HOD Approval — ${r.nrgp_number}`, label: "Approve", color: "bg-blue-600 hover:bg-blue-700" })} className="transition-transform hover:scale-125">
                              <CheckCircle className="w-5 h-5 text-blue-600" />
                            </button>
                            <button title="Reject" onClick={() => setApprovalModal({ id: r.id, action: "reject", title: `Reject — ${r.nrgp_number}`, label: "Reject", color: "bg-red-600 hover:bg-red-700" })} className="transition-transform hover:scale-125">
                              <XCircle className="w-5 h-5 text-red-500" />
                            </button>
                          </>
                        )}
                        {/* Stores */}
                        {showStores && (
                          <>
                            <button title="Stores Verify" onClick={() => setApprovalModal({ id: r.id, action: "stores-verify", title: `Stores Verification — ${r.nrgp_number}`, label: "Verify", color: "bg-purple-600 hover:bg-purple-700" })} className="transition-transform hover:scale-125">
                              <ShieldCheck className="w-5 h-5 text-purple-600" />
                            </button>
                            <button title="Reject" onClick={() => setApprovalModal({ id: r.id, action: "reject", title: `Reject — ${r.nrgp_number}`, label: "Reject", color: "bg-red-600 hover:bg-red-700" })} className="transition-transform hover:scale-125">
                              <XCircle className="w-5 h-5 text-red-500" />
                            </button>
                          </>
                        )}
                        {/* Admin */}
                        {showAdmin && (
                          <>
                            <button title="Admin Approve (deducts dept stock)" onClick={() => setApprovalModal({ id: r.id, action: "admin-approve", title: `Admin Approval — ${r.nrgp_number} (deducts dept stock)`, label: "Approve & Deduct Stock", color: "bg-green-600 hover:bg-green-700" })} className="transition-transform hover:scale-125">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            </button>
                            <button title="Reject" onClick={() => setApprovalModal({ id: r.id, action: "reject", title: `Reject — ${r.nrgp_number}`, label: "Reject", color: "bg-red-600 hover:bg-red-700" })} className="transition-transform hover:scale-125">
                              <XCircle className="w-5 h-5 text-red-500" />
                            </button>
                          </>
                        )}
                        {/* Edit — DRAFT only */}
                        {isDraft && (
                          <button title="Edit" onClick={() => openEdit(r.id)} className="transition-transform hover:scale-125">
                            <PencilLine className="w-5 h-5 text-green-600" />
                          </button>
                        )}
                        {/* Delete — ADMIN only */}
                        {isAdmin && isDraft && (
                          <button title="Delete" onClick={() => handleDelete(r.id, r.nrgp_number)} className="transition-transform hover:scale-125">
                            <Trash2 className="w-5 h-5 text-red-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
