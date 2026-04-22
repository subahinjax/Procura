"use client";

import SidebarLayout from "@/components/SidebarLayout";
import { useState } from "react";
import { formatDateIndian } from "@/utils/dateUtils";

type POItem = {
  po_no: string;
  po_date: string;
  supplier_name: string;
  department: string;
  grand_total: number;
};

export default function POReportPage() {

  const [activeSection, setActiveSection] = useState<string | null>(null);


  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<POItem[]>([]);
  const [summary, setSummary] = useState<{ total_count: number; grand_total: number } | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    setError("");
    setData([]);
    setSummary(null);

    /* 🔒 Validation */
    if (!fromDate || !toDate) {
      setError("From Date and To Date are required");
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      setError("From Date cannot be greater than To Date");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        `/api/reports/po?fromDate=${fromDate}&toDate=${toDate}`
      );

      if (!res.ok) {
        throw new Error("Failed to fetch PO report");
      }

      const result = await res.json();
      setData(result.data || []);
      setSummary(result.summary || null);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarLayout
      title="PO Reports"
      menuItems={[]}
      activeSection={activeSection}
      setActiveSection={setActiveSection}
    >
      <div className="p-6 border rounded bg-gray-50 space-y-4">
        <h2 className="text-xl font-semibold">PO Report</h2>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl items-end">
          <div>
            <label className="block text-sm font-medium mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border rounded px-2 py-1"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="h-9 bg-blue-600 text-white rounded px-4 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-600 text-sm font-medium">{error}</div>
        )}

        {/* Summary */}
        {summary && (
          <div className="flex gap-6 text-sm font-semibold text-gray-700">
            <span>Total POs: {summary.total_count}</span>
            <span>Total Amount: ₹{summary.grand_total.toLocaleString()}</span>
          </div>
        )}

        {/* Table */}
        {data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border mt-4 bg-white">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-2 text-left">PO No</th>
                  <th className="border px-2 py-2 text-left">PO Date</th>
                  <th className="border px-2 py-2 text-left">Supplier</th>
                  <th className="border px-2 py-2 text-left">Department</th>
                  <th className="border px-2 py-2 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.map((po) => (
                  <tr key={po.po_no} className="hover:bg-gray-50">
                    <td className="border px-2 py-1">{po.po_no}</td>
                    <td className="border px-2 py-1">{formatDateIndian(po.po_date)}</td>
                    <td className="border px-2 py-1">{po.supplier_name}</td>
                    <td className="border px-2 py-1">{po.department}</td>
                    <td className="border px-2 py-1 text-right">
                      ₹{po.grand_total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* No data */}
        {!loading && data.length === 0 && summary && (
          <div className="text-gray-600 text-sm">
            No released POs found for selected date range.
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
