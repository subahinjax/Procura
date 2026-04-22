"use client";

import { useState, useMemo } from "react";

interface Props {
  poId: number;
  approvedBy: string | number;
  releasedBy: string | number;
  onConfirm: (files: Record<string, File>) => void;
  onClose: () => void;
}

export default function DocumentUploadModal({
  poId,
  approvedBy,
  releasedBy,
  onConfirm,
  onClose,
}: Props) {
  const [files, setFiles] = useState<Record<string, File | null>>({});

  /**
   * ✅ PRE-RELEASE REQUIRED DOCS
   */
  const REQUIRED_DOCS = useMemo(
    () => [
      {
        key: "PO_APPROVED",
        label: "PO Approved Copy (Signed)",
      },
      {
        key: "PO_QUOTATION",
        label: "Supplier Quotation (Signed)",
      },
    ],
    []
  );


const [hasInvalidFile, setHasInvalidFile] = useState(false);


  /**
   * 📎 File selection
   */
const handleFileChange = (
  key: string,
  file?: File,
  input?: HTMLInputElement
) => {
  if (!file) return;

  const allowed = ["application/pdf", "image/jpeg", "image/png"];

  if (!allowed.includes(file.type)) {
    alert("Only PDF, JPG or PNG files are allowed");

    // ❌ clear browser-selected file
    if (input) input.value = "";

    // ❌ remove any previous valid file
    setFiles((prev) => ({ ...prev, [key]: null }));

    setHasInvalidFile(true);
    return;
  }

  setHasInvalidFile(false);
  setFiles((prev) => ({ ...prev, [key]: file }));
};





  /**
   * ❌ Cancel
   */
  const handleCancel = () => {
    setFiles({});
    onClose();
  };

  /**
   * ✅ Confirm upload (NO RELEASE HERE)
   */
  const handleConfirm = () => {
    if (hasInvalidFile) {
       alert("Please upload proper file");
       return;
    }

    const missing = REQUIRED_DOCS.filter((d) => !files[d.key]);

    if (missing.length) {
       alert("Please upload proper file");
       return;
    }


    const cleanFiles: Record<string, File> = {};
    Object.entries(files).forEach(([k, v]) => {
      if (v) cleanFiles[k] = v;
    });

    onConfirm(cleanFiles);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-4">
          Upload Approval Documents
        </h2>

        <p className="text-sm text-gray-600 mb-4">
          These documents are required before releasing the PO.
          After saving, the PO cannot be edited.
        </p>

        <div className="space-y-4">
          {REQUIRED_DOCS.map((d) => (
            <div key={d.key}>
              <label className="block font-medium mb-1">{d.label}</label>

              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) =>
                  handleFileChange(d.key, e.target.files?.[0], e.target)
                }
              />

              {files[d.key] && (
                <p className="text-sm text-green-700 mt-1">
                  Selected: {files[d.key]!.name}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded border"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Save Approval Documents
          </button>
        </div>
      </div>
    </div>
  );
}
