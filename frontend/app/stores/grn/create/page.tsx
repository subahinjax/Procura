"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { API_BASE_URL } from "@/lib/api";
import { parseIndianDate } from "@/utils/dateUtils";


interface GRNDetail {
  item_id: number | null;
  item_name: string;
  item_search: string;        // ← add
  showDropdown: boolean;      // ← add
  dropUp: boolean;   // ← add
  description: string;
  quantity_received: string;
  unit_of_measure: string;
  remarks: string;
  po_balance_qty: number | null; // remaining balance from PO (null if no PO)
}

const emptyDetail = (): GRNDetail => ({
  item_id: null, item_name: "", item_search: "", showDropdown: false,  dropUp: false, description: "", quantity_received: "", unit_of_measure: "", remarks: "", po_balance_qty: null,
});

export default function GRNFormPage() {
  const router = useRouter();
  const params = useParams();
  const grnId = params?.id as string | undefined;
  const isEdit = !!grnId;

  const { user, loading: authLoading } = useAuth();
  useAuthGuard();

  const navAllowedRef = useRef<boolean | null>(null);
  // pendingDeptRef/pendingSubdeptRef: used to apply dept+subdept after allSubdepts loads
  const pendingDeptRef    = useRef<any>(null);  // dept_id to apply once allSubdepts is loaded
  const pendingSubdeptRef = useRef<any>(null);  // subdept_id to apply once filteredSubdepts is set

  const [navChecked, setNavChecked] = useState(false);

  useEffect(() => {
    // ✅ Run once on mount — check flag and redirect if not from list
    if (navAllowedRef.current !== null) return;
    const flag = sessionStorage.getItem("from_grn_list");
    if (flag === "true") {
      sessionStorage.removeItem("from_grn_list");
      navAllowedRef.current = true;
    } else {
      navAllowedRef.current = false;
      router.replace("/stores/grn");
      return;
    }
    setNavChecked(true);
  }, []);

  // Header state
  const [grn_number, setGrnNumber] = useState("");
  const today = new Date().toLocaleDateString("en-CA");
  const [grn_date] = useState(today);
  const [supplier_id, setSupplierId] = useState<number | "">("");
  const [dc_number, setDcNumber] = useState("");
  const [dc_date, setDcDate] = useState("");
  const [gate_entry_no, setGateEntryNo] = useState("");
  const [gate_entry_date, setGateEntryDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [po_id, setPoId] = useState<number | "">("");
  const [dept_id, setDeptId] = useState<number | "">("");
  const [subdept_id, setSubdeptId] = useState<number | "">("");

  // Detail state
  const [details, setDetails] = useState<GRNDetail[]>([emptyDetail()]);
  const [saving, setSaving] = useState(false);

  // Dropdown data
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [allSubdepts, setAllSubdepts] = useState<any[]>([]);
  const [filteredSubdepts, setFilteredSubdepts] = useState<any[]>([]);

  useEffect(() => {
    if (!navChecked || authLoading || !user) return;
    fetchDropdowns();
    if (!isEdit) fetchGRNNumber();
    if (isEdit && grnId) fetchGRN(grnId);
  }, [navChecked, authLoading, user]);

  // Filter subdepts when dept changes — ONLY update filteredSubdepts list, never touch subdept_id here
  // subdept_id is managed explicitly: cleared on manual dept change, set on PO/edit load
  useEffect(() => {
    if (!dept_id) {
      setFilteredSubdepts([]);
    } else {
      setFilteredSubdepts(allSubdepts.filter(s => String(s.dept_id) === String(dept_id)));
    }
  }, [dept_id, allSubdepts]);

  const fetchDropdowns = async () => {
    try {
      const [supRes, itemRes, deptRes] = await Promise.all([
        fetch(`/api/proxy/suppliers`),
        fetch(`/api/proxy/items`),
        fetch(`/api/proxy/department`),
      ]);
      if (supRes.ok) setSuppliers(await supRes.json());
      if (itemRes.ok) setItems(await itemRes.json());
      if (deptRes.ok) setDepartments(await deptRes.json());

      // Fetch all subdepts at once — then immediately apply filtered subdepts if dept already set
      const subdeptRes = await fetch(`/api/proxy/subdepartments/all`);
      if (subdeptRes.ok) {
        const allSubs: any[] = await subdeptRes.json();
        setAllSubdepts(allSubs);
        // If dept_id was already set (e.g. from fetchGRN running in parallel),
        // apply filteredSubdepts directly now that we have the data
        if (pendingDeptRef.current) {
          const dId = pendingDeptRef.current;
          setFilteredSubdepts(allSubs.filter(s => String(s.dept_id) === String(dId)));
          if (pendingSubdeptRef.current) {
            setSubdeptId(pendingSubdeptRef.current);
            pendingSubdeptRef.current = null;
          }
          pendingDeptRef.current = null;
        }
      }
    } catch (err) {
      console.error("Failed to fetch dropdowns:", err);
    }
  };

  // Fetch POs for selected supplier (exclude COMPLETE grn_status)
  const fetchPosForSupplier = async (supId: number | "") => {
    if (!supId) { setPos([]); return; }
    try {
      const res = await fetch(
        `/api/proxy/purchase-orders?supplier_id=${supId}&exclude_complete=true`
      );
      if (res.ok) setPos(await res.json());
    } catch (err) {
      console.error("Failed to fetch POs for supplier:", err);
    }
  };

  const fetchGRNNumber = async () => {
    try {
      const res = await fetch(`/api/proxy/grn/new-number`);
      if (res.ok) {
        const data = await res.json();
        setGrnNumber(data.grn_number);
      }
    } catch (err) {
      console.error("Failed to fetch GRN number:", err);
    }
  };

  const fetchGRN = async (id: string) => {
    try {
      const res = await fetch(`/api/proxy/grn/${id}`);
      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (!res.ok) { router.replace("/stores/grn"); return; }
      const data = await res.json();
      const h = data.header;
      setGrnNumber(h.grn_number);
      // grn_date is fixed to today — not loaded from DB on edit
      setSupplierId(h.supplier_id);
      setDcNumber(h.dc_number || "");


      setDcDate(parseIndianDate(h.dc_date));
      setGateEntryNo(h.gate_entry_no || "");
      setGateEntryDate(parseIndianDate(h.gate_entry_date));


      setRemarks(h.remarks || "");
      if (h.dept_id) {
        setDeptId(h.dept_id);
        // Store in refs — fetchDropdowns will apply filteredSubdepts + subdept_id once allSubdepts loads
        pendingDeptRef.current    = h.dept_id;
        pendingSubdeptRef.current = h.subdept_id || null;
      }
      if (h.supplier_id) await fetchPosForSupplier(h.supplier_id);
      if (h.po_id) setPoId(h.po_id);
setDetails(
  data.details.map((d: any) => ({
    ...emptyDetail(),
    item_id: d.item_id,
    item_name: d.item_name || d.item_name_master || "",
    item_search: d.item_name || d.item_name_master || "",
    description: d.description || "",
    quantity_received: String(d.quantity_received),
    unit_of_measure: d.unit_of_measure || "",
    remarks: d.remarks || "",
    po_balance_qty: null,
  }))
);
    } catch (err) {
      console.error("Failed to fetch GRN:", err);
    }
  };

  const handlePoChange = async (selectedPoId: number | "") => {
    setPoId(selectedPoId);
    if (!selectedPoId) {
      setDetails([emptyDetail()]);
      return;
    }
    try {
      // Fetch PO balance (remaining qty to receive)
      const balRes = await fetch(`/api/proxy/grn/po-balance/${selectedPoId}`);
      if (!balRes.ok) return;
      const balItems: any[] = await balRes.json();

      // Also fetch PO header for dept/subdept
      const poRes = await fetch(`/api/proxy/purchase-orders/${selectedPoId}`);
      const poData = poRes.ok ? await poRes.json() : null;
if (balItems.length > 0) {
setDetails(
  balItems.map((d: any) => ({
    ...emptyDetail(),

    item_id: d.item_code || null,
    item_name: d.item_name || "",
    item_search: d.item_name || "",

    description: d.description || "",
    quantity_received: String(d.balance_qty > 0 ? d.balance_qty : 0),
    unit_of_measure: d.unit_of_measure ? d.unit_of_measure.trim() : "",
    remarks: "",
    po_balance_qty: Number(d.balance_qty),
  }))
);
  } 
      if (poData?.header?.dept_id) {
        setDeptId(poData.header.dept_id);
        // If allSubdepts already loaded apply immediately, else store in refs
        setAllSubdepts(all => {
          if (all.length > 0) {
            setFilteredSubdepts(all.filter(s => String(s.dept_id) === String(poData.header.dept_id)));
            if (poData.header.subdept_id) setSubdeptId(poData.header.subdept_id);
          } else {
            pendingDeptRef.current    = poData.header.dept_id;
            pendingSubdeptRef.current = poData.header.subdept_id || null;
          }
          return all;
        });
      }
    } catch (err) {
      console.error("Failed to load PO items:", err);
    }
  };

  const updateDetail = (index: number, field: keyof GRNDetail, value: any) => {
    setDetails(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };


// Replace handleItemSearch with this:
const handleItemSearch = (index: number, value: string, inputEl?: HTMLInputElement) => {
  let dropUp = false;
  if (inputEl) {
    const rect = inputEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    dropUp = spaceBelow < 192;
  }
  setDetails(prev => prev.map((d, i) =>
    i === index
      ? { ...d, item_search: value, item_id: null, item_name: "", showDropdown: true, dropUp }
      : d
  ));
};

// Close dropdown on blur
const handleItemSearchClose = (index: number) => {
  setDetails(prev => prev.map((d, i) =>
    i === index ? { ...d, showDropdown: false } : d
  ));
};





  // ✅ mas_item uses item_code as primary key; auto-populate UOM from mas_item.unit
const handleItemSelect = (index: number, itemCode: string) => {
  if (!itemCode) {
    setDetails(prev => prev.map((d, i) =>
      i === index
        ? { ...d, item_id: null, item_name: "", item_search: "", unit_of_measure: "", showDropdown: false }
        : d
    ));
    return;
  }
  const item = items.find(it => String(it.item_code) === String(itemCode));
  if (item) {
    setDetails(prev => prev.map((d, i) =>
      i === index
        ? {
            ...d,
            item_id: item.item_code,
            item_name: item.item_name || "",
            item_search: item.item_name || "",
            unit_of_measure: item.unit ? item.unit.trim() : "",
            showDropdown: false,
          }
        : d
    ));
  }
};



  const addRow = () => setDetails(prev => [...prev, emptyDetail()]);
  const removeRow = (index: number) => setDetails(prev => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!supplier_id)      return alert("Select a supplier");
    if (!dc_number?.trim())      return alert("DC Number is required");
    if (!dc_date)                return alert("DC Date is required");
    if (!gate_entry_no?.trim())  return alert("Gate Entry No. is required");
    if (!gate_entry_date)        return alert("Gate Entry Date is required");
    if (!dept_id)                return alert("Department is required");
    if (!subdept_id)             return alert("Sub Department is required");

    if (details.some(d => !d.item_name || !d.quantity_received)) {
      return alert("All items must have a name and quantity");
    }
    if (details.some(d => Number(d.quantity_received) <= 0)) {
      return alert("Item quantity must be greater than 0");
    }
    // Alert if any item qty exceeds PO balance (warning only — does not block save)
    for (const d of details) {
      if (d.po_balance_qty !== null && Number(d.quantity_received) > d.po_balance_qty) {
        const excess = (Number(d.quantity_received) - d.po_balance_qty).toFixed(3);
        const proceed = window.confirm(
          `"${d.item_name}": GRN qty (${d.quantity_received}) exceeds PO balance (${d.po_balance_qty}) by ${excess} units.

Do you want to proceed anyway?`
        );
        if (!proceed) return;
        break;
      }
    }
    if (!window.confirm("Save this GRN?")) return;

    setSaving(true);
    try {
      const payload = {
        grn_date,
        supplier_id,
        dc_number: dc_number || null,
        dc_date: dc_date || null,
        gate_entry_no: gate_entry_no || null,
        gate_entry_date: gate_entry_date || null,
        remarks: remarks || null,
        po_id: po_id || null,
        dept_id: dept_id || null,
        subdept_id: subdept_id || null,
        details: details.map(d => ({
          ...d,
          quantity_received: Number(d.quantity_received),
        })),
      };

      const res = await fetch(
        isEdit ? `/api/proxy/grn/${grnId}` : `/api/proxy/grn`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (!res.ok) { const e = await res.json(); alert(e.error || "Save failed"); return; }

      alert(`GRN ${isEdit ? "updated" : "created"} successfully`);
      sessionStorage.setItem("from_grn_list", "true");
      router.push("/stores/grn");
    } catch (err) {
      console.error("Save GRN error:", err);
      alert("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // Still checking nav flag or auth — show loading
  if (!navChecked || authLoading || !user) {
    return <div className="p-4">Loading...</div>;
  }

const ItemDropdown = ({
  items,
  search,
  onSelect,
}: {
  items: { item_code: string; item_name: string }[];
  search: string;
  onSelect: (code: string) => void;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [dropUp, setDropUp] = useState(false);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 192; // max-h-48 = 12rem = 192px
      setDropUp(spaceBelow < dropdownHeight);
    }
  }, []);

  const filtered = items.filter(it =>
    it.item_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref}>
      <ul
        className={`absolute z-50 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto
          ${dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}
      >
        {filtered.length > 0 ? (
          filtered.map(it => (
            <li
              key={it.item_code}
              onMouseDown={() => onSelect(it.item_code)}
              className="px-2 py-1 text-sm hover:bg-blue-50 cursor-pointer"
            >
              {it.item_name}
            </li>
          ))
        ) : (
          <li className="px-2 py-1 text-sm text-gray-400">No items found</li>
        )}
      </ul>
    </div>
  );
};



  return (
    <div className="p-4 bg-gray-100 rounded-xl shadow max-w-5xl mx-auto">
      <h2 className="text-lg font-semibold text-white text-center bg-blue-600 py-2 rounded-md shadow mb-4">
        {isEdit ? "Edit GRN" : "Create GRN"}
      </h2>

      {/* Header */}
      <div className="bg-white rounded-md shadow p-4 mb-4 grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GRN Number</label>
          <input value={grn_number} readOnly
            className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GRN Date</label>
          <input type="date" value={grn_date} readOnly
            className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
          <select value={supplier_id}
            onChange={e => {
              const val = e.target.value ? Number(e.target.value) : "";
              setSupplierId(val);
              setPoId("");
              setDetails([emptyDetail()]);
              fetchPosForSupplier(val);
            }}
 //disabled={!!po_id}
            className={`w-full border rounded px-3 py-2`}>
            <option value="">-- Select Supplier --</option>
            {suppliers.map(s => (
              <option key={s.sup_id} value={s.sup_id}>{s.sup_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Link to PO (optional)</label>
          <select value={po_id} onChange={e => handlePoChange(e.target.value ? Number(e.target.value) : "")}
            className="w-full border rounded px-3 py-2">
            <option value="">-- Select PO (optional) --</option>
            {pos.map(p => (
              <option key={p.id} value={p.id}>{p.po_no} — {p.sup_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">DC Number</label>
          <input value={dc_number} onChange={e => setDcNumber(e.target.value)}
            className="w-full border rounded px-3 py-2" placeholder="Delivery Challan No." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">DC Date</label>
          <input type="date" value={dc_date} onChange={e => setDcDate(e.target.value)}
            className="w-full border rounded px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gate Entry No.</label>
          <input value={gate_entry_no} onChange={e => setGateEntryNo(e.target.value)}
            className="w-full border rounded px-3 py-2" placeholder="Security gate entry no." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gate Entry Date</label>
          <input type="date" value={gate_entry_date} onChange={e => setGateEntryDate(e.target.value)}
            className="w-full border rounded px-3 py-2" />
        </div>

        {/* Department — cascades to subdept */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <select value={dept_id} onChange={e => { setDeptId(e.target.value ? Number(e.target.value) : ""); setSubdeptId(""); }}
            className="w-full border rounded px-3 py-2">
            <option value="">-- Select Department --</option>
            {departments.map(d => (
              <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sub Department</label>
          <select value={subdept_id}
            onChange={e => setSubdeptId(e.target.value ? Number(e.target.value) : "")}
            className="w-full border rounded px-3 py-2"
            disabled={!dept_id}>
            <option value="">-- Select Sub Department --</option>
            {filteredSubdepts.map(s => (
              <option key={s.subdept_id} value={s.subdept_id}>{s.subdept_name}</option>
            ))}
          </select>
        </div>

        <div className="col-span-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
            className="w-full border rounded px-3 py-2" placeholder="Optional remarks" />
        </div>
      </div>

      {/* Details */}
      <div className="bg-white rounded-md shadow p-4 mb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-gray-700">Items Received</h3>
          <button onClick={addRow}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
            + Add Row
          </button>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-2 text-left">Item</th>
              <th className="border px-2 py-2 text-left">Description</th>
              <th className="border px-2 py-2 w-28">PO Balance</th>
              <th className="border px-2 py-2 w-28">Qty Received</th>
              <th className="border px-2 py-2 w-20">UOM</th>
              <th className="border px-2 py-2">Remarks</th>
              <th className="border px-2 py-2 w-8">×</th>
            </tr>
          </thead>
          <tbody>
            {details.map((d, i) => (
              <tr key={i}>
                <td className="border px-2 py-1">
{po_id ? (
  <input value={d.item_name} readOnly
    className="w-full border rounded px-2 py-1 bg-gray-50 text-sm" />
) : (
<div className="relative">
  <input
    type="text"
    value={d.item_search ?? d.item_name ?? ""}
    onChange={e => handleItemSearch(i, e.target.value, e.currentTarget)}
    onFocus={e => handleItemSearch(i, d.item_search ?? d.item_name ?? "", e.currentTarget)}
    onBlur={() => setTimeout(() => handleItemSearchClose(i), 150)}
    placeholder="Search item..."
    className="w-full border rounded px-2 py-1 text-sm"
  />
  {d.showDropdown && (
    <ul className={`absolute z-50 w-full bg-white border rounded shadow-lg max-h-48 overflow-y-auto
      ${d.dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}
    >
      {items
        .filter(it => it.item_name.toLowerCase().includes((d.item_search ?? "").toLowerCase()))
        .map(it => (
          <li
            key={it.item_code}
            onMouseDown={() => handleItemSelect(i, it.item_code)}
            className="px-2 py-1 text-sm hover:bg-blue-50 cursor-pointer"
          >
            {it.item_name}
          </li>
        ))}
      {items.filter(it =>
        it.item_name.toLowerCase().includes((d.item_search ?? "").toLowerCase())
      ).length === 0 && (
        <li className="px-2 py-1 text-sm text-gray-400">No items found</li>
      )}
    </ul>
  )}
</div>
)}
                </td>
                <td className="border px-2 py-1">
                  <input
  		   value={d.description || ""}   // ✅ safety fallback
		   onChange={e => updateDetail(i, "description", e.target.value)} // ✅ correct field
		   className="w-full border rounded px-2 py-1 text-sm"
		  />
                </td>
                <td className="border px-2 py-1 text-center">
                  {d.po_balance_qty !== null ? (
                    <span className={`text-sm font-medium ${d.po_balance_qty <= 0 ? "text-red-500" : "text-blue-700"}`}>
                      {Number(d.po_balance_qty).toFixed(3)}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="border px-2 py-1">
                  <input type="number" value={d.quantity_received}
                    onChange={e => {
                      updateDetail(i, "quantity_received", e.target.value);
                    }}
                    className={`w-full border rounded px-2 py-1 text-sm text-right ${
                      d.po_balance_qty !== null && Number(d.quantity_received) > d.po_balance_qty
                        ? "border-orange-400 bg-orange-50"
                        : ""
                    }`}
                    min="0" />
                </td>
                <td className="border px-2 py-1">
                  <input value={d.unit_of_measure} readOnly
                    className="w-full border rounded px-2 py-1 text-sm bg-gray-50 text-gray-700" />
                </td>
                <td className="border px-2 py-1">
                  <input value={d.remarks}
                    onChange={e => updateDetail(i, "remarks", e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm" />
                </td>
                <td className="border px-2 py-1 text-center">
                  {details.length > 1 && (
                    <button onClick={() => removeRow(i)}
                      className="text-red-500 hover:text-red-700 font-bold text-lg">×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => { sessionStorage.setItem("from_grn_list", "true"); router.push("/stores/grn"); }}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving..." : isEdit ? "Update GRN" : "Save GRN"}
        </button>
      </div>
    </div>
  );
}
