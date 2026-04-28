"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { API_BASE_URL } from "@/lib/api";
import { parseIndianDate } from "@/utils/dateUtils";

interface InvoiceDetail {
  grn_detail_ids: string;
  grn_ids_for_item: string;
  grn_detail_qtys: string;
  grn_detail_maxqtys: string;
  item_name: string;
  description: string;
  uom: string;
  quantity: string;
  rate: string;
  amount: string;
  discount: string;        // smart field: ≤100 = %, >100 = flat amount
  discount_percent: string;  // resolved %
  discount_amount: string;   // resolved flat amount
  taxable_amount: string;    // amount - discount_amount
  gst_percent: string;
  gst_amount: string;        // taxable_amount × gst% / 100
  remarks: string;
  po_sort_order: number;
  from_grn: boolean;
}

const emptyDetail = (): InvoiceDetail => ({
  grn_detail_ids: "", grn_ids_for_item: "", grn_detail_qtys: "", grn_detail_maxqtys: "",
  item_name: "", description: "", uom: "", quantity: "", rate: "", amount: "",
  discount: "", discount_percent: "0", discount_amount: "0", taxable_amount: "",
  gst_percent: "", gst_amount: "", remarks: "", po_sort_order: 9999, from_grn: false,
});

// Resolve smart discount field: ≤100 = %, >100 = flat amount
// Returns { discount_percent, discount_amount, taxable_amount }
const resolveDiscount = (discountVal: string, amount: string) => {
  const d = Number(discountVal) || 0;
  const amt = Number(amount) || 0;
  if (d === 0) {
    return { discount_percent: "0", discount_amount: "0", taxable_amount: amt.toFixed(2) };
  }
  if (d <= 100) {
    // treat as %
    const disc_amt = parseFloat(((amt * d) / 100).toFixed(2));
    return {
      discount_percent: String(d),
      discount_amount: disc_amt.toFixed(2),
      taxable_amount: (amt - disc_amt).toFixed(2),
    };
  }
  // treat as flat amount
  const disc_amt = Math.min(d, amt); // can't discount more than amount
  return {
    discount_percent: "0",
    discount_amount: disc_amt.toFixed(2),
    taxable_amount: (amt - disc_amt).toFixed(2),
  };
};

