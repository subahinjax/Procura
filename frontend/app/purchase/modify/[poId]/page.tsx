"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import CreatePOForm from "@/app/purchase/create/CreatePOForm";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";

interface POData {
  header: any;
  details: any[];
  terms: string[];
}

export default function EditPOPage() {
  const params = useParams();
  const poId = params?.poId as string;
  const router = useRouter();
  const [poData, setPoData] = useState<POData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useAuthGuard();

  // ✅ Synchronous nav check using useRef — no flash/redirect race
  const navAllowedRef = useRef<boolean | null>(null);
  if (navAllowedRef.current === null) {
    if (typeof window !== "undefined") {
      const fromList = sessionStorage.getItem("from_modify_list");
      if (fromList === "true") {
        sessionStorage.removeItem("from_modify_list");
        navAllowedRef.current = true;
      } else {
        navAllowedRef.current = false;
      }
    }
  }

  // Redirect if direct URL access
  useEffect(() => {
    if (navAllowedRef.current === false) {
      router.replace("/purchase/modify");
    }
  }, [router]);

  // Fetch PO data
  useEffect(() => {
    if (!poId || navAllowedRef.current !== true) return;

    const fetchPO = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
        const res = await fetch(`${API_BASE_URL}/api/purchase-orders/${poId}`, {
          credentials: "include",
        });
        if (res.status === 401) {
          router.replace("/session-expired");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setPoData(data);
      } catch (err) {
        console.error("❌ Failed to fetch PO:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPO();
  }, [poId, router]);

  // ✅ Block render — direct URL access
  if (navAllowedRef.current === false) {
    return <div className="p-4 text-center">Access Denied. Redirecting...</div>;
  }

  if (authLoading || loading) {
    return <p className="p-4 text-center">Loading PO...</p>;
  }

  if (!poData) {
    return <p className="p-4 text-center text-red-500">PO not found.</p>;
  }

  const isEditable = poData.header.status === "Draft";

  return (
    <div className="p-4">
      <CreatePOForm
        existingPO={poData}
        mode={isEditable ? "edit" : "view"}
        setDirty={() => {}}
      />
    </div>
  );
}
