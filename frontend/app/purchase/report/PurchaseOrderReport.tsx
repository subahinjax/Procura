"use client";
import React, { useEffect, useState } from "react";
import numberToWords from "@/utils/numberToWords";
import { formatDateIndian } from "@/utils/dateUtils";
import { formatAmount } from "@/utils/numberUtils";
import { API_BASE_URL } from "@/lib/api";

interface UserSignature {
  id: number;
  name: string;
  desig: string;
}

export interface PurchaseOrderHeader {
  id?: number;
  po_no: string;
  po_date: string;
  po_title: string;
  sup_id: string;
  sup_name: string;
  sup_add: string;
  sup_person: string;
  sup_email: string;
  sup_phone: string;
  quot_no: string;
  del_day: string;
  warranty: string;
  freight: string;
  pay_term: string;
  sup_gst: string;
  acct_name: string;
  acct_no: string;
  bank_name: string;
  ifsc_code: string;
  bank_branch: string;
  approved_by: number | string;
  released_by?: number | string;
  prepared_by: string;
  review_by: string;
  prepared_review: string;
  sub_total: number;
  gst_total: number;
  grand_total: number;
}

interface Item {
  item_name: string;
  description: string;
  qty: number;
  rate: number;
  unit: string;
  unitPrice?: number;
  amount: number;
  hsn_code: string;
  gst_per?: number;
}

interface Term {
  term_id?: number;
  title?: string;
  content: string;
}

// ── NEW: other charge type ─────────────────────────────────────────────────────
interface OtherCharge {
  id?: number;
  item_code?: string;
  item_name: string;
  amount: number;
  is_discount: boolean;
}
// ──────────────────────────────────────────────────────────────────────────────

interface PurchaseOrderData {
  header: PurchaseOrderHeader;
  items: Item[];
  terms: Term[];
  other_charges?: OtherCharge[];   // ── NEW (optional — safe for old POs)
}

interface Props {
  poData: PurchaseOrderData;
}

