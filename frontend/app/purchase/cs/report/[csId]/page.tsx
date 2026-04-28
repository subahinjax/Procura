"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

// ── types ─────────────────────────────────────────────────────────────────────
type CSHeader = {
  id: number; cs_no: string; cs_date: string;
  description: string; dept_name: string; subdept_name: string; status: string;
  sup1_name: string; sup1_quot_no: string; sup1_quot_date: string; sup1_terms: string;
  sup2_name: string; sup2_quot_no: string; sup2_quot_date: string; sup2_terms: string;
  sup3_name: string; sup3_quot_no: string; sup3_quot_date: string; sup3_terms: string;
  sup4_name: string; sup4_quot_no: string; sup4_quot_date: string; sup4_terms: string;
};
type CSItem = {
  id: number; sno: number;
  item_name: string; description: string; uom: string; qty: number;
  sup1_rate: number|null; sup1_gst: number; sup1_amount: number|null;
  sup2_rate: number|null; sup2_gst: number; sup2_amount: number|null;
  sup3_rate: number|null; sup3_gst: number; sup3_amount: number|null;
  sup4_rate: number|null; sup4_gst: number; sup4_amount: number|null;
  recommended_sup: number|null;
};
type Approver = { id: number; designation: string; emp_name: string; sort_order: number };

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number|null|undefined): string => {
  if (n == null || n === 0) return "—";
  return Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtDate = (d: string): string => {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};
const fmtDateShort = (d: string): string => {
  if (!d) return "";
  try {
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yy = String(dt.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
  } catch { return d; }
};
function getSuppliers(h: CSHeader) {
  return [
    { slot:1, name:h.sup1_name, quot_no:h.sup1_quot_no, quot_date:h.sup1_quot_date, terms:h.sup1_terms },
    { slot:2, name:h.sup2_name, quot_no:h.sup2_quot_no, quot_date:h.sup2_quot_date, terms:h.sup2_terms },
    { slot:3, name:h.sup3_name, quot_no:h.sup3_quot_no, quot_date:h.sup3_quot_date, terms:h.sup3_terms },
    { slot:4, name:h.sup4_name, quot_no:h.sup4_quot_no, quot_date:h.sup4_quot_date, terms:h.sup4_terms },
  ].filter(s => s.name?.trim());
}

// ── scale helper ──────────────────────────────────────────────────────────────
// At 100% (z=1): returns the base value unchanged — nothing differs from original.
// Below 100%: multiplies base by z so font, padding, line-height, margins shrink.
const sc = (base: number, z: number) => base * z;

// ── component ─────────────────────────────────────────────────────────────────
export default function CSReportPage() {
  const { csId } = useParams();
  const router   = useRouter();

  const [csData,     setCsData]     = useState<{ header: CSHeader; items: CSItem[] }|null>(null);
  const [approvers,  setApprovers]  = useState<Approver[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string|null>(null);
  const [pageBreaks, setPageBreaks] = useState<number[]>([]);
  const [orient,     setOrient]     = useState<"landscape"|"portrait">("landscape");
  const [printZoom,  setPrintZoom]  = useState(100);

  useEffect(() => {
    if (!csId) return;
    Promise.all([
      fetch(`/api/proxy/cs/${csId}`, { credentials:"include" })
        .then(r => { if (!r.ok) throw new Error("Not found"); return r.json(); }),
      fetch(`/api/proxy/cs/${csId}/approvers`, { credentials:"include" })
        .then(r => r.ok ? r.json() : [])
        .catch(() => []),
    ]).then(([cs, appr]) => {
      setCsData(cs);
      if (Array.isArray(appr) && appr.length > 0) {
        setApprovers(appr);
      } else {
        fetch(`/api/proxy/cs-approvers`, { credentials:"include" })
          .then(r => r.json()).then(d => setApprovers(Array.isArray(d) ? d : []));
      }
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [csId]);

  useEffect(() => {
    const saved = localStorage.getItem("csPrintZoom");
    if (saved) setPrintZoom(Number(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("csPrintZoom", printZoom.toString());
  }, [printZoom]);

  const togglePageBreak = (index: number) => {
    setPageBreaks(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center gap-2 py-20 text-gray-400">
      <Loader2 size={22} className="animate-spin"/> Loading report…
    </div>
  );
  if (error)   return <p className="p-8 text-red-500">{error}</p>;
  if (!csData) return null;

  const { header: h, items } = csData;
  const suppliers = getSuppliers(h);

  const R  = (it: CSItem, s: number) => Number((it as any)[`sup${s}_rate`])   || 0;
  const G  = (it: CSItem, s: number) => Number((it as any)[`sup${s}_gst`])    || 0;
  const A  = (it: CSItem, s: number) => Number((it as any)[`sup${s}_amount`]) || 0;

  const subTotal   = (slot: number) => items.reduce((t, it) => t + A(it, slot), 0);
  const gstTotal   = (slot: number) => items.reduce((t, it) => t + A(it, slot) * G(it, slot) / 100, 0);
  const grandTotal = (slot: number) => subTotal(slot) + gstTotal(slot);

  const allRates = Array.from(new Set(
    suppliers.flatMap(s => items.map(it => G(it, s.slot)).filter(g => g > 0))
  )).sort((a, b) => a - b);

  const supHasGst = (slot: number) => items.some(it => G(it, slot) > 0);
  const gstByRate = (slot: number, rate: number) =>
    items.reduce((t, it) => G(it, slot) === rate ? t + A(it, slot) * rate / 100 : t, 0);

  const recSlot = (() => {
    const activeSups = suppliers.filter(s => items.some(it => A(it, s.slot) > 0));
    if (activeSups.length === 0) return null;
    let bestSlot: number|null = null, bestTotal = Infinity;
    activeSups.forEach(s => {
      const total = grandTotal(s.slot);
      if (total > 0 && total < bestTotal) { bestTotal = total; bestSlot = s.slot; }
    });
    return bestSlot;
  })();

  const supCols     = (slot: number) => supHasGst(slot) ? 3 : 2;
  const isLandscape = orient === "landscape";
  const LS          = isLandscape;

  const pagePx = LS ? 1047 : 718;
  const pSno   = LS ? 4.5  : 5.5;
  const pUom   = LS ? 5.5  : 7.5;
  const pQty   = LS ? 6.5  : 8.5;
  const pGst   = parseFloat(((LS ? 58 : 43) / pagePx * 100).toFixed(1));

  const numPx = (n: number): number => {
    const s = n.toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 });
    const digits = [...s].filter(ch => /[0-9]/.test(ch)).length;
    const puncts = [...s].filter(ch => /[.,]/.test(ch)).length;
    return digits * 7 + puncts * 4 + 16;
  };
  const pxToPct = (px: number) => parseFloat((px / pagePx * 100).toFixed(1));

  const maxRate  = suppliers.reduce((mx, s) => items.reduce((m, it) => Math.max(m, R(it, s.slot)), mx), 0);
  const maxGrand = suppliers.reduce((mx, s) => Math.max(mx, grandTotal(s.slot)), 0);
  const pRate    = pxToPct(Math.max(numPx(maxRate),  4 * 7 + 10));
  const pAmt     = pxToPct(Math.max(numPx(maxGrand), 6 * 7 + 10));

  const supUsed = suppliers.reduce((t, s) =>
    t + (supHasGst(s.slot) ? pGst + pRate + pAmt : pRate + pAmt), 0);
  const pDesc = Math.max(15, parseFloat((100 - pSno - pUom - pQty - supUsed).toFixed(1)));

  const colWidths: string[] = [`${pSno}%`, `${pDesc}%`, `${pUom}%`, `${pQty}%`];
  suppliers.forEach(s => {
    if (supHasGst(s.slot)) colWidths.push(`${pGst}%`, `${pRate}%`, `${pAmt}%`);
    else                   colWidths.push(`${pRate}%`, `${pAmt}%`);
  });

  const signatories = approvers.length > 0 ? approvers : [
    { id:1, designation:"Technical Assistant", emp_name:"", sort_order:1 },
    { id:2, designation:"Manager - Purchase",  emp_name:"", sort_order:2 },
    { id:3, designation:"COE",                 emp_name:"", sort_order:3 },
    { id:4, designation:"Pro Chancellor",      emp_name:"", sort_order:4 },
  ];

  const breakPoints = [...pageBreaks.map(Number)].sort((a, b) => a - b);
  breakPoints.push(items.length);
  let lastIndex = 0;
  const sections: CSItem[][] = [];
  breakPoints.forEach(bp => {
    const slice = items.slice(lastIndex, bp);
    if (slice.length > 0) sections.push(slice);
    lastIndex = bp;
  });
  const cumulativeStart = sections.map(
    (_, i) => sections.slice(0, i).reduce((sum, sec) => sum + sec.length, 0)
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // z = zoom factor (1.0 at 100%, 0.95 at 95% etc.)
  // ALL original base values are preserved exactly.
  // sc(base, z) = base * z  →  at z=1 returns base unchanged.
  // ─────────────────────────────────────────────────────────────────────────────
  const z = printZoom / 100;

  // Original base values from the very first version you sent — untouched at 100%
  const TH: React.CSSProperties = {
    border: "1px solid #333",
    padding: `${sc(2, z)}px ${sc(5, z)}px`,          // original: 2px 5px
    textAlign: "center",
    fontWeight: "bold",
    background: "#eef1fb",
    fontSize: `${sc(9.5, z)}pt`,                      // original: 9.5pt
    lineHeight: `${sc(1.4, z)}`,                      // adds line-height scaling (new for zoom)
  };
  const TD: React.CSSProperties = {
    border: "1px solid #333",
    padding: `${sc(2, z)}px ${sc(5, z)}px`,          // original: 2px 5px
    verticalAlign: "top",
    fontSize: `${sc(10.5, z)}pt`,                     // original: 10.5pt
    lineHeight: `${sc(1.4, z)}`,                      // adds line-height scaling (new for zoom)
  };

  const TheadJSX = () => (
    <thead>
      <tr>
        <th rowSpan={3} style={TH}>S.No.</th>
        <th rowSpan={3} style={TH}>Description</th>
        <th rowSpan={3} style={TH}>UoM</th>
        <th rowSpan={3} style={TH}>Qty</th>
        {suppliers.map(s => (
          <th key={s.slot} colSpan={supCols(s.slot)}
            style={{ ...TH, background: s.slot===recSlot ? "#c8e6c9" : "#dde3fa" }}>
            M/s.&nbsp;{s.name}
          </th>
        ))}
      </tr>
      <tr>
        {suppliers.map(s => (
          <th key={s.slot} colSpan={supCols(s.slot)}
            style={{ ...TH, fontWeight:"normal", background:"#f5f7ff" }}>
            Qno.&nbsp;{s.quot_no||"—"}&nbsp;&nbsp;Dt:&nbsp;{fmtDateShort(s.quot_date)||"—"}
          </th>
        ))}
      </tr>
      <tr>
        {suppliers.map(s => {
          const bg = s.slot===recSlot ? "#dcedc8" : "#eef1fb";
          return supHasGst(s.slot)
            ? [
                <th key={`${s.slot}g`} style={{ ...TH, background:bg }}>GST%</th>,
                <th key={`${s.slot}r`} style={{ ...TH, background:bg }}>Rate</th>,
                <th key={`${s.slot}a`} style={{ ...TH, background:bg }}>Amount</th>,
              ]
            : [
                <th key={`${s.slot}r`} style={{ ...TH, background:bg }}>Rate</th>,
                <th key={`${s.slot}a`} style={{ ...TH, background:bg }}>Amount</th>,
              ];
        })}
      </tr>
    </thead>
  );

  return (
    <>
      <style>{`
        @media print {
          .no-print { display:none!important; }
          #csr-root { background:white!important; }
          #csr-wrap {
            box-shadow:none!important;
            max-width:100%!important;
            padding:0!important;
            margin:0!important;
          }
          @page { size:A4 ${isLandscape?"landscape":"portrait"}; margin:10mm 12mm; }
          * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          .page-break  { page-break-before:always; }
          .avoid-break { page-break-inside:avoid; }
        }
        @media screen {
          #csr-root { background:#e5e7eb; min-height:100vh; }
        }
        @media print {
          .no-print-padding { padding:0!important; margin:0!important; background:white!important; }
        }
      `}</style>

      <div id="csr-root">

        {/* ── Toolbar ── */}
        <div className="no-print flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm flex-wrap">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
          >
            <ArrowLeft size={14}/> Back
          </button>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setOrient("portrait")}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${orient==="portrait"?"bg-white text-blue-700 shadow font-semibold":"text-gray-500 hover:text-gray-700"}`}>
              ◻ Portrait
            </button>
            <button onClick={() => setOrient("landscape")}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-all ${orient==="landscape"?"bg-white text-blue-700 shadow font-semibold":"text-gray-500 hover:text-gray-700"}`}>
              ▭ Landscape
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-medium">Print zoom:</span>
            <select
              value={printZoom}
              onChange={e => setPrintZoom(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white text-gray-700"
            >
              {[100,99,98,97,96,95,94,93,92,91,90,85,80,75,70].map(v => (
                <option key={v} value={v}>{v}%</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm text-white font-semibold px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 shadow"
          >
            <Printer size={14}/> Print / Save PDF
          </button>
          <span className="text-xs text-gray-400 ml-1">Click any item row to insert / remove page break</span>
        </div>

        <div className="p-6 no-print-padding">
          <div
            id="csr-wrap"
            style={{
              fontFamily: "'Times New Roman',Times,serif",
              background: "#fff",
              maxWidth: isLandscape ? 1140 : 820,
              margin: "0 auto",
              padding: "24px 32px",
              boxShadow: "0 2px 20px rgba(0,0,0,.1)",
            }}
          >

            {/* Company name — original: 15pt, letterSpacing 2, marginBottom 2 */}
            <div style={{
              textAlign: "center",
              fontWeight: "bold",
              fontSize: `${sc(15, z)}pt`,
              textTransform: "uppercase",
              letterSpacing: 2,
              lineHeight: `${sc(1.4, z)}`,
              marginBottom: `${sc(2, z)}px`,
            }}>
              HINDUSTAN INSTITUTE OF TECHNOLOGY & SCIENCE
            </div>

            {/* CS No | Title | Date — original: 10pt / 13pt, marginBottom 12 */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: `${sc(12, z)}px`,
            }}>
              <div style={{ fontSize:`${sc(10, z)}pt`, lineHeight:`${sc(1.4, z)}`, minWidth:160 }}>
                <strong>CS No.:</strong>&nbsp;{h.cs_no}
              </div>
              <div style={{
                fontWeight: "bold",
                fontSize: `${sc(13, z)}pt`,
                lineHeight: `${sc(1.4, z)}`,
                letterSpacing: 1,
                textAlign: "center",
                flex: 1,
              }}>
                Comparative Statement
              </div>
              <div style={{ fontSize:`${sc(10, z)}pt`, lineHeight:`${sc(1.4, z)}`, textAlign:"right", minWidth:160 }}>
                <strong>Date:</strong>&nbsp;{fmtDate(h.cs_date)}
              </div>
            </div>

            {/* ── Sections ── */}
            {sections.map((section, sIdx) => (
              <React.Fragment key={sIdx}>
                <div className="table-section">
                  <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed" }}>
                    <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width:w }}/>)}</colgroup>
                    {TheadJSX()}
                    <tbody>
                      {section.map((item, idx) => {
                        const globalIndex = cumulativeStart[sIdx] + idx;
                        return (
                          <tr
                            key={globalIndex}
                            className="avoid-break"
                            style={{ verticalAlign:"top", cursor:"pointer" }}
                            onClick={() => togglePageBreak(globalIndex)}
                            title="Click to add/remove page break after this row"
                          >
                            <td style={{ ...TD, textAlign:"center" }}>{item.sno}</td>
                            <td style={TD}>
                              {item.description && item.description.trim() && item.description.trim() !== item.item_name.trim()
                                ? `${item.item_name} - ${item.description}`
                                : item.item_name}
                            </td>
                            <td style={{ ...TD, textAlign:"center" }}>{item.uom||"—"}</td>
                            <td style={{ ...TD, textAlign:"center" }}>
                              {Number(item.qty).toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 })}
                            </td>
                            {suppliers.map(s => {
                              const rate=R(item,s.slot), gst=G(item,s.slot), amt=A(item,s.slot);
                              const isRec = item.recommended_sup === s.slot;
                              const bg    = isRec ? "#f1f8e9" : "transparent";
                              return supHasGst(s.slot)
                                ? [
                                    <td key={`${s.slot}g`} style={{ ...TD, textAlign:"center", background:bg, color:"#555" }}>{gst>0?`${gst}%`:""}</td>,
                                    <td key={`${s.slot}r`} style={{ ...TD, textAlign:"right",  background:bg, paddingRight:`${sc(8, z)}px` }}>{fmt(rate||null)}</td>,
                                    <td key={`${s.slot}a`} style={{ ...TD, textAlign:"right",  background:bg, paddingRight:`${sc(8, z)}px` }}>{fmt(amt||null)}</td>,
                                  ]
                                : [
                                    <td key={`${s.slot}r`} style={{ ...TD, textAlign:"right",  background:bg, paddingRight:`${sc(8, z)}px` }}>{fmt(rate||null)}</td>,
                                    <td key={`${s.slot}a`} style={{ ...TD, textAlign:"right",  background:bg, paddingRight:`${sc(8, z)}px` }}>{fmt(amt||null)}</td>,
                                  ];
                            })}
                          </tr>
                        );
                      })}

                      {/* Totals only on last section */}
                      {sIdx === sections.length - 1 && (
                        <>
                          {allRates.length > 0 && allRates.map(rate => (
                            <tr key={`gst-${rate}`} className="avoid-break" style={{ background:"#fafafa" }}>
                              <td colSpan={4} style={{ ...TD, textAlign:"right", fontStyle:"italic", color:"#555" }}>
                                Add: GST @ {rate}%
                              </td>
                              {suppliers.map(s => {
                                const g=gstByRate(s.slot,rate), isRec=s.slot===recSlot;
                                return supHasGst(s.slot)
                                  ? [
                                      <td key={`${s.slot}g`} style={{ ...TD, background:isRec?"#f1f8e9":"#fafafa" }}></td>,
                                      <td key={`${s.slot}r`} style={{ ...TD, background:isRec?"#f1f8e9":"#fafafa" }}></td>,
                                      <td key={`${s.slot}a`} style={{ ...TD, textAlign:"right", fontStyle:"italic", background:isRec?"#f1f8e9":"#fafafa", paddingRight:`${sc(8, z)}px` }}>
                                        {g>0?fmt(g):"—"}
                                      </td>,
                                    ]
                                  : [
                                      <td key={`${s.slot}r`} style={{ ...TD, background:isRec?"#f1f8e9":"#fafafa" }}></td>,
                                      <td key={`${s.slot}a`} style={{ ...TD, textAlign:"right", fontStyle:"italic", background:isRec?"#f1f8e9":"#fafafa", paddingRight:`${sc(8, z)}px` }}>
                                        {g>0?fmt(g):"—"}
                                      </td>,
                                    ];
                              })}
                            </tr>
                          ))}

                          {/* Grand total */}
                          <tr className="avoid-break">
                            <td colSpan={4} style={{ ...TD, textAlign:"right", fontWeight:"bold", textTransform:"uppercase", background:"#e8eeff", fontSize:`${sc(10, z)}pt` }}>
                              Total Amount (Rs.)
                            </td>
                            {suppliers.map(s => {
                              const isRec = s.slot===recSlot;
                              return supHasGst(s.slot)
                                ? [
                                    <td key={`${s.slot}g`} style={{ ...TD, background:isRec?"#c8e6c9":"#e8eeff" }}></td>,
                                    <td key={`${s.slot}r`} style={{ ...TD, background:isRec?"#c8e6c9":"#e8eeff" }}></td>,
                                    <td key={`${s.slot}a`} style={{ ...TD, textAlign:"right", fontWeight:"bold", fontSize:`${sc(11, z)}pt`, background:isRec?"#c8e6c9":"#e8eeff", paddingRight:`${sc(8, z)}px` }}>
                                      {fmt(grandTotal(s.slot))}
                                    </td>,
                                  ]
                                : [
                                    <td key={`${s.slot}r`} style={{ ...TD, background:isRec?"#c8e6c9":"#e8eeff" }}></td>,
                                    <td key={`${s.slot}a`} style={{ ...TD, textAlign:"right", fontWeight:"bold", fontSize:`${sc(11, z)}pt`, background:isRec?"#c8e6c9":"#e8eeff", paddingRight:`${sc(8, z)}px` }}>
                                      {fmt(grandTotal(s.slot))}
                                    </td>,
                                  ];
                            })}
                          </tr>

                          {/* T&C — avoid-break on tr, lineHeight scaled */}
                          {suppliers.some(s => s.terms?.trim()) && (
                            <tr className="avoid-break" style={{ verticalAlign:"top" }}>
                              <td colSpan={4} style={{ ...TD, fontWeight:"bold", textAlign:"right", background:"#f9f9f9" }}>
                                Terms &amp; Conditions
                              </td>
                              {suppliers.map(s => (
                                <td key={s.slot} colSpan={supCols(s.slot)}
                                  style={{
                                    ...TD,
                                    // original lineHeight was 1.6 — now scaled so it shrinks with zoom
                                    lineHeight: `${sc(1.6, z)}`,
                                    background: s.slot===recSlot ? "#f9fbe7" : "#fafafa",
                                  }}>
                                  {s.terms?.trim()
                                    ? s.terms.split("\n").map((line, i) => <div key={i}>{line||"\u00a0"}</div>)
                                    : <span style={{ color:"#aaa" }}>—</span>}
                                </td>
                              ))}
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Page break indicator */}
                {sIdx < sections.length - 1 && (
                  <>
                    <div
                      className="no-print cursor-pointer text-center"
                      style={{ borderTop:"1px dashed #999", margin:"8px 0", color:"#666", fontSize:"0.8rem" }}
                      onClick={() => togglePageBreak(cumulativeStart[sIdx] + section.length)}
                    >
                      — Page Break — (click to remove)
                    </div>
                    <div className="page-break" />
                  </>
                )}
              </React.Fragment>
            ))}

            {/* ── Signatories ──
                original marginTop was 48 — kept at 48 for 100%.
                paddingTop 32 (signature space) also kept for 100%.
                Both scale down with z below 100%.                    */}
            {signatories.length > 0 && (
              <table
                className="avoid-break"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginTop: `${sc(8, z)}px`,           // original: 48px
                  fontSize: `${sc(10.5, z)}pt`,          // original: 10.5pt
                }}
              >
                <tbody>
                  <tr>
                    {signatories.map(a => (
                      <td key={a.id} style={{ textAlign:"center", verticalAlign:"bottom", paddingBottom:0 }}>
                        <div style={{
                          paddingTop: `${sc(4, z)}px`,   // original: 4px
                          marginTop:  `${sc(32, z)}px`,  // original: 32px (signature space above line)
                          display: "inline-block",
                          minWidth: "75%",

                          fontSize: `${sc(10.5, z)}pt`,  // original: 10.5pt
                          fontWeight: "medium",
                        }}>
                          {a.designation}
                          {a.emp_name && (
                            <div style={{
                              fontSize: `${sc(9, z)}pt`, // original: 9pt
                              color: "#555",
                              fontWeight: "normal",
                              marginTop: `${sc(1, z)}px`,
                            }}>
                              {a.emp_name}
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
