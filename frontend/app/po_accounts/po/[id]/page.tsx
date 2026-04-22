"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "@/lib/axios";
import { formatAmount } from "@/utils/numberUtils";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { hasAccess } from "@/lib/accessControl";

export default function PaymentPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { user, loading: authLoading } = useAuth();

  useAuthGuard();

  // ✅ Check flag synchronously before first render using useRef
  // useRef runs synchronously unlike useEffect — no redirect flash
  const navAllowedRef = useRef<boolean | null>(null);
  if (navAllowedRef.current === null) {
    if (typeof window !== "undefined") {
      const fromList = sessionStorage.getItem("from_po_list");
      if (fromList === "true") {
        sessionStorage.removeItem("from_po_list");
        navAllowedRef.current = true;
      } else {
        navAllowedRef.current = false;
      }
    }
  }

  const [po, setPo] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [pageloading, pagesetLoading] = useState(false);
  const [form, setForm] = useState({
    payment_type: "",
    paid_amount: "",
    payment_date: "",
    payment_mode: "",
    reference_no: "",
    reference_date: "",
    bank_name: "",
    notes: "",
  });
  const [isDirty, setIsDirty] = useState(false);
  const [actualAdvanceInput, setActualAdvanceInput] = useState("");
  const [actualAdvanceNarration, setActualAdvanceNarration] = useState("");

  // Redirect if direct URL access
  useEffect(() => {
    if (navAllowedRef.current === false) {
      router.replace("/po_accounts");
    }
  }, [router]);

  // Warn on back if unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    window.history.pushState({ preventBack: true }, "");
    const handlePopState = () => {
      const confirmLeave = window.confirm("You have unsaved changes. Are you sure you want to leave?");
      if (confirmLeave) {
        router.back();
      } else {
        window.history.pushState({ preventBack: true }, "");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isDirty, router]);

  // Warn on tab close if unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setIsDirty(true);
  };

  useEffect(() => {
    if (!authLoading && user && id && hasAccess(user.user_type, "ACCOUNTS_PAY") && navAllowedRef.current === true) {
      fetchPO();
    }
  }, [id, authLoading, user]);

  const fetchPO = async () => {
    try {
      const res = await axios.get(`/api/accounts/po/${id}`);
      const poData = res.data.po;
      const paymentList = res.data.payments || [];
      const advancePaid = paymentList
        .filter((p: any) => p.payment_type === "Advance")
        .reduce((s: number, p: any) => s + Number(p.paid_amount || 0), 0);
      setPo({ ...poData, advance_paid: advancePaid });
      setPayments(paymentList);
    } catch (err: any) {
      console.error("Fetch PO error:", err);
      if (err?.response?.status === 401) {
        router.replace("/session-expired");
        return;
      }
      setPo(null);
      setPayments([]);
    }
  };

  const formatDateDDMMYYYY = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    const dd = String(local.getDate()).padStart(2, "0");
    const mm = String(local.getMonth() + 1).padStart(2, "0");
    const yyyy = local.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const totalPaid = payments.reduce((s, p) => s + Number(p.paid_amount || 0), 0);
  const remaining = Number(po?.grand_total || 0) - totalPaid;
  const mustEnterActualAdvance = po?.advance_required && po?.actual_advance === null;
  const advanceRequired = (po?.advance_required || "").toString().trim().toLowerCase() === "true";
  const actualAdvance = Number(po?.actual_advance || 0);
  const totalAdvancePaid =
    payments?.filter((p) => p.payment_type === "Advance")
      ?.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0) || 0;
  const advanceBalance = advanceRequired ? actualAdvance - totalAdvancePaid : null;

  const saveActualAdvance = async () => {
    if (actualAdvanceInput === "" || isNaN(Number(actualAdvanceInput)) || Number(actualAdvanceInput) < 0) {
      return alert("❌ Enter a valid Actual Advance amount.");
    }
    if (!actualAdvanceNarration || actualAdvanceNarration.trim().length < 3) {
      return alert("❌ Enter a narration for the Actual Advance (min 3 chars).");
    }
    if (!confirm("Do you want to save Actual Advance?")) return;
    try {
      await axios.post(`/api/accounts/po/set-advance`, {
        po_id: id,
        actual_advance: Number(actualAdvanceInput),
        narration: actualAdvanceNarration.trim(),
      });
      alert("✔ Actual Advance saved successfully");
      setActualAdvanceInput("");
      setActualAdvanceNarration("");
      fetchPO();
    } catch (err: any) {
      if (err?.response?.status === 401) { router.replace("/session-expired"); return; }
      alert("❌ " + (err?.response?.data?.error || "Error saving actual advance"));
    }
  };

  const savePayment = async () => {
    if (form.payment_type === "") return alert("Select payment type");
    if (form.paid_amount === "" || Number(form.paid_amount) <= 0) return alert("Paid Amount must be greater than 0");
    if (!form.payment_date) return alert("Select payment date");
    if (form.payment_mode.trim() === "") return alert("Enter payment mode");
    if (Number(form.paid_amount) > remaining) return alert("❌ Paid amount cannot exceed remaining balance");
    if (form.reference_no.trim() === "") return alert("Enter reference no.");
    if (!form.reference_date) return alert("Select reference date");
    if (form.bank_name.trim() === "") return alert("Enter bank name.");
    if (!confirm("Do you want to save this payment?")) return;

    pagesetLoading(true);
    try {
      await axios.post(`/api/accounts/payments/create`, { po_id: id, ...form });
      setForm({ payment_type: "", paid_amount: "", payment_date: "", payment_mode: "", reference_no: "", reference_date: "", bank_name: "", notes: "" });
      setIsDirty(false);
      fetchPO();
      alert("Payment added");
    } catch (err: any) {
      if (err?.response?.status === 401) { router.replace("/session-expired"); return; }
      alert("❌ " + (err?.response?.data?.error || "Error saving payment"));
    } finally {
      pagesetLoading(false);
    }
  };

  // ✅ Block render — nav not allowed
  if (navAllowedRef.current === false) {
    return <div className="p-6">Access Denied. Redirecting...</div>;
  }

  // ✅ Block render — auth not ready
  if (authLoading || !user) {
    return <div className="p-6">Loading...</div>;
  }

  // ✅ Block render — wrong role
  if (!hasAccess(user.user_type, "ACCOUNTS_PAY")) {
    return <div className="p-6">Access Denied. Redirecting...</div>;
  }

  if (!po) {
    return <div className="p-6">Loading...</div>;
  }



  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        Payment Processing -{" "}
        <span className="text-blue-700">PO #{po.po_no}</span>
      </h1>

      {/* Summary */}
      <div className="bg-white p-6 rounded-lg shadow mb-4">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">Supplier</div>
            <div className="font-medium">{po.sup_name}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500">PO Total</div>
            <div className="font-medium">₹ {formatAmount(po.grand_total)}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Total Paid</div>
            <div className="font-medium">₹ {formatAmount(totalPaid)}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Balance</div>
            <div
              className={`font-medium ${
                remaining > 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              ₹ {formatAmount(remaining)}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Advance Required</div>
            <div className="font-medium">
              {po.advance_required ? "Yes" : "N/A"}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Actual Advance</div>
            <div className="font-medium">
              {po.advance_required
                ? po.actual_advance === null
                  ? "Not Entered"
                  : `₹ ${formatAmount(po.actual_advance)}`
                : "N/A"}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Advance Paid</div>
            <div className="font-medium">
              {po.advance_required
                ? po.advance_paid
                  ? `₹ ${formatAmount(po.advance_paid)}`
                  : "Not Paid"
                : "N/A"}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Advance Balance</div>
            {advanceRequired ? (
              <div className="font-medium">
                ₹ {formatAmount(advanceBalance)}
              </div>
            ) : (
              <div className="font-medium text-gray-400">N/A</div>
            )}
          </div>
        </div>
      </div>

      {/* Actual Advance */}
      {po.advance_required && (
        <div className="bg-white p-2 rounded-lg shadow mb-4">
          <h2 className="text-lg font-semibold text-blue-700 mb-2 border-b pb-2 text-center underline">
            Actual Advance
          </h2>

          <div className="grid grid-cols-3 gap-6 items-end">
            <div>
              <label className="block text-sm mb-2 font-medium">
                Amount (₹)
              </label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2"
                placeholder="Enter Actual Advance"
                value={actualAdvanceInput}
                onChange={(e) => setActualAdvanceInput(e.target.value)}
                disabled={po.actual_advance !== null}
              />
            </div>

            <div>
              <label className="block text-sm mb-2 font-medium">
                Narration
              </label>
              <textarea
                className="w-full border rounded px-3 py-2 h-14"
                placeholder="e.g., 30% advance excluding GST"
                value={actualAdvanceNarration}
                onChange={(e) => setActualAdvanceNarration(e.target.value)}
                disabled={po.actual_advance !== null}
              />
            </div>

            <div className="flex items-end">
              {po.actual_advance === null ? (
                <button
                  onClick={saveActualAdvance}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded"
                >
                  Save Actual Advance
                </button>
              ) : (
                <div className="text-green-600 font-semibold">
                  ✔ Actual Advance locked
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Payment */}
      <div
        className={`bg-white p-6 rounded-lg shadow mb-8 ${
          mustEnterActualAdvance ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        <h2 className="text-lg font-semibold text-blue-700 mb-2 border-b pb-2">
          Add Payment
        </h2>

        {mustEnterActualAdvance && (
          <div className="text-sm text-red-600 mb-3 font-semibold">
            ❗ Please enter Actual Advance before adding payments.
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-2 font-medium">
              Payment Type
            </label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.payment_type}
              onChange={(e) =>
                setForm({ ...form, payment_type: e.target.value })
              }
            >
              <option value="">Select Payment Type</option>
              <option value="Advance" disabled={!po.advance_required}>
                Advance
              </option>
              <option value="Part Payment">Part Payment</option>
              <option value="Full Payment">Full Payment</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-2 font-medium">
              Paid Amount (₹)
            </label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2"
              placeholder="0.00"
              value={form.paid_amount}
              onChange={(e) =>
                setForm({ ...form, paid_amount: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm mb-2 font-medium">
              Payment Date
            </label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={form.payment_date}
              onChange={(e) =>
                setForm({ ...form, payment_date: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm mb-2 font-medium">
              Payment Mode
            </label>

<select
  className="border rounded p-2 w-full"
  value={form.payment_mode}
  onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}
>
  <option value="">Select Payment Mode</option>
  <option value="Cash">Cash</option>
  <option value="Cheque">Cheque</option>
  <option value="NEFT">NEFT</option>
  <option value="RTGS">RTGS</option>
  <option value="IMPS">IMPS</option>
  <option value="UPI">UPI</option>
  <option value="Bank Transfer">Bank Transfer</option>
  <option value="DD">Demand Draft (DD)</option>
  <option value="Online">Online Payment</option>
  <option value="Credit Note">Credit Note</option>
</select>

     </div>




          <div>
            <label className="block text-sm mb-2 font-medium">
              Reference No
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Reference No"
              value={form.reference_no}
              onChange={(e) =>
                setForm({ ...form, reference_no: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm mb-2 font-medium">
              Reference Date
            </label>
            <input
              type="date"
              className="w-full border rounded px-3 py-2"
              value={form.reference_date}
              onChange={(e) =>
                setForm({ ...form, reference_date: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm mb-2 font-medium">
              Bank Name
            </label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Bank Name"
              value={form.bank_name}
              onChange={(e) =>
                setForm({ ...form, bank_name: e.target.value })
              }
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm mb-2 font-medium">Notes</label>
            <textarea
              className="w-full border rounded px-3 py-2 h-14"
              placeholder="Notes"
              value={form.notes}
              onChange={(e) =>
                setForm({ ...form, notes: e.target.value })
              }
            />
          </div>
        </div>

        <div className="mt-4 text-right">
          <button
            onClick={savePayment}
            disabled={pageloading}
            className={`px-6 py-2 rounded text-white ${
              pageloading
                ? "bg-gray-400"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {pageloading ? "Saving..." : "Save Payment"}
          </button>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white p-6 rounded-lg shadow mb-20">
        <h2 className="text-lg font-semibold text-blue-700 mb-4 border-b pb-2">
          Payment History
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border text-center">Type</th>
                <th className="p-2 border text-right">Amount</th>
                <th className="p-2 border text-center">Paid Date</th>
                <th className="p-2 border text-center">Mode</th>
                <th className="p-2 border text-center">Ref. No.</th>
                <th className="p-2 border text-center">Ref. Date</th>
                <th className="p-2 border text-center">Bank Name</th>
                <th className="p-2 border text-center">Note</th>
              </tr>
            </thead>

            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-6 text-gray-500"
                  >
                    No payments recorded.
                  </td>
                </tr>
              )}

              {payments.map((p: any) => {
                const pid = p.payment_id ?? p.id;
                return (
                  <tr key={pid} className="hover:bg-gray-50">
                    <td className="border p-2 text-center">
                      {p.payment_type}
                    </td>
                    <td className="border p-2 text-right">
                      ₹ {formatAmount(p.paid_amount)}
                    </td>
                    <td className="border p-2 text-center">
                      {formatDateDDMMYYYY(p.payment_date)}
                    </td>
                    <td className="border p-2 text-center">
                      {p.payment_mode}
                    </td>

	             <td className="border p-2 text-center">
                      {p.reference_no}
                    </td>
	             <td className="border p-2 text-center">
                      {formatDateDDMMYYYY(p.reference_date)}
                    </td>
	             <td className="border p-2 text-center">
                      {p.bank_name}
                    </td>
	             <td className="border p-2 text-center">
                      {p.notes}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
 

