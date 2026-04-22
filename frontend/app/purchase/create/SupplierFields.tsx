"use client";

import { useEffect, useState } from "react";
import { PoHeader } from "@/types/po";
import { Supplier } from "@/types/supplier";

/* ================= TYPES ================= */



type SupplierFieldsProps = {
  suppliers: Supplier[];
  selectedSupplier: Supplier | null;
  setSelectedSupplier: React.Dispatch<React.SetStateAction<Supplier | null>>;
  poHeader: PoHeader;
  setPoHeader: React.Dispatch<React.SetStateAction<PoHeader>>;
};

/* ================= COMPONENT ================= */

export default function SupplierFields({
  suppliers,
  selectedSupplier,
  setSelectedSupplier,
  poHeader,
  setPoHeader,
}: SupplierFieldsProps) {
  const [showMoreFields, setShowMoreFields] = useState(false);

  /* 🔄 Sync selected supplier when PO loads (EDIT mode) */
  useEffect(() => {
    if (poHeader?.sup_id && suppliers.length > 0) {
      const sup = suppliers.find(
        (s: Supplier) => String(s.sup_id) === String(poHeader.sup_id)
      );
      setSelectedSupplier(sup || null);
    }
  }, [poHeader.sup_id, suppliers, setSelectedSupplier]);

  /* 🧠 Handle supplier change */
  const handleSupplierChange = (supId: string | number) => {
    const sup =
      suppliers.find((s: Supplier) => String(s.sup_id) === String(supId)) ||
      null;

 // 🛑 SAME supplier → do nothing
  if (String(poHeader.sup_id) === String(sup?.sup_id)) {
    return;
  }

    setSelectedSupplier(sup);

    setPoHeader((prev) => ({
      ...prev,
      sup_id: sup?.sup_id?.toString() || "",
      sup_name: sup?.sup_name || "",
      sup_add: sup?.sup_add || "",
      sup_person: sup?.sup_person || "",
      sup_phone: sup?.sup_phone || "",
      sup_email: sup?.sup_email || "",
      sup_gst: sup?.sup_gst || "",
      acct_no: sup?.acct_no || "",
      acct_name: sup?.acct_name || "",
      bank_name: sup?.bank_name || "",
      ifsc_code: sup?.ifsc_code || "",
      bank_branch: sup?.bank_branch || "",
    }));

  };

  return (
    <div>
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setShowMoreFields((prev) => !prev)}
        className="mt-3 text-blue-600 underline"
      >
        {showMoreFields ? "Hide Supplier Details ▲" : "Show Supplier Details ▼"}
      </button>

      {/* Supplier Details */}
      {selectedSupplier && showMoreFields && (
        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
          <div>
            <strong>Account No:</strong>{" "}
            {selectedSupplier.acct_no ?? "-"}
          </div>
          <div>
            <strong>Supplier Address:</strong>{" "}
            {selectedSupplier.sup_add ?? "-"}
          </div>
          <div>
            <strong>Account Name:</strong>{" "}
            {selectedSupplier.acct_name ?? "-"}
          </div>
          <div>
            <strong>GST:</strong> {selectedSupplier.sup_gst ?? "-"}
          </div>
          <div>
            <strong>Bank Name:</strong>{" "}
            {selectedSupplier.bank_name ?? "-"}
          </div>
          <div>
            <strong>Contact Person:</strong>{" "}
            {selectedSupplier.sup_person ?? "-"}
          </div>
          <div>
            <strong>Branch:</strong>{" "}
            {selectedSupplier.bank_branch ?? "-"}
          </div>
          <div>
            <strong>Email:</strong>{" "}
            {selectedSupplier.sup_email ?? "-"}
          </div>
          <div>
            <strong>IFSC Code:</strong>{" "}
            {selectedSupplier.ifsc_code ?? "-"}
          </div>
          <div>
            <strong>Phone No:</strong>{" "}
            {selectedSupplier.sup_phone ?? "-"}
          </div>
        </div>
      )}
    </div>
  );
}
