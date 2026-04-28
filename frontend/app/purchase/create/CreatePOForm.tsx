"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import TermsConditionsTable from "./TermsConditionsTable/terms_cond";
import SupplierFields from "./SupplierFields";

import ItemsTable from "./ItemsTable";
import ApproverFields from "./ApproverFields";
import GeneralInfoFields from "./GeneralInfoFields";
import DocumentUploadModal from "@/components/DocumentUploadModal";

import type { OtherCharge, PoItem } from "./ItemsTable"; 


import { Plus, Trash2 } from "lucide-react";
import { toast, dismissToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";

import { formatDateIndian } from "@/utils/dateUtils";
import { parseIndianDate } from "@/utils/dateUtils";

import { API_BASE_URL } from "@/lib/api";

import type { PoHeader } from "@/types/po";
import type { Supplier as SupplierType } from "@/types/supplier";
import type { Term } from "@/types/term";

import { round2 } from "@/utils/numberUtils";

// ── NEW: import OtherCharge type from ItemsTable ──────────────────────────────

import { useSearchParams } from "next/navigation";

// --- types ---
interface Supplier {
  sup_id: string;
  sup_name: string;
  [key: string]: unknown;
}

interface Department {
  dept_id: string;
  dept_name: string;
}

interface SubDepartment {
  subdept_id: number | "";
  dept_id: string;
  subdept_name: string;
}


interface Approver {
  id: number;
  name: string;
  [key: string]: any;
}

interface SavedHeader {
  id?: number;
  po_no?: string;
  [key: string]: unknown;
}

// --- initial defaults ---
//const today = new Date().toLocaleDateString("en-CA");


const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
};

const initialPoHeader: PoHeader = {
  po_type: "",
  po_no: "",
  po_date: new Date().toLocaleDateString("en-CA"),
  quot_no: "",
  del_day: "",
  warranty: "",
  freight: "",
  pay_term: "",
  sup_id: "",
  sup_name: "",
  po_title: "",
  prepared_by: "",
  review_by: "",
  prepared_review: "",
  approved_by: "",
  released_by: "",
  dept_id: "",
  subdept_id: "",
  advance_required: false,
  advance_percent: "",
  status: "Draft",
};

const initialPoItems: PoItem[] = [
  {
    id: generateId(),
    item_code: 0,
    item_name: "",
    description: "",
    unit: "",
    qty: 0,
    rate: 0,
    amount: 0,
    hsn_code: "",
    gst_per: 0,
    _from_cs: false,
  },
];


// ---------------- Null / Blank Saving ----------------
const normalize = (v: any) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  return v;
};

const isEmpty = (v: any) =>
  v === null ||
  v === undefined ||
  (typeof v === "string" && v.trim() === "");

const isNA = (v: any) =>
  typeof v === "string" && v.trim().toUpperCase() === "NA";

const isFilled = (v: any) =>
  typeof v === "string"
    ? v.trim() !== "" && !isNA(v)
    : v !== null && v !== undefined;

const REQUIRED_FIELDS = [
  "po_date",
  "dept_id",
  "subdept_id",
  "sup_name",
  "approved_by",
];

const NA_ALLOWED_FIELDS = [
  "quot_no",
  "warranty",
  "freight",
  "pay_term",
  "po_title",
  "del_day",
];

const SYSTEM_FIELDS = [
  "po_no", "id", "status",
  "sup_id", "sup_phone", "sup_email", "sup_gst", "sup_add", "sup_person",
  "acct_name", "acct_no", "bank_name", "bank_branch", "ifsc_code",
  "sub_total", "gst_total", "grand_total",
  "notes", "created_at", "updated_at", "create_date", "created_by",
  "approved_date", "released_by_name",
];





// ---------------- Null / Blank Saving ----------------

