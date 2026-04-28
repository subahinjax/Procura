"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { API_BASE_URL } from "@/lib/api";
import { formatDateIndian } from "@/utils/dateUtils";
import { hasAccess } from "@/lib/accessControl";
import { PencilLine, Trash2, RotateCcw, Send, CheckCircle, XCircle, ShieldCheck, Eye } from "lucide-react";
import { parseIndianDate } from "@/utils/dateUtils";

interface RGPDetail {
  item_id: number | null;
  item_name: string;
  unit_of_measure: string;
  quantity_sent: string;
  stock_qty: number | null;
  stock_error: boolean;
}
const emptyDetail = (): RGPDetail => ({
  item_id: null, item_name: "", unit_of_measure: "",
  quantity_sent: "", stock_qty: null, stock_error: false,
});

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600", PENDING_HOD: "bg-yellow-100 text-yellow-800",
  HOD_APPROVED: "bg-blue-100 text-blue-700", STORES_VERIFIED: "bg-purple-100 text-purple-700",
  APPROVED: "bg-green-100 text-green-800", REJECTED: "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", PENDING_HOD: "Pending HOD", HOD_APPROVED: "HOD Approved",
  STORES_VERIFIED: "Stores Verified", APPROVED: "Approved", REJECTED: "Rejected",
};

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
          <h3 className="text-lg font-semibold">Gate Pass — {row.rgp_number}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">×</button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          {[
            ["RGP Number", row.rgp_number], ["Date", formatDateIndian(row.rgp_date)],
            ["Expected Return", row.expected_return_date ? formatDateIndian(row.expected_return_date) : "—"],
            ["Department", row.dept_name || "—"], ["Vehicle No", row.vehicle_no || "—"],
            ["Purpose", row.purpose || "—"],
            ["Party Name", row.supplier_name || "—"], ["Contact Person", row.contact_person || "—"],
            ["Phone", row.contact_phone || "—"], ["Address", row.address || "—"],
            ["Remarks", row.remarks || "—"],
            ["Approval Status", STATUS_LABEL[row.approval_status] || row.approval_status],
            ["Return Status", row.status?.replace(/_/g," ") || "—"],
          ].map(([l, v]) => (
            <div key={l}><span className="font-medium text-gray-500">{l}: </span><span>{v}</span></div>
          ))}
        </div>
        <h4 className="font-medium text-gray-700 mb-2 border-t pt-3">Items</h4>
        <table className="w-full border-collapse text-sm mb-4">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2 text-left">Item</th>
              <th className="border px-3 py-2 w-16">UOM</th>
              <th className="border px-3 py-2 w-24 text-right">Sent</th>
              <th className="border px-3 py-2 w-24 text-right">Returned</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, i: number) => (
              <tr key={i}>
                <td className="border px-3 py-2">{it.item_name}</td>
                <td className="border px-3 py-2 text-center">{it.unit_of_measure}</td>
                <td className="border px-3 py-2 text-right">{Number(it.quantity_sent).toFixed(3)}</td>
                <td className="border px-3 py-2 text-right text-green-700">{Number(it.quantity_returned || 0).toFixed(3)}</td>
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

// Required field label
const Req = () => <span className="text-red-500 ml-0.5">*</span>;

export default function RGPPage() {
  const router   = useRouter();
  const { user, loading: authLoading } = useAuth();
  useAuthGuard();
  const today = new Date().toLocaleDateString("en-CA");

  const userType = (user?.user_type || "").toUpperCase();
  const isAdmin  = userType === "ADMIN";

  const [list, setList]                   = useState<any[]>([]);
  const [listLoading, setListLoading]     = useState(true);
  const [filterApproval, setFilterApproval] = useState("");
  const [filterReturn, setFilterReturn]   = useState("");

  const [departments, setDepts]           = useState<any[]>([]);
  const [allSubdepts, setAllSubdepts]     = useState<any[]>([]);
  const [filteredSubs, setFilteredSubs]   = useState<any[]>([]);
  const [masItems, setMasItems]           = useState<any[]>([]);

  // Form fields
  const [editId, setEditId]                       = useState<number | null>(null);
  const [rgp_number, setRgpNumber]                = useState("");
  const [expected_return_date, setExpectedReturn] = useState("");
  const [dept_id, setDeptId]                      = useState<number | "">("");
  const [subdept_id, setSubdeptId]                = useState<number | "">("");
  const [vehicle_no, setVehicleNo]                = useState("");
  const [purpose, setPurpose]                     = useState("");
  const [supplier_name, setSupplierName]          = useState("");
  const [contact_person, setContactPerson]        = useState("");
  const [contact_phone, setContactPhone]          = useState("");
  const [address, setAddress]                     = useState("");
  const [remarks, setRemarks]                     = useState("");
  const [details, setDetails]                     = useState<RGPDetail[]>([emptyDetail()]);
  const [saving, setSaving]                       = useState(false);

  const stockCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [approvalModal, setApprovalModal] = useState<any>(null);
  const [viewModal, setViewModal]         = useState<{ row: any; items: any[] } | null>(null);
  const [returnModal, setReturnModal]     = useState<any>(null);
  const [returnDate, setReturnDate]       = useState(today);
  const [returnItems, setReturnItems]     = useState<any[]>([]);
  const [returnRemarks, setReturnRemarks] = useState("");
  const [returnSaving, setReturnSaving]   = useState(false);


  useEffect(() => {
    setFilteredSubs(dept_id ? allSubdepts.filter(s => String(s.dept_id) === String(dept_id)) : []);
  }, [dept_id, allSubdepts]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchDropdowns(); fetchList(); fetchNumber();
  }, [authLoading, user]);

  const fetchDropdowns = async () => {
    const [dRes, subRes, itemRes] = await Promise.all([
      fetch(`/api/proxy/department`),
      fetch(`/api/proxy/subdepartments/all`),
      fetch(`/api/proxy/items`),
    ]);
    if (dRes.ok)    setDepts(await dRes.json());
    if (subRes.ok)  setAllSubdepts(await subRes.json());
    if (itemRes.ok) setMasItems(await itemRes.json());
  };

  const fetchList = async (approval?: string, ret?: string) => {
    setListLoading(true);
    try {
      const p = new URLSearchParams();
      if (approval) p.set("approval_status", approval);
      if (ret)      p.set("return_status", ret);
      const qs = p.toString() ? "?" + p.toString() : "";
      const res = await fetch(`/api/proxy/rgp${qs}`);
      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (res.ok) setList(await res.json());
    } finally { setListLoading(false); }
  };

  const fetchNumber = async () => {
    const res = await fetch(`/api/proxy/rgp/new-number`);
    if (res.ok) setRgpNumber((await res.json()).rgp_number);
  };

  const resetForm = () => {
    setEditId(null); setExpectedReturn(""); setDeptId(""); setSubdeptId("");
    setVehicleNo(""); setPurpose(""); setSupplierName(""); setContactPerson("");
    setContactPhone(""); setAddress(""); setRemarks(""); setDetails([emptyDetail()]);
  };

const checkStockForRow = async (
  i: number,
  itemId: number | null,
  qty: string,
  deptId: number | "",
  subdeptId: number | ""
) => {
  if (!itemId || !deptId || !subdeptId || !qty || Number(qty) <= 0) {
    setDetails(p => p.map((d, idx) =>
      idx === i ? { ...d, stock_qty: null, stock_error: false } : d
    ));
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/stock/check-availability?dept_id=${deptId}&subdept_id=${subdeptId}&item_id=${itemId}&qty=${qty}`
    );

    if (!res.ok) return;

    const data = await res.json();

    setDetails(p => p.map((d, idx) =>
      idx === i
        ? {
            ...d,
            stock_qty: data.current_qty,
            stock_error: !data.available
          }
        : d
    ));
  } catch {}
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
  const existingQty = details[i].quantity_sent;

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



// Then handleQtyChange becomes:
const handleQtyChange = (i: number, val: string) => {
  setDetails(p => p.map((d, idx) => idx === i ? { ...d, quantity_sent: val, stock_error: false } : d));
  const itemId = details[i].item_id;
  if (itemId && dept_id && subdept_id && val && Number(val) > 0) {
    if (stockCheckTimer.current) clearTimeout(stockCheckTimer.current);
    stockCheckTimer.current = setTimeout(
      () => checkStockForRow(i, itemId, val, dept_id, subdept_id),
      400
    );
  }
};

// ✅ Fix — subdept resets to "" when dept changes, so pass "" directly:
const handleDeptChange = (newDeptId: number | "") => {
  setDeptId(newDeptId); 
  setSubdeptId("");
  setDetails(p => p.map(d => ({ ...d, stock_qty: null, stock_error: false })));
  // ✅ No stock check here — subdept is now "" so checkStockForRow
  // would early-return anyway. Stock rechecks when user picks subdept.
};

const handleSubDeptChange = (newSubDeptId: number | "") => {
  setSubdeptId(newSubDeptId);

  if (!newSubDeptId) {
    setDetails(p => p.map(d => ({ ...d, stock_qty: null, stock_error: false })));
    return;
  }

  details.forEach((d, i) => {
    if (d.item_id && d.quantity_sent && dept_id) {
      checkStockForRow(i, d.item_id, d.quantity_sent, dept_id, newSubDeptId);
    }
  });
};


  const openEdit = async (id: number) => {
    const res = await fetch(`/api/proxy/rgp/${id}`);
    if (!res.ok) { alert("Failed to load gate pass"); return; }
    const data = await res.json();
    const h = data.header;
    setEditId(id); setRgpNumber(h.rgp_number);

    setExpectedReturn(parseIndianDate(h.expected_return_date) || "");

    setVehicleNo(h.vehicle_no || ""); setPurpose(h.purpose || "");
    setSupplierName(h.supplier_name || ""); setContactPerson(h.contact_person || "");
    setContactPhone(h.contact_phone || ""); setAddress(h.address || ""); setRemarks(h.remarks || "");
    setDeptId(h.dept_id ? Number(h.dept_id) : "");
    setTimeout(() => setSubdeptId(h.subdept_id ? Number(h.subdept_id) : ""), 50);
    const loaded: RGPDetail[] = data.details.map((d: any) => ({
      item_id: d.item_id || null, item_name: d.item_name || "",
      unit_of_measure: d.unit_of_measure || "", quantity_sent: String(d.quantity_sent),
      stock_qty: null, stock_error: false,
    }));
    setDetails(loaded);
    if (h.dept_id) {
      loaded.forEach((d, i) => {
        if (d.item_id && d.quantity_sent) checkStockForRow(i, d.item_id, d.quantity_sent, Number(h.dept_id), Number(h.subdept_id));
      });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Validate all required fields
  const validate = (): string | null => {
    if (!expected_return_date) return "Expected Return Date is required";
    if (!dept_id)              return "Department is required";
    if (!subdept_id)           return "Sub Department is required";
    if (!vehicle_no.trim())    return "Vehicle No is required";
    if (!purpose.trim())       return "Purpose is required";
    if (!supplier_name.trim()) return "Party / Supplier Name is required";
    if (!contact_person.trim()) return "Contact Person is required";
    if (!contact_phone.trim()) return "Contact Phone is required";
    if (!address.trim())       return "Address is required";

if (hasDuplicateItems()) {
  return "Duplicate items are not allowed";
}

    const validRows = details.filter(d => d.item_id);
    if (!validRows.length)     return "Add at least one item";
    for (const d of validRows) {
      if (!d.quantity_sent || Number(d.quantity_sent) <= 0) return "All items must have quantity > 0";
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
        rgp_date: today, expected_return_date, dept_id: dept_id || null,
        subdept_id: subdept_id || null, vehicle_no, purpose,
        supplier_name, contact_person, contact_phone, address, remarks: remarks || null,
        details: validRows.map(d => ({
          item_id: d.item_id, item_name: d.item_name,
          unit_of_measure: d.unit_of_measure || null, quantity_sent: Number(d.quantity_sent),
          remarks: null,
        })),
      };
      const url    = editId ? `${API_BASE_URL}/api/rgp/${editId}` : `${API_BASE_URL}/api/rgp`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(payload),
      });
      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (!res.ok) { alert((await res.json()).error || "Save failed"); return; }
      alert(`Gate Pass ${editId ? "updated" : "saved as Draft"}`);
      resetForm(); await fetchNumber(); fetchList(filterApproval || undefined, filterReturn || undefined);
    } catch { alert("Something went wrong"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number, num: string) => {
    if (!isAdmin) { alert("Only Admin can delete gate passes"); return; }
    if (!window.confirm(`Delete Gate Pass ${num}?`)) return;
    const res = await fetch(`/api/proxy/rgp/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { alert((await res.json()).error || "Failed to delete"); return; }
    fetchList(filterApproval || undefined, filterReturn || undefined);
  };

  const handleSubmit = async (id: number) => {
    if (!window.confirm("Submit for HOD Approval?")) return;
    const res = await fetch(`/api/proxy/rgp/${id}/submit`, { method: "POST", credentials: "include" });
    if (!res.ok) { alert((await res.json()).error || "Failed"); return; }
    alert("Submitted for HOD Approval");
    fetchList(filterApproval || undefined, filterReturn || undefined);
  };

  const handleApprovalAction = async (remarksVal: string) => {
    if (!approvalModal) return;
    const res = await fetch(`/api/proxy/rgp/${approvalModal.id}/${approvalModal.action}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ remarks: remarksVal }),
    });
    if (res.status === 401) { router.replace("/session-expired"); return; }
    const data = await res.json();
    if (!res.ok) { alert(data.error || "Action failed"); setApprovalModal(null); return; }
    alert(`Status: ${STATUS_LABEL[data.approval_status] || data.approval_status}`);
    setApprovalModal(null); fetchList(filterApproval || undefined, filterReturn || undefined);
  };

  const openReturnModal = (row: any, items: any[]) => {
    const pending = items.map((it: any) => ({
      rgp_detail_id: it.id, item_name: it.item_name, unit_of_measure: it.unit_of_measure,
      quantity_sent: Number(it.quantity_sent), quantity_returned: Number(it.quantity_returned || 0),
      pending_qty: Number(it.quantity_sent) - Number(it.quantity_returned || 0), return_qty: "",
    })).filter(it => it.pending_qty > 0);
    if (!pending.length) { alert("All items already returned"); return; }
    setReturnModal({ rgp_id: row.id, rgp_number: row.rgp_number });
    setReturnItems(pending); setReturnDate(today); setReturnRemarks("");
  };

  const handleReturnSave = async () => {
    const toReturn = returnItems.filter(it => Number(it.return_qty) > 0);
    if (!toReturn.length) return alert("Enter return quantity for at least one item");
    for (const it of toReturn) {
      if (Number(it.return_qty) > it.pending_qty) {
        alert(`"${it.item_name}": exceeds pending (${it.pending_qty})`); return;
      }
    }
    if (!window.confirm("Record this return?")) return;
    setReturnSaving(true);
    try {
      const res = await fetch(`/api/proxy/rgp-return`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rgp_id: returnModal.rgp_id, return_date: returnDate, remarks: returnRemarks || null,
          details: toReturn.map(it => ({
            rgp_detail_id: it.rgp_detail_id, item_name: it.item_name,
            unit_of_measure: it.unit_of_measure, quantity_returned: Number(it.return_qty),
          })),
        }),
      });
      if (!res.ok) { alert((await res.json()).error || "Failed"); return; }
      const d = await res.json();
      alert(`Return recorded — ${d.return_number}`);
      setReturnModal(null); fetchList(filterApproval || undefined, filterReturn || undefined);
    } catch { alert("Something went wrong"); }
    finally { setReturnSaving(false); }
  };

  const hasStockErrors = details.some(d => d.stock_error);
  if (authLoading || !user) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 bg-gray-100 rounded-xl shadow max-w-5xl mx-auto space-y-4">
      {approvalModal && <ApprovalModal {...approvalModal} onConfirm={handleApprovalAction} onCancel={() => setApprovalModal(null)} />}
      {viewModal && <ViewModal row={viewModal.row} items={viewModal.items} onClose={() => setViewModal(null)} />}

      {/* Return Modal */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">Record Return — {returnModal.rgp_number}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Date</label>
                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <input value={returnRemarks} onChange={e => setReturnRemarks(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
            </div>
            <table className="w-full border-collapse text-sm mb-4">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-2 text-left">Item</th>
                  <th className="border px-2 py-2 w-16">UOM</th>
                  <th className="border px-2 py-2 w-20 text-right">Sent</th>
                  <th className="border px-2 py-2 w-20 text-right">Ret'd</th>
                  <th className="border px-2 py-2 w-20 text-right">Pending</th>
                  <th className="border px-2 py-2 w-24">Return Qty</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.map((it, i) => (
                  <tr key={i}>
                    <td className="border px-3 py-2">{it.item_name}</td>
                    <td className="border px-2 py-2 text-center">{it.unit_of_measure}</td>
                    <td className="border px-2 py-2 text-right">{it.quantity_sent.toFixed(3)}</td>
                    <td className="border px-2 py-2 text-right">{it.quantity_returned.toFixed(3)}</td>
                    <td className="border px-2 py-2 text-right text-orange-600 font-medium">{it.pending_qty.toFixed(3)}</td>
                    <td className="border px-2 py-1">
                      <input type="number" value={it.return_qty} min="0" max={it.pending_qty}
                        onChange={e => setReturnItems(p => p.map((r, ri) => ri === i ? { ...r, return_qty: e.target.value } : r))}
                        className={`w-full border rounded px-2 py-1 text-right text-sm ${Number(it.return_qty) > it.pending_qty ? "border-red-400 bg-red-50" : ""}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-3">
              <button onClick={() => setReturnModal(null)} className="px-4 py-2 bg-gray-400 text-white rounded">Cancel</button>
              <button onClick={handleReturnSave} disabled={returnSaving}
                className="px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
                {returnSaving ? "Saving..." : "Save Return"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORM ── */}
      <div className="bg-white rounded-md shadow p-4">
        <h2 className="text-lg font-semibold text-white text-center bg-blue-600 py-2 rounded-md mb-4">
          {editId ? `Edit RGP — ${rgp_number}` : "New Returnable Gate Pass (RGP)"}
        </h2>
        {hasStockErrors && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-700">
            ⚠️ Insufficient stock for one or more items. Adjust quantities before saving.
          </div>
        )}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Row 1 — Number, Date, Exp Return */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RGP Number</label>
            <input value={rgp_number} readOnly className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input value={today} readOnly className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Return Date <Req /></label>
            <input type="date" value={expected_return_date} onChange={e => setExpectedReturn(e.target.value)}
              className="w-full border rounded px-3 py-2" />
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
          {/* Row 3 — Purpose full width */}
          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose <Req /></label>
            <input value={purpose} onChange={e => setPurpose(e.target.value)}
              className="w-full border rounded px-3 py-2" placeholder="Reason for sending out" />
          </div>
          {/* Row 4 — Party details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Party / Supplier Name <Req /></label>
            <input value={supplier_name} onChange={e => setSupplierName(e.target.value)}
              className="w-full border rounded px-3 py-2" placeholder="Company or person" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person <Req /></label>
            <input value={contact_person} onChange={e => setContactPerson(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone <Req /></label>
            <input value={contact_phone} onChange={e => setContactPhone(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          {/* Row 5 — Address full width */}
          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address <Req /></label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
              className="w-full border rounded px-3 py-2 resize-none" placeholder="Full address..." />
          </div>
          {/* Row 6 — Remarks */}
          <div className="col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <input value={remarks} onChange={e => setRemarks(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
        </div>

        {/* Items Table */}
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium text-gray-700 text-sm">Items <Req /></h4>
          <button onClick={() => setDetails(p => [...p, emptyDetail()])}
            disabled={!dept_id}
            title={!dept_id ? "Select department first" : "Add row"}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
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
              <th className="border px-2 py-2 w-28">Qty Sent <Req /></th>
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
                  <input type="number" value={d.quantity_sent} min="0"
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
                    : <span className="text-xs text-gray-400">—</span>}
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
            className={`px-6 py-2 text-white rounded disabled:opacity-50 ${hasStockErrors ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>
            {saving ? "Saving..." : editId ? "Update Draft" : "Save as Draft"}
          </button>
        </div>
      </div>

      {/* ── LIST ── */}
      <div className="bg-white rounded-md shadow p-4">
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <h3 className="font-semibold text-gray-700">RGP List</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <label className="text-sm text-gray-600">Approval:</label>
              <select value={filterApproval}
                onChange={e => { setFilterApproval(e.target.value); fetchList(e.target.value || undefined, filterReturn || undefined); }}
                className="border rounded px-2 py-1.5 text-sm">
                <option value="">All</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-sm text-gray-600">Return:</label>
              <select value={filterReturn}
                onChange={e => { setFilterReturn(e.target.value); fetchList(filterApproval || undefined, e.target.value || undefined); }}
                className="border rounded px-2 py-1.5 text-sm">
                <option value="">All</option>
                <option value="UNCLOSED">Unclosed</option>
                <option value="CLOSED">Closed</option>
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
                const isApproved       = r.approval_status === "APPROVED";
                const isOwner          = r.created_by === user?.username;

                // Submit visible only for DRAFT owner / admin
                const showSubmit = isDraft && (isOwner || isAdmin);
                // HOD approve/reject — visible to HOD/ADMIN when PENDING_HOD
                const showHod    = isPendingHod && hasAccess(userType, "GP_HOD_APPROVE");
                // Stores verify — visible when HOD_APPROVED
                const showStores = isHodApproved && hasAccess(userType, "GP_STORES_VERIFY");
                // Admin approve — visible when STORES_VERIFIED
                const showAdmin  = isStoresVerified && hasAccess(userType, "GP_ADMIN_APPROVE");

                return (
                  <div key={r.id} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">{r.rgp_number}</span>
                          <span className="text-sm text-gray-500">{formatDateIndian(r.rgp_date)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.approval_status] || ""}`}>
                            {STATUS_LABEL[r.approval_status] || r.approval_status}
                          </span>
                          {isApproved && r.status && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === "OPEN" ? "bg-green-100 text-green-700" : r.status === "PARTIALLY_RETURNED" ? "bg-yellow-100 text-yellow-700" : "bg-gray-200 text-gray-600"}`}>
                              {r.status.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5 truncate">
                          {r.supplier_name || "—"}{r.dept_name ? ` · ${r.dept_name}` : ""}
                          {r.expected_return_date ? ` · Exp: ${formatDateIndian(r.expected_return_date)}` : ""}
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
                            <Send className="w-5 h-5 text-blue-600" />
                          </button>
                        )}
                        {/* HOD */}
                        {showHod && (
                          <>
                            <button title="HOD Approve" onClick={() => setApprovalModal({ id: r.id, action: "hod-approve", title: `HOD Approval — ${r.rgp_number}`, label: "Approve", color: "bg-blue-600 hover:bg-blue-700" })} className="transition-transform hover:scale-125">
                              <CheckCircle className="w-5 h-5 text-blue-600" />
                            </button>
                            <button title="Reject" onClick={() => setApprovalModal({ id: r.id, action: "reject", title: `Reject — ${r.rgp_number}`, label: "Reject", color: "bg-red-600 hover:bg-red-700" })} className="transition-transform hover:scale-125">
                              <XCircle className="w-5 h-5 text-red-500" />
                            </button>
                          </>
                        )}
                        {/* Stores */}
                        {showStores && (
                          <>
                            <button title="Stores Verify" onClick={() => setApprovalModal({ id: r.id, action: "stores-verify", title: `Stores Verification — ${r.rgp_number}`, label: "Verify", color: "bg-purple-600 hover:bg-purple-700" })} className="transition-transform hover:scale-125">
                              <ShieldCheck className="w-5 h-5 text-purple-600" />
                            </button>
                            <button title="Reject" onClick={() => setApprovalModal({ id: r.id, action: "reject", title: `Reject — ${r.rgp_number}`, label: "Reject", color: "bg-red-600 hover:bg-red-700" })} className="transition-transform hover:scale-125">
                              <XCircle className="w-5 h-5 text-red-500" />
                            </button>
                          </>
                        )}
                        {/* Admin */}
                        {showAdmin && (
                          <>
                            <button title="Admin Approve" onClick={() => setApprovalModal({ id: r.id, action: "admin-approve", title: `Admin Approval — ${r.rgp_number}`, label: "Approve", color: "bg-green-600 hover:bg-green-700" })} className="transition-transform hover:scale-125">
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            </button>
                            <button title="Reject" onClick={() => setApprovalModal({ id: r.id, action: "reject", title: `Reject — ${r.rgp_number}`, label: "Reject", color: "bg-red-600 hover:bg-red-700" })} className="transition-transform hover:scale-125">
                              <XCircle className="w-5 h-5 text-red-500" />
                            </button>
                          </>
                        )}
                        {/* Return */}
                        {isApproved && r.status !== "CLOSED" && (
                          <button title="Record Return" onClick={() => openReturnModal(r, items)} className="transition-transform hover:scale-125">
                            <RotateCcw className="w-5 h-5 text-blue-500" />
                          </button>
                        )}
                        {/* Edit — DRAFT only */}
                        {isDraft && (
                          <button title="Edit" onClick={() => openEdit(r.id)} className="transition-transform hover:scale-125">
                            <PencilLine className="w-5 h-5 text-green-600" />
                          </button>
                        )}
                        {/* Delete — ADMIN only */}
                        {isAdmin && isDraft && (
                          <button title="Delete" onClick={() => handleDelete(r.id, r.rgp_number)} className="transition-transform hover:scale-125">
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
