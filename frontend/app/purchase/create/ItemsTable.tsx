"use client";
import { Plus, Trash2 } from "lucide-react";
import { formatAmount } from "@/utils/numberUtils";
import { Dispatch, SetStateAction, useState, useEffect, useRef } from "react";

const generateRowId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export type PoItem = {
  id: string;
  item_code: number;
  item_name: string;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
  hsn_code: string;
  gst_per: number;
  is_discount_applicable?: boolean;
  disc_amt?: number;          // computed proportional discount — persisted to po_details
  _from_cs?: boolean;
};

export type OtherCharge = {
  id?: number;
  item_code: string;
  item_name: string;
  amount: string;
  is_discount: boolean;
};

export default function ItemsTable({
  poItems,
  setPoItems,
  items,
  disabled,
  otherCharges,
  setOtherCharges,
  chargeItems,
  onTotalsChange,
}: {
  poItems: PoItem[];
  setPoItems: Dispatch<SetStateAction<PoItem[]>>;
  items: any[];
  disabled: boolean;
  otherCharges: OtherCharge[];
  setOtherCharges: Dispatch<SetStateAction<OtherCharge[]>>;
  chargeItems: any[];
  onTotalsChange?: (subtotal: number, gst: number, total: number) => void;
}) {
  const [searchIndex,      setSearchIndex]      = useState<number | null>(null);
  const [searchText,       setSearchText]       = useState<string>("");
  const [focusedAmountIdx, setFocusedAmountIdx] = useState<number | null>(null);

  /* ── ITEM HANDLERS ─────────────────────────────────────────────────────── */
  const handleAddItem = (index: number) => {
    if (disabled) return;
    const newItem: PoItem = {
      id: generateRowId(), item_code: 0, item_name: "", description: "",
      unit: "", qty: 0, rate: 0, amount: 0, hsn_code: "", gst_per: 0,
    };
    const updated = [...poItems];
    updated.splice(index + 1, 0, newItem);
    setPoItems(updated);
  };

  const handleItemChange = (index: number, field: keyof PoItem, value: string | number) => {
    if (disabled) return;
    const updated = [...poItems];
    if (field === "item_code") {
      if (!value) {
        updated[index] = {
          ...updated[index],
          item_code: 0, item_name: "", description: "",
          unit: "", qty: 0, rate: 0, amount: 0, hsn_code: "", gst_per: 0,
        };
        setPoItems(updated); return;
      }
      const selected = items.find((it: any) => it.item_code === value);
      if (!selected) return;
      const qty  = Number(updated[index].qty) || 1;
      const rate = Number(selected.rate) || 0;
      updated[index] = {
        ...updated[index],
        item_code: selected.item_code, item_name: selected.item_name ?? "",
        description: selected.description ?? "", unit: selected.unit ?? "",
        qty, rate, amount: qty * rate,
        hsn_code: selected.hsn_code ?? "", gst_per: Number(selected.gst_per) || 0,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value } as PoItem;
      if (field === "qty" || field === "rate") {
        updated[index].amount =
          (Number(updated[index].qty) || 0) * (Number(updated[index].rate) || 0);
      }
    }
    setPoItems(updated);
  };

  const handleRemoveItem = (i: number) => {
    if (disabled) return;
    setPoItems(poItems.filter((_: any, idx: number) => idx !== i));
  };

const isDiscountPoItem = (item: PoItem): boolean => {
  const nm = (item.item_name || "").toLowerCase();
  return nm.includes("discount") || nm.includes("buyback");
};



  /* ── TOTALS ────────────────────────────────────────────────────────────── */
  const subtotal = poItems.reduce((sum, item) => {
  const amt = item.qty * item.rate;
  return isDiscountPoItem(item) ? sum - amt : sum + amt;
}, 0);

const chargesAddition  = otherCharges.filter(oc => !oc.is_discount).reduce((s, oc) => s + (Number(oc.amount) || 0), 0);
const chargesDeduction = otherCharges.filter(oc =>  oc.is_discount).reduce((s, oc) => s + (Number(oc.amount) || 0), 0);

// Sum of discount/buyback poItems (item-level deductions)
const itemLevelDeduction = poItems
  .filter(i => isDiscountPoItem(i))
  .reduce((s, i) => s + i.qty * i.rate, 0);

// Normal items only (exclude discount/buyback rows)
const normalItems = poItems.filter(i => !isDiscountPoItem(i));
const normalItemsTotal = normalItems.reduce((s, i) => s + i.qty * i.rate, 0);

const discountItems      = normalItems.filter(i => i.is_discount_applicable);
const discountItemsTotal = discountItems.reduce((s, i) => s + i.qty * i.rate, 0);
const hasItemSpecificDiscount = discountItems.length > 0;
const hasDiscount = chargesDeduction > 0;

// Total deduction = footer discount rows + item-level discount/buyback rows
const totalDeduction = chargesDeduction + itemLevelDeduction;

const getItemDiscountAmount = (item: PoItem): number => {
  if (isDiscountPoItem(item)) return 0;
  if (totalDeduction === 0) return 0;

  if (hasItemSpecificDiscount) {
    if (!item.is_discount_applicable || discountItemsTotal === 0) return 0;
    return (item.qty * item.rate / discountItemsTotal) * totalDeduction;
  }

  if (normalItemsTotal === 0) return 0;
  return (item.qty * item.rate / normalItemsTotal) * totalDeduction;
};

const taxableBase = normalItems.reduce((sum, item) =>
  sum + (item.qty * item.rate) - getItemDiscountAmount(item), 0);

const totalGST = normalItems.reduce((sum, item) => {
  const taxable = (item.qty * item.rate) - getItemDiscountAmount(item);
  return sum + (taxable * (Number(item.gst_per) || 0)) / 100;
}, 0);

const grandTotal = Math.round(taxableBase + totalGST + chargesAddition);

const totalDiscountDisplayed = normalItems.reduce(
  (sum, item) => sum + getItemDiscountAmount(item), 0
);

  // ── REFS ───────────────────────────────────────────────────────────────────
  // manuallyUnchecked: items the user explicitly unchecked — useEffect won't re-check them
  const manuallyUnchecked = useRef<Set<string>>(new Set());
  // userEditedDeduction: becomes true the moment user types in the deduction input
  // while false → trust DB values (edit load); while true → auto-check all items
  const userEditedDeduction = useRef(false);

  useEffect(() => {
    // Always update disc_amt (proportional calc)
    // For is_discount_applicable:
    //   chargesDeduction = 0           → always false (discount removed)
    //   chargesDeduction > 0
    //     userEditedDeduction = false  → keep whatever DB loaded (trust saved values)
    //     userEditedDeduction = true   → true unless manually unchecked by user
    setPoItems(prev =>
      prev.map(item => {
        const computed = parseFloat(getItemDiscountAmount(item).toFixed(2));
        let checked: boolean;
        if (chargesDeduction === 0) {
          checked = false;
        } else if (!userEditedDeduction.current) {
          checked = item.is_discount_applicable ?? false; // trust DB
        } else {
          checked = !manuallyUnchecked.current.has(item.id); // auto-check unless manually unchecked
        }
        // Only update if something actually changed — avoids infinite loop
        if (item.disc_amt === computed && item.is_discount_applicable === checked) return item;
        return { ...item, disc_amt: computed, is_discount_applicable: checked };
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargesDeduction, subtotal,
      poItems.map(i => i.is_discount_applicable).join(",")]);

  useEffect(() => {
    onTotalsChange?.(subtotal, totalGST, grandTotal);
  }, [poItems, otherCharges]);

  /* ── OTHER CHARGE HELPERS ──────────────────────────────────────────────── */
  const addOtherCharge = (isDiscount: boolean) => {
    if (disabled) return;
    setOtherCharges(prev => [...prev, { item_code: "", item_name: "", amount: "", is_discount: isDiscount }]);
  };

  const removeOtherCharge = (i: number) => {
    if (disabled) return;
    setOtherCharges(prev => prev.filter((_, ri) => ri !== i));
  };

  const updateOtherCharge = (i: number, patch: Partial<OtherCharge>) => {
    if (disabled) return;
    // User is actively typing a deduction amount — switch from DB-trust to auto-check mode
    if ('amount' in patch) userEditedDeduction.current = true;
    setOtherCharges(prev => prev.map((row, ri) => (ri === i ? { ...row, ...patch } : row)));
  };

  const amountDisplay = (oc: OtherCharge, i: number): string => {
    if (focusedAmountIdx === i) return oc.amount;
    const n = Number(oc.amount);
    if (!oc.amount || isNaN(n) || n === 0) return oc.amount;
    return n.toFixed(2);
  };

  // Fix 5: Separate filtered lists for each dropdown type
  const isDiscountItem = (c: any) => {
    const nm = (c.item_name || "").toLowerCase();
    return nm.includes("discount") || nm.includes("buyback");
  };
  const discountChargeItems = chargeItems.filter(isDiscountItem);
  const otherChargeItems    = chargeItems.filter(c => !isDiscountItem(c));

  
  /*
   * ── COLUMN LAYOUT (0-based) ─────────────────────────────────────────────
   *
   * WITHOUT discount  (TOTAL_COLS = 10):
   *   [0]Item [1]Desc [2]HSN [3]GST [4]Qty [5]UOM [6]Rate [7]Amount [8]Add [9]Del
   *
   * WITH discount  (TOTAL_COLS = 12):
   *   [0]Item [1]Desc [2]HSN [3]GST [4]Qty [5]UOM [6]Rate [7]Amount [8]DiscAmt [9]Disc? [10]Add [11]Del
   *
   * Footer / charge-row mapping:
   *   colSpan 7  → label text OR dropdown  (cols 0-6)
   *   1 cell     → Amount value            (col 7)
   *   1 cell     → DiscAmt value / empty   (col 8, only when hasDiscount)
   *   1 cell     → Disc? / empty           (col 9, only when hasDiscount)
   *   1 cell     → Add button              (col 10 or 8)
   *   1 cell     → Del button              (col 11 or 9)
   * ────────────────────────────────────────────────────────────────────────
   */
  const TOTAL_COLS = hasDiscount ? 12 : 10;

  /* ── RENDER ─────────────────────────────────────────────────────────────── */
  return (
    <div className={`overflow-visible rounded-lg border border-teal-400 shadow-sm mt-2 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      <table className="w-full table-fixed border border-teal-800 text-sm">
        <colgroup>
          {hasDiscount ? (
            <>
	      <col style={{ width: "18%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "7%"  }} />
              <col style={{ width: "5%"  }} />
              <col style={{ width: "8%"  }} />
              <col style={{ width: "6%"  }} />
              <col style={{ width: "9%"  }} />
              <col style={{ width: "11%"  }} />
              <col style={{ width: "7%"  }} />
              <col style={{ width: "4%"  }} />
              <col style={{ width: "4%"  }} />
              <col style={{ width: "4%"  }} />
            </>
          ) : (
            <>
              <col style={{ width: "22%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "8%"  }} />
              <col style={{ width: "6%"  }} />
              <col style={{ width: "8%"  }} />
              <col style={{ width: "6%"  }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "4%"  }} />
              <col style={{ width: "4%"  }} />
            </>
          )}
        </colgroup>

        {/* HEADERS */}
        <thead className="bg-gradient-to-r from-blue-600 to-teal-500 text-white text-sm">
          <tr>
            <th className="px-1 py-2 text-center border border-gray-800">Item</th>
            <th className="px-1 py-2 text-center border border-gray-800">Description</th>
            <th className="px-1 py-2 text-center border border-gray-800">HSN</th>
            <th className="px-1 py-2 text-center border border-gray-800">GST%</th>
            <th className="px-1 py-2 text-center border border-gray-800">Qty</th>
            <th className="px-1 py-2 text-center border border-gray-800">UOM</th>
            <th className="px-1 py-2 text-center border border-gray-800">Rate</th>
            <th className="px-1 py-2 text-center border border-gray-800">Amount</th>
            {hasDiscount && <th className="px-1 py-2 text-center border border-gray-800 text-xs">Disc Amt</th>}
            {hasDiscount && <th className="px-1 py-2 text-center border border-gray-800 text-xs">Disc?</th>}
            <th className="px-1 py-2 text-center border border-gray-800">Add</th>
            <th className="px-1 py-2 text-center border border-gray-800">Del</th>
          </tr>
        </thead>

        {/* BODY */}
        <tbody className="[&>tr>td]:py-[4px] [&>tr>td]:px-[8px]">
          {poItems.length === 0 ? (
            <tr>
              <td colSpan={TOTAL_COLS} className="border border-orange-800 px-1.5 py-2">
                No items added.{" "}
                <button className="text-blue-600 hover:underline" type="button" disabled={disabled}
                  onClick={() => !disabled && setPoItems(prev => [...prev, {
                    id: generateRowId(), item_code: 0, item_name: "", description: "",
                    unit: "", qty: 0, rate: 0, amount: 0, hsn_code: "", gst_per: 0,
                  }])}>
                  Add Item
                </button>
              </td>
            </tr>
          ) : (
            poItems.map((item: any, index: number) => {
              const discAmt = getItemDiscountAmount(item);
              return (
                <tr key={item.id} className="odd:bg-teal-50 even:bg-blue-100 hover:bg-orange-100">

                  {/* [0] Item */}
                  <td className="pl-2 py-2 border-b border-gray-400">
                    <div className="relative">
                      <input disabled={disabled} type="text"
                        className="w-[98.5%] ml-1 h-8 px-2 rounded-md border border-gray-400 focus:border-blue-500 focus:outline-none focus:ring focus:ring-blue-300 text-sm"
                        value={searchIndex === index ? searchText : item.item_name}
                        onFocus={() => { setSearchIndex(index); setSearchText(item.item_name || ""); }}
                        onChange={e => { setSearchIndex(index); setSearchText(e.target.value); }}
                        onBlur={() => { setTimeout(() => setSearchIndex(null), 150); }}
                      />
                      {searchIndex === index && !disabled && (
                        <div className="absolute z-50 bg-white border border-gray-300 w-full max-h-48 overflow-y-auto shadow-md rounded-md mt-1">
                          {items.filter((itm: any) => itm.item_name.toLowerCase().includes(searchText.toLowerCase()))
                            .map((itm: any) => (
                              <div key={itm.item_code}
                                className="px-3 py-1 hover:bg-blue-100 cursor-pointer text-sm"
                                onClick={() => { handleItemChange(index, "item_code", Number(itm.item_code)); setSearchIndex(null); setSearchText(""); }}>
                                {itm.item_name}
                              </div>
                            ))}
                          {items.filter((itm: any) => itm.item_name.toLowerCase().includes(searchText.toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-gray-500 text-sm">No items found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* [1] Description */}
                  <td className="border-b border-gray-400">
                    <textarea disabled={disabled} rows={1}
                      value={item.description ?? ""}
                      onChange={e => { handleItemChange(index, "description", e.target.value); e.target.style.height = "2rem"; e.target.style.height = `${Math.max(e.target.scrollHeight, 32)}px`; }}
                      onFocus={e => { e.target.style.lineHeight = "1.5rem"; e.target.style.height = "2rem"; e.target.style.height = `${Math.max(e.target.scrollHeight, 32)}px`; }}
                      onBlur={e => { e.target.style.height = "2rem"; e.target.style.lineHeight = "2rem"; }}
                      className="w-full resize-none overflow-hidden box-border px-2 mt-1 rounded-md border border-gray-400 focus:border-blue-500 focus:outline-none focus:ring focus:ring-blue-300 text-sm"
                      style={{ height: "2rem", lineHeight: "2rem" }}
                    />
                  </td>

                  {/* [2] HSN */}
                  <td className="px-2 py-2 border-b border-gray-400 text-center">
                    <input disabled={disabled} type="text"
                      className="w-full h-8 px-2 rounded-md border border-gray-400 text-center focus:border-blue-500 focus:outline-none focus:ring focus:ring-blue-300 text-sm"
                      value={item.hsn_code ?? ""}
                      onChange={e => handleItemChange(index, "hsn_code", e.target.value)}
                    />
                  </td>

                  {/* [3] GST */}
                  <td className="px-2 py-2 border-b border-gray-400 text-center">
                    <input disabled={disabled} type="text"
                      className="w-full h-8 px-2 rounded-md border border-gray-400 text-center focus:border-blue-500 focus:outline-none focus:ring focus:ring-blue-300 text-sm"
                      value={item.gst_per}
                      onChange={e => handleItemChange(index, "gst_per", e.target.value)}
                    />
                  </td>

                  {/* [4] Qty */}
                  <td className="px-2 py-2 border-b border-gray-400 text-right">
                    <input disabled={disabled} type="number"
                      className="w-full h-8 px-2 rounded-md border border-gray-400 text-right focus:border-blue-500 focus:outline-none focus:ring focus:ring-blue-300 text-sm appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={item.qty}
                      onChange={e => handleItemChange(index, "qty", Number(e.target.value))}
                    />
                  </td>

                  {/* [5] UOM */}
                  <td className="px-2 py-2 border-b border-gray-400 text-center">
                    <input disabled={disabled} type="text" readOnly
                      className="w-full h-8 px-2 rounded-md border border-gray-400 text-center text-sm"
                      value={item.unit}
                    />
                  </td>

                  {/* [6] Rate */}
                  <td className="px-2 py-2 border-b border-gray-400 text-right">
                    <input disabled={disabled} type="number"
                      className="w-full h-8 px-2 rounded-md border border-gray-400 text-right focus:border-blue-500 focus:outline-none focus:ring focus:ring-blue-300 text-sm appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={item.rate}
                      onChange={e => handleItemChange(index, "rate", Number(e.target.value))}
                    />
                  </td>

                  {/* [7] Amount */}
<td className={`px-2 py-2 border-b border-gray-400 text-right font-medium whitespace-nowrap ${isDiscountPoItem(item) ? "text-red-600" : ""}`}>
  {isDiscountPoItem(item)
    ? `(${(item.qty * item.rate).toFixed(2)})`
    : (item.qty * item.rate).toFixed(2)}
</td>

                  {/* [8] Disc Amt — only when hasDiscount */}
                  {hasDiscount && (
                    <td className="px-2 py-2 border-b border-gray-400 text-right text-red-600 text-xs whitespace-nowrap">
                      {discAmt > 0 ? `- ${discAmt.toFixed(2)}` : ""}
                    </td>
                  )}

                  {/* [9] Disc? checkbox — only when hasDiscount */}
                  {hasDiscount && (
                    <td className="px-2 py-2 border-b border-gray-400 text-center">
                      <input type="checkbox"
                        checked={item.is_discount_applicable || false}
                        onChange={e => {
                          userEditedDeduction.current = true;
                          if (!e.target.checked) {
                            manuallyUnchecked.current.add(item.id);
                            const updated = [...poItems];
                            updated[index].is_discount_applicable = false;
                            updated[index].disc_amt = 0;
                            setPoItems(updated);
                          } else {
                            manuallyUnchecked.current.delete(item.id);
                            const updated = [...poItems];
                            updated[index].is_discount_applicable = true;
                            setPoItems(updated);
                          }
                          // If all unchecked → clear manual tracking so next deduction entry re-checks all
                          const allUnchecked = poItems.every((it, idx) =>
                            idx === index ? !e.target.checked : !it.is_discount_applicable
                          );
                          if (allUnchecked) manuallyUnchecked.current.clear();
                        }}
                      />
                    </td>
                  )}

                  {/* [10|8] Add */}
                  <td className="px-2 py-2 border-b border-gray-400 text-center">
                    <button disabled={disabled} type="button"
                      className="p-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200"
                      onClick={() => handleAddItem(index)}>
                      <Plus size={18} strokeWidth={2.5} />
                    </button>
                  </td>

                  {/* [11|9] Del */}
                  <td className="px-2 py-2 border-b border-gray-400 text-center">
                    <button disabled={disabled} type="button"
                      className="p-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200"
                      onClick={() => handleRemoveItem(index)}>
                      <Trash2 size={18} strokeWidth={2.5} />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>

        {/* ══════════════════════════════════════════════════════════════════
            FOOTER — column mapping (all rows follow this exact structure):
              colSpan=7  → label text or dropdown input    (cols 0-6)
              1 td       → Amount / value cell             (col 7)
              1 td       → Disc Amt cell (hasDiscount only)(col 8)
              1 td       → Disc? cell   (hasDiscount only) (col 9)
              1 td       → Add button                      (col 10|8)
              1 td       → Del button                      (col 11|9)
            ══════════════════════════════════════════════════════════════ */}
        <tfoot className="sticky bottom-0 bg-white">

          {/* ── Sub Total
                Fix 3: Total Disc Amount shown inline at col 8 (Disc Amt column) — no separate row ── */}
          <tr className="bg-blue-100 text-black text-sm">
            <td colSpan={7} className="px-2 py-2 text-right font-bold">Sub Total</td>
            {/* col 7: subtotal value */}
            <td className="px-2 py-2 text-right font-bold whitespace-nowrap">{formatAmount(subtotal)}</td>
            {/* col 8: total disc shown under Disc Amt header (Fix 3) */}
            {hasDiscount && (
              <td className="px-2 py-2 text-right font-semibold text-red-600 text-xs whitespace-nowrap">
                {totalDiscountDisplayed > 0 ? `- ${totalDiscountDisplayed.toFixed(2)}` : ""}
              </td>
            )}
            {/* col 9: empty Disc? cell */}
            {hasDiscount && <td />}
            {/* Add / Del: empty */}
            <td /><td />
          </tr>

          {/* ── Discount / Buyback input rows ── */}
          {otherCharges.filter(oc => oc.is_discount).map((oc) => {
            const globalIndex = otherCharges.indexOf(oc);
            return (
              <tr key={`disc-${globalIndex}`} className="bg-red-50 text-sm">
                {/* cols 5-6: dropdown — Fix 2: spans label area, aligns with Sub Total label */}
             <td colSpan={5}></td>
                <td colSpan={2} className="px-2 py-1">
                  <select disabled={disabled} value={String(oc.item_code || "")}
                    onChange={e => {
                      const sel = chargeItems.find((c: any) => String(c.item_code) === String(e.target.value));
                      updateOtherCharge(globalIndex, { item_code: e.target.value, item_name: sel?.item_name || "", is_discount: true });
                    }}
                    className="w-full h-8 border border-red-300 rounded px-2 text-xs">
                    <option value="">-- Select Deduction --</option>
                    {discountChargeItems.map((c: any) => {
                      const used = otherCharges.some((r, ri) => ri !== globalIndex && String(r.item_code) === String(c.item_code));
                      return <option key={c.item_code} value={String(c.item_code)} disabled={used}>{c.item_name}{used ? " (added)" : ""}</option>;
                    })}
                  </select>
                </td>
                {/* col 7: amount input — Fix 2: aligns with Sub Total / summary values */}
                <td className="px-2 py-1">
                  <input disabled={disabled} type="number" min="0.01" step="0.01"
                    value={amountDisplay(oc, globalIndex)}
                    onFocus={() => setFocusedAmountIdx(globalIndex)}
                    onBlur={() => setFocusedAmountIdx(null)}
                    onChange={e => updateOtherCharge(globalIndex, { amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full h-8 border border-red-300 rounded px-2 text-right text-sm appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </td>
                {/* col 8 & 9: empty placeholder cells to keep Add/Del pinned to right */}
                {hasDiscount && <td />}
                {hasDiscount && <td />}
                {/* Fix 4: Add/Del occupy the same columns as item table Add/Del */}
                <td className="px-2 py-1 text-center">
                  <button disabled={disabled} type="button" onClick={() => addOtherCharge(true)}
                    className="p-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200">
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </td>
                <td className="px-2 py-1 text-center">
                  <button disabled={disabled} type="button" onClick={() => removeOtherCharge(globalIndex)}
                    className="p-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200">
                    <Trash2 size={16} strokeWidth={2.5} />
                  </button>
                </td>
              </tr>
            );
          })}

          {/* Fix 1: Add Discount/Buyback button — right-aligned, same position as Sub Total label */}
          {!disabled && otherCharges.filter(oc => oc.is_discount).length === 0 && (
            <tr className="bg-red-50">
              <td colSpan={7} className="px-2 py-1 text-right">
                <button type="button" onClick={() => addOtherCharge(true)}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium py-0.5">
                  <Plus size={14} strokeWidth={2.5} /> Add Discount / Buyback
                </button>
              </td>
              <td />{hasDiscount && <td />}{hasDiscount && <td />}<td /><td />
            </tr>
          )}

          {/* ── Taxable Total — only when deductions exist ── */}
          {chargesDeduction > 0 && (
            <tr className="bg-blue-200 text-black text-sm">
              <td colSpan={7} className="px-2 py-2 text-right font-bold">Taxable Total</td>
              <td className="px-2 py-2 text-right font-bold whitespace-nowrap">{formatAmount(taxableBase)}</td>
              {hasDiscount && <td />}{hasDiscount && <td />}
              <td /><td />
            </tr>
          )}

          {/* ── GST Total ── */}
          <tr className="bg-gray-100 text-black text-sm">
            <td colSpan={7} className="px-2 py-2 text-right font-medium">GST Total</td>
            <td className="px-2 py-2 text-right font-medium whitespace-nowrap">{formatAmount(totalGST)}</td>
            {hasDiscount && <td />}{hasDiscount && <td />}
            <td /><td />
          </tr>

          {/* ── Other Charge (addition) input rows ── */}
          {otherCharges.filter(oc => !oc.is_discount).map((oc) => {
            const globalIndex = otherCharges.indexOf(oc);
            return (
              <tr key={`add-${globalIndex}`} className="bg-blue-50 text-sm">
                {/* cols 5-6: dropdown — Fix 2: spans label area */}
             <td colSpan={5}></td>
                <td colSpan={2} className="px-2 py-1">
                  <select disabled={disabled} value={String(oc.item_code || "")}
                    onChange={e => {
                      const sel = chargeItems.find((c: any) => String(c.item_code) === String(e.target.value));
                      updateOtherCharge(globalIndex, { item_code: e.target.value, item_name: sel?.item_name || "", is_discount: false });
                    }}
                    className="w-full h-8 border border-blue-300 rounded px-2 text-xs">
                    <option value="">-- Select Other Charge --</option>
                    {/* Fix 5: show only non-discount/buyback items */}
                    {otherChargeItems.map((c: any) => {
                      const used = otherCharges.some((r, ri) => ri !== globalIndex && String(r.item_code) === String(c.item_code));
                      return <option key={c.item_code} value={String(c.item_code)} disabled={used}>{c.item_name}{used ? " (added)" : ""}</option>;
                    })}
                  </select>
                </td>
                {/* col 7: amount input — Fix 2: aligns with GST Total / summary values */}
                <td className="px-2 py-1">
                  <input disabled={disabled} type="number" min="0.01" step="0.01"
                    value={amountDisplay(oc, globalIndex)}
                    onFocus={() => setFocusedAmountIdx(globalIndex)}
                    onBlur={() => setFocusedAmountIdx(null)}
                    onChange={e => updateOtherCharge(globalIndex, { amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full h-8 border border-blue-300 rounded px-2 text-right text-sm appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </td>
                {/* col 8 & 9: empty placeholder cells */}
                {hasDiscount && <td />}
                {hasDiscount && <td />}
                {/* Fix 4: Add/Del occupy the same columns as item table Add/Del */}
                <td className="px-2 py-1 text-center">
                  <button disabled={disabled} type="button" onClick={() => addOtherCharge(false)}
                    className="p-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200">
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </td>
                <td className="px-2 py-1 text-center">
                  <button disabled={disabled} type="button" onClick={() => removeOtherCharge(globalIndex)}
                    className="p-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200">
                    <Trash2 size={16} strokeWidth={2.5} />
                  </button>
                </td>
              </tr>
            );
          })}

          {/* Fix 1: Add Other Charge button — right-aligned, matching Add Discount/Buyback style */}
          {!disabled && otherCharges.filter(oc => !oc.is_discount).length === 0 && (
            <tr className="bg-blue-50">
              <td colSpan={7} className="px-2 py-1 text-right">
                <button type="button" onClick={() => addOtherCharge(false)}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium py-0.5">
                  <Plus size={14} strokeWidth={2.5} /> Add Other Charge
                </button>
              </td>
              <td />{hasDiscount && <td />}{hasDiscount && <td />}<td /><td />
            </tr>
          )}

          {/* ── Grand Total ── */}
          <tr className="bg-blue-200 text-black text-sm">
            <td colSpan={7} className="px-2 py-2 text-right font-bold whitespace-nowrap">
              Grand Total (Rounded Off)
            </td>
            <td className="text-right font-medium text-lg px-1 py-2 text-black whitespace-nowrap">
              {formatAmount(grandTotal)}
            </td>
            {hasDiscount && <td />}{hasDiscount && <td />}
            <td /><td />
          </tr>

        </tfoot>
      </table>
    </div>
  );
}