export default function CreatePOForm({
  setDirty,
  existingPO,
  mode = "create",
}: {
  setDirty: (dirty: boolean) => void;
  existingPO?: any;
  mode?: "create" | "edit" | "view";
}) {
  const router = useRouter();

  const [formData, setFormData]                 = useState({ poNumber: "", supplier: "" });
  const [poHeader, setPoHeader]                 = useState<PoHeader>(initialPoHeader);
  const [poItems, setPoItems]                   = useState(initialPoItems);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierType | null>(null);
  const [suppliers, setSuppliers]               = useState<Supplier[]>([]);
  const [department, setDepartment]             = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [subDepartments, setSubDepartments]     = useState<SubDepartment[]>([]);
  const [selectedSubDepartment, setSelectedSubDepartment] = useState<SubDepartment | null>(null);
  const [items, setItems] = useState<PoItem[]>(initialPoItems);
  const [selectedTerms, setSelectedTerms]       = useState<Term[]>([]);
  const [approvers, setApprovers]               = useState<any[]>([]);
  const [poData, setPoData]                     = useState<any>(null);
  const [loading, setLoading]                   = useState(false);
  const [formDisabled, setFormDisabled]         = useState(false);
  const [savedHeader, setSavedHeader]           = useState<SavedHeader | null>(null);
  const [showUploadModal, setShowUploadModal]   = useState(false);
  const [docsUploaded, setDocsUploaded]         = useState(false);
  const [pendingDocs, setPendingDocs]           = useState<Record<string, File>>({});

  // ── NEW: other charges state ────────────────────────────────────────────────
  const [otherCharges, setOtherCharges]         = useState<OtherCharge[]>([]);
  const [chargeItems, setChargeItems]           = useState<any[]>([]);
  // ────────────────────────────────────────────────────────────────────────────

  const initialRef           = useRef<string | null>(null);
  const [dirty, setLocalDirty] = useState(false);
  const pendingBaselineRef   = useRef<any>(null);

  const searchParams = useSearchParams();
  const isCopy       = !!searchParams.get("copyId");

 // CHANGE 1: Add CS state variables


  const [csList,       setCsList]       = useState<any[]>([]);   // dropdown options
  const [selectedCsId, setSelectedCsId] = useState<string>("");  // selected CS id


const [subtotal, setSubtotal] = useState(0);
const [totalGST, setTotalGST] = useState(0);
const [grandTotal, setGrandTotal] = useState(0);


  // ---------------- Fetch master data ----------------
  const fetchMasterData = async () => {
    try {
      const [supRes, deptRes, itemRes, apprRes, ocRes, csRes] = await Promise.all([
        fetch(`/api/proxy/suppliers`),
        fetch(`/api/proxy/department`),
        fetch(`/api/proxy/items`),
        fetch(`/api/proxy/approvers`),
        fetch(`/api/proxy/invoice/charge-items`),
        fetch(`/api/proxy/cs`),
      ]);
      const suppliersData   = await supRes.json();
      const departmentData  = await deptRes.json();
      const itemsData       = await itemRes.json();
      const approversData   = await apprRes.json();
      const chargeItemsData = ocRes.ok ? await ocRes.json() : [];
      const csData          = csRes.ok ? await csRes.json() : [];

      setSuppliers(  Array.isArray(suppliersData)  ? suppliersData  : []);
      setDepartment( Array.isArray(departmentData) ? departmentData : []);
      setItems(      Array.isArray(itemsData)      ? itemsData      : []);
      setApprovers(  Array.isArray(approversData)  ? approversData  : []);
      setChargeItems(Array.isArray(chargeItemsData)? chargeItemsData: []);
      setCsList(     Array.isArray(csData)         ? csData         : []);
    } catch (err) {
      console.error("Error fetching master data:", err);
      setSuppliers([]);
      setDepartment([]);
      setItems([]);
      setApprovers([]);
      setChargeItems([]);
      setCsList([]);
    }
  };


  const [terms, setTerms] = useState<Term[]>([]);

  const fetchterms = async () => {
    try {
      const res  = await fetch("/api/terms");
      const data = await res.json();

      const normalized: Term[] = Array.isArray(data)
        ? data.map((t) => ({
            id:       t.id,
            content:  t.content ?? t.title ?? "",
            isCustom: false,
          }))
        : [];

      setTerms(normalized);
    } catch (err) {
      console.error("Failed to fetch terms:", err);
      setTerms([]);
    }
  };

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "TERMS_UPDATED")  { fetchterms();      localStorage.removeItem("TERMS_UPDATED");  }
      if (event.key === "MASTER_UPDATED") { fetchMasterData(); localStorage.removeItem("MASTER_UPDATED"); }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const onFocus = () => fetchterms();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    fetchMasterData();
    fetchterms();
  }, []);

  // ---------------- Load existing PO ----------------
  useEffect(() => {
    if (!existingPO)                        return;
    if (!Array.isArray(existingPO.items))   return;
    if (items.length === 0)                 return;

    setPoData(existingPO);

    /* Header */
    const header = existingPO.header || {};
    const normalizedHeader = {
      ...header,

      po_date: header.po_date ? header.po_date.slice(0, 10) : "",
    };
    setPoHeader(normalizedHeader);
    setSavedHeader(normalizedHeader);

    /* Items */
    const mappedItems = existingPO.items.map((d: any) => {
      const code   = Number(d.item_code);
      const master = items.find(it => Number(it.item_code) === code);
      const qty    = Number(d.qty  ?? 1);
      const rate   = Number(d.rate ?? master?.rate ?? 0);
      return {
        ...d,
        id:          generateId(),
        item_code:   code,
        item_name:   d.item_name   ?? master?.item_name   ?? "",
        description: d.description ?? master?.description ?? "",
        unit:        d.unit        ?? master?.unit        ?? "",
        qty,
        rate,
        amount:   qty * rate,
        hsn_code: d.hsn_code ?? master?.hsn_code ?? "",
        gst_per:  Number(d.gst_per ?? master?.gst_per ?? 0),
      };
    });
    setPoItems(mappedItems);

    // ── NEW: load other_charges on edit / copy ──────────────────────────────
    setOtherCharges(
      (existingPO.other_charges || []).map((oc: any) => ({
        id:          oc.id,
        item_code:   String(oc.item_code || ""),
        item_name:   oc.item_name  || "",
        amount:      String(oc.amount    || ""),
        is_discount: oc.is_discount === true,
      }))
    );
    // ───────────────────────────────────────────────────────────────────────

    /* Supplier */
    const sup = suppliers.find(s => s.sup_id === header.sup_id) || null;
    setSelectedSupplier(sup);

    /* Department */
    const dept = department.find(d => d.dept_id === existingPO.header.dept_id) || null;
    setSelectedDepartment(dept);
    setPoHeader((prev) => ({ ...prev, dept_id: dept?.dept_id || "" }));

    if (dept) {
      fetch(`/api/proxy/subdepartment/${dept.dept_id}`)
        .then(res => res.json())
        .then((subs: SubDepartment[]) => {
          setSubDepartments(subs);
          const subDept =
            subs.find((s: SubDepartment) => s.subdept_id === existingPO.header.subdept_id) || null;
          setPoHeader((prev) => ({
            ...prev,
            subdept_id: subDept?.subdept_id?.toString() || "",
          }));
          setSelectedSubDepartment(subDept);
        })
        .catch(err => console.error("❌ Subdepartment fetch failed:", err));
    }

    /* Terms */
    const normalizedTerms = Array.isArray(existingPO.terms)
      ? existingPO.terms.map((t: any) => ({
          id:       t.term_id,
          title:    t.title   ?? "",
          content:  t.content,
          isCustom: false,
        }))
      : [];
    setSelectedTerms(normalizedTerms);

    setFormDisabled(mode === "view");

    pendingBaselineRef.current = {
      poHeader:            normalizedHeader,
      poItems:             mappedItems,
      selectedSupplier:    sup,
      selectedDepartment:  dept,
      selectedTerms:       normalizedTerms,
    };
  }, [existingPO, items, suppliers, department, mode]);

