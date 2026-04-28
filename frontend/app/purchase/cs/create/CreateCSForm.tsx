"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Upload, CheckCircle2, AlertCircle,
  Loader2, Star, RotateCcw, FileSpreadsheet, Save, X,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

import { parseIndianDate } from "@/utils/dateUtils";


// ── types ─────────────────────────────────────────────────────────────────────
type MasSup    = { sup_id: number; sup_name: string };
type CSApprover = { id: number; designation: string; emp_name: string; sort_order: number };
type MasItem = {
  item_code: number; item_name: string; unit: string;
  description: string; hsn_code: string; gst_per: number; rate: number;
};
type Department = { dept_id: string; dept_name: string };
type SubDept    = { subdept_id: number; dept_id: string; subdept_name: string };


// supports up to 4 suppliers — terms is plain free text per supplier
type SupSlot = {
  sup_id: string; sup_name: string; quot_no: string; quot_date: string;
  terms: string;   // free-text T&C per supplier
};


type CsItem = {
  _id: string; item_code: number | null;
  item_name: string; description: string; uom: string; qty: string;
  sup1_rate: string; sup1_gst: string;
  sup2_rate: string; sup2_gst: string;
  sup3_rate: string; sup3_gst: string;
  sup4_rate: string; sup4_gst: string;    // CHANGE 2: 4th supplier
  recommended_sup: number | null;
  is_override: boolean; override_reason: string;
};

// ── helpers ───────────────────────────────────────────────────────────────────
const mkId  = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const blank = (): CsItem => ({
  _id: mkId(), item_code: null,
  item_name: "", description: "", uom: "", qty: "1",
  sup1_rate: "", sup1_gst: "0",
  sup2_rate: "", sup2_gst: "0",
  sup3_rate: "", sup3_gst: "0",
  sup4_rate: "", sup4_gst: "0",
  recommended_sup: null, is_override: false, override_reason: "",
});

const blankSlot = (): SupSlot => ({
  sup_id: "", sup_name: "", quot_no: "", quot_date: "",
  terms: "",
});

const today = new Date().toLocaleDateString("en-CA");

const MAX_SLOTS = 4;  // CHANGE 2

function autoRecommend(item: CsItem, activeCount: number): number | null {
  if (item.is_override) return item.recommended_sup;
  const rates: { slot: number; rate: number }[] = [];
  for (let s = 1; s <= activeCount; s++) {
    const r = Number((item as any)[`sup${s}_rate`]);
    if (r > 0) rates.push({ slot: s, rate: r });
  }
  if (!rates.length) return null;
  return rates.sort((a, b) => a.rate - b.rate)[0].slot;
}

function calcAmt(rate: string, qty: string)               { return (Number(rate)||0) * (Number(qty)||0); }
function calcGstAmt(rate: string, qty: string, gst: string){ return calcAmt(rate,qty) * (Number(gst)||0) / 100; }

function slotSub(items: CsItem[], slot: number)   { return items.reduce((s,it) => s + calcAmt((it as any)[`sup${slot}_rate`], it.qty), 0); }
function slotGst(items: CsItem[], slot: number)   { return items.reduce((s,it) => s + calcGstAmt((it as any)[`sup${slot}_rate`], it.qty, (it as any)[`sup${slot}_gst`]), 0); }
function slotGrand(items: CsItem[], slot: number) { return slotSub(items,slot) + slotGst(items,slot); }

const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// CHANGE 3: one extra slot colour for supplier 4
const SLOT_BORDER = ["border-blue-500",   "border-teal-500",   "border-indigo-500",  "border-rose-500"];
const SLOT_HEAD   = ["bg-blue-600",       "bg-teal-600",       "bg-indigo-600",      "bg-rose-600"];
const SLOT_BADGE  = [
  "bg-blue-100 text-blue-800",
  "bg-teal-100 text-teal-800",
  "bg-indigo-100 text-indigo-800",
  "bg-rose-100 text-rose-800",
];

