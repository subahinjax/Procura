"use client";

import { parseIndianDate, formatDateIndian } from "@/utils/dateUtils";
import type { PoHeader } from "@/types/po";
import { useState, useEffect, useRef } from "react";
import AutoExpandField from "@/components/AutoExpandField";

import { toast, dismissToast } from "@/components/ui/use-toast";


type AdvanceRequiredToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
};


function AdvanceRequiredToggle({
  value,
  onChange,
}: AdvanceRequiredToggleProps) {
  return (
    <div className="flex items-center gap-6 mt-1">
      {/* YES */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="advanceRequired"
          checked={value === true}
          onChange={() => onChange(true)}
          className="h-4 w-4 text-green-600"
        />
        <span className="text-sm font-medium">YES</span>
      </label>

      {/* NO */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          name="advanceRequired"
          checked={value === false}
          onChange={() => onChange(false)}
          className="h-4 w-4 text-red-600"
        />
        <span className="text-sm font-medium">NO</span>
      </label>
    </div>
  );
}



export default function GeneralInfoFields({
  poHeader,
  setPoHeader,
  suppliers,
  selectedSupplier,
  setSelectedSupplier,
  department,
  subDepartments,
  selectedDepartment,
  setSelectedDepartment,
  setSelectedSubDepartment,
  disabled,
  // ── CS props ──────────────────────────────────────────────────────────────
  mode,
  csList,
  selectedCsId,
  onCsSelect,
  // ─────────────────────────────────────────────────────────────────────────
}: {
  poHeader: PoHeader;
  setPoHeader: React.Dispatch<React.SetStateAction<PoHeader>>;
  suppliers: any[];
  selectedSupplier: any;
  setSelectedSupplier: (v: any) => void;
  department: any[];
  subDepartments: any[];
  selectedDepartment: any;
  setSelectedDepartment: (v: any) => void;
  setSelectedSubDepartment: (v: any) => void;
  disabled?: boolean;
  // ── CS props ──────────────────────────────────────────────────────────────
  mode?: string;
  csList?: any[];
  selectedCsId?: string;
  onCsSelect?: (csId: string) => void;
  // ─────────────────────────────────────────────────────────────────────────
}) {
const inputClass =
  "w-full h-10 px-4 py-2 border border-gray-400 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-500 mb-2";

const handleSupplierChange = (supId: number) => {
  const sup = suppliers.find((s: any) => s.sup_id === supId) || null;

  if (!sup) return;

  const requiredFields = [
    sup.sup_name,
    sup.sup_add,
    sup.sup_person,
    sup.sup_phone,
    sup.sup_email,
    sup.sup_gst,
    sup.acct_no,
    sup.acct_name,
    sup.bank_name,
    sup.ifsc_code,
    sup.bank_branch
  ];

  const hasMissingField = requiredFields.some(
    (field) => field === null || field === undefined || String(field).trim() === ""
  );

  if (hasMissingField) {
     toast({
        title: "Incomplete Supplier",
        description: "Fill in all supplier details and select.",
        variant: "destructive"
    });


    setSelectedSupplier(null);
    setSupplierSearch("");

    setPoHeader((prev: any) => ({
      ...prev,
      sup_id: 0,
      sup_name: "",
      sup_add: "",
      sup_person: "",
      sup_phone: "",
      sup_email: "",
      sup_gst: "",
      acct_no: "",
      acct_name: "",
      bank_name: "",
      ifsc_code: "",
      bank_branch: ""
    }));

    setShowSupplierDropdown(false);
    return;
  }

  setSelectedSupplier(sup);

  setPoHeader((prev: any) => ({
    ...prev,
    sup_id: sup?.sup_id || 0,
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
    bank_branch: sup?.bank_branch || ""
  }));

  setShowSupplierDropdown(false);
};

const [supplierSearch, setSupplierSearch] = useState("");
const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
const supplierRef = useRef<HTMLDivElement | null>(null);


useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (supplierRef.current && !supplierRef.current.contains(event.target as Node)) {
      setShowSupplierDropdown(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);




return (
<>

  {/* ── PO No (left) + CS No (right) — same row ───────────────────────── */}
  <div className="flex items-center justify-between gap-4 mb-0 mt-1">

    {/* PO No — left (unchanged) */}
    <div className="flex items-center gap-0">
      <label className="text-base font-bold h-8 px-4 mt-1">
        Po No.
      </label>
      <input
        type="text"
        className={`${inputClass} !w-96 h-8 !bg-violet-50 border-violet-200 cursor-not-allowed mt-1`}
        value={poHeader.po_no || ""}
        readOnly
        maxLength={100}
      />
    </div>

    {/* CS No — right, only in create mode */}
    {mode === "create" && (
      <div className="flex items-center gap-2 mt-1 mr-4">
        <label className="text-sm font-semibold text-gray-600 whitespace-nowrap">
          CS No.
          <span className="ml-1 text-gray-400 font-normal text-xs">(optional)</span>
        </label>
        <select
          value={selectedCsId || ""}
          onChange={e => onCsSelect?.(e.target.value)}
          disabled={disabled}
          className="border border-gray-400 rounded-md px-3 py-1.5 text-sm w-72 focus:ring-1 focus:ring-blue-300 outline-none"
        >
          <option value="">-- Select CS to Import --</option>
          {(csList || []).map((cs: any) => (
            <option key={cs.id} value={String(cs.id)}>
              {cs.cs_no}{cs.description ? ` — ${cs.description}` : ""}
            </option>
          ))}
        </select>
      </div>
    )}

  </div>
  {/* ──────────────────────────────────────────────────────────────────── */}



<fieldset disabled={disabled} className="px-4 bg-white rounded-md shadow mt-0">

{/* PO Type */}
{/* Row 1 */}

<div className="grid grid-cols-4 gap-4">

 
<div className="flex flex-col gap-1 mb-1 mt-2">
  <label className="text-sm font-medium">PO Type</label>

  <select
    className={`${inputClass} w-56`}
    value={poHeader.po_type}
    onChange={(e) =>
      setPoHeader({
        ...poHeader,
        po_type: e.target.value,
      })
    }
  >
    <option value="">Select</option>
    <option value="PO">Purchase Order</option>
    <option value="WO">Work Order</option>
  </select>
</div>




      {/* PO Date */}
     <div>
	<label className="block text-sm font-medium mb-1 mt-2">PO Date</label>
	<input
	    type="date"
	    className={inputClass}
	    value={poHeader.po_date ? parseIndianDate(poHeader.po_date) : ""}
	    onChange={(e) =>
	    setPoHeader({ ...poHeader, po_date: formatDateIndian(e.target.value) })
	 }
	/>
     </div>

{/* Department */}
<div>
  <label className="block text-sm font-medium mb-1 mt-2">Department</label>
  <select
  className={inputClass}
  value={poHeader.dept_id || ""}
  onChange={(e) => {
    const deptId = e.target.value;

    const deptObj =
      department.find(
        (d: any) => String(d.dept_id) === deptId
      ) || null;

    setPoHeader((prev) => ({
      ...prev,
      dept_id: deptId,
      subdept_id: "",
    }));

    setSelectedDepartment(deptObj);
  }}
 >
    <option value="">Select Department</option>
    {department?.map((d: any) => (
      <option key={d.dept_id} value={d.dept_id}>
        {d.dept_name}
      </option>
    ))}
  </select>
</div>

{/* Sub-Department */}
<div>
  <label className="block text-sm font-medium mb-1 mt-2">Sub-Department</label>
<select
  className={inputClass}
  value={poHeader.subdept_id || ""}
  onChange={(e) => {
    const subDeptId = e.target.value;

    const selectedSub =
      subDepartments.find(
        (sd: any) => String(sd.subdept_id) === subDeptId
      ) || null;

    setPoHeader((prev) => ({
      ...prev,
      subdept_id: subDeptId,
    }));

    setSelectedSubDepartment(selectedSub);
  }}
  >
    <option value="">Select Sub-Department</option>
    {subDepartments?.map((sd: any) => (
      <option key={sd.subdept_id} value={sd.subdept_id}>
        {sd.subdept_name}
      </option>
    ))}
  </select>
</div>



    </div>

    {/* Row 2 */}
    <div className="grid grid-cols-4 gap-4 mt-0">
      {/* Supplier */}
      <div>
        <label className="block text-sm font-medium mb-1">Supplier</label>
<div className="relative" ref={supplierRef}>
  <input
    type="text"
    className={inputClass}
    value={
      showSupplierDropdown
        ? supplierSearch
        : selectedSupplier?.sup_name || ""
    }
    onFocus={() => {
      setSupplierSearch(selectedSupplier?.sup_name || "");
      setShowSupplierDropdown(true);
    }}
    onChange={(e) => {
      setSupplierSearch(e.target.value);
      setShowSupplierDropdown(true);
    }}
  />

  {showSupplierDropdown && (
    <div className="absolute z-50 bg-white border border-gray-300 w-full max-h-48 overflow-y-auto shadow-md rounded-md mt-1">
      {suppliers
        .filter((s: any) =>
          s.sup_name
            .toLowerCase()
            .includes(supplierSearch.toLowerCase())
        )
        .map((s: any) => (
          <div
            key={s.sup_id}
            className="px-3 py-1 hover:bg-blue-100 cursor-pointer text-sm"
            onClick={() => {
              handleSupplierChange(s.sup_id);
              setShowSupplierDropdown(false);
            }}
          >
            {s.sup_name}
          </div>
        ))}

      {suppliers.filter((s: any) =>
        s.sup_name
          .toLowerCase()
          .includes(supplierSearch.toLowerCase())
      ).length === 0 && (
        <div className="px-3 py-2 text-gray-500 text-sm">
          No suppliers found
        </div>
      )}
    </div>
  )}
</div>

      </div>



      {/* Quotation */}

<AutoExpandField
  label="Quot. No & Date"
  value={poHeader.quot_no || ""}
  maxLength={100}
  warningLength={90}
  onChange={(val) =>
    setPoHeader({
      ...poHeader,
      quot_no: val,
    })
  }
/>



      {/* Delivery Days */}
<AutoExpandField
  label="Delivery Days"
  value={poHeader.del_day || ""}
  maxLength={100}
  warningLength={90}
  onChange={(val) =>
    setPoHeader({ ...poHeader, del_day: val })
  }
/>



<AutoExpandField
  label="Warranty"
  value={poHeader.warranty || ""}
  maxLength={100}
  warningLength={90}
  onChange={(val) =>
    setPoHeader({ ...poHeader, warranty: val })
  }
/>

    </div>



    {/* Row 3 */}
    <div className="grid grid-cols-4 gap-x-4 gap-y-0 mt-0">
      {/* Freight */}
<AutoExpandField
  label="Freight"
  value={poHeader.freight || ""}
  maxLength={200}
  warningLength={180}
  onChange={(val) =>
    setPoHeader({ ...poHeader, freight: val })
  }
/>




      {/* Payment Terms */}
<AutoExpandField
  label="Payment Terms"
  value={poHeader.pay_term || ""}
  maxLength={200}
  warningLength={180}
  onChange={(val) =>
    setPoHeader({ ...poHeader, pay_term: val })
  }
/>



      {/* Advance Payment */}
      <div className="mt-0 px-9">
 	<label className=" text-sm font-medium">Advance Required</label>
	   <AdvanceRequiredToggle
	   value={poHeader.advance_required}
	   onChange={(val) => {
	   setPoHeader({
	   ...poHeader,
	   advance_required: val,
	   advance_percent: val ? poHeader.advance_percent : ""
	   });
	  }}
	/>
      </div>


{/* Advance Percentage */}
<div>
  <label className="block text-sm font-medium mb-1">
    Advance Percentage
  </label>

  <input
    type="text"
    inputMode="numeric"
    disabled={!poHeader.advance_required}
    className={`${inputClass} ${
      !poHeader.advance_required ? "bg-gray-200 cursor-not-allowed" : ""
    }`}
    value={poHeader.advance_required ? (poHeader.advance_percent || "") : ""}
    onChange={(e) => {
      if (!poHeader.advance_required) return;

      let value = e.target.value.replace(/[^0-9]/g, "");

      if (value !== "" && Number(value) > 100) {
        value = "100";
      }

      setPoHeader({
        ...poHeader,
        advance_percent: value,
      });
    }}
  />
</div>

      {/* PO Title */}
      <div className="col-span-2">
        <label className="block text-sm font-medium mb-1">
          Purchase Order Title
        </label>
        <input
          type="text"
          className={inputClass}
          value={poHeader.po_title || ""}
          onChange={(e) =>
            setPoHeader({ ...poHeader, po_title: e.target.value })
          }
        />
      </div>
    </div>
  </fieldset>
</>
);
}
