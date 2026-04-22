"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Save, X, Building2, User, Phone, Mail, CreditCard, Landmark } from "lucide-react";

/* =======================
   TYPES
======================= */
type PoHeader = {
  sup_id: string;
  sup_name: string;
  sup_add: string;
  sup_person: string;
  sup_phone: string;
  sup_email: string;
  sup_gst: string;
  acct_no: string;
  acct_name: string;
  bank_name: string;
  ifsc_code: string;
  bank_branch: string;
};

type IndexedSupplier = PoHeader & {
  _nName: string;
  _nEmail: string;
  _nPhone: string;
  _nGst: string;
  _nAcct: string;
  _nIfsc: string;
};

/* =======================
   NORMALIZE HELPERS
======================= */
const normalizeGst = (v?: string | null) =>
  (v ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, "").toUpperCase().replace(/\s+/g, "").trim();

const normalizeText   = (v?: string | null) => (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizeNumber = (v?: string | null) => (v ?? "").replace(/\D/g, "");
const normalizeAccount = (v?: string | null) => (v ?? "").replace(/\s+/g, "").toUpperCase();

/* =======================
   UTILS
======================= */
function levenshtein(a: string, b: string) {
  const m = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) m[0][i] = i;
  for (let j = 0; j <= b.length; j++) m[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[j][i] = Math.min(m[j - 1][i] + 1, m[j][i - 1] + 1, m[j - 1][i - 1] + cost);
    }
  }
  return m[b.length][a.length];
}

const toTitleCase = (value: string) => {
  const keepUpper = ["Ltd", "Pvt", "LLP", "Inc", "Co"];
  return value.split(/\s+/).map(word => {
    const clean = word.replace(/[^A-Za-z]/g, "");
    if (!clean) return word;
    if (keepUpper.includes(clean)) return word;
    return word.replace(clean, clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase());
  }).join(" ");
};

/* =======================
   FIELD GROUPS for layout
======================= */
const FIELD_GROUPS = [
  {
    title: "Basic Information",
    icon: Building2,
    color: "blue",
    fields: ["sup_name", "sup_add", "sup_person", "sup_phone", "sup_email", "sup_gst"],
  },
  {
    title: "Bank Details",
    icon: Landmark,
    color: "emerald",
    fields: ["acct_no", "acct_name", "bank_name", "ifsc_code", "bank_branch"],
  },
];

const FIELD_LABELS: Record<string, string> = {
  sup_name:    "Supplier Name",
  sup_add:     "Address",
  sup_person:  "Contact Person",
  sup_phone:   "Phone Number",
  sup_email:   "Email ID",
  sup_gst:     "GST Number",
  acct_no:     "Account No / EFT Code",
  acct_name:   "Account Name",
  bank_name:   "Bank Name",
  ifsc_code:   "IFSC Code",
  bank_branch: "Bank Branch",
};

const EMPTY: PoHeader = {
  sup_id: "", sup_name: "", sup_add: "", sup_person: "",
  sup_phone: "", sup_email: "", sup_gst: "",
  acct_no: "", acct_name: "", bank_name: "", ifsc_code: "", bank_branch: "",
};