// ── component ─────────────────────────────────────────────────────────────────
export default function CreateCSForm({
  existingCS,
  mode = "create",
  onSaved,
}: {
  existingCS?: any;
  mode?: "create" | "edit" | "view";
  onSaved?: () => void;          // called after successful save on edit page
}) {
  const router = useRouter();

  const [suppliers,   setSuppliers]   = useState<MasSup[]>([]);
  const [masItems,    setMasItems]    = useState<MasItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepts,    setSubDepts]    = useState<SubDept[]>([]);
  const [csDate,      setCsDate]      = useState(today);
  const [deptId,      setDeptId]      = useState("");
  const [subdeptId,   setSubdeptId]   = useState("");
  const [description, setDescription] = useState("");

  // CHANGE 2: start with 3 slots, allow adding 4th
  const [slots, setSlots] = useState<SupSlot[]>([blankSlot(), blankSlot(), blankSlot()]);
  const [items, setItems] = useState<CsItem[]>([blank()]);

  // CHANGE 4: which supplier columns are collapsed (set of slot indices 0-based)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const [searchIdx,  setSearchIdx]  = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const searchRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [inputMethod, setInputMethod] = useState<"manual" | "upload">("manual");
  const [uploadSlot,  setUploadSlot]  = useState<number>(1);
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const [parsing,   setParsing]   = useState(false);
  const [parseMsg,  setParseMsg]  = useState<string | null>(null);
  const [disabled,  setDisabled]  = useState(mode === "view");
  const [allApprovers,      setAllApprovers]      = useState<CSApprover[]>([]);
  const [selectedApprIds,  setSelectedApprIds]  = useState<number[]>([]);
  const [overrideModal, setOverrideModal] = useState<{ idx: number; slot: number } | null>(null);
  const [overrideText,  setOverrideText]  = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── fetch master data ──────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`/api/proxy/suppliers`).then(r => r.json()),
      fetch(`/api/proxy/department`).then(r => r.json()),
      fetch(`/api/proxy/items`).then(r => r.json()),
      fetch(`/api/proxy/cs-approvers`).then(r => r.json()),
    ]).then(([sup, dept, itm, appr]) => {
      setSuppliers(  Array.isArray(sup)  ? sup  : []);
      setDepartments(Array.isArray(dept) ? dept : []);
      setMasItems(   Array.isArray(itm)  ? itm  : []);
      setAllApprovers(Array.isArray(appr) ? appr : []);
    });
  }, []);

  useEffect(() => {
    if (!deptId) { setSubDepts([]); setSubdeptId(""); return; }
    fetch(`/api/proxy/subdepartment/${deptId}`)
      .then(r => r.json()).then(d => setSubDepts(Array.isArray(d) ? d : []));
  }, [deptId]);

  // ── load existing CS ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!existingCS) return;
    const h = existingCS.header;

    setCsDate(parseIndianDate(h.cs_date) || today);

    setDeptId(h.dept_id || "");
    setSubdeptId(String(h.subdept_id || ""));
    setDescription(h.description || "");
    setInputMethod(h.input_method || "manual");

    // FIX 1: build slots from header — always load all 4, trim blank trailing ones
    // but keep at least 3. If sup4 has data, keep 4.
    const loadedSlots: SupSlot[] = [];
    for (let si = 1; si <= MAX_SLOTS; si++) {
      loadedSlots.push({
        sup_id:    String(h[`sup${si}_id`]  || ""),
        sup_name:  h[`sup${si}_name`]       || "",
        quot_no:   h[`sup${si}_quot_no`]    || "",
	quot_date: parseIndianDate(h[`sup${si}_quot_date`]) || "",
        terms: existingCS.header[`sup${si}_terms`] || "",
      });
    }
    // FIX 1: keep sup4 if it has a name, otherwise trim to 3 minimum
    // FIX 1: sup_name from DB can be null — use ?? "" before trim
    const hasSup4 = (loadedSlots[3]?.sup_name ?? "").trim();
    setSlots(hasSup4 ? loadedSlots : loadedSlots.slice(0, 3));

    const loaded: CsItem[] = (existingCS.items || []).map((it: any) => ({
      _id: mkId(), item_code: it.item_code ?? null,
      item_name: it.item_name || "", description: it.description || "",
      uom: it.uom || "", qty: String(it.qty || 1),
      sup1_rate: it.sup1_rate != null ? String(it.sup1_rate) : "", sup1_gst: String(it.sup1_gst||0),
      sup2_rate: it.sup2_rate != null ? String(it.sup2_rate) : "", sup2_gst: String(it.sup2_gst||0),
      sup3_rate: it.sup3_rate != null ? String(it.sup3_rate) : "", sup3_gst: String(it.sup3_gst||0),
      sup4_rate: it.sup4_rate != null ? String(it.sup4_rate) : "", sup4_gst: String(it.sup4_gst||0),
      recommended_sup: it.recommended_sup ?? null,
      is_override: it.is_override||false, override_reason: it.override_reason||"",
    }));
    setItems(loaded.length ? loaded : [blank()]);
    if (mode === "view" || h.status === "Finalized") setDisabled(true);
    // Load selected approvers for this CS
    if (existingCS?.header?.id) {
      fetch(`/api/proxy/cs/${existingCS.header.id}/approvers`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setSelectedApprIds(d.map((a: any) => a.id)); })
        .catch(() => {});
    }
  }, [existingCS, mode]);

  // ── helpers ────────────────────────────────────────────────────────────────
  const activeCount   = slots.filter(s => s.sup_name.trim()).length;
  const activeNums    = slots.map((s, i) => s.sup_name.trim() ? i + 1 : null).filter(Boolean) as number[];

  const updateItem = (idx: number, patch: Partial<CsItem>) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, ...patch };
      if (!updated.is_override) updated.recommended_sup = autoRecommend(updated, activeCount);
      return updated;
    }));
  };

const fetchMasItems = async () => {
  try {
    const res = await fetch(`/api/proxy/items`);
    const data = await res.json();
    setMasItems(data || []);
  } catch (err) {
    console.error("Error loading items:", err);
  }
};

