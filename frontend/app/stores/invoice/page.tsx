"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { API_BASE_URL } from "@/lib/api";
import { formatDateIndian } from "@/utils/dateUtils";
import { PencilLine, Trash2, Eye } from "lucide-react";

export default function InvoiceListPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [viewInv, setViewInv] = useState<any>(null);
  const [viewDetails, setViewDetails] = useState<any[]>([]);
  const [viewCharges, setViewCharges] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  useAuthGuard();

  useEffect(() => {
    if (loading || !user) return;
    fetchInvoices();
  }, [loading, user]);

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`/api/proxy/invoice`);
      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (!res.ok) throw new Error("Failed to fetch invoices");
      setInvoices(await res.json());
    } catch (err) {
      console.error("Error fetching invoices:", err);
    } finally {
      setPageLoading(false);
    }
  };

  const openView = async (id: number) => {
    setViewLoading(true);
    try {
      const res = await fetch(`/api/proxy/invoice/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setViewInv(data.header);
      setViewDetails(data.details || []);
      setViewCharges(data.other_charges || []);
    } finally { setViewLoading(false); }
  };

  const handleDelete = async (id: number, invoice_number: string) => {
    if (!window.confirm(`Delete Invoice ${invoice_number}?`)) return;
    try {
      const res = await fetch(`/api/proxy/invoice/${id}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.status === 401) { router.replace("/session-expired"); return; }
      if (!res.ok) throw new Error("Failed to delete");
      setInvoices(prev => prev.filter(i => i.id !== id));
      alert("Invoice deleted successfully");
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Helper: does any detail row have a discount?
  const hasAnyDiscount = viewDetails.some(
    d => Number(d.discount_percent) > 0 || Number(d.discount_amount) > 0
  );

  if (loading || pageLoading) return <p className="text-center p-4">Loading...</p>;

  return (
    <div>
      {/* ── View Modal ── */}
      {viewInv && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-xs text-gray-400">Invoice No</p>
                <h3 className="text-lg font-bold text-gray-800">{viewInv.invoice_number}</h3>
              </div>
              <button onClick={() => setViewInv(null)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">×</button>
            </div>

            {/* Header details */}
            <div className="grid grid-cols-3 gap-3 text-sm mb-4 bg-gray-50 rounded-lg p-3">
              {[
                ["Invoice Date",  formatDateIndian(viewInv.invoice_date)],
                ["Bill No",       viewInv.bill_no || "—"],
                ["Bill Date",     viewInv.bill_date ? formatDateIndian(viewInv.bill_date) : "—"],
                ["Supplier",      viewInv.supplier_name || viewInv.supplier_id || "—"],
                ["Department",    viewInv.dept_name || "—"],
		["GRN No.", 
		  viewInv.grn_ids
		  ? String(viewInv.grn_ids)
		  .replace(/[{}]/g, "")
	          .split(",")
	          .join(", ")
		  : "—" 
		],
                ["Created By",    viewInv.created_by || "—"],
                ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-xs text-gray-400">{l}</p>
                  <p className="font-medium text-gray-800">{v}</p>
                </div>
              ))}
            </div>

            {/* Items table */}
            <h4 className="font-semibold text-gray-700 mb-2 text-sm">Items</h4>
            <table className="w-full border-collapse text-xs mb-4">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1.5 text-left">Item</th>
                  <th className="border px-2 py-1.5 w-16 text-right">Qty</th>
                  <th className="border px-2 py-1.5 w-20 text-right">Rate</th>
                  <th className="border px-2 py-1.5 w-20 text-right">Amount</th>
                  {/* Discount column — only shown when at least one item has discount */}
                  {hasAnyDiscount && (
                    <th className="border px-2 py-1.5 w-24 text-right text-red-600">Disc</th>
                  )}
                  {hasAnyDiscount && (
                    <th className="border px-2 py-1.5 w-24 text-right">Taxable</th>
                  )}
                  <th className="border px-2 py-1.5 w-14 text-right">GST%</th>
                  <th className="border px-2 py-1.5 w-20 text-right">GST Amt</th>
                  <th className="border px-2 py-1.5 w-24 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewDetails.map((d, i) => {
                  const amount         = Number(d.amount         || 0);
                  const discPercent    = Number(d.discount_percent || 0);
                  const discAmount     = Number(d.discount_amount  || 0);
                  // Use saved taxable_amount if present, else compute
                  const taxableAmount  = Number(d.taxable_amount   || 0) || (amount - discAmount);
                  const gstAmount      = Number(d.gst_amount       || 0);
                  // Total = taxable + gst
                  const lineTotal      = taxableAmount + gstAmount;

                  return (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="border px-2 py-1.5">{d.item_name}</td>
                      <td className="border px-2 py-1.5 text-right">{Number(d.quantity).toFixed(3)}</td>
                      <td className="border px-2 py-1.5 text-right">{Number(d.rate).toFixed(2)}</td>
                      <td className="border px-2 py-1.5 text-right">{amount.toFixed(2)}</td>
                      {/* Disc column: show % if percent entered, else show amount */}
                      {hasAnyDiscount && (
                        <td className="border px-2 py-1.5 text-right text-red-600">
                          {discPercent > 0
                            ? `${discPercent.toFixed(2)}%`
                            : discAmount > 0
                              ? `−${discAmount.toFixed(2)}`
                              : "—"}
                        </td>
                      )}
                      {hasAnyDiscount && (
                        <td className="border px-2 py-1.5 text-right">{taxableAmount.toFixed(2)}</td>
                      )}
                      <td className="border px-2 py-1.5 text-right">{d.gst_percent}%</td>
                      <td className="border px-2 py-1.5 text-right">{gstAmount.toFixed(2)}</td>
                      <td className="border px-2 py-1.5 text-right font-semibold">{lineTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sub Total</span>
                  <span>₹{Number(viewInv.sub_total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GST Total</span>
                  <span>₹{Number(viewInv.gst_total).toFixed(2)}</span>
                </div>
                {viewCharges.map((oc, i) => (
                  <div key={i} className={`flex justify-between text-xs ${oc.is_discount ? "text-red-600" : "text-blue-600"}`}>
                    <span>{oc.item_name}</span>
                    <span>{oc.is_discount ? "−" : "+"} ₹{Number(oc.amount).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1 font-bold text-base">
                  <span>Grand Total</span>
                  <span>₹{Number(viewInv.grand_total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {viewInv.remarks && (
              <p className="mt-3 text-xs text-gray-500 italic">Remarks: {viewInv.remarks}</p>
            )}
          </div>
        </div>
      )}

      {/* ── List ── */}
      <div className="p-4 bg-gray-100 rounded-xl shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white text-center bg-blue-600 py-2 px-6 rounded-md shadow">
            Invoice List
          </h2>
          <button
            onClick={() => {
              sessionStorage.setItem("from_invoice_list", "true");
              router.push("/stores/invoice/create");
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            + New Invoice
          </button>
        </div>

        <table className="w-full border-collapse bg-white shadow-sm rounded-md text-sm">
          <thead className="bg-gray-200">
            <tr>
              <th className="px-3 py-2 border">Invoice No</th>
              <th className="px-3 py-2 border">Date</th>
              <th className="px-3 py-2 border">Supplier</th>
              <th className="px-3 py-2 border">GRN No</th>
              <th className="px-3 py-2 border">Department</th>
              <th className="px-3 py-2 border text-right">Sub Total</th>
              <th className="px-3 py-2 border text-right">Grand Total</th>
              <th className="px-3 py-2 border">Created By</th>
              <th className="px-3 py-2 border text-center">Actions</th>
            </tr>
          </thead>



          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-6 text-gray-400">No invoices found</td></tr>
            ) : invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2 font-medium">{inv.invoice_number}</td>
                <td className="border px-3 py-2">{formatDateIndian(inv.invoice_date)}</td>
                <td className="border px-3 py-2">{inv.supplier_name}</td>
	        <td className="border px-3 py-2">
	         {inv.grn_ids
	         ? String(inv.grn_ids)
                 .replace(/[{}]/g, "")   // remove { }
                 .split(",")             // split into array
                 .join(",")              // join with commas
                 : "—"}
               </td>
                <td className="border px-3 py-2">{inv.dept_name || "—"}</td>
                <td className="border px-3 py-2 text-right">{Number(inv.sub_total || 0).toFixed(2)}</td>
                <td className="border px-3 py-2 text-right font-semibold">{Number(inv.grand_total || 0).toFixed(2)}</td>
                <td className="border px-3 py-2">{inv.created_by}</td>
                <td className="border px-2 py-2">
                  <div className="flex items-center justify-center gap-2">
                    <button title="View Invoice"
                      onClick={() => openView(inv.id)}
                      className="transition-transform duration-200 hover:scale-125">
                      <Eye className="w-5 h-5 text-gray-500 hover:text-gray-700" />
                    </button>
                    <button title="Edit Invoice"
                      onClick={() => {
                        sessionStorage.setItem("from_invoice_list", "true");
                        router.push(`/stores/invoice/${inv.id}`);
                      }}
                      className="transition-transform duration-200 hover:scale-125">
                      <PencilLine className="w-5 h-5 text-green-600 hover:text-green-800" />
                    </button>
                    <button title="Delete Invoice"
                      onClick={() => handleDelete(inv.id, inv.invoice_number)}
                      className="transition-transform duration-200 hover:scale-125">
                      <Trash2 className="w-5 h-5 text-red-600 hover:text-red-800" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