// QUICK FIX — find and move these exact lines to the correct position:

const handleCsSelect = async (csId: string) => {
  setSelectedCsId(csId);

  if (!csId) {
    setPoHeader(initialPoHeader);
    setPoItems(initialPoItems);
    setSelectedSupplier(null);
    setSelectedDepartment(null);
    setSelectedSubDepartment(null);
    setOtherCharges([]);
    return;
  }

  try {
    const res = await fetch(`/api/proxy/cs/${csId}`);
    if (!res.ok) { alert("Failed to load CS"); return; }
    const { header: ch, items: ciRows } = await res.json();

    const N = ciRows?.[0]?.recommended_sup || 1;

    const supId   = ch[`sup${N}_id`];
    const quotNo  = ch[`sup${N}_quot_no`];

    // ✅ Find matched objects first, don't call setSelectedSupplier yet
    const matchedSup  = suppliers.find((s: any) => String(s.sup_id) === String(supId)) || null;
    const matchedDept = department.find((d: any) => String(d.dept_id) === String(ch.dept_id)) || null;

    setSelectedDepartment(matchedDept);

    let matchedSub: SubDepartment | null = null;
    if (matchedDept) {
      const subRes = await fetch(`/api/proxy/subdepartment/${matchedDept.dept_id}`);
      const subs   = subRes.ok ? await subRes.json() : [];
      setSubDepartments(subs);
      matchedSub = subs.find((s: SubDepartment) => String(s.subdept_id) === String(ch.subdept_id)) || null;
      setSelectedSubDepartment(matchedSub);
    }

    // ✅ Set poHeader with ALL supplier fields from matchedSup directly
    setPoHeader(prev => ({
      ...prev,
      dept_id:     ch.dept_id || "",
      subdept_id:  matchedSub?.subdept_id?.toString() || "",
      sup_id:      matchedSup?.sup_id       || "",
      sup_name:    matchedSup?.sup_name     || "",
      // ✅ Use the exact field names your DB/payload expects:
      sup_add:     matchedSup?.address      || matchedSup?.sup_add  || "",
      sup_gst:     matchedSup?.gst          || matchedSup?.sup_gst  || "",
      sup_phone:   matchedSup?.phone        || matchedSup?.sup_phone || "",
      sup_email:   matchedSup?.email        || matchedSup?.sup_email || "",
      acct_name:   matchedSup?.acct_name    || matchedSup?.acct_name || "",
      acct_no:     matchedSup?.acct_no      || matchedSup?.acct_no || "",
      bank_name:   matchedSup?.bank_name    || matchedSup?.bank_name || "",
      bank_branch: matchedSup?.bank_branch  || matchedSup?.bank_branch || "",
      ifsc_code:  matchedSup?.ifsc_code     || matchedSup?.ifsc_code || "", 


      sup_person:  matchedSup?.sup_person || "",
      quot_no:     quotNo || "",
      po_title:    ch.description || "",
    }));

    const mappedItems = ciRows.map((ci: any) => {
      let supNum = N;
      if (ci.is_override && ci.override_reason) {
        const match = ci.override_reason.match(/S(\d)/i);
        if (match) supNum = Number(match[1]);
      }
      const rate   = Number(ci[`sup${supNum}_rate`])   || 0;
      const gstPer = Number(ci[`sup${supNum}_gst`])    || 0;
      const qty    = Number(ci.qty)                    || 1;
      const rawAmount = ci[`sup${supNum}_amount`];
      const amount =
      rawAmount !== undefined && rawAmount !== null && rawAmount !== ""
      ? Number(rawAmount)
      : round2(qty * rate);

      return {
        id:          generateId(),
        item_code:   ci.item_code   || "",
        item_name:   ci.item_name   || "",
        description: ci.description || "",
        unit:        ci.uom         || "",
        qty,
        rate,
        amount,
        hsn_code:    "",
        gst_per:     gstPer,
        _from_cs:    true,
        _override:   ci.is_override || false,
      };
    });

    setPoItems(mappedItems);

    // ✅ Set selectedSupplier LAST so SupplierFields syncs after poHeader is already correct
    setSelectedSupplier(matchedSup);

  } catch (err) {
    console.error("CS import error:", err);
    alert("Failed to import CS data");
  }
};
   // ← handleCsSelect ends here with }; at column 2



  // ---------------- Fetch subdepartments on department change ----------------
  useEffect(() => {
    if (!selectedDepartment) return setSubDepartments([]);
    fetch(`/api/proxy/subdepartment/${selectedDepartment.dept_id}`)
      .then(res => res.json())
      .then(data => setSubDepartments(data))
      .catch(err => console.error("Error fetching subdepartments:", err));
  }, [selectedDepartment]);

  // ---------------- Finalize baseline AFTER all state is settled ----------------
  useEffect(() => {
    if (!pendingBaselineRef.current) return;
    initialRef.current = JSON.stringify({
      poHeader:           pendingBaselineRef.current.poHeader,
      poItems:            pendingBaselineRef.current.poItems,
      selectedSupplier:   pendingBaselineRef.current.selectedSupplier,
      selectedDepartment: pendingBaselineRef.current.selectedDepartment,
      selectedTerms:      pendingBaselineRef.current.selectedTerms,
    });
    setLocalDirty(false);
    pendingBaselineRef.current = null;
  }, [
    poHeader, poItems, selectedSupplier,
    selectedDepartment, selectedSubDepartment, selectedTerms,
  ]);

  // -------- CREATE MODE BASELINE --------
  useEffect(() => {
    if (mode !== "create") return;
    if (initialRef.current) return;
    initialRef.current = JSON.stringify({
      poHeader, poItems, selectedSupplier,
      selectedDepartment, selectedSubDepartment, selectedTerms,
    });
    setLocalDirty(false);
  }, [mode]);

  // -------- DIRTY COMPARISON --------
  useEffect(() => {
    if (!initialRef.current) return;
    const current = JSON.stringify({
      poHeader, poItems, selectedSupplier,
      selectedDepartment, selectedTerms,
    });
    setLocalDirty(current !== initialRef.current);
  }, [
    poHeader, poItems, selectedSupplier,
    selectedDepartment, selectedSubDepartment, selectedTerms,
  ]);

  // ---------------- Handlers ----------------
  const handleNewPO = () => {
    setPoHeader(initialPoHeader);
    setPoItems(initialPoItems);
    setOtherCharges([]);          // ── NEW: reset charges on new PO
    setSelectedSupplier(null);
    setSelectedTerms([]);
    setSelectedDepartment(null);
    setDirty(false);
    setFormDisabled(false);
    setSelectedCsId("");
  };




  // ---------------- Validate ----------------
  const validateHeaderCompleteness = () => {
    for (const field of REQUIRED_FIELDS) {
      if (isEmpty(poHeader[field as keyof typeof poHeader])) {
        toast({ title: `${field.replace(/_/g, " ")} is required` });
        return false;
      }
    }
    for (const field of NA_ALLOWED_FIELDS) {
      const value = poHeader[field as keyof typeof poHeader];
      if (isEmpty(value)) {
        toast({ title: `${field.replace(/_/g, " ")} is required (enter NA if not applicable)` });
        return false;
      }
    }
    if (poHeader.advance_required === true) {
      if (isEmpty(poHeader.advance_percent)) {
        toast({ title: "Advance Percentage is required" });
        return false;
      }
    }
    return true;
  };

  const validateApproverLogic = () => {
    const hasPreparedBy      = isFilled(poHeader.prepared_by);
    const hasReviewedBy      = isFilled(poHeader.review_by);
    const hasPreparedReview  = isFilled(poHeader.prepared_review);

    if (!hasPreparedReview && !hasPreparedBy && !hasReviewedBy) {
      toast({
        title: "Approval details required",
        description: "Fill either Prepared & Reviewed OR Prepared By and Reviewed By",
      });
      return false;
    }
    if (hasPreparedReview && hasPreparedBy && hasReviewedBy) {
      toast({
        title: "Invalid approval selection",
        description: "Use either Prepared & Reviewed OR Prepared By and Reviewed By",
      });
      return false;
    }
    if ((hasPreparedBy && !hasReviewedBy) || (!hasPreparedBy && hasReviewedBy)) {
      toast({
        title: "Incomplete approval",
        description: "Both Prepared By and Reviewed By must be filled",
      });
      return false;
    }
    return true;
  };

