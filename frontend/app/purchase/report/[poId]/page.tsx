"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PurchaseOrderReport from "../PurchaseOrderReport";

export default function ReportPage() {
  const { poId } = useParams();
  const [poData,    setPoData]    = useState<any>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [printZoom, setPrintZoom] = useState(100);

  // Load saved zoom
  useEffect(() => {
    const savedZoom = localStorage.getItem("printZoom");
    if (savedZoom) setPrintZoom(Number(savedZoom));
  }, []);

  useEffect(() => {
    localStorage.setItem("printZoom", printZoom.toString());
  }, [printZoom]);

  // Fetch PO data — other_charges is already returned by GET /api/purchase-orders/:poid
  useEffect(() => {
    if (!poId) return;
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

    fetch(`${API_BASE_URL}/api/purchase-orders/${poId}`, { credentials: "include" })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        // data = { header, items, terms, other_charges }
        // other_charges is included automatically from PATCH 1 in server_backup_routes
        setPoData(data);
      })
      .catch(err => {
        console.error("❌ Failed to fetch PO:", err);
        setError("Failed to load purchase order");
      });
  }, [poId]);

  const handlePrint = () => {
    document.documentElement.style.setProperty(
      "--print-zoom",
      (printZoom / 100).toString()
    );
    window.print();
  };

  if (error)   return <p>{error}</p>;
  if (!poData) return <p>Loading report...</p>;

  return (
    <div className="p-4">
      {/* Controls */}
      <div className="no-print flex justify-end gap-2 mb-4">
        {/* Zoom selector */}
        <select
          value={printZoom}
          onChange={e => setPrintZoom(Number(e.target.value))}
          className="border px-3 py-2 rounded"
        >
          {[100,99,98,97,96,95,94,93,92,91,90].map(v => (
            <option key={v} value={v}>{v}%</option>
          ))}
        </select>

        {/* Print */}
        <button
          onClick={handlePrint}
          className="bg-blue-500 text-white px-3 py-1 rounded"
        >
          Preview / Print
        </button>

        {/* Export PDF */}
        <button
          onClick={handlePrint}
          className="bg-green-500 text-white px-3 py-1 rounded"
        >
          <div>Export PDF</div>
          <div className="text-[10px]">Choose "Save as PDF"</div>
        </button>
      </div>

      {/* Report — poData includes other_charges from the API */}
      <div className="report-container print-a4">
        <PurchaseOrderReport poData={poData} />
      </div>
    </div>
  );
}
