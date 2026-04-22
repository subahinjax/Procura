"use client";

import { useEffect, useState } from "react";
import { hasAccess } from "@/lib/accessControl";
import { useAuth } from "@/context/AuthContext";
import type { PoHeader } from "@/types/po";

type SavedPOHeader = {
  id?: number;
  approved_by?: number | null;
  released_by?: number | null;
};

type ApproverFieldsProps = {
  poHeader: PoHeader;
  setPoHeader: React.Dispatch<React.SetStateAction<PoHeader>>;
  approvers: { id: number; name: string }[];
  disabled?: boolean;
  savedHeader?: SavedPOHeader;
  onReleasedSelected?: (id: number) => void;
  mode?: "create" | "edit" | "view";   // ← NEW
};

export default function ApproverFields({
  poHeader,
  setPoHeader,
  approvers,
  disabled = false,
  savedHeader,
  onReleasedSelected,
  mode = "create",               // ← NEW
}: ApproverFieldsProps) {

  const disablePreparedReviewed =
    (poHeader?.prepared_by?.trim() || "") !== "" ||
    (poHeader?.review_by?.trim() || "") !== "";

  const disablePreparedAndReviewed =
    (poHeader?.prepared_review?.trim() || "") !== "";

  const reviewedByMissing =
    (poHeader?.prepared_by?.trim() || "") !== "" &&
    (poHeader?.review_by?.trim() || "") === "";

  const preparedByMissing =
    (poHeader?.review_by?.trim() || "") !== "" &&
    (poHeader?.prepared_by?.trim() || "") === "";

  // Use AuthContext — localStorage does NOT store user in this app
  const { user } = useAuth();
  const canRelease = hasAccess(user?.user_type ?? null, "RELEASE_PO");

  // ── KEY FIX ──────────────────────────────────────────────────────────────
  // Use poHeader.approved_by (live form value) NOT savedHeader?.approved_by
  // savedHeader only updates after DB save — so in create mode it's always null
  // Remove !poHeader.id check — in create mode id doesn't exist until after save
  // User flow: select Approved By → Released By enables → select Released By
  //            → Save → upload modal → PO saved with Released status
  const releasedByDisabled =
    mode === "create" ||            // ← NEW: always disabled in create mode
    !canRelease ||                  // user must have RELEASE_PO access
    !poHeader.approved_by ||        // Approved By must be selected (live form value)
    !!savedHeader?.released_by;     // already released → permanently locked
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <fieldset disabled={disabled}>
      <div className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-2">

          {/* Prepared By */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Prepared By :</label>
              <span className="text-xs text-gray-500">{(poHeader.prepared_by || "").length}/50</span>
            </div>
            <input
              type="text"
              placeholder="Prepared By"
              maxLength={50}
              disabled={disablePreparedAndReviewed}
              className={`w-full h-10 px-4 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-500 mb-2 ${
                disablePreparedAndReviewed
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : preparedByMissing ? "border-red-500" : "border-gray-300"
              }`}
              value={poHeader.prepared_by || ""}
              onChange={(e) => setPoHeader({ ...poHeader, prepared_by: e.target.value.slice(0, 50) })}
            />
          </div>

          {/* Reviewed By */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Reviewed By</label>
              <span className="text-xs text-gray-500">{(poHeader.review_by || "").length}/50</span>
            </div>
            <input
              type="text"
              placeholder="Reviewed By"
              maxLength={50}
              disabled={disablePreparedAndReviewed}
              className={`w-full h-10 px-4 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-500 mb-2 ${
                disablePreparedAndReviewed
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : reviewedByMissing ? "border-red-500" : "border-gray-300"
              }`}
              value={poHeader.review_by || ""}
              onChange={(e) => setPoHeader({ ...poHeader, review_by: e.target.value.slice(0, 50) })}
            />
          </div>

          {/* Prepared & Reviewed By */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Prepared & Reviewed By</label>
              <span className="text-xs text-gray-500">{(poHeader.prepared_review || "").length}/50</span>
            </div>
            <input
              type="text"
              placeholder="Prepared & Reviewed By"
              maxLength={50}
              disabled={disablePreparedReviewed}
              className={`w-full h-10 px-4 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-500 mb-2 ${
                disablePreparedReviewed
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "border-gray-300"
              }`}
              value={poHeader.prepared_review || ""}
              onChange={(e) => {
                const val = e.target.value.slice(0, 50);
                setPoHeader({
                  ...poHeader,
                  prepared_review: val,
                  prepared_by: val ? "" : poHeader.prepared_by,
                  review_by:   val ? "" : poHeader.review_by,
                });
              }}
            />
          </div>

          {/* Approved By */}
          <div>
            <label className="block text-sm font-medium">Approved By</label>
            <select
              className="w-full h-10 px-4 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-500 mb-2 mt-1"
              value={poHeader.approved_by ?? ""}
              onChange={(e) => setPoHeader({ ...poHeader, approved_by: e.target.value || null })}
              disabled={!!poHeader.released_by}
            >
              <option value="">-- Select Approver --</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Released By */}
          <div>
            <label className="block text-sm font-medium">Released By</label>
            <select
              className={`w-full h-10 px-4 py-2 border border-gray-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-500 mt-1 ${
                releasedByDisabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""
              }`}
              value={poHeader.released_by || ""}
              onChange={(e) => {
                const value = e.target.value;
                setPoHeader((prev: PoHeader) => ({ ...prev, released_by: value || null }));
                if (value) onReleasedSelected?.(Number(value));
              }}
              disabled={releasedByDisabled}
            >
              <option value="">-- Select Released By --</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {!poHeader.approved_by && (
              <p className="text-xs text-gray-500 mt-1">
                Please Save <b>Approved By</b> first
              </p>
            )}
          </div>

        </div>
      </div>
    </fieldset>
  );
}