// REPLACE your validateItems function with this:

  const validateItems = () => {
    if (!Array.isArray(poItems) || poItems.length === 0) {
      toast({ title: "At least one item is required" });
      return false;
    }
    for (let i = 0; i < poItems.length; i++) {
      const item = poItems[i];

      // item_code check — skip for CS-imported rows (they don't have item_code)
      if (!item._from_cs && !item.item_code) {
        toast({ title: `Item missing at row ${i + 1}` });
        return false;
      }

      // item_name must exist for CS rows (since item_code is 0)
      if (item._from_cs && !item.item_name?.trim()) {
        toast({ title: `Item name missing at row ${i + 1}` });
        return false;
      }

      if (Number(item.qty) <= 0) {
        toast({ title: `Quantity must be greater than zero (row ${i + 1})` });
        return false;
      }
      if (Number(item.rate) <= 0) {
        toast({ title: `Rate must be greater than zero (row ${i + 1})` });
        return false;
      }
if (!item.unit || item.unit.trim() === "") {
  toast({ title: `UOM is required (row ${i + 1})` });
  return false;
}
    }


    return true;
  };

  const validateTerms = () => {
    if (!Array.isArray(selectedTerms) || selectedTerms.length === 0) {
      toast({ title: "At least one Terms & Condition is required" });
      return false;
    }
    return true;
  };

  // ── NEW: validate other charges (no half-filled rows) ─────────────────────
  const validateOtherCharges = () => {
    for (let i = 0; i < otherCharges.length; i++) {
      const oc = otherCharges[i];
      if (!oc.item_name?.trim()) {
        toast({ title: `Other Charges row ${i + 1}: please select a charge item` });
        return false;
      }
      if (!oc.amount || Number(oc.amount) <= 0) {
        toast({ title: `Other Charges row ${i + 1}: amount must be greater than 0` });
        return false;
      }
    }
    return true;
  };
  // ───────────────────────────────────────────────────────────────────────────

  // ---------------- Save Handler ----------------
  const handleSave = async () => {
    try {
      if (!poHeader.po_type) {
        toast({ title: "PO Type is required" });
        return;
      }
      if (!selectedSupplier) {
        toast({ title: "Supplier is required" });
        return;
      }
      if (!selectedDepartment || !selectedSubDepartment) {
        toast({ title: "Department & Sub-department required" });
        return;
      }
      if (
        !validateHeaderCompleteness() ||
        !validateApproverLogic()       ||
        !validateItems()               ||
        !validateTerms()               ||
        !validateOtherCharges()         // ── NEW
      ) {
        return;
      }

      setFormDisabled(true);
      setLoading(true);



      const updatedStatus =
        poHeader.released_by && docsUploaded
          ? "Approved"
          : poHeader.status || "Draft";

      const payload = {
        header: {
          ...poHeader,
          po_type:    poHeader.po_type,
          status:     updatedStatus,
          dept_id:    Number(poHeader.dept_id    || selectedDepartment?.dept_id    || 0),
          subdept_id: Number(poHeader.subdept_id || selectedSubDepartment?.subdept_id || 0),
          sub_total:   subtotal,
          gst_total:   totalGST,
          grand_total: grandTotal,
        },
        items: poItems,
        terms: selectedTerms,

        // ── NEW: include other_charges in payload ───────────────────────────
        other_charges: otherCharges
          .filter(oc => oc.item_name?.trim() && Number(oc.amount) > 0)
          .map(oc => ({
            item_code:   oc.item_code  || null,
            item_name:   oc.item_name.trim(),
            amount:      Number(oc.amount),
            is_discount: Boolean(oc.is_discount),
          })),
        // ───────────────────────────────────────────────────────────────────
      };

      const url =
        mode === "edit"
          ? `${API_BASE_URL}/api/purchase-orders/${poHeader.id}`
          : `${API_BASE_URL}/api/po`;

      const res = await fetch(url, {
        method:      mode === "edit" ? "PUT" : "POST",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify(payload),
        credentials: "include",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Something went wrong.");
        setFormDisabled(false);
        return;
      }

      const data = await res.json();

      /* Document upload after save */
      if (updatedStatus === "Approved" && Object.keys(pendingDocs).length > 0) {
        const formData = new FormData();
        Object.entries(pendingDocs).forEach(([key, file]) => formData.append(key, file));
        const docRes = await fetch(
          `${API_BASE_URL}/api/purchase-orders/${data.poId}/documents`,
          { method: "POST", body: formData, credentials: "include" }
        );
        if (!docRes.ok) {
          alert("PO saved, but document upload failed");
          return;
        }
        setPendingDocs({});
        setDocsUploaded(true);
      }

      setPoHeader((prev) => ({
        ...prev,
        id:     data.poId,
        po_no:  data.po_no,
        status: updatedStatus,
      }));
      setSavedHeader((prev) => ({ ...prev, id: data.poId, po_no: data.po_no }));

      // Link CS to saved PO so it won't appear in dropdown again
      if (selectedCsId) {
        await fetch(`/api/proxy/cs/${selectedCsId}/link-po`, {
          method:      "PATCH",
          headers:     { "Content-Type": "application/json" },
          body:        JSON.stringify({ po_id: data.poId }),
          credentials: "include",
        });
        setSelectedCsId("");
      }



      setDirty(false);
      setFormDisabled(true);

      initialRef.current = JSON.stringify({
        poHeader, poItems, selectedSupplier, selectedDepartment, selectedTerms,
      });
      setLocalDirty(false);

      const toastId = toast({
        title: `✅ PO ${data.po_no} saved successfully!`,
        description: (
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={() => {
                if (toastId) dismissToast(toastId);
                const url = `/purchase/report/${data.poId}`;
                if (mode === "edit" || isCopy) router.replace(url);
                else router.replace(url);
              }}
            >
              View Report
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (toastId) dismissToast(toastId);
                if (mode === "edit")  router.replace("/purchase/modify");
                else if (isCopy)      router.replace("/purchase/importPO");
                else { handleNewPO(); setFormDisabled(false); }
              }}
            >
              Back
            </Button>
          </div>
        ),
        duration: null,
      });
    } catch (err) {
      console.error("❌ Failed to save PO:", err);
      toast({ title: "Failed to save PO", description: `${err}` });
      setFormDisabled(false);
    } finally {
      setLoading(false);
    }
  };

  // Cancel handler
  const handleCancelPO = () => {
    if (dirty) {
      const ok = window.confirm("You may have unsaved changes. Discard them?");
      if (!ok) return;
    }
    if (mode === "edit")        router.replace("/purchase/modify");
    else if (isCopy)            router.replace("/purchase/importPO");
    else {
      setPoHeader(initialPoHeader);
      setPoItems(initialPoItems);
      setOtherCharges([]);        // ── NEW: reset on cancel
      setSelectedSupplier(null);
      setSelectedTerms([]);
      setSelectedDepartment(null);
      setSelectedCsId("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUploadCancel = () => {
    setPendingDocs({});
    setDocsUploaded(false);
    setShowUploadModal(false);
    setPoHeader(prev => ({ ...prev, released_by: "" }));
  };

  // ---------------- Render ----------------
  return (
    <div className="bg-gray-200 rounded-xl shadow p-2 mt-0">

      {/* Header */}
      {mode === "create" && (
        <h2 className="text-lg font-semibold mb-0 text-white text-center bg-blue-600 py-1 rounded-md shadow">
          Create Purchase Order
        </h2>
      )}
      {mode === "edit" && (
        <h2 className="text-lg font-semibold mb-1 text-white text-center bg-blue-600 py-1 rounded-md shadow">
          Edit Purchase Orders
        </h2>
      )}

      {/* Form Fields */}
      <GeneralInfoFields
        poHeader={poHeader}
        setPoHeader={setPoHeader}
        suppliers={suppliers}
        selectedSupplier={selectedSupplier}
        setSelectedSupplier={setSelectedSupplier}
        department={department}
        subDepartments={subDepartments}
        selectedDepartment={selectedDepartment}
        setSelectedDepartment={setSelectedDepartment}
        setSelectedSubDepartment={setSelectedSubDepartment}
        disabled={formDisabled}
        mode={mode}
        csList={csList}
        selectedCsId={selectedCsId}
        onCsSelect={handleCsSelect}
      />
      <SupplierFields
        suppliers={suppliers as SupplierType[]}
        selectedSupplier={selectedSupplier}
        setSelectedSupplier={setSelectedSupplier}
        poHeader={poHeader}
        setPoHeader={setPoHeader}
      />

      {/* ── ItemsTable now receives otherCharges props ── */}
      <ItemsTable
        poItems={poItems}
        setPoItems={setPoItems}
        items={items}
        disabled={formDisabled}
        otherCharges={otherCharges}
        setOtherCharges={setOtherCharges}
        chargeItems={chargeItems}
onTotalsChange={(subtotal, gst, total) => {
    setSubtotal(subtotal);
    setTotalGST(gst);
    setGrandTotal(total);
  }}
      />

      <TermsConditionsTable
        value={selectedTerms}
        onChange={setSelectedTerms}
        terms={terms}
        disabled={formDisabled}
      />

      <ApproverFields
        poHeader={poHeader}
        setPoHeader={setPoHeader}
        approvers={approvers}
        disabled={formDisabled}
        savedHeader={savedHeader ?? undefined}
        mode={mode}
        onReleasedSelected={() => {
          if (!docsUploaded) setShowUploadModal(true);
        }}
      />

      {/* Buttons */}
      <div className="mt-0 flex justify-center space-x-6">
        <Button
          className="w-20"
          onClick={handleSave}
          type="button"
          variant="default"
          size="md"
          disabled={
            loading ||
            formDisabled ||
            (poHeader.status === "Approved" && !docsUploaded)
          }
        >
          {loading ? "Saving..." : "Save"}
        </Button>

        <Button
          className="w-20"
          onClick={handleCancelPO}
          type="button"
          variant="destructive"
          size="md"
          disabled={formDisabled}
        >
          Cancel
        </Button>
      </div>

      {/* Document Upload Modal */}
      {showUploadModal && poHeader.id && (
        <DocumentUploadModal
          poId={Number(poHeader.id)}
          approvedBy={poHeader.approved_by ?? ""}
          releasedBy={poHeader.released_by  ?? ""}
          onConfirm={(files) => {
            setPendingDocs(files);
            setDocsUploaded(true);
            setShowUploadModal(false);
          }}
          onClose={handleUploadCancel}
        />
      )}

    </div>
  );
}