const selectMasItem = async (idx: number, code: number) => {
  await fetchMasItems(); // optional extra safety
  const f = masItems.find(m => m.item_code === code);
  if (!f) return;

  const gst = String(f.gst_per || 0);
  const current = items[idx];

  if (inputMethod === "upload") {
    // ✅ Upload mode → minimal fields only
    updateItem(idx, {
      item_code: f.item_code,
      item_name: f.item_name,
      uom: f.unit,
    });
  } else {
    // ✅ Manual mode → include description + GST (only first time)
    const isFirstTime = !current.item_code;

    updateItem(idx, {
      item_code: f.item_code,
      item_name: f.item_name,
      uom: f.unit,

      description: isFirstTime ? (f.description || "") : current.description,

      sup1_gst: isFirstTime ? gst : current.sup1_gst,
      sup2_gst: isFirstTime ? gst : current.sup2_gst,
      sup3_gst: isFirstTime ? gst : current.sup3_gst,
      sup4_gst: isFirstTime ? gst : current.sup4_gst,
    });
  }

  setSearchIdx(null);
  setSearchText("");
};

  const addItemAfter = (idx: number) => {
    setItems(prev => { const n=[...prev]; n.splice(idx+1,0,blank()); return n; });
  };
  const removeItem = (idx: number) => {
    setItems(prev => prev.length===1 ? [blank()] : prev.filter((_,i)=>i!==idx));
  };

  const updateSlot = (si: number, patch: Partial<SupSlot>) => {
    setSlots(prev => prev.map((s, i) => i===si ? {...s,...patch} : s));
  };

  // CHANGE 2: add 4th supplier
  const addSupplier = () => {
    if (slots.length >= MAX_SLOTS) return;
    setSlots(prev => [...prev, blankSlot()]);
  };
  const removeSupplier = (si: number) => {
    if (slots.length <= 3) return;   // always keep minimum 3
    setSlots(prev => prev.filter((_,i)=>i!==si));
  };

  // CHANGE 4: toggle collapse for a supplier column
  const toggleCollapse = (si: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(si) ? next.delete(si) : next.add(si);
      return next;
    });
  };

  // totals
  const subTotals   = slots.map((s, i) => s.sup_name.trim() ? slotSub(items, i+1)   : null);
  const gstTotals   = slots.map((s, i) => s.sup_name.trim() ? slotGst(items, i+1)   : null);
  const grandTotals = slots.map((s, i) => s.sup_name.trim() ? slotGrand(items, i+1) : null);

  // overallRec: supplier with LOWEST grand total (sub + GST) across all items
  const overallRec = (() => {
    let bestSlot: number | null = null;
    let bestTotal = Infinity;
    slots.forEach((s, i) => {
      if (!s.sup_name.trim()) return;
      const total = grandTotals[i];
      if (total !== null && total > 0 && total < bestTotal) {
        bestTotal = total;
        bestSlot  = i + 1;
      }
    });
    return bestSlot;
  })();

  const cellBg = (item: CsItem, slot: number) => {
    const rate = Number((item as any)[`sup${slot}_rate`]);
    if (!rate) return "";
    if (item.recommended_sup === slot) return "bg-green-100";
    const sorted = activeNums.map(s => Number((item as any)[`sup${s}_rate`])).filter(r=>r>0).sort((a,b)=>a-b);
    return sorted.length > 1 && rate === sorted[1] ? "bg-yellow-50" : "";
  };

  // validation
  const validate = (): string | null => {
    if (!csDate)                   return "CS Date is required";
    if (!deptId)                   return "Department is required";        // FIX 2
    if (!description.trim())       return "Purpose / Description is required";  // FIX 2
    // ✅ Approver validation
    if (selectedApprIds.length === 0) {
       return "Please select at least one approver / verifier";
    }
    if (!slots[0].sup_name.trim()) return "Supplier 1 name is required";
    for (let si = 0; si < slots.length; si++) {
      const s = slots[si];
      if (!s.sup_name.trim()) continue;
      if (!s.quot_no.trim())  return `Supplier ${si+1}: Quotation Number is required`;
      if (!s.quot_date)       return `Supplier ${si+1}: Quotation Date is required`;
    }
    const validItems = items.filter(it => it.item_name.trim());
    if (!validItems.length) return "At least one item is required";
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const mas = masItems.find(m => m.item_code === it.item_code);

      if (mas && it.uom.trim() !== (mas.unit || "").trim()) {
         return `Row ${i+1}: UOM mismatch with master (${mas.unit})`;
      }

      if (!it.item_name.trim()) continue;
      if (!it.item_code) return `Row ${i+1}: Please select item from dropdown`;
      if (!it.uom.trim())                  return `Row ${i+1}: UOM is required`;
      if (!it.qty || Number(it.qty) <= 0)  return `Row ${i+1}: Qty must be > 0`;
      for (let si = 0; si < slots.length; si++) {
          if (!slots[si].sup_name.trim()) continue;

          const rate = Number((it as any)[`sup${si+1}_rate`]);

          // ❌ Block negative
          if (rate < 0) {
             return `Row ${i+1} — ${slots[si].sup_name}: Rate cannot be negative`;
          }
 
          // ⚠️ Optional: if you still want to force entry (not empty)
          if ((it as any)[`sup${si+1}_rate`] === "") {
             return `Row ${i+1} — ${slots[si].sup_name}: Rate is required`;
          }
        }
      }
     return null;
   };

  // file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true); setParseMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("slot", String(uploadSlot));
      const res  = await fetch(`/api/proxy/cs/parse-upload`, { method:"POST", body:fd, credentials:"include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      const rk = `sup${uploadSlot}_rate`; const gk = `sup${uploadSlot}_gst`;
      const incoming: CsItem[] = (data.items||[]).map((it: any) => {
        const f = masItems.find(m => m.item_name.toLowerCase().trim() === String(it.item_name||"").toLowerCase().trim());
        const b = blank();
return {
  ...b,
  item_code: f?.item_code ?? null,
  item_name: it.item_name || "",
  uom: f?.unit || "",

  // keep upload values ONLY if present
  description: it.description || "",
  qty: it.qty != null ? String(it.qty) : "1",

  [rk]: it.rate != null ? String(it.rate) : "",
  [gk]: it.gst != null ? String(it.gst) : "",
} as CsItem;

      }).map((it: CsItem) => ({ ...it, recommended_sup: autoRecommend(it, activeCount) }));
      if (!incoming.length) throw new Error("No items found");
      const isBlank = items.length===1 && !items[0].item_name.trim();
      if (isBlank) {
        setItems(incoming);
      } else {
        setItems(prev => {
          const merged = [...prev];
          incoming.forEach(inc => {
            const ei = merged.findIndex(ex => ex.item_name.toLowerCase().trim() === inc.item_name.toLowerCase().trim());
            if (ei !== -1) {
              merged[ei] = { ...merged[ei], [rk]: (inc as any)[rk], [gk]: (inc as any)[gk], recommended_sup: autoRecommend({...merged[ei],[rk]:(inc as any)[rk],[gk]:(inc as any)[gk]}, activeCount) };
            } else { merged.push(inc); }
          });
          return merged;
        });
      }
      setParseMsg(`✅ ${incoming.length} items loaded for ${slots[uploadSlot-1]?.sup_name || `Supplier ${uploadSlot}`}`);
    } catch (err: any) {
      setParseMsg("❌ " + (err.message || "Parse failed"));
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // save
  const handleSave = async () => {
    const err = validate();
    if (err) { alert(err); return; }
    setSaving(true); setSaveMsg(null);
    try {
      // Build flat header fields for all slots (including terms)
      const headerSlots: Record<string, any> = {};
      slots.forEach((s, i) => {
        const n = i + 1;
        headerSlots[`sup${n}_id`]        = s.sup_id         || null;
        headerSlots[`sup${n}_name`]      = s.sup_name.trim() || null;
        headerSlots[`sup${n}_quot_no`]   = s.quot_no        || null;
        headerSlots[`sup${n}_quot_date`] = s.quot_date      || null;
        headerSlots[`sup${n}_terms`]     = s.terms.trim()   || null;  // free text
      });

      const payload = {
        header: { cs_date: csDate, dept_id: deptId||null, subdept_id: subdeptId||null, description: description||null, input_method: inputMethod, ...headerSlots },
        items: items.filter(it => it.item_name.trim()).map(it => ({
          item_code: it.item_code, item_name: it.item_name.trim(), description: it.description||null, uom: it.uom||null, qty: Number(it.qty)||1,
          sup1_rate: it.sup1_rate!==""?Number(it.sup1_rate):null, sup1_gst: Number(it.sup1_gst)||0,
          sup2_rate: it.sup2_rate!==""?Number(it.sup2_rate):null, sup2_gst: Number(it.sup2_gst)||0,
          sup3_rate: it.sup3_rate!==""?Number(it.sup3_rate):null, sup3_gst: Number(it.sup3_gst)||0,
          sup4_rate: it.sup4_rate!==""?Number(it.sup4_rate):null, sup4_gst: Number(it.sup4_gst)||0,
          recommended_sup: it.recommended_sup??null, is_override: it.is_override, override_reason: it.override_reason||null,
        })),
      };

      const isEdit = mode==="edit" && existingCS?.header?.id;
      const res = await fetch(
        isEdit ? `/api/proxy/cs/${existingCS.header.id}` : `/api/proxy/cs`,
        { method: isEdit?"PUT":"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload), credentials:"include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      // Save selected approvers
      const savedId = data.csId || existingCS?.header?.id;
      if (savedId && selectedApprIds.length > 0) {
        await fetch(`/api/proxy/cs/${savedId}/approvers`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(selectedApprIds),
        }).catch(() => {});
      }
      setSaveMsg({ ok:true, text:`✅ ${data.cs_no||"CS"} saved successfully!` });
      // Show success message for 1.5s, then hand off to parent or navigate
      if (onSaved) {
        setTimeout(() => onSaved(), 1500);
      } else {
        const savedId = data.csId;
        setTimeout(() => router.push(`/purchase/cs/${savedId}`), 1500);
      }
    } catch (err: any) {
      setSaveMsg({ ok:false, text:"❌ " + (err.message||"Save failed") });
      setDisabled(false);
    } finally { setSaving(false); }
  };

  // ── CHANGE 4: compute colspans for collapsed state ─────────────────────────
  // Each active supplier: if expanded = 3 cols (GST | Rate | Amt), if collapsed = 1 col
  const slotCols = (si: number) => slots[si]?.sup_name.trim() ? (collapsed.has(si) ? 1 : 3) : 0;

  // ── render ─────────────────────────────────────────────────────────────────
  // CHANGE 3: base font class increased — text-sm throughout instead of text-xs
  return (
    <div className={`bg-gray-100 rounded-xl shadow p-3 text-sm ${disabled ? "pointer-events-none opacity-70" : ""}`}>

      {/* Title */}
      <h2 className="text-base font-semibold text-white text-center bg-gradient-to-r from-blue-600 to-teal-500 py-1.5 rounded-md shadow mb-3">
        {mode==="edit" ? "Edit" : mode==="view" ? "View" : "Create"} Comparative Statement
      </h2>

      {/* Input method toggle */}
      {mode === "create" && (
        <div className="flex items-center gap-3 mb-3 bg-white rounded-lg px-4 py-2 border border-gray-200 shadow-sm w-fit text-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Input via</span>
          {([{key:"manual",label:"Manual Entry",Icon:Plus},{key:"upload",label:"Upload File",Icon:Upload}] as const).map(({key,label,Icon})=>(
            <button key={key} type="button" onClick={()=>setInputMethod(key as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${inputMethod===key?"bg-blue-600 text-white shadow":"text-gray-600 hover:bg-gray-100"}`}>
              <Icon size={14}/>{label}
            </button>
          ))}
        </div>
      )}

      {/* Header fields */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 mb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">CS Date *</label>
            <input type="date" value={csDate} onChange={e=>setCsDate(e.target.value)}
              className="w-full h-9 border border-gray-300 rounded px-2 text-sm focus:border-blue-500 focus:outline-none"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Department *</label>
            <select value={deptId} onChange={e=>setDeptId(e.target.value)}
              className={`w-full h-9 border rounded px-2 text-sm focus:border-blue-500 focus:outline-none ${!deptId ? "border-red-300" : "border-gray-300"}`}>
              <option value="">-- Select --</option>
              {departments.map(d=><option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Sub-Department</label>
            <select value={subdeptId} onChange={e=>setSubdeptId(e.target.value)}
              className="w-full h-9 border border-gray-300 rounded px-2 text-sm focus:border-blue-500 focus:outline-none" disabled={!deptId}>
              <option value="">-- Select --</option>
              {subDepts.map(s=><option key={s.subdept_id} value={s.subdept_id}>{s.subdept_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Purpose / Description *</label>
            <input type="text" value={description} onChange={e=>setDescription(e.target.value)}
              placeholder="e.g. Lab equipment Q1 *"
              className={`w-full h-9 border rounded px-2 text-sm focus:border-blue-500 focus:outline-none ${!description.trim() ? "border-red-300" : "border-gray-300"}`}/>
          </div>
        </div>
      </div>

      {/* ── CHANGE 2: Supplier slots — 2 cols top row, 3rd slot full-width below ─ */}
      <div className="space-y-3 mb-3">

        {/* Row 1: Supplier 1 + Supplier 2 */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map(si => (
            <SupplierCard key={si} si={si} slot={slots[si]} disabled={disabled}
              suppliers={suppliers} activeCount={slots.length}
              onUpdate={patch => updateSlot(si, patch)}
              onRemove={si >= 3 && !disabled ? () => removeSupplier(si) : undefined} />
          ))}
        </div>

        {/* Row 2: Supplier 3 (full width) + optional Supplier 4 */}
        <div className={slots.length >= 4 ? "grid grid-cols-2 gap-3" : ""}>
          {[2, 3].filter(si => si < slots.length).map(si => (
            <SupplierCard key={si} si={si} slot={slots[si]} disabled={disabled}
              suppliers={suppliers} activeCount={slots.length}
              onUpdate={patch => updateSlot(si, patch)}
              onRemove={si >= 3 && !disabled ? () => removeSupplier(si) : undefined}
              fullWidth={slots.length === 3 && si === 2} />
          ))}
        </div>

        {/* CHANGE 2: Add 4th supplier button */}
        {!disabled && slots.length < MAX_SLOTS && (
          <button type="button" onClick={addSupplier}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors">
            <Plus size={14}/> Add Supplier {slots.length + 1}
          </button>
        )}
      </div>

      {/* Upload panel */}
      {inputMethod==="upload" && mode!=="view" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
          <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
            <Upload size={14}/> Upload quotation file for one supplier at a time
          </p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-amber-700 font-medium">Upload for:</span>
            {slots.map((s, si) => (
              <button key={si} type="button" onClick={()=>setUploadSlot(si+1)}
                className={`px-3 py-1 rounded text-sm font-bold border transition-colors ${uploadSlot===si+1 ? `${SLOT_HEAD[si]} text-white border-transparent` : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>
                {s.sup_name.trim() ? `S${si+1}: ${s.sup_name.slice(0,12)}` : `Supplier ${si+1}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-amber-700 mb-2">
            Expected columns:{" "}
            {["Item Name","Description","UOM","Qty","Rate","GST"].map(c=>(
              <code key={c} className="bg-amber-100 px-1 rounded mr-1">{c}</code>
            ))}
          </p>
          <div className="flex items-center gap-3">
            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-amber-400 cursor-pointer hover:bg-amber-100 text-sm font-medium text-amber-800 transition-colors ${parsing?"opacity-50 pointer-events-none":""}`}>
              {parsing?<Loader2 size={15} className="animate-spin"/>:<FileSpreadsheet size={15}/>}
              {parsing?"Parsing…":"Choose File"}
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.docx,.doc" className="hidden" onChange={handleFileUpload}/>
            </label>
            {parseMsg && <p className={`text-sm font-medium ${parseMsg.startsWith("✅")?"text-green-700":"text-red-600"}`}>{parseMsg}</p>}
          </div>
        </div>
      )}

      {/* ── Items table ───────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-300 shadow-sm mb-3" style={{overflowX:"auto",overflowY:"visible"}}>
        <table className="w-full border-collapse" style={{fontSize:"0.8rem", minWidth: 600 + slots.filter(s=>s.sup_name.trim()).length * (180)}}>
          <thead>
            {/* Row 1: main headers */}
            <tr className="bg-gradient-to-r from-blue-600 to-teal-500 text-white">
              <th className="border border-blue-700 px-2 py-2 text-center w-8">#</th>
              <th className="border border-blue-700 px-2 py-2 text-left" style={{minWidth:160}}>Item Name</th>
              <th className="border border-blue-700 px-2 py-2 text-left" style={{minWidth:110}}>Description</th>
              <th className="border border-blue-700 px-2 py-2 text-center w-16">UOM</th>
              <th className="border border-blue-700 px-2 py-2 text-right w-[90px] min-w-[60px] max-w-[90px]">Qty</th>
              {/* CHANGE 4: per-supplier header with collapse toggle */}
              {slots.map((slot, si) => {
                if (!slot.sup_name.trim()) return null;
                const isCol = collapsed.has(si);
                return (
                  <th key={`h-s${si}`} colSpan={isCol ? 1 : 3}
                    className={`border border-blue-700 px-1 py-1 text-center ${SLOT_HEAD[si]}`}>
                    <div className="flex items-center justify-between gap-1">
                      {!isCol && <span className="text-[10px] opacity-0 w-4">·</span>}
                      <span className="flex-1 text-center truncate text-xs">
                        {isCol ? `S${si+1}` : (slot.sup_name.length > 16 ? slot.sup_name.slice(0,14)+"…" : slot.sup_name)}
                      </span>
                      {/* CHANGE 4: shrink/expand toggle button */}
                      <button type="button" onClick={()=>toggleCollapse(si)}
                        title={isCol ? "Expand" : "Collapse"}
                        className="shrink-0 bg-white/20 hover:bg-white/40 rounded px-0.5 py-0.5 transition-colors">
                        {isCol
                          ? <ChevronRight size={12} strokeWidth={2.5}/>
                          : <ChevronLeft  size={12} strokeWidth={2.5}/>}
                      </button>
                    </div>
                  </th>
                );
              })}
              <th className="border border-blue-700 px-2 py-2 text-center w-14">Rec.</th>
              <th className="border border-blue-700 px-2 py-2 text-center w-10">Add</th>
              <th className="border border-blue-700 px-2 py-2 text-center w-8">Del</th>
            </tr>
            {/* Row 2: sub-headers for expanded slots */}
            <tr className="bg-blue-700/80 text-white/90 text-[11px]">
              <th colSpan={5} className="border border-blue-800 px-1 py-0.5"></th>
              {slots.map((slot, si) => {
                if (!slot.sup_name.trim()) return null;
                if (collapsed.has(si)) return (
                  <th key={`sub-s${si}`} className="border border-blue-800 px-1 py-0.5 text-center">Amt</th>
                );
                return [
                  <th key={`sub-s${si}-g`} className="border border-blue-800 px-1 py-0.5 text-right w-12">GST%</th>,
                  <th key={`sub-s${si}-r`} className="border border-blue-800 px-1 py-0.5 text-right w-[90px] min-w-[60px] max-w-[90px]">Rate</th>,
                  <th key={`sub-s${si}-a`} className="border border-blue-800 px-1 py-0.5 text-right w-24">Amount</th>,
                ];
              })}
              <th colSpan={3} className="border border-blue-800 px-1 py-0.5"></th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, idx) => (
              <tr key={item._id} className="odd:bg-white even:bg-gray-50 hover:bg-blue-50/40">

                <td className="border border-gray-200 px-1 py-1 text-center text-gray-400">{idx+1}</td>

                {/* Item search dropdown */}
                <td className="border border-gray-200 px-1 py-1" style={{position:"relative",overflow:"visible"}}>
                  <input
                    ref={el=>{searchRefs.current[idx]=el;}}
                    type="text"
                    value={searchIdx===idx ? searchText : item.item_name}
                    onFocus={async ()=> {await fetchMasItems();setSearchIdx(idx);setSearchText(item.item_name);}}
                    onChange={e=>{
  setSearchIdx(idx);
  setSearchText(e.target.value);
  updateItem(idx, { item_name: e.target.value, item_code: null }); // ✅ reset code if typing
}}
                    onBlur={()=>setTimeout(()=>setSearchIdx(null),180)}
                    placeholder="Search item…"
                    className="w-full h-8 border border-gray-300 rounded px-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  {searchIdx===idx && (
                    <div style={{position:"fixed",zIndex:9999,width:searchRefs.current[idx]?.offsetWidth??200,top:(searchRefs.current[idx]?.getBoundingClientRect().bottom??0)+2,left:searchRefs.current[idx]?.getBoundingClientRect().left??0,maxHeight:200,overflowY:"auto"}}
                      className="bg-white border border-gray-300 shadow-xl rounded text-sm">
                      {masItems.filter(m=>m.item_name.toLowerCase().includes(searchText.toLowerCase())).slice(0,40).map(m=>(
                        <div key={m.item_code} onMouseDown={()=>selectMasItem(idx,m.item_code)}
                          className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0">
                          <span className="font-medium">{m.item_name}</span>
                          <span className="text-gray-400 ml-1">({m.unit})</span>
                        </div>
                      ))}
                      {masItems.filter(m=>m.item_name.toLowerCase().includes(searchText.toLowerCase())).length===0 && (
                        <div className="px-2 py-2 text-gray-400">No items found</div>
                      )}
                    </div>
                  )}
                </td>


<td className="border border-gray-200 px-1 py-1">
  <textarea
    value={item.description}
    onChange={e => updateItem(idx, { description: e.target.value })}

    onFocus={e => {
      e.target.style.height = "auto";
      e.target.style.height = e.target.scrollHeight + "px"; // expand
    }}

    onInput={e => {
      const el = e.currentTarget;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px"; // grow while typing
    }}

    onBlur={e => {
      e.target.style.height = "2rem";       // collapse back
      e.target.style.lineHeight = "2rem";
    }}

    placeholder="Auto-filled"
    rows={1}

    className="w-full resize-none overflow-hidden box-border px-2 rounded border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"

    style={{ height: "2rem", lineHeight: "2rem" }}
  />
</td>


                <td className="border border-gray-200 px-1 py-1">
                  <input type="text" readOnly value={item.uom} onChange={e=>updateItem(idx,{uom:e.target.value})}
                    placeholder="Nos" className={`w-full h-8 border rounded px-2 text-sm text-center focus:border-blue-500 focus:outline-none ${item.item_name.trim()&&!item.uom.trim()?"border-red-300":"border-gray-300"}`}/>
                </td>
                <td className="border border-gray-200 px-1 py-1">
                  <input type="number" value={item.qty}
                    onChange={e => updateItem(idx, { qty: e.target.value })}
                    onBlur={e => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) updateItem(idx, { qty: v.toFixed(2) });
                    }}
                    step="0.01" min="0"
                    className={`w-full min-w-[60px] max-w-[90px] h-8 border rounded px-2 text-sm text-right focus:border-blue-500 focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${item.item_name.trim()&&Number(item.qty)<=0?"border-red-300":"border-gray-300"}`}/>
                </td>

                {/* CHANGE 4: Rate/GST/Amt cells — collapsed shows only amount */}
                {slots.map((slot, si) => {
                  if (!slot.sup_name.trim()) return null;
                  const rk  = `sup${si+1}_rate` as keyof CsItem;
                  const gk  = `sup${si+1}_gst`  as keyof CsItem;
                  const bg  = cellBg(item, si+1);
                  const amt = calcAmt(item[rk] as string, item.qty);
                  const rateInvalid = item.item_name.trim() && (!item[rk] || Number(item[rk]) < 0);

                  if (collapsed.has(si)) {
                    // CHANGE 4: collapsed — show only computed amount
                    return (
                      <td key={`${item._id}-s${si}-col`}
                        className={`border border-gray-200 px-2 py-1 text-right font-medium text-gray-700 ${bg}`}
                        title={`GST: ${item[gk]}% | Rate: ${item[rk]}`}>
                        {amt > 0 ? fmt(amt) : "—"}
                      </td>
                    );
                  }

                  return [
                    <td key={`${item._id}-s${si}-g`} className={`border border-gray-200 px-1 py-1 ${bg}`}>
                      <input type="number" value={item[gk] ? String(Number(item[gk])) : ""} onChange={e=>updateItem(idx,{[gk]:e.target.value} as any)}
                        placeholder="0" min="0"
                        className="w-full h-8 border border-gray-300 rounded px-1 text-sm text-right focus:border-blue-500 focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"/>
                    </td>,
                    <td key={`${item._id}-s${si}-r`} className={`border border-gray-200 px-1 py-1 ${bg}`}>
                      <input type="number" value={item[rk] as string} onChange={e=>updateItem(idx,{[rk]:e.target.value} as any)}
                        placeholder="0.00" min="0"
                        className={`w-full min-w-[60px] max-w-[90px] h-8 border rounded px-2 text-sm text-right focus:border-blue-500 focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${rateInvalid?"border-red-300":"border-gray-300"} ${bg}`}/>
                    </td>,
                    <td key={`${item._id}-s${si}-a`} className={`border border-gray-200 px-2 py-1 text-right font-medium text-gray-700 ${bg}`}>
                      {amt > 0 ? fmt(amt) : "—"}
                    </td>,
                  ];
                })}

                {/* Recommended */}
                <td className="border border-gray-200 px-1 py-1 text-center">
                  {item.recommended_sup ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${SLOT_BADGE[item.recommended_sup-1]}`}>
                        S{item.recommended_sup}{item.is_override?" ✎":""}
                      </span>
                      {!item.is_override ? (
                        <button type="button" onClick={()=>{setOverrideModal({idx,slot:item.recommended_sup!});setOverrideText("");}}
                          className="text-[10px] text-gray-400 hover:text-orange-500 underline">override</button>
                      ) : (
                        <button type="button" onClick={()=>updateItem(idx,{is_override:false,override_reason:""})}
                          className="text-[10px] text-orange-500 hover:text-red-600 flex items-center gap-0.5">
                          <RotateCcw size={9}/> reset
                        </button>
                      )}
                    </div>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="border border-gray-200 px-1 py-1 text-center">
                  <button type="button" onClick={()=>addItemAfter(idx)}
                    className="p-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200">
                    <Plus size={14} strokeWidth={2.5}/>
                  </button>
                </td>
                <td className="border border-gray-200 px-1 py-1 text-center">
                  <button type="button" onClick={()=>removeItem(idx)}
                    className="p-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200">
                    <Trash2 size={14} strokeWidth={2.5}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          {/* Footer totals */}
          <tfoot>
            {/* Sub Total */}
            <tr className="bg-blue-50 text-sm">
              <td colSpan={5} className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-gray-700">Sub Total</td>
              {slots.map((slot, si) => {
                if (!slot.sup_name.trim()) return null;
                const sub = subTotals[si];
                const isRec = overallRec === si+1;
                const isCol = collapsed.has(si);
                if (isCol) return (
                  <td key={`sub-col-${si}`} className={`border border-gray-300 px-2 py-1.5 text-right font-semibold text-sm ${isRec?"bg-green-100 text-green-900":"text-gray-700"}`}>
                    {sub !== null ? fmt(sub) : "—"}
                  </td>
                );
                return [
                  <td key={`sub-g-${si}`} className="border border-gray-300"></td>,
                  <td key={`sub-r-${si}`} className="border border-gray-300"></td>,
                  <td key={`sub-a-${si}`} className={`border border-gray-300 px-2 py-1.5 text-right font-semibold ${isRec?"bg-green-100 text-green-900":"text-gray-700"}`}>
                    {sub !== null ? fmt(sub) : "—"}
                  </td>,
                ];
              })}
              <td colSpan={3} className="border border-gray-300"></td>
            </tr>
            {/* GST */}
            <tr className="bg-gray-50 text-sm">
              <td colSpan={5} className="border border-gray-300 px-2 py-1.5 text-right text-gray-600">GST</td>
              {slots.map((slot, si) => {
                if (!slot.sup_name.trim()) return null;
                const gst = gstTotals[si];
                const isRec = overallRec === si+1;
                const isCol = collapsed.has(si);
                if (isCol) return (
                  <td key={`gst-col-${si}`} className={`border border-gray-300 px-2 py-1.5 text-right text-sm ${isRec?"bg-green-100 text-green-800":"text-gray-600"}`}>
                    {gst !== null ? fmt(gst) : "—"}
                  </td>
                );
                return [
                  <td key={`gst-g-${si}`} className="border border-gray-300"></td>,
                  <td key={`gst-r-${si}`} className="border border-gray-300"></td>,
                  <td key={`gst-a-${si}`} className={`border border-gray-300 px-2 py-1.5 text-right ${isRec?"bg-green-100 text-green-800":"text-gray-600"}`}>
                    {gst !== null ? fmt(gst) : "—"}
                  </td>,
                ];
              })}
              <td colSpan={3} className="border border-gray-300"></td>
            </tr>
            {/* Grand Total */}
            <tr className="bg-gradient-to-r from-blue-100 to-teal-100 text-sm font-bold">
              <td colSpan={5} className="border border-gray-300 px-2 py-2 text-right text-gray-800">
                <div className="flex items-center justify-end gap-2">
                  <span>Grand Total</span>
                  {!disabled && activeNums.length > 1 && (
                    <div className="flex gap-1">
                      {activeNums.map(slot => (
                        <button key={`oa-${slot}`} type="button"
                          title={`Override all → S${slot}`}
                          onClick={()=>{
                            if (!confirm(`Override ALL items → Supplier ${slot}: ${slots[slot-1].sup_name}?`)) return;
                            setItems(prev=>prev.map(it=>({...it,recommended_sup:slot,is_override:true,override_reason:`Override all → S${slot}`})));
                          }}
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${SLOT_BADGE[slot-1]} border-current hover:opacity-80`}>
                          Override All → S{slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </td>
              {slots.map((slot, si) => {
                if (!slot.sup_name.trim()) return null;
                const grand = grandTotals[si];
                const isRec = overallRec === si+1;
                const isCol = collapsed.has(si);
                if (isCol) return (
                  <td key={`gt-col-${si}`} className={`border border-gray-300 px-2 py-2 text-right text-sm ${isRec?"bg-green-200 text-green-900":"text-gray-800"}`}>
                    <div className="flex items-center justify-end gap-1">
                      {isRec && <Star size={11} className="text-green-600 fill-green-600"/>}
                      {grand !== null ? fmt(grand) : "—"}
                    </div>
                  </td>
                );
                return [
                  <td key={`gt-g-${si}`} className="border border-gray-300"></td>,
                  <td key={`gt-r-${si}`} className="border border-gray-300 px-2 py-2">
                    {isRec && (
                      <div className="flex items-center justify-end gap-1">
                        <Star size={11} className="text-green-600 fill-green-600"/>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${SLOT_BADGE[si]}`}>Recommended</span>
                      </div>
                    )}
                  </td>,
                  <td key={`gt-a-${si}`} className={`border border-gray-300 px-2 py-2 text-right text-sm ${isRec?"bg-green-200 text-green-900":"text-gray-800"}`}>
                    {grand !== null ? fmt(grand) : "—"}
                  </td>,
                ];
              })}
              <td colSpan={3} className="border border-gray-300 px-2 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Approver / Verifier picker — dropdown, add one by one */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Approvers / Verifiers for this CS
        </h3>
        {allApprovers.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No approvers configured. Go to CS Approvers master to add.</p>
        ) : (
          <>
            {/* Dropdown to add approvers one by one */}
            {!disabled && (
              <div className="flex items-center gap-2 mb-2">
                <select
                  className="h-8 border border-gray-300 rounded px-2 text-sm focus:border-blue-500 focus:outline-none flex-1 max-w-xs"
                  value=""
                  onChange={e => {
                    const id = Number(e.target.value);
                    if (!id) return;
                    setSelectedApprIds(prev => prev.includes(id) ? prev : [...prev, id]);
                  }}>
                  <option value="">— Select approver to add —</option>
                  {allApprovers
                    .filter(a => !selectedApprIds.includes(a.id))
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        {a.designation}{a.emp_name ? ` (${a.emp_name})` : ""}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Selected approvers list with remove button */}
            {selectedApprIds.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No approvers selected yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedApprIds.map((id, idx) => {
                  const a = allApprovers.find(x => x.id === id);
                  if (!a) return null;
                  return (
                    <div key={id} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full pl-3 pr-1.5 py-1 text-sm">
                      <span className="text-gray-400 text-xs">{idx + 1}.</span>
                      <span className="font-medium text-blue-800 text-xs">{a.designation}</span>
                      {a.emp_name && <span className="text-blue-400 text-xs">({a.emp_name})</span>}
                      {!disabled && (
                        <button type="button"
                          onClick={() => setSelectedApprIds(prev => prev.filter(x => x !== id))}
                          className="ml-1 w-4 h-4 flex items-center justify-center rounded-full bg-blue-200 hover:bg-red-200 text-blue-700 hover:text-red-600 text-xs font-bold leading-none flex-shrink-0">
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Save message */}
      {saveMsg && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium mb-3 ${saveMsg.ok?"bg-green-50 text-green-700 border border-green-200":"bg-red-50 text-red-700 border border-red-200"}`}>
          {saveMsg.ok?<CheckCircle2 size={16}/>:<AlertCircle size={16}/>}
          {saveMsg.text}
        </div>
      )}

      {/* Buttons */}
      {mode !== "view" && (
        <div className="flex justify-center gap-4">
          <button type="button" onClick={handleSave} disabled={saving||disabled}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-teal-500 text-white text-sm font-semibold shadow hover:from-blue-700 hover:to-teal-600 disabled:opacity-60 transition-all">
            {saving?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>}
            {saving?"Saving…":"Save CS"}
          </button>
          <button type="button" onClick={()=>router.back()}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all">
            <X size={16}/> Cancel
          </button>
        </div>
      )}

      {/* Override modal */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-5 w-80">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <RotateCcw size={16} className="text-orange-500"/> Override Recommendation
            </h3>
            <p className="text-sm text-gray-500 mb-3">Item #{overrideModal.idx+1} — select supplier and give reason.</p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {slots.filter(s=>s.sup_name.trim()).map((s,si)=>(
                <button key={si} type="button"
                  onClick={()=>setOverrideModal(prev=>prev?{...prev,slot:si+1}:null)}
                  className={`flex-1 py-1.5 rounded text-sm font-bold border-2 transition-colors ${overrideModal.slot===si+1?`${SLOT_HEAD[si]} text-white border-transparent`:"bg-white text-gray-600 border-gray-300 hover:border-blue-400"}`}>
                  S{si+1}: {s.sup_name.slice(0,10)}
                </button>
              ))}
            </div>
            <textarea rows={2} placeholder="Reason for override…" value={overrideText} onChange={e=>setOverrideText(e.target.value)}
              className="w-full border border-gray-300 rounded p-2 text-sm focus:border-blue-500 focus:outline-none resize-none mb-3"/>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={()=>setOverrideModal(null)}
                className="px-3 py-1.5 rounded text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button type="button"
                onClick={()=>{
                  if (!overrideText.trim()){alert("Please enter a reason");return;}
                  updateItem(overrideModal.idx,{recommended_sup:overrideModal.slot,is_override:true,override_reason:overrideText.trim()});
                  setOverrideModal(null);
                }}
                className="px-3 py-1.5 rounded text-sm bg-blue-600 text-white font-semibold hover:bg-blue-700">
                Apply Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SupplierCard — extracted component for cleaner JSX ────────────────────────
// CHANGE 1: includes per-supplier Terms & Conditions panel
function SupplierCard({
  si, slot, disabled, suppliers, activeCount,
  onUpdate, onRemove, fullWidth,
}: {
  si: number;
  slot: SupSlot;
  disabled: boolean;
  suppliers: MasSup[];
  activeCount: number;
  onUpdate: (patch: Partial<SupSlot>) => void;
  onRemove?: () => void;
  fullWidth?: boolean;
}) {
  const isRequired = si === 0;

  return (
    <div className={`bg-white rounded-lg border-2 ${SLOT_BORDER[si]} shadow-sm overflow-visible ${fullWidth ? "col-span-2" : ""}`}>

      {/* Card header */}
      <div className={`${SLOT_HEAD[si]} text-white text-sm font-bold px-3 py-2 flex items-center justify-between`}>
        <span>Supplier {si+1}{isRequired?" *":""}</span>
        <div className="flex items-center gap-2">
          {!isRequired && <span className="text-white/60 text-xs">Optional</span>}
          {/* CHANGE 2: remove button for 4th supplier */}
          {onRemove && (
            <button type="button" onClick={onRemove}
              className="text-white/70 hover:text-white bg-white/20 hover:bg-white/30 rounded px-1.5 py-0.5 text-xs">
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="p-2 space-y-2">
        {/* Supplier selector */}
        <select value={slot.sup_id}
          onChange={e=>{
            const f = suppliers.find(s=>String(s.sup_id)===e.target.value);
            onUpdate({sup_id:e.target.value,sup_name:f?.sup_name||""});
          }}
          className="w-full h-9 border border-gray-300 rounded px-2 text-sm focus:border-blue-500 focus:outline-none">
          <option value="">-- Select from Master --</option>
          {suppliers.map(s=><option key={s.sup_id} value={String(s.sup_id)}>{s.sup_name}</option>)}
        </select>

        <input type="text" readOnly placeholder={`Supplier name${isRequired?" *":""}`}
          value={slot.sup_name} onChange={e=>onUpdate({sup_name:e.target.value})}
          className={`w-full h-8 border rounded px-2 text-sm focus:border-blue-500 focus:outline-none ${isRequired&&!slot.sup_name.trim()?"border-red-300":"border-gray-200"}`}/>

        <div className="grid grid-cols-2 gap-2">
          <input type="text" placeholder={`Quot. No.${slot.sup_name.trim()?" *":""}`}
            value={slot.quot_no} onChange={e=>onUpdate({quot_no:e.target.value})}
            className={`h-8 border rounded px-2 text-sm focus:border-blue-500 focus:outline-none ${slot.sup_name.trim()&&!slot.quot_no.trim()?"border-red-300":"border-gray-200"}`}/>
          <input type="date"
            value={slot.quot_date}
            onChange={e => onUpdate({quot_date: e.target.value})}
            max="9999-12-31"
            className={`h-8 border rounded px-2 text-sm focus:border-blue-500 focus:outline-none ${slot.sup_name.trim()&&!slot.quot_date?"border-red-300":"border-gray-200"}`}/>
        </div>

         {/* Terms & Conditions — free text per supplier */}
         <div className="border-t border-gray-100 pt-2">
           <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
             Terms &amp; Conditions
           </label>
           <textarea
             rows={4}
             placeholder={"Enter terms & conditions\n(one per line or free text)"}
             value={slot.terms}
             onChange={e => onUpdate({ terms: e.target.value })}
             disabled={disabled}
             className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs leading-relaxed focus:border-blue-500 focus:outline-none resize-none disabled:bg-gray-50 disabled:text-gray-500"
           />
         </div>
      </div>
    </div>
  );
}