export default function InvoiceFormPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.id as string | undefined;
  const isEdit = !!invoiceId;

  const { user, loading: authLoading } = useAuth();
  useAuthGuard();

  const navAllowedRef = useRef<boolean | null>(null);
  const [navChecked, setNavChecked] = useState(false);

  useEffect(() => {
    if (navAllowedRef.current !== null) return;
    const flag = sessionStorage.getItem("from_invoice_list");
    if (flag === "true") {
      sessionStorage.removeItem("from_invoice_list");
      navAllowedRef.current = true;
      setNavChecked(true);
    } else {
      navAllowedRef.current = false;
      router.replace("/stores/invoice");
    }
  }, []);

  const [invoice_number, setInvoiceNumber] = useState("");
  const [invoice_date, setInvoiceDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [bill_no, setBillNo] = useState("");
  const [bill_date, setBillDate] = useState("");
  const [supplier_id, setSupplierId] = useState<number | "">("");
  const [supplier_locked, setSupplierLocked] = useState(false);
  const [po_id, setPoId] = useState<number | "">("");
  const [dept_id, setDeptId] = useState<number | "">("");
  const [subdept_id, setSubdeptId] = useState<number | "">("");
  const [dept_name_display, setDeptNameDisplay] = useState("");
  const [subdept_name_display, setSubdeptNameDisplay] = useState("");
  const [remarks, setRemarks] = useState("");
  const [otherCharges, setOtherCharges] = useState<{
    item_code: string; item_name: string; description?: string, amount: string; is_discount: boolean;
  }[]>([]);

  const [selectedGrns, setSelectedGrns] = useState<any[]>([]);
  const [grnSelectKey, setGrnSelectKey] = useState(0);
  const [details, setDetails] = useState<InvoiceDetail[]>([]);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [availableGrns, setAvailableGrns] = useState<any[]>([]);
  const [poGrandTotal, setPoGrandTotal] = useState<number>(0);
  const [po_number, setPoNumber] = useState("");
  const [chargeItems, setChargeItems] = useState<any[]>([]);

  // Totals — use taxable_amount as base for sub_total
  const sub_total    = details.reduce((s, d) => s + (Number(d.amount)         || 0), 0);
  const disc_total   = details.reduce((s, d) => s + (Number(d.discount_amount)|| 0), 0);
  const taxable_total= details.reduce((s, d) => s + (Number(d.taxable_amount) || 0), 0);
  const gst_total    = details.reduce((s, d) => s + (Number(d.gst_amount)     || 0), 0);
  const charges_addition  = otherCharges.filter(oc => !oc.is_discount).reduce((s, oc) => s + (Number(oc.amount) || 0), 0);
  const charges_deduction = otherCharges.filter(oc =>  oc.is_discount).reduce((s, oc) => s + (Number(oc.amount) || 0), 0);
  const grand_total  = taxable_total + gst_total + charges_addition - charges_deduction;


  //--- CHANGE 1: Add state (after `const [chargeItems, setChargeItems] = useState...`) ---

  const [masItems,       setMasItems]       = useState<any[]>([]);
  const [itemSearchIdx,  setItemSearchIdx]  = useState<number | null>(null);
  const [itemSearchText, setItemSearchText] = useState("");



  useEffect(() => {
    if (!navChecked || authLoading || !user) return;
    fetchSuppliers();
    fetchChargeItems();
    if (!isEdit) fetchInvoiceNumber();
    if (isEdit && invoiceId) fetchInvoice(invoiceId);
  }, [navChecked, authLoading, user]);

  useEffect(() => {
    if (!supplier_id) { setAvailableGrns([]); return; }
    fetchGrnsForSupplier(supplier_id as number);
  }, [supplier_id]);

useEffect(() => {
  if (itemSearchIdx !== null) {
    console.log("chargeItems sample:", chargeItems[0]);
  }
}, [itemSearchIdx, chargeItems]);


  const fetchSuppliers = async () => {
    const res = await fetch(`/api/proxy/suppliers`);
    if (res.ok) setSuppliers(await res.json());
  };

  const fetchInvoiceNumber = async () => {
    const res = await fetch(`/api/proxy/invoice/new-number`);
    if (res.ok) setInvoiceNumber((await res.json()).invoice_number);
  };

  const fetchGrnsForSupplier = async (supId: number) => {
    const res = await fetch(`/api/proxy/invoice/grns-by-supplier/${supId}`);
    if (res.ok) setAvailableGrns(await res.json());
  };

  const fetchChargeItems = async () => {
    const [chargeRes, itemRes] = await Promise.all([
      fetch(`/api/proxy/invoice/charge-items`),
      fetch(`/api/proxy/items`),
    ]);
    if (chargeRes.ok) setChargeItems(await chargeRes.json());
    if (itemRes.ok)   setMasItems(await itemRes.json());
  };

  const fetchInvoice = async (id: string) => {
    const res = await fetch(`/api/proxy/invoice/${id}`);
    if (res.status === 401) { router.replace("/session-expired"); return; }
    if (!res.ok) { router.replace("/stores/invoice"); return; }
    const data = await res.json();
    const h = data.header;
    setInvoiceNumber(h.invoice_number);
    setInvoiceDate(parseIndianDate(h.invoice_date) || "");
    setBillNo(h.bill_no || "");
    setBillDate(parseIndianDate(h.bill_date) || "");
    setSupplierId(h.supplier_id);
    setSupplierLocked(true);
    setPoId(h.po_id || "");
    setDeptId(h.dept_id || "");
    setSubdeptId(h.subdept_id || "");
    setDeptNameDisplay(h.dept_name || "");
    setSubdeptNameDisplay(h.subdept_name || "");
    setOtherCharges(
      (data.other_charges || []).map((oc: any) => {
        const nm = (oc.item_name || "").toLowerCase();
        return {
          item_code:   String(oc.item_code || ""),
          item_name:   oc.item_name || "",
          amount:      String(oc.amount || ""),
          is_discount: oc.is_discount === true || oc.is_discount === "true"
            || nm.includes("discount") || nm.includes("buyback"),
        };
      })
    );
    setRemarks(h.remarks || "");
    setDetails(data.details.map((d: any) => {
      const amount          = String(d.amount || "");
      const discount_percent= String(d.discount_percent || "0");
      const discount_amount = String(d.discount_amount  || "0");
      const taxable_amount  = String(d.taxable_amount   || d.amount || "");
      // Reconstruct smart discount display value
      const discNum = Number(discount_percent) > 0
        ? discount_percent
        : Number(discount_amount) > 0
          ? discount_amount
          : "";
      return {
        grn_detail_ids:    d.grn_detail_ids || (d.grn_detail_id ? String(d.grn_detail_id) : ""),
        grn_ids_for_item:  d.grn_ids_for_item || (d.grn_id ? String(d.grn_id) : ""),
        grn_detail_qtys:   d.grn_detail_qtys || "",
        grn_detail_maxqtys:d.grn_detail_maxqtys || d.grn_detail_qtys || "",
        item_name:         d.item_name || "",
        description:       d.description || "",
        uom:               d.uom || "",
        quantity:          String(d.quantity || ""),
        rate:              String(d.rate || ""),
        amount,
        discount:          discNum,
        discount_percent,
        discount_amount,
        taxable_amount,
        gst_percent:       String(d.gst_percent || ""),
        gst_amount:        String(d.gst_amount  || ""),
        remarks:           d.remarks || "",
        po_sort_order:     d.po_sort_order || 9999,
        from_grn:          !!(d.grn_ids_for_item || d.grn_id),
      };
    }));
    if (h.grn_ids?.length) {
      const grnData = await Promise.all(
        h.grn_ids.map((gid: number) =>
          fetch(`/api/proxy/grn/${gid}`)
            .then(r => r.ok ? r.json() : null)
        )
      );
      setSelectedGrns(grnData.filter(Boolean).map((g: any) => g.header));
    }
  };

  const [grnLoading, setGrnLoading] = useState(false);

  // Apply PO disc_amt to a detail row
  const applyPoDiscount = (d: InvoiceDetail, poItem: any): InvoiceDetail => {
    const poDiscAmt = Number(poItem.disc_amt) || 0;
    if (poDiscAmt <= 0) return d;
    const amount = Number(d.amount) || 0;
    if (amount <= 0) return d;
    // Use PO disc_amt directly as discount_amount
    const disc_amt = Math.min(poDiscAmt, amount);
    const taxable  = parseFloat((amount - disc_amt).toFixed(2));
    const gst_pct  = Number(d.gst_percent) || 0;
    const gst_amt  = parseFloat((taxable * gst_pct / 100).toFixed(2));
    return {
      ...d,
      discount:         disc_amt.toFixed(2),
      discount_percent: "0",
      discount_amount:  disc_amt.toFixed(2),
      taxable_amount:   taxable.toFixed(2),
      gst_amount:       gst_amt.toFixed(2),
    };
  };

  const handleAddGrn = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    setGrnSelectKey(k => k + 1);
    setGrnLoading(true);
    try {
      const valStr = String(val);
      if (selectedGrns.find(g => String(g.id) === valStr)) return;

      const res = await fetch(`/api/proxy/invoice/grn-balance/${valStr}`);
      if (!res.ok) { alert("Failed to load GRN items"); return; }
      const balanceItems: any[] = await res.json();

      const grnInfo = availableGrns.find(g => String(g.id) === valStr);
      if (!grnInfo) { alert("GRN not found in list"); return; }

      if (!supplier_locked) setSupplierLocked(true);

      if (selectedGrns.length === 0) {
        if (grnInfo.dept_id)    { setDeptId(grnInfo.dept_id);       setDeptNameDisplay(grnInfo.dept_name || String(grnInfo.dept_id)); }
        if (grnInfo.subdept_id) { setSubdeptId(grnInfo.subdept_id); setSubdeptNameDisplay(grnInfo.subdept_name || String(grnInfo.subdept_id)); }
        if (grnInfo.po_id)      { setPoId(grnInfo.po_id); }
      }

      setSelectedGrns(prev => [...prev, grnInfo]);

      if (balanceItems.length === 0) {
        alert(`GRN ${grnInfo.grn_number} has no items with remaining balance.`);
        return;
      }

      const activePo = po_id || grnInfo.po_id;
      let poItems: any[] = [];
      if (activePo) {
        const poRes = await fetch(`/api/proxy/invoice/po-rates/${activePo}`);
        if (poRes.ok) {
          const poData = await poRes.json();
          poItems = poData.items || [];
          setPoGrandTotal(Number(poData.po_grand_total) || 0);
          setPoNumber(poData.po_number || String(activePo));
          if (!po_id) setPoId(activePo);
        }
      }

      setDetails(prev => {
        const updated = [...prev];

        for (const item of balanceItems) {
          const existingIdx = updated.findIndex(
            d => d.from_grn && d.item_name.trim().toLowerCase() === item.item_name.trim().toLowerCase()
          );
          if (existingIdx >= 0) {
            const existing = updated[existingIdx];
            const newQty = (Number(existing.quantity) || 0) + Number(item.balance_qty);
            updated[existingIdx] = {
              ...existing,
              quantity:            String(newQty),
              grn_detail_ids:      existing.grn_detail_ids      ? existing.grn_detail_ids      + "," + String(item.grn_detail_id) : String(item.grn_detail_id),
              grn_ids_for_item:    existing.grn_ids_for_item    ? existing.grn_ids_for_item    + "," + String(item.grn_id)        : String(item.grn_id),
              grn_detail_qtys:     existing.grn_detail_qtys     ? existing.grn_detail_qtys     + "," + String(item.balance_qty)   : String(item.balance_qty),
              grn_detail_maxqtys:  existing.grn_detail_maxqtys  ? existing.grn_detail_maxqtys  + "," + String(item.balance_qty)   : String(item.balance_qty),
            };
          } else {
            updated.push({
              grn_detail_ids:    String(item.grn_detail_id),
              grn_ids_for_item:  String(item.grn_id),
              grn_detail_qtys:   String(item.balance_qty),
              grn_detail_maxqtys:String(item.balance_qty),
              item_name:         item.item_name,
              description:       item.description,
              uom:               item.uom || "",
              quantity:          String(item.balance_qty),
              rate: "", amount: "",
              discount: "", discount_percent: "0", discount_amount: "0", taxable_amount: "",
              gst_percent: "", gst_amount: "",
              remarks: "", po_sort_order: 9999, from_grn: true,
            });
          }
        }

        // Apply PO rates + disc_amt in one pass
        const withRates = updated.map(d => {
          const poItem = poItems.find(
            p => p.item_name.trim().toLowerCase() === d.item_name.trim().toLowerCase()
          );
          if (!poItem) return d;
          const rate        = String(poItem.rate || "");
          const amount      = (Number(d.quantity) * Number(rate)).toFixed(2);
          const gst_percent = String(poItem.gst_per || "0");
          // Compute gst on taxable (after discount) — will be revised in applyPoDiscount
          const gst_amount  = ((Number(amount) * Number(gst_percent)) / 100).toFixed(2);
          const withRate: InvoiceDetail = {
            ...d, rate, amount,
            taxable_amount: amount,   // default = no discount
            discount: "", discount_percent: "0", discount_amount: "0",
            gst_percent, gst_amount,
            po_sort_order: Number(poItem.sort_order),
          };
          // Apply PO disc_amt if available
          return applyPoDiscount(withRate, poItem);
        });

        return withRates.sort((a, b) => a.po_sort_order - b.po_sort_order);
      });
    } finally {
      setGrnLoading(false);
    }
  };

  const handleRemoveGrn = async (grnId: number | string) => {
    const grnIdStr = String(grnId);
    setSelectedGrns(prev => prev.filter(g => String(g.id) !== grnIdStr));
    setDetails(prev => {
      const updated: InvoiceDetail[] = [];
      for (const d of prev) {
        if (!d.from_grn) { updated.push(d); continue; }
        const grnIdsList    = (d.grn_ids_for_item  || "").split(",").map(s => s.trim());
        const detailIdsList = (d.grn_detail_ids     || "").split(",").map(s => s.trim());
        const maxQtysList   = (d.grn_detail_maxqtys || "").split(",").map(s => s.trim());
        const curQtysList   = (d.grn_detail_qtys    || "").split(",").map(s => s.trim());
        const grnIdx = grnIdsList.indexOf(grnIdStr);
        if (grnIdx === -1) { updated.push(d); continue; }
        const effectiveMax   = maxQtysList.length > grnIdx && maxQtysList[grnIdx] !== "" ? maxQtysList[grnIdx] : (curQtysList.length > grnIdx ? curQtysList[grnIdx] : "0");
        const contributedMax = Number(effectiveMax) || 0;
        if (grnIdsList.filter(Boolean).length <= 1) continue;
        const newQty        = Math.max(0, (Number(d.quantity) || 0) - contributedMax);
        const newGrnIds     = grnIdsList   .filter((_, i) => i !== grnIdx).join(",");
        const newDetailIds  = detailIdsList.filter((_, i) => i !== grnIdx).join(",");
        const newMaxQtys    = maxQtysList  .filter((_, i) => i !== grnIdx).join(",");
        const newCurQtys    = curQtysList  .filter((_, i) => i !== grnIdx).join(",");
        const remainingMaxes = newMaxQtys.split(",").map(s => Number(s.trim()) || 0);
        const redistributed: number[] = [];
        let rem = newQty;
        for (const max of remainingMaxes) { const alloc = Math.min(max, rem); redistributed.push(alloc); rem = Math.max(0, rem - alloc); }
        const newAmount = (newQty * (Number(d.rate) || 0)).toFixed(2);
        const resolved  = resolveDiscount(d.discount, newAmount);
        const newGst    = ((Number(resolved.taxable_amount) * (Number(d.gst_percent) || 0)) / 100).toFixed(2);
        updated.push({
          ...d,
          quantity:           String(newQty),
          amount:             newAmount,
          ...resolved,
          gst_amount:         newGst,
          grn_ids_for_item:   newGrnIds,
          grn_detail_ids:     newDetailIds,
          grn_detail_maxqtys: newMaxQtys,
          grn_detail_qtys:    redistributed.join(","),
        });
      }
      return updated;
    });
    if (selectedGrns.length <= 1) {
      setSupplierLocked(false); setDeptId(""); setSubdeptId("");
      setPoId(""); setPoNumber(""); setPoGrandTotal(0);
    }
  };

  const applyPoRates = async (poId: number | string) => {
    const res = await fetch(`/api/proxy/invoice/po-rates/${poId}`);
    if (!res.ok) return;
    const data = await res.json();
    const poItems: any[] = data.items || [];
    setPoGrandTotal(Number(data.po_grand_total) || 0);
    if (data.po_number) setPoNumber(data.po_number);
    setDetails(prev => {
      const updated = prev.map(d => {
        const poItem = poItems.find(p => p.item_name.trim().toLowerCase() === d.item_name.trim().toLowerCase());
        if (!poItem) return d;
        const rate       = String(poItem.rate || "");
        const amount     = (Number(d.quantity) * Number(rate)).toFixed(2);
        const gst_percent= String(poItem.gst_per || "0");
        const withRate: InvoiceDetail = {
          ...d, rate, amount, taxable_amount: amount,
          discount: "", discount_percent: "0", discount_amount: "0",
          gst_percent, gst_amount: "0", po_sort_order: Number(poItem.sort_order),
        };
        return applyPoDiscount(withRate, poItem);
      });
      return updated.sort((a, b) => a.po_sort_order - b.po_sort_order);
    });
  };

  const distributeQtySequential = (totalQty: number, maxQtysStr: string): string => {
    const maxQtys = maxQtysStr.split(",").map(s => Number(s.trim()) || 0);
    const allocated: number[] = [];
    let remaining = totalQty;
    for (const max of maxQtys) { const alloc = Math.min(max, remaining); allocated.push(alloc); remaining = Math.max(0, remaining - alloc); }
    return allocated.join(",");
  };

  const updateDetail = (index: number, field: keyof InvoiceDetail, value: string) => {
    setDetails(prev => prev.map((d, i) => {
      if (i !== index) return d;
      const updated = { ...d, [field]: value };

      if (field === "quantity" || field === "rate") {
        const qty    = field === "quantity" ? Number(value) : Number(d.quantity);
        const rate   = field === "rate"     ? Number(value) : Number(d.rate);
        const amount = isNaN(qty * rate) ? "" : (qty * rate).toFixed(2);
        updated.amount = amount;
        const resolved = resolveDiscount(d.discount, amount);
        Object.assign(updated, resolved);
        updated.gst_amount = amount && d.gst_percent
          ? ((Number(resolved.taxable_amount) * (Number(d.gst_percent) || 0)) / 100).toFixed(2)
          : "0.00";
        if (field === "quantity" && d.from_grn && d.grn_detail_maxqtys) {
          updated.grn_detail_qtys = distributeQtySequential(qty, d.grn_detail_maxqtys);
        }
      }

      if (field === "discount") {
        // Smart field: re-resolve discount on change
        const resolved = resolveDiscount(value, d.amount);
        Object.assign(updated, resolved);
        updated.gst_amount = ((Number(resolved.taxable_amount) * (Number(d.gst_percent) || 0)) / 100).toFixed(2);
      }

      if (field === "gst_percent") {
        const taxable = Number(updated.taxable_amount) || Number(updated.amount) || 0;
        updated.gst_amount = ((taxable * (Number(value) || 0)) / 100).toFixed(2);
      }

      return updated;
    }));
  };

  const addRow = () => setDetails(prev => [...prev, emptyDetail()]);
  const removeRow = (index: number) => setDetails(prev => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!supplier_id)   return alert("Select a supplier");
    if (!invoice_date)  return alert("Select invoice date");
    if (!bill_no.trim())return alert("Bill No. is required");
    if (!bill_date)     return alert("Bill Date is required");
    if (selectedGrns.length === 0) return alert("Select at least one GRN");
    if (details.some(d => !d.item_name)) return alert("All rows must have an item name");
    if (details.every(d => !d.quantity || Number(d.quantity) === 0)) return alert("Invoice cannot be saved with all zero quantities");


    if (details.some(d => !d.item_name || !d.quantity || !d.rate)) {
      return alert("All items must have a name, quantity and rate");
    }
    if (details.some(d => Number(d.quantity) <= 0 || Number(d.rate) <= 0)) {
      return alert("Item quantity/rate must be greater than 0");
    }

    for (const d of details) {
      if (!d.from_grn || !d.grn_detail_maxqtys) continue;
      const totalMax   = d.grn_detail_maxqtys.split(",").reduce((sum, s) => sum + (Number(s.trim()) || 0), 0);
      const invoiceQty = Number(d.quantity) || 0;
      if (invoiceQty > totalMax) {
        alert(`"${d.item_name}": Invoice qty (${invoiceQty}) exceeds GRN balance (${totalMax}).\nPlease reduce qty before saving.`);
        return;
      }
    }

    if (po_id && poGrandTotal > 0 && grand_total > poGrandTotal) {
      if (!window.confirm(`⚠️ Invoice total (₹${grand_total.toFixed(2)}) exceeds PO total (₹${poGrandTotal.toFixed(2)}).\n\nProceed anyway?`)) return;
    } else {
      if (!window.confirm("Save this Invoice?")) return;
    }

    setSaving(true);
    try {
      const payload = {
        invoice_date, bill_no: bill_no || null, bill_date: bill_date || null,
        supplier_id,
        grn_ids:    selectedGrns.map(g => g.id),
        po_id:      po_id      || null,
        dept_id:    dept_id    || null,
        subdept_id: subdept_id || null,
        sub_total, gst_total, grand_total,
        other_charges: otherCharges
          .filter(oc => oc.item_name?.trim() && Number(oc.amount) > 0)
          .map(oc => ({ item_code: oc.item_code?.trim() || null, item_name: oc.item_name.trim(), description: oc.description?.trim() || "", amount: Number(oc.amount), is_discount: Boolean(oc.is_discount) })),
        remarks: remarks || null,
        details: details.map(d => {
          const effectiveMax    = (d.grn_detail_maxqtys && d.grn_detail_maxqtys !== "") ? d.grn_detail_maxqtys : (d.grn_detail_qtys || "");
          let finalDetailQtys   = d.grn_detail_qtys || null;
          if (d.from_grn && effectiveMax && d.quantity) {
            const maxQtys = effectiveMax.split(",").map(s => Number(s.trim()) || 0);
            const allocated: number[] = [];
            let remaining = Number(d.quantity) || 0;
            for (const max of maxQtys) { const alloc = Math.min(max, remaining); allocated.push(alloc); remaining = Math.max(0, remaining - alloc); }
            finalDetailQtys = allocated.join(",");
          }
          return {
            grn_detail_ids:    d.grn_detail_ids    || null,
            grn_ids_for_item:  d.grn_ids_for_item  || null,
            grn_detail_qtys:   finalDetailQtys,
            grn_detail_maxqtys:effectiveMax         || null,
            item_name:         d.item_name,
            description:       d.description,
            uom:               d.uom                || null,
            quantity:          Number(d.quantity)   || 0,
            rate:              Number(d.rate)        || 0,
            amount:            Number(d.amount)      || 0,
            discount_percent:  Number(d.discount_percent) || 0,   // ← new
            discount_amount:   Number(d.discount_amount)  || 0,   // ← new
            taxable_amount:    Number(d.taxable_amount)   || Number(d.amount) || 0,  // ← new
            gst_percent:       Number(d.gst_percent) || 0,
            gst_amount:        Number(d.gst_amount)  || 0,
            remarks:           d.remarks             || null,
          };
        }),
      };

      const res = await fetch(
        isEdit ? `${API_BASE_URL}/api/invoice/${invoiceId}` : `${API_BASE_URL}/api/invoice`,
        { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) }
      );
      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (!res.ok) { const e = await res.json(); alert(e.error || "Save failed"); return; }
      alert(`Invoice ${isEdit ? "updated" : "created"} successfully`);
      sessionStorage.setItem("from_invoice_list", "true");
      router.push("/stores/invoice");
    } catch (err) {
      console.error("Save invoice error:", err);
      alert("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (!navChecked || authLoading || !user) return <div className="p-4">Loading...</div>;

  const unselectedGrns  = availableGrns.filter(g => !selectedGrns.find(s => String(s.id) === String(g.id)));
  const hasBadCharge    = otherCharges.some(oc => !oc.item_name?.trim() || !oc.amount || Number(oc.amount) <= 0);
  const hasAnyDiscount  = details.some(d => Number(d.discount_amount) > 0);

  return (
    <div className="p-4 bg-gray-100 rounded-xl shadow max-w-6xl mx-auto">
      <h2 className="text-lg font-semibold text-white text-center bg-blue-600 py-2 rounded-md shadow mb-4">
        {isEdit ? "Edit Invoice" : "Create Invoice"}
      </h2>

      {/* Header */}
      <div className="bg-white rounded-md shadow p-4 mb-4 grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
          <input value={invoice_number} readOnly className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date *</label>
          <input type="date" value={invoice_date} onChange={e => setInvoiceDate(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
          <select value={supplier_id}
            onChange={e => { setSupplierId(Number(e.target.value)); setSelectedGrns([]); setDetails([]); }}
            disabled={supplier_locked}
            className={`w-full border rounded px-3 py-2 ${supplier_locked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}>
            <option value="">-- Select Supplier --</option>
            {suppliers.map(s => <option key={s.sup_id} value={s.sup_id}>{s.sup_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bill No *</label>
          <input value={bill_no} onChange={e => setBillNo(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Supplier's invoice number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bill Date *</label>
          <input type="date" value={bill_date} onChange={e => setBillDate(e.target.value)} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PO Reference</label>
          <input value={po_number || (po_id ? String(po_id) : "")} readOnly placeholder="Auto-filled from GRN" className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <input value={dept_name_display || ""} readOnly className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sub Department</label>
          <input value={subdept_name_display || ""} readOnly className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
          <input value={remarks} onChange={e => setRemarks(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Optional remarks" />
        </div>
      </div>

      {/* GRN Multi-Select */}
      <div className="bg-white rounded-md shadow p-4 mb-4">
        <h3 className="font-semibold text-gray-700 mb-3">GRN Selection *</h3>
        <div className="flex gap-3 items-center mb-3">
          <select key={grnSelectKey} defaultValue="" onChange={handleAddGrn}
            disabled={!supplier_id || grnLoading}
            className={`flex-1 border rounded px-3 py-2 ${(!supplier_id || grnLoading) ? "bg-gray-100 cursor-not-allowed" : ""}`}>
            <option value="" disabled>
              {grnLoading ? "Loading..." : supplier_id ? "Select GRN to add" : "Select supplier first"}
            </option>
            {unselectedGrns.map(g => (
              <option key={g.id} value={String(g.id)}>
                {g.grn_number} — {g.grn_date?.split("T")[0]} — {g.dept_name || "No Dept"}
              </option>
            ))}
          </select>
          {grnLoading && <span className="text-sm text-blue-500">Loading GRN items...</span>}
        </div>
        {selectedGrns.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedGrns.map(g => (
              <span key={g.id} className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                {g.grn_number}
                <button onClick={() => handleRemoveGrn(g.id)} className="text-blue-500 hover:text-red-600 font-bold text-base leading-none">×</button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No GRNs selected yet.</p>
        )}
      </div>

      {/* Details Table */}
      <div className="bg-white rounded-md shadow p-4 mb-4 overflow-x-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-gray-700">Invoice Items</h3>
          <button onClick={addRow} className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">+ Add Row</button>
        </div>
        <table className="w-full border-collapse text-sm min-w-[1080px]">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-2 text-left">Item Name</th>
              <th className="border px-2 py-2 text-left">Description</th>
              <th className="border px-2 py-2 w-16">GST%</th>
              <th className="border px-2 py-2 w-20">Qty</th>
              <th className="border px-2 py-2 w-16">UOM</th>
              <th className="border px-2 py-2 w-24">Rate</th>
              <th className="border px-2 py-2 w-24">Amount</th>
              {/* Discount column — always shown so user can enter it */}
              <th className="border px-2 py-2 w-24 text-red-600" title="Enter % (≤100) or flat amount (>100). Auto-filled from PO if available.">
                Disc (% or ₹)
              </th>
              {hasAnyDiscount && <th className="border px-2 py-2 w-24">Taxable</th>}
              <th className="border px-2 py-2 w-24">GST Amt</th>
              <th className="border px-2 py-2">Remarks</th>
              <th className="border px-2 py-2 w-8">×</th>
            </tr>
          </thead>
          <tbody>
            {details.length === 0 ? (
              <tr><td colSpan={hasAnyDiscount ? 11 : 10} className="text-center py-6 text-gray-400">Select a GRN to populate items</td></tr>
            ) : details.map((d, i) => (
              <tr key={i} className={d.from_grn ? "" : "bg-blue-50"}>
<td className="border px-2 py-1">
  {d.from_grn ? (
    /* GRN row — read-only */
    <input
      value={d.item_name}
      readOnly
      className="w-full border rounded px-2 py-1 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
    />
  ) : (
    /* Manually added row — searchable chargeItems dropdown */
    <div className="relative">
      <input
        type="text"
        value={itemSearchIdx === i ? itemSearchText : d.item_name}
        onFocus={() => {
          setItemSearchIdx(i);
          setItemSearchText(d.item_name);
        }}
        onChange={e => {
          setItemSearchIdx(i);
          setItemSearchText(e.target.value);
        }}
        onBlur={() => setTimeout(() => setItemSearchIdx(null), 160)}
        placeholder="Search charge item…"
        className="w-full border rounded px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
      />

      {itemSearchIdx === i && (


        <div
          className="fixed bg-white border border-gray-300 shadow-xl rounded text-xs overflow-y-auto"
          style={{ zIndex: 9999, maxHeight: 200 }}
          ref={el => {
            if (!el) return;

            const input = el.parentElement?.querySelector("input");
            if (!(input instanceof HTMLElement)) return;

            const r = input.getBoundingClientRect();

            el.style.top = r.bottom + "px";
            el.style.left = r.left + "px";
            el.style.width = r.width + "px";
          }}
        >
          {chargeItems
            .filter(m =>
              m.item_name
                .toLowerCase()
                .includes(itemSearchText.toLowerCase())
            )
            .map(m => (
              <div
                key={m.item_code}
onMouseDown={() => {
  const matched = masItems.find(m2 => m2.item_code === m.item_code);
  setDetails(prev =>
    prev.map((row, ri) =>
      ri === i
        ? {
            ...row,
            item_name: m.item_name,
            uom: matched?.unit ?? matched?.uom ?? row.uom,
          }
        : row
    )
  );
  setItemSearchIdx(null);
  setItemSearchText("");
}}
                className="px-2 py-1.5 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
              >
                {m.item_name}
              </div>

            ))}

          {chargeItems.filter(m =>
            m.item_name
              .toLowerCase()
              .includes(itemSearchText.toLowerCase())
          ).length === 0 && (
            <div className="px-2 py-2 text-gray-400 text-center">
              No items found
            </div>

          )}
        </div>

      )}
    </div>

  )}
</td>


<td className="border px-2 py-1">
<input
  type="text"
  value={d.description || ""}
  onChange={e => updateDetail(i, "description", e.target.value)}
  className="w-full border rounded px-2 py-1 text-sm"
/>
</td>

                <td className="border px-2 py-1">
                  <input type="number" value={d.gst_percent} onChange={e => updateDetail(i, "gst_percent", e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm text-right" min="0" max="100" />
                </td>
                <td className="border px-2 py-1">
                  <input type="number" value={d.quantity} onChange={e => updateDetail(i, "quantity", e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm text-right" min="0" />
                </td>
                <td className="border px-2 py-1">
                  <input value={d.uom} readOnly className="w-full border rounded px-2 py-1 text-sm bg-gray-50 text-center" />
                </td>
                <td className="border px-2 py-1">
                  <input type="number" value={d.rate} onChange={e => updateDetail(i, "rate", e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm text-right" min="0" />
                </td>
                <td className="border px-2 py-1">
                  <input type="number" value={d.amount} readOnly className="w-full border rounded px-2 py-1 text-sm text-right bg-gray-50" />
                </td>
                {/* Smart discount input — editable, pre-filled from PO disc_amt */}
                <td className="border px-2 py-1">
                  <input type="number" value={d.discount}
                    onChange={e => updateDetail(i, "discount", e.target.value)}
                    placeholder={po_id ? "From PO" : "% or ₹"}
                    className={`w-full border rounded px-2 py-1 text-sm text-right ${Number(d.discount_amount) > 0 ? "border-red-300 bg-red-50" : ""}`}
                    min="0" title="Enter % (≤100) or flat amount (>100)" />
                </td>
                {/* Taxable amount — read-only, shown only when any discount exists */}
                {hasAnyDiscount && (
                  <td className="border px-2 py-1">
                    <input value={d.taxable_amount || d.amount} readOnly className="w-full border rounded px-2 py-1 text-sm text-right bg-gray-50" />
                  </td>
                )}
                <td className="border px-2 py-1">
                  <input type="number" value={d.gst_amount} readOnly className="w-full border rounded px-2 py-1 text-sm text-right bg-gray-50" />
                </td>
                <td className="border px-2 py-1">
                  <input value={d.remarks}
                    readOnly={!!d.remarks && d.from_grn && d.remarks.startsWith("Excess qty:")}
                    onChange={e => updateDetail(i, "remarks", e.target.value)}
                    className={`w-full border rounded px-2 py-1 text-sm ${d.remarks?.startsWith("Excess qty:") ? "bg-red-50 text-red-600 font-medium" : ""}`} />
                </td>
                <td className="border px-2 py-1 text-center">
                  <button onClick={() => removeRow(i)} className="text-red-500 hover:text-red-700 font-bold text-lg">×</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-medium text-sm">
            <tr>
              <td className="border px-2 py-2 text-gray-700">
                Total Items: <span className="font-bold text-blue-700">{details.length}</span>
              </td>
              <td className="border px-2 py-2" />
              <td className="border px-2 py-2 text-right text-gray-700 font-semibold">
                {details.reduce((s, d) => s + (Number(d.quantity) || 0), 0).toFixed(3)}
              </td>
              <td className="border px-2 py-2" />
              <td className="border px-2 py-2" />
              <td className="border px-2 py-2 text-right text-gray-700 font-semibold">
                {details.reduce((s, d) => s + (Number(d.amount) || 0), 0).toFixed(2)}
              </td>
              {/* Disc total footer */}
              <td className="border px-2 py-2 text-right text-red-600 font-semibold">
                {disc_total > 0 ? `−${disc_total.toFixed(2)}` : ""}
              </td>
              {hasAnyDiscount && (
                <td className="border px-2 py-2 text-right text-gray-700 font-semibold">
                  {taxable_total.toFixed(2)}
                </td>
              )}
              <td className="border px-2 py-2 text-right text-gray-700 font-semibold">
                {details.reduce((s, d) => s + (Number(d.gst_amount) || 0), 0).toFixed(2)}
              </td>
              <td colSpan={2} className="border px-2 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Totals */}
      <div className="bg-white rounded-md shadow p-4 mb-4 flex justify-end">
        <div className="w-96 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Sub Total (Amount)</span>
            <span className="font-medium">₹{sub_total.toFixed(2)}</span>
          </div>
          {disc_total > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Item Discount (−)</span>
              <span>− ₹{disc_total.toFixed(2)}</span>
            </div>
          )}
          {disc_total > 0 && (
            <div className="flex justify-between text-gray-600 border-t pt-1">
              <span>Taxable Total</span>
              <span className="font-medium">₹{taxable_total.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">GST Total</span>
            <span className="font-medium">₹{gst_total.toFixed(2)}</span>
          </div>

          {/* Other Charges */}
          {otherCharges.map((oc, i) => {
            const rowInvalid = !oc.item_name?.trim() || !oc.amount || Number(oc.amount) <= 0;
            return (
              <div key={i} className={`flex items-center gap-2 py-1 px-2 rounded border ${rowInvalid ? "bg-orange-50 border-orange-300" : oc.is_discount ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}>
                <select value={String(oc.item_code || "")}
                  onChange={e => {
                    const sel = chargeItems.find((c: any) => String(c.item_code) === String(e.target.value));
                    const nm  = (sel?.item_name || "").toLowerCase();
                    const isDisc = nm.includes("discount") || nm.includes("buyback");
                    setOtherCharges(p => p.map((r, ri) => ri === i ? { ...r, item_code: e.target.value, item_name: sel?.item_name || "", is_discount: isDisc } : r));
                  }}
                  className={`flex-1 border rounded px-2 py-1 text-xs min-w-0 ${rowInvalid && !oc.item_name ? "border-orange-400" : ""}`}>
                  <option value="">-- Select Charge --</option>
                  {chargeItems.map((c: any) => {
                    const usedElsewhere = otherCharges.some((r, ri) => ri !== i && ((c.item_code && String(r.item_code) === String(c.item_code)) || r.item_name.trim().toLowerCase() === c.item_name.trim().toLowerCase()));
                    return <option key={c.item_code} value={String(c.item_code)} disabled={usedElsewhere}>{c.item_name}{usedElsewhere ? " (added)" : ""}</option>;
                  })}
                </select>
                <span className={`text-xs font-bold w-5 text-center shrink-0 ${oc.is_discount ? "text-red-600" : "text-blue-600"}`}>{oc.is_discount ? "−" : "+"}</span>
                <input type="number" value={oc.amount} min="0.01" step="0.01"
                  onChange={e => setOtherCharges(p => p.map((r, ri) => ri === i ? { ...r, amount: e.target.value } : r))}
                  placeholder="Amount"
                  className={`w-24 border rounded px-2 py-1 text-right text-xs shrink-0 ${rowInvalid && oc.item_code && (!oc.amount || Number(oc.amount) <= 0) ? "border-orange-400" : ""}`} />
                <button onClick={() => setOtherCharges(p => p.filter((_, ri) => ri !== i))} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0 font-bold">×</button>
              </div>
            );
          })}
          <button onClick={() => setOtherCharges(p => [...p, { item_code: "", item_name: "", amount: "", is_discount: false }])}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium py-0.5">
            <span className="text-lg leading-none font-bold">+</span> Add Other Charge
          </button>
          {charges_addition > 0 && (
            <div className="flex justify-between text-blue-700 text-xs border-t pt-1">
              <span>Other Charges (+)</span><span>+ ₹{charges_addition.toFixed(2)}</span>
            </div>
          )}
          {charges_deduction > 0 && (
            <div className="flex justify-between text-red-600 text-xs">
              <span>Discount / Buyback (−)</span><span>− ₹{charges_deduction.toFixed(2)}</span>
            </div>
          )}
          <div className={`flex justify-between border-t pt-2 font-semibold text-base ${po_id && poGrandTotal > 0 && grand_total > poGrandTotal ? "text-red-600" : ""}`}>
            <span>Grand Total</span><span>₹{grand_total.toFixed(2)}</span>
          </div>
          {po_id && poGrandTotal > 0 && grand_total > poGrandTotal && (
            <p className="text-red-500 text-xs text-right">⚠️ Exceeds PO total of ₹{poGrandTotal.toFixed(2)}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button onClick={() => { sessionStorage.setItem("from_invoice_list", "true"); router.push("/stores/invoice"); }}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">Cancel</button>
        <button onClick={handleSave} disabled={saving || hasBadCharge}
          title={hasBadCharge ? "Fix Other Charges rows before saving" : ""}
          className={`px-6 py-2 text-white rounded disabled:opacity-50 ${hasBadCharge ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}>
          {saving ? "Saving..." : isEdit ? "Update Invoice" : "Save Invoice"}
        </button>
      </div>
    </div>
  );
}