const PurchaseOrderReport: React.FC<Props> = ({ poData }) => {
  const [approvers,   setApprovers]   = useState<UserSignature[]>([]);
  const [pageBreaks,  setPageBreaks]  = useState<number[]>([]);
  const [termBreaks,  setTermBreaks]  = useState<number[]>([]);

  const togglePageBreak = (index: number) => {
    setPageBreaks(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const toggleTermBreak = (key: number) => {
    setTermBreaks(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]
    );
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/approvers`, { credentials: "include" })
      .then(res => res.json())
      .then(setApprovers);
  }, []);

  const approver = approvers.find(a => a.id === Number(poData.header?.approved_by));
  const releaser = approvers.find(a => a.id === Number(poData.header?.released_by));

  // ── NEW: derive other charge totals for display ───────────────────────────
  const otherCharges      = poData.other_charges || [];
  const chargesAddition   = otherCharges
    .filter(oc => !oc.is_discount)
    .reduce((s, oc) => s + Number(oc.amount), 0);
  const chargesDeduction  = otherCharges
    .filter(oc => oc.is_discount)
    .reduce((s, oc) => s + Number(oc.amount), 0);
  const hasOtherCharges   = otherCharges.length > 0;

const taxableTotal =
  Number(poData.header.sub_total || 0) - chargesDeduction;

const hasDiscount   = chargesDeduction > 0;
const hasGST        = Number(poData.header.gst_total) > 0;
const hasAdditions  = chargesAddition > 0;

// FINAL condition
const showOnlyGrandTotal = !hasDiscount && !hasGST && !hasAdditions;
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="print-a4 print-safe bg-white text-base">

        {/* Title */}
        <h1 className="border border-black text-center text-lg font-bold mb-0">
          P U R C H A S E &nbsp; O R D E R
        </h1>

        {/* Header Section */}
        <div className="grid grid-cols-[39.95%_60.05%] leading-tight">
          {/* Left */}
          <div className="px-1 border-b border-l border-black">
            <p>
              <span className="text-[16px] font-semibold">Vendor Code :</span>{" "}
              <span className="text-[15px]">VND-{String(poData.header.sup_id).padStart(4, "0")}</span>
            </p>
            <div className="text-[16px] leading-[1]">
              <p className="font-medium">M/s. {poData.header.sup_name}</p>
              {poData.header.sup_add    && <p>Address: {poData.header.sup_add}</p>}
              {poData.header.sup_person && <p>Contact: {poData.header.sup_person}</p>}
              {poData.header.sup_email  && <p>Email: {poData.header.sup_email}</p>}
              {poData.header.sup_phone  && <p>Phone No.: {poData.header.sup_phone}</p>}
            </div>
          </div>

          {/* Right */}
          <div className="text-base leading-tight border-l border-r border-black">
            <div className="grid grid-cols-[30%_70%] border-b border-black divide-x divide-black">
              <p className="px-1 text-[14px] font-semibold leading-[1.5]">PO NO & DATE</p>
              <p className="px-1 text-[15px]">{poData.header.po_no} dt. {formatDateIndian(poData.header.po_date)}</p>
            </div>
            <div className="grid grid-cols-[30%_70%] divide-x divide-black border-b border-black">
              <p className="px-1 text-[14px] font-semibold leading-[1.5]">QTN NO & DATE</p>
              <p className="px-1 text-[15.5px]">{poData.header.quot_no}</p>
            </div>
            <div className="grid grid-cols-[30%_70%] divide-x divide-black border-b border-black">
              <p className="px-1 text-[14px] font-semibold leading-[1.5]">DELIVERY</p>
              <p className="px-1 text-[15.5px]">{poData.header.del_day}</p>
            </div>
            <div className="grid grid-cols-[30%_70%] divide-x divide-black border-b border-black">
              <p className="px-1 text-[14px] font-semibold leading-[1.5]">WARRANTY</p>
              <p className="px-1 text-[15.5px]">{poData.header.warranty}</p>
            </div>
            <div className="grid grid-cols-[30%_70%] divide-x divide-black border-b border-black">
              <p className="px-1 text-[14px] font-semibold leading-[1.5]">FREIGHT</p>
              <p className="px-1 text-[15.5px]">{poData.header.freight}</p>
            </div>
            <div className="grid grid-cols-[30%_70%] divide-x divide-black border-b border-black">
              <p className="px-1 text-[14px] font-semibold leading-[1.5]">PAYMENT TERMS</p>
              <p className="px-1 text-[15.5px]">{poData.header.pay_term}</p>
            </div>
            <div className="grid grid-cols-[30%_70%] divide-x divide-black border-b border-black">
              <p className="px-1 text-[14px] font-semibold leading-[1.5]">OUR GST NO</p>
              <p className="px-1 text-[14.5px]">33AAATH6508A2Z9</p>
            </div>
            <div className="grid grid-cols-[30%_70%] divide-x divide-black border-b border-black">
              <p className="px-1 text-[14px] font-semibold leading-[1.5]">VENDOR GST NO</p>
              <p className="px-1 text-[14.5px]">{poData.header.sup_gst}</p>
            </div>
          </div>
        </div>

        {/* Bill To / Bank Headers */}
        <div className="grid grid-cols-[40%_60%] border-b border-l border-black leading-snug">
          <div className="px-1 border-r border-black bg-gray-300">
            <p><strong>Bill and Deliver to:</strong></p>
          </div>
          <div className="px-1 border-r border-black bg-gray-300">
            <p><strong>Bank Details:</strong></p>
          </div>
        </div>

        {/* Bill To / Bank Details */}
        <div className="grid grid-cols-[40%_60%] border border-t-0 border-black">
          <div className="px-1 border-r border-black leading-[1]">
            <p className="text-[16px] font-medium">Hindustan Institute of Technology & Science</p>
            <p>No.1, Rajiv Gandhi Salai, OMR Road</p>
            <p>Padur, Kelambakkam</p>
            <p>Chennai 603 103</p>
            <p>Ph. +91 44 2747 4395 / 27474262</p>
          </div>
          <div className="px-1 text-[16px] tracking-normal leading-[1]">
            <p>Account Name: {poData.header.acct_name  || "-"}</p>
            <p>Account No: {poData.header.acct_no      || "-"}</p>
            <p>Bank Name: {poData.header.bank_name     || "-"}</p>
            <p>IFSC: {poData.header.ifsc_code          || "-"}</p>
            <p>Branch: {poData.header.bank_branch      || "-"}</p>
          </div>
        </div>

        {/* Preamble */}
        <div className="px-1 border-r border-l border-black text-[16px] text-justify leading-[1] mb-[4px]">
          We are pleased to place our confirm purchase order for the items mentioned below.
          Kindly acknowledge receipt of this order and supply the goods as per the delivery schedule.
        </div>

        {/* ── Item Table Sections ─────────────────────────────────────────────── */}
        {(() => {
          const breakPoints: number[] = [...pageBreaks.map(Number)].sort((a, b) => a - b);
          breakPoints.push(poData.items.length);

          let lastIndex = 0;
          const sections: Item[][] = [];
          breakPoints.forEach(breakIndex => {
            const slice = poData.items.slice(lastIndex, breakIndex);
            if (slice.length > 0) sections.push(slice);
            lastIndex = breakIndex;
          });

          const cumulativeStart = sections.map(
            (_, i) => sections.slice(0, i).reduce((sum, sec) => sum + sec.length, 0)
          );

          return sections.map((section, sIdx) => (
            <React.Fragment key={sIdx}>
              <div className="table-section">
                <table className="po-table border-collapse text-base w-full table-fixed">
                  <colgroup>
                    <col className="w-[5%]"  />
                    <col className="w-[40%]" />
                    <col className="w-[10%]" />
                    <col className="w-[6%]"  />
                    <col className="w-[9%]"  />
                    <col className="w-[7%]"  />
                    <col className="w-[10%]" />
                    <col className="w-[13%]" />
                  </colgroup>

                  <thead className="bg-gray-300 text-sm font-medium leading-[1.3]">
                    <tr>
                      <th className="border border-black px-0 py-0">S.NO.</th>
                      <th className="border border-black px-1 py-0">ITEM NAME</th>
                      <th className="border border-black px-1 py-0">HSN/SAC Code</th>
                      <th className="border border-black px-1 py-0">GST %</th>
                      <th className="border border-black px-1 py-0">QTY</th>
                      <th className="border border-black px-1 py-0">UOM</th>
                      <th className="border border-black px-1 py-0">UNIT PRICE</th>
                      <th className="border border-black px-1 py-0">AMOUNT (INR)</th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* PO Title — first section only */}
                    {sIdx === 0 && poData.header.po_title && (
                      <tr>
                        <td colSpan={8} className="border border-black text-center text-base font-medium bg-gray-50">
                          {poData.header.po_title}
                        </td>
                      </tr>
                    )}

                    {/* Item rows */}
                    {section.map((item, idx) => {
                      const globalIndex = cumulativeStart[sIdx] + idx;
                      return (
                        <tr
                          key={globalIndex}
                          className="print-item-row page-break-inside-avoid hover:bg-yellow-100 cursor-pointer"

                          onClick={() => togglePageBreak(globalIndex)}
                          title="Click to add/remove page break"
                        >
                          <td className="border border-black px-0 text-center">{globalIndex + 1}</td>
                          <td className="border border-black px-2">{`${item.item_name} ${item.description}`}</td>
                          <td className="border border-black px-0 text-center">{item.hsn_code || "-"}</td>
                          <td className="border border-black px-0 text-center">{item.gst_per  || "-"}</td>
                          <td className="border border-black px-1 text-right">{item.qty}</td>
                          <td className="border border-black px-0 text-center">{item.unit}</td>
                          <td className="border border-black px-1 text-right">{item.rate}</td>
                          <td className="border border-black px-1 text-right">{formatAmount(item.amount)}</td>
                        </tr>
                      );
                    })}

                    {/* ── Totals — last section only ─────────────────────────── */}
                    {sIdx === sections.length - 1 && section.length > 0 && (
                      <>
                        {/* Sub Total */}
			{!showOnlyGrandTotal && (
                        <tr>
                          <td colSpan={7} className="border border-black text-right px-1 text-[15.5px] font-medium">
                            Sub Total
                          </td>
                          <td className="border border-black text-right px-1 text-[15.5px] font-medium">
                            {formatAmount(poData.header.sub_total)}
                          </td>
                        </tr>
			)}


                        {/* ── Other Charges rows (one row per charge) ──── */}
{/* Discount Charges (First) */}
{hasDiscount &&
 otherCharges
  .filter(oc => oc.is_discount)
  .map((oc, i) => (
    <tr key={`disc-${i}`}>
      <td colSpan={7} className="border border-black text-right px-1">
        {oc.item_name} (-)
      </td>
      <td className="border border-black text-right px-1">
        {formatAmount(Number(oc.amount))}
      </td>
    </tr>
  ))}

{hasDiscount && (
  <tr>
    <td colSpan={7} className="border border-black text-right px-1 text-[15.5px] font-medium">
      Taxable Total
    </td>
    <td className="border border-black text-right px-1 text-[15.5px] font-medium">
      {formatAmount(taxableTotal)}
    </td>
  </tr>
)}


                        {/* GST */}
{hasGST && (
  <tr>
    <td colSpan={7} className="border border-black text-right px-1">
      GST Total
    </td>
    <td className="border border-black text-right px-1">
      {formatAmount(poData.header.gst_total)}
    </td>
  </tr>
)}

{/* Other Charges (After GST) */}
{hasAdditions &&
  otherCharges
    .filter(oc => !oc.is_discount)
    .map((oc, i) => (
      <tr key={`add-${i}`}>
        <td colSpan={7} className="border border-black text-right px-1">
          {oc.item_name}
        </td>
        <td className="border border-black text-right px-1">
          {formatAmount(Number(oc.amount))}
        </td>
      </tr>
    ))}


                        {/* Grand Total */}
<tr className="">
  <td colSpan={5} className="text-center border border-black text-sm font-medium whitespace-nowrap">
    {numberToWords(Number(poData.header.grand_total))}
  </td>
  <td colSpan={2} className="border border-black text-right text-[15.5px] font-bold px-.5">
    Grand Total (R/O)
  </td>
  <td className="border border-black text-right text-[15.5px] font-bold px-1">
    {formatAmount(poData.header.grand_total)}
  </td>
</tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Page break indicator */}
              {sIdx < sections.length - 1 && (
                <>
                  <div
                    className="no-print cursor-pointer text-center text-gray-600 border-t border-dashed border-gray-400 py-1"
                    onClick={() => togglePageBreak(cumulativeStart[sIdx] + section.length)}
                  >
                    — Page Break — (click to remove)
                  </div>
                  <div className="page-break" />
                </>
              )}
            </React.Fragment>
          ));
        })()}

        {/* ── Terms & Conditions ────────────────────────────────────────────── */}
        {(() => {
          if (!poData.terms || poData.terms.length === 0) {
            return (
              <div className="border border-black border-t-0 p-0 mt-0 leading-none first-page">
                <h2 className="text-base underline mb-0">TERMS AND CONDITIONS :-</h2>
                <ol className="list-decimal ml-4 text-xs"><li>No terms specified.</li></ol>
              </div>
            );
          }

          const sections: React.ReactNode[][] = [];
          let currentTerms: React.ReactNode[] = [];

          poData.terms.forEach((term, idx) => {
            const isBreakHere = termBreaks.includes(idx);
            currentTerms.push(
              <li
                key={idx}
                onClick={() => toggleTermBreak(idx)}
                title="Click to add/remove page break"
                className="cursor-pointer avoid-break"
              >
                <div className="term-content">
                  {typeof term === "string" ? term : term.content}
                </div>
              </li>
            );
            if (isBreakHere) { sections.push(currentTerms); currentTerms = []; }
          });

          if (currentTerms.length > 0) sections.push(currentTerms);

          let termCounter = 1;
          return sections.map((termsGroup, sectionIdx) => {
            const startNumber = termCounter;
            termCounter += termsGroup.length;
            return (
              <React.Fragment key={sectionIdx}>
                {sectionIdx > 0 && <div className="page-break" />}
                <div className={`border border-black p-1 leading-tight ${sectionIdx === 0 ? "border-t-0 first-page" : ""}`}>
                  <h2 className="text-[14px] font-semibold underline leading-none mb-0">
                    TERMS AND CONDITIONS :-
                  </h2>
                  <ol className="list-decimal ml-4 text-[16px] text-justify leading-[1.05] mt-[3px]" start={startNumber}>
                    {termsGroup}
                  </ol>
                </div>
              </React.Fragment>
            );
          });
        })()}

        {/* ── Signatures ───────────────────────────────────────────────────── */}
        <div className="approval-group avoid-break border-l border-r border-b border-black">
          <div className="grid grid-cols-[45%_55%] px-1 divide-x divide-black text-[16px]">
            {/* Left */}
            <div className="text-left mt-1">
              {poData.header.prepared_review ? (
                <>
                  <p className="text-center">Prepared & Reviewed by</p>
                  <br /><br />
                  <p className="text-center mt-5">{poData.header.prepared_review}</p>
                </>
              ) : (
                <>
                  <p>Prepared by:</p>
                  <p className="text-center mt-4">{poData.header.prepared_by}</p>
                  <p className="mt-0">Reviewed by:</p>

                  <p className="text-center mt-4">{poData.header.review_by}</p>
                </>
              )}
            </div>
            {/* Right */}
            <div className="text-center font-semibold text-[15px] mt-0">
              <p className="italic">For HINDUSTAN INSTITUTE OF TECHNOLOGY &amp; SCIENCE</p>
              <br /><br />
              <p className="text-center font-semibold text-[15px] leading-none mt-4">
                {releaser?.name || approver?.name || "__________"}
              </p>
              <p className="text-center font-semibold text-[15px] leading-none mt-0">
                {releaser?.desig || approver?.desig || ""}
              </p>
            </div>
          </div>
        </div>

        {/* Vendor Acceptance */}
        <div className="vendor-acceptance mt-0 px-0 avoid-break">
          <p className="italic font-semibold text-xs mt-1">ACCEPTED BY THE VENDOR:</p>
          <div className="vendor-dash" />
        </div>

      </div>
    </>
  );
};

export default PurchaseOrderReport;
