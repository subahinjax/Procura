"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { API_BASE_URL } from "@/lib/api";

export default function ReleasedUploadPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.id as string;

  const [file, setFile] = useState<File | null>(null);
  const [invalidFile, setInvalidFile] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * 🔒 File validation (same as approved flow)
   */
  const handleFileChange = (
    selected?: File,
    input?: HTMLInputElement
  ) => {
    if (!selected) return;

    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];

    if (!allowed.includes(selected.type)) {
      alert("Only PDF, JPG or PNG files are allowed");
      if (input) input.value = ""; // ❌ remove filename
      setFile(null);
      setInvalidFile(true);
      return;
    }

    setInvalidFile(false);
    setFile(selected);
  };

  /**
   * 🚀 Upload + Release
   */
  const handleUpload = async () => {
    if (!file || invalidFile) {
      alert("Please upload proper file");
      return;
    }

    try {
      setLoading(true);

      // 1️⃣ Upload Released document
      const formData = new FormData();
      formData.append("PO_RELEASED", file);

      const uploadRes = await fetch(
        `/api/proxy/purchase-orders/${poId}/documents/release`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        }
      );

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        alert(uploadData.error || "Document upload failed");
        return;
      }

      // 2️⃣ Release PO
      const releaseRes = await fetch(
        `/api/proxy/purchase-orders/${poId}/release`,
        {
          method: "PUT",
          credentials: "include",
        }
      );

      let releaseData: any = {};
	try {
	  releaseData = await releaseRes.json();
	} catch {
	  // response was NOT JSON (HTML / 404 page)
	}

      if (!releaseRes.ok) {
         alert(releaseData.error || "Failed to release PO");
         return;
      }

      alert("PO Released successfully");

      // 3️⃣ Redirect
      router.push("/purchase/modify");

    } catch (err: any) {
      alert(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white shadow rounded">
      <h1 className="text-xl font-bold mb-4">
        Upload Released Copy
      </h1>

      <p className="text-gray-600 mb-4">
        PO ID: {poId}
      </p>

      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) =>
          handleFileChange(
            e.target.files?.[0],
            e.target
          )
        }
        className="mb-4"
      />

      <button
        onClick={handleUpload}
        disabled={loading}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "Uploading..." : "Upload & Release"}
      </button>
    </div>
  );
}