/* =======================
   COMPONENT
======================= */
export default function SupplierForm() {
  const [suppliers,        setSuppliers]        = useState<PoHeader[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<PoHeader | null>(null);
  const [poHeader,         setPoHeader]         = useState<PoHeader>(EMPTY);
  const [mode,             setMode]             = useState<"view" | "add" | "edit">("view");
  const [supplierSearch,   setSupplierSearch]   = useState("");
  const [showTitleWarn,    setShowTitleWarn]    = useState(false);

  /* ── Fetch ── */
  useEffect(() => {
    fetch("/api/suppliers").then(r => r.json()).then(d =>
      setSuppliers(Array.isArray(d) ? d.map(s => ({ ...s, sup_id: String(s.sup_id) })) : [])
    );
  }, []);

  const indexedSuppliers = useMemo<IndexedSupplier[]>(() =>
    suppliers.map(s => ({
      ...s,
      _nName:  normalizeText(s.sup_name),
      _nEmail: normalizeText(s.sup_email),
      _nPhone: normalizeNumber(s.sup_phone),
      _nGst:   normalizeGst(s.sup_gst),
      _nAcct:  normalizeAccount(s.acct_no),
      _nIfsc:  normalizeAccount(s.ifsc_code),
    })), [suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const q = normalizeText(supplierSearch);
    return suppliers.filter(s => normalizeText(s.sup_name).includes(q));
  }, [supplierSearch, suppliers]);

  /* ── Handlers ── */
  const handleSelect = (id: string) => {
    const sup = suppliers.find(s => s.sup_id === id) || null;
    setSelectedSupplier(sup);
    setPoHeader(sup ?? EMPTY);
    setMode("view");
    setSupplierSearch("");
  };

  const setField = (key: string, val: string) => {
    let filtered = val;

    // Phone — digits only, max 10
    if (key === "sup_phone") {
      filtered = val.replace(/\D/g, "").slice(0, 10);
    }
    // Account No — alphanumeric only (digits + uppercase letters for EFT codes)
    // Must have at least one digit — pure alphabet not allowed
    if (key === "acct_no") {
      filtered = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    }
    // IFSC — alphanumeric uppercase, max 11
    if (key === "ifsc_code") {
      filtered = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 11);
    }
    // GST — alphanumeric uppercase, max 15
    if (key === "sup_gst") {
      filtered = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 15);
    }

    setPoHeader(prev => ({ ...prev, [key]: filtered }));
    if (key === "sup_name") setShowTitleWarn(!!filtered && filtered !== toTitleCase(filtered));
  };

  const handleSave = async () => {
    try {
      // ── Mandatory fields — block save if empty ──────────────────────────────
      const mandatory = ["sup_name", "sup_add"];
      const missingMandatory = mandatory.filter(k => !String((poHeader as any)[k] || "").trim());
      if (missingMandatory.length) {
        alert("Required: " + missingMandatory.map(k => FIELD_LABELS[k]).join(", "));
        return;
      }

      // ── Optional fields — warn but allow save ────────────────────────────
      const optional = ["sup_person","sup_phone","sup_email","sup_gst","acct_no","acct_name","bank_name","ifsc_code","bank_branch"];
      const missingOptional = optional.filter(k => !String((poHeader as any)[k] || "").trim());
      if (missingOptional.length) {
        const proceed = confirm(
          "The following fields are empty:\n" +
          missingOptional.map(k => "• " + FIELD_LABELS[k]).join("\n") +
          "\n\nDo you want to save anyway?"
        );
        if (!proceed) return;
      }

      // ── Validate only if values are provided ─────────────────────────────
      const phone = poHeader.sup_phone?.trim() ? normalizeNumber(poHeader.sup_phone) : "";
      if (phone && phone.length !== 10) { alert("Phone must be 10 digits"); return; }

      const gst   = poHeader.sup_gst?.trim()   ? normalizeGst(poHeader.sup_gst)                     : "";
      const email = poHeader.sup_email?.trim()  ? poHeader.sup_email.trim().toLowerCase()             : "";
      const ifsc  = poHeader.ifsc_code?.trim()  ? poHeader.ifsc_code.trim().toUpperCase()             : "";

      if (email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) { alert("Invalid Email"); return; }
      if (ifsc  && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))                             { alert("Invalid IFSC Code"); return; }
      if (gst   && !/^[0-9]{2}[A-Z]{3}[PCHFABTLJG][A-Z][0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst)) { alert("Invalid GST Number"); return; }
      // Account No must contain at least one digit (pure alphabet not valid)
      const acct = poHeader.acct_no?.trim() ? normalizeAccount(poHeader.acct_no) : "";
      if (acct && !/\d/.test(acct)) { alert("Account No / EFT Code must contain at least one number"); return; }

      // ── Duplicate checks only if values provided ─────────────────────────
      if (gst && indexedSuppliers.some(s => s._nName === normalizeText(poHeader.sup_name) && s._nGst === gst && s.sup_id !== poHeader.sup_id)) {
        alert("Supplier with this Name and GST already exists"); return;
      }
      if (email && indexedSuppliers.some(s => s._nEmail === normalizeText(email) && s.sup_id !== poHeader.sup_id)) {
        if (!confirm("Email already used by another supplier. Continue?")) return;
      }
      if (phone && indexedSuppliers.some(s => s._nPhone === phone && s.sup_id !== poHeader.sup_id)) {
        if (!confirm("Phone already used by another supplier. Continue?")) return;
      }

      const res = await fetch("/api/suppliers", {
        method:  mode === "add" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...poHeader,
          sup_phone:  phone  || null,
          sup_gst:    gst    || null,
          sup_email:  email  || null,
          ifsc_code:  ifsc   || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw { status: res.status, message: body?.error || "Save failed" };

      localStorage.setItem("MASTER_UPDATED", "supplier");

      const freshData = await (await fetch("/api/suppliers")).json();
      const list = Array.isArray(freshData) ? freshData.map(s => ({ ...s, sup_id: String(s.sup_id) })) : [];
      setSuppliers(list);
      const sel = list.find(s => String(s.sup_id) === String(body.sup_id)) || null;
      setSelectedSupplier(sel);
      setPoHeader(sel ?? EMPTY);
      setMode("view");
      alert("Supplier saved successfully ✅");
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 409) { alert(err.message); return; }
      alert("Unexpected error ❌");
    }
  };

  const isReadOnly = mode === "view";

  /* ── UI ── */
  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* ── Page wrapper — constrained width, centered ── */}
      <div className="max-w-4xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Supplier Master</h1>
              <p className="text-xs text-gray-400">{suppliers.length} suppliers registered</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {mode === "view" && (
              <>
                <button onClick={() => { setMode("add"); setPoHeader(EMPTY); setSelectedSupplier(null); setShowTitleWarn(false); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium shadow-sm">
                  <Plus className="w-4 h-4" /> Add New
                </button>
                <button onClick={() => setMode("edit")} disabled={!selectedSupplier}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 font-medium shadow-sm disabled:opacity-40">
                  <Pencil className="w-4 h-4" /> Edit
                </button>
              </>
            )}
            {(mode === "add" || mode === "edit") && (
              <>
                <button onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium shadow-sm">
                  <Save className="w-4 h-4" /> Save
                </button>
                <button onClick={() => { setMode("view"); setShowTitleWarn(false); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-400 text-white text-sm rounded-lg hover:bg-gray-500 font-medium shadow-sm">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Search + Select ── */}
        <div className="bg-white rounded-xl shadow p-4 mb-4 flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search supplier..." value={supplierSearch}
              onChange={e => setSupplierSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
          </div>
          <select value={poHeader.sup_id || ""} disabled={mode !== "view"}
            onChange={e => handleSelect(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-50">
            <option value="">-- Select Supplier --</option>
            {filteredSuppliers.map(s => (
              <option key={s.sup_id} value={s.sup_id}>{s.sup_name}</option>
            ))}
          </select>
          {selectedSupplier && mode === "view" && (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full whitespace-nowrap">
              {selectedSupplier.sup_name}
            </span>
          )}
        </div>

        {/* ── Form sections ── */}
        {FIELD_GROUPS.map(group => {
          const Icon = group.icon;
          const accent = group.color === "blue" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-emerald-500 bg-emerald-50 text-emerald-700";
          const headerBg = group.color === "blue" ? "bg-blue-600" : "bg-emerald-600";
          return (
            <div key={group.title} className="bg-white rounded-xl shadow mb-4 overflow-hidden">
              {/* Section header */}
              <div className={`flex items-center gap-2 px-5 py-3 ${headerBg}`}>
                <Icon className="w-4 h-4 text-white" />
                <h2 className="text-sm font-semibold text-white">{group.title}</h2>
              </div>
              {/* Fields grid */}
              <div className="grid grid-cols-2 gap-4 p-5">
                {group.fields.map(key => (
                  <div key={key} className={key === "sup_add" ? "col-span-2" : ""}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                      {FIELD_LABELS[key]}
                    </label>
                    <input
                      type={key === "sup_email" ? "email" : "text"}
                      value={(poHeader as any)[key] || ""}
                      readOnly={isReadOnly}
                      onChange={e => setField(key, e.target.value)}
                      className={`w-full h-10 px-3 border rounded-lg text-base font-normal text-black focus:ring-2 focus:ring-blue-200 outline-none transition-colors ${
                        isReadOnly ? "bg-gray-50 cursor-default" : "bg-white"
                      }`}
                    />
                    {key === "sup_name" && mode !== "view" && showTitleWarn && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠ Recommended: Title Case — e.g. Abc Traders Pvt Ltd
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* ── Empty state ── */}
        {mode === "view" && !selectedSupplier && (
          <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a supplier above to view details</p>
          </div>
        )}

      </div>
    </div>
  );
}
