export const PO_DOCUMENT_TYPES = {
  PO_APPROVED: "PO_APPROVED",
  SUPPLIER_QUOTATION: "SUPPLIER_QUOTATION",
  PO_RELEASED: "PO_RELEASED",
} as const;

/* =========================
   STAGE-2 : APPROVAL UI
   ========================= */
export const APPROVAL_DOCS = [
  { key: "PO_APPROVED", label: "PO Approved Copy (Signed)" },
  { key: "SUPPLIER_QUOTATION", label: "Supplier Quotation (Signed)" },
];

/* =========================
   STAGE-3 : RELEASE UI
   ========================= */
export const RELEASE_DOCS = [
  { key: "PO_RELEASED", label: "PO Released Copy (Signed)" },
];