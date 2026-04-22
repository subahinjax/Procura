"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import CreatePOForm from "./CreatePOForm";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";

export default function CreatePOClient() {
  useAuthGuard(); // ✅ ONLY guard

  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const modeParam = searchParams.get("mode");
  const id = searchParams.get("id");
  const copyId = searchParams.get("copyId");

  const [existingPO, setExistingPO] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(false);

  // ⛔ Block UI until auth ready
  if (loading) {
    return <div className="p-4 text-gray-600">Checking authentication...</div>;
  }

  if (!user) {
    return null; // useAuthGuard will redirect
  }

  const safeMode: "view" | "edit" | "create" =
    modeParam === "view" || modeParam === "edit" || modeParam === "create"
      ? modeParam
      : "create";

  // 📦 Fetch PO only after auth confirmed
  useEffect(() => {
    if (!user) return;

    const fetchPO = async (poId: string, isCopy: boolean) => {
      try {
        setPageLoading(true);

        const res = await fetch(
          `${API_BASE_URL}/api/purchase-orders/${poId}`,
          { credentials: "include" }
        );

        if (res.status === 401) {
          // Let AuthContext handle session expiration
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch PO");

        const data = await res.json();

        if (isCopy) {
          const cleanedData = {
            ...data,
            header: {
              ...data.header,
              id: undefined,
              po_no: undefined,
              status: "Draft",
              created_by: undefined,
              created_at: undefined,
              updated_at: undefined,
              approved_by: undefined,
              approved_at: undefined,
              released_by: undefined,
              released_at: undefined,
            },
          };
          setExistingPO(cleanedData);
        } else {
          setExistingPO(data);
        }
      } catch (err) {
        console.error("❌ Failed to load PO:", err);
      } finally {
        setPageLoading(false);
      }
    };

    if (safeMode === "edit" && id) {
      fetchPO(id, false);
    }

    if (safeMode === "create" && copyId) {
      fetchPO(copyId, true);
    }
  }, [safeMode, id, copyId, user]);

  if (pageLoading) {
    return <div className="p-4">Loading PO...</div>;
  }

  return (
    <CreatePOForm
      mode={safeMode}
      existingPO={existingPO}
      setDirty={() => {}}
    />
  );
}