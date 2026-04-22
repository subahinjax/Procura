"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { API_BASE_URL } from "@/lib/api";

export default function StockReportPage() {
  const { user, loading: authLoading } = useAuth();
  useAuthGuard();

  const [balance, setBalance]               = useState<any[]>([]);
  const [departments, setDepts]             = useState<any[]>([]);
  const [subDepartments, setSubDepts]       = useState<any[]>([]);
  const [allItems, setAllItems]             = useState<any[]>([]);
  const [categoryTypes, setCategoryTypes]   = useState<string[]>([]);
  const [categories, setCategories]         = useState<any[]>([]);

  const [filterDept, setFilterDept]         = useState("");
  const [filterSubDept, setFilterSubDept]   = useState("");
  const [filterItemId, setFilterItemId]     = useState("");
  const [filterCatType, setFilterCatType]   = useState("");
  const [filterCatCode, setFilterCatCode]   = useState("");
  const [loading, setLoading]               = useState(true);

useEffect(() => {
  if (authLoading || !user) return;
  fetchDepts();
  fetchSubDepts();        // ← fetch all on mount, no deptId
  fetchAllItems();
  fetchCategoryTypes();
  fetchBalance();
}, [authLoading, user]);

  const fetchDepts = async () => {
    const res = await fetch(`${API_BASE_URL}/api/department`, { credentials: "include" });
    if (res.ok) setDepts(await res.json());
  };

  // Replace fetchSubDepts to use existing endpoint
const fetchSubDepts = async (deptId?: string) => {
  const qs = deptId ? `?dept_id=${deptId}` : "";
  const res = await fetch(`${API_BASE_URL}/api/subdepartments/all${qs}`, { credentials: "include" });
  if (res.ok) setSubDepts(await res.json());
  else setSubDepts([]);
};


  const fetchAllItems = async () => {
    const res = await fetch(`${API_BASE_URL}/api/stock/all-item-names`, { credentials: "include" });
    if (res.ok) setAllItems(await res.json());
  };

  const fetchCategoryTypes = async () => {
    const res = await fetch(`${API_BASE_URL}/api/stock/category-types`, { credentials: "include" });
    if (res.ok) setCategoryTypes(await res.json());
  };

  const fetchCategories = async (catType?: string) => {
    const qs = catType ? `?category_type=${encodeURIComponent(catType)}` : "";
    const res = await fetch(`${API_BASE_URL}/api/stock/categories${qs}`, { credentials: "include" });
    if (res.ok) setCategories(await res.json());
  };

  const fetchBalance = async (
  deptId?: string,
  subdeptId?: string,       // ← param name
  itemId?: string,
  catType?: string,
  catCode?: string
) => {
  setLoading(true);
  try {
    const p = new URLSearchParams();
    if (deptId)    p.set("dept_id", deptId);
    if (subdeptId) p.set("subdept_id", subdeptId);   // ← must be "subdept_id" not "sub_dept_id"
    if (itemId) {
      const item = allItems.find(it => String(it.item_id) === itemId);
      if (item) p.set("item_name", item.item_name);
    }
    if (catType) p.set("category_type", catType);
    if (catCode) p.set("cat_code", catCode);
    const qs  = p.toString() ? "?" + p.toString() : "";
    const res = await fetch(`${API_BASE_URL}/api/stock/balance${qs}`, { credentials: "include" });
    if (res.ok) setBalance(await res.json());
  } finally { setLoading(false); }
};

  // ── Filter handlers ──────────────────────────────────────────────────────
  const handleCatTypeFilter = (v: string) => {
    setFilterCatType(v);
    setFilterCatCode("");
    fetchCategories(v || undefined);
    fetchBalance(filterDept || undefined, filterSubDept || undefined, filterItemId || undefined, v || undefined, undefined);
  };

  const handleCatCodeFilter = (v: string) => {
    setFilterCatCode(v);
    fetchBalance(filterDept || undefined, filterSubDept || undefined, filterItemId || undefined, filterCatType || undefined, v || undefined);
  };

const handleDeptFilter = (v: string) => {
  setFilterDept(v);
  setFilterSubDept("");
  fetchBalance(v || undefined, undefined, filterItemId || undefined, filterCatType || undefined, filterCatCode || undefined);
};

  const handleSubDeptFilter = (v: string) => {
    setFilterSubDept(v);
    fetchBalance(filterDept || undefined, v || undefined, filterItemId || undefined, filterCatType || undefined, filterCatCode || undefined);
  };

  const handleItemFilter = (v: string) => {
    setFilterItemId(v);
    fetchBalance(filterDept || undefined, filterSubDept || undefined, v || undefined, filterCatType || undefined, filterCatCode || undefined);
  };

  const clearFilters = () => {
    setFilterDept(""); setFilterSubDept(""); setFilterItemId("");
    setFilterCatType(""); setFilterCatCode("");
    setSubDepts([]);
    fetchCategories(undefined);
    fetchBalance();
  };

  const hasFilter = !!(filterDept || filterSubDept || filterItemId || filterCatType || filterCatCode);
  const selectedItemName = filterItemId
    ? allItems.find(it => String(it.item_id) === filterItemId)?.item_name
    : null;

  // ── Layout helpers ───────────────────────────────────────────────────────
  const itemFiltered = !!filterItemId;

  // Group by dept → category_type → category
  const grouped: Record<string, Record<string, Record<string, any[]>>> = {};
  for (const row of balance) {
    const dept    = row.dept_name   || `Dept ${row.dept_id}`;
    const catType = row.category_type || "Uncategorised";
    const cat     = row.category     || "Uncategorised";
    if (!grouped[dept]) grouped[dept] = {};
    if (!grouped[dept][catType]) grouped[dept][catType] = {};
    if (!grouped[dept][catType][cat]) grouped[dept][catType][cat] = [];
    grouped[dept][catType][cat].push(row);
  }

  const deptNames = Object.keys(grouped).sort();

  // Grand totals
  const grandIn   = balance.reduce((s, r) => s + Number(r.total_in   || 0), 0);
  const grandOut  = balance.reduce((s, r) => s + Number(r.total_out  || 0), 0);
  const grandBal  = balance.reduce((s, r) => s + Number(r.current_qty|| 0), 0);

  if (authLoading || !user) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 bg-gray-100 min-h-screen max-w-6xl mx-auto space-y-4">

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl shadow px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-800">Stock Report</h1>
          {hasFilter && (
            <button onClick={clearFilters}
              className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-200 rounded px-3 py-1">
              ✕ Clear Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* 1. Category Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category Type</label>
            <select value={filterCatType} onChange={e => handleCatTypeFilter(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">All Types</option>
              {categoryTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* 2. Category */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select value={filterCatCode} onChange={e => handleCatCodeFilter(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.cat_code} value={c.cat_code}>
                  {c.category}
                  {!filterCatType && c.category_type ? ` (${c.category_type})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Department */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
            <select value={filterDept} onChange={e => handleDeptFilter(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
            </select>
          </div>

          {/* 4. Sub Department */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sub Department</label>
<select
  value={filterSubDept}
  onChange={e => handleSubDeptFilter(e.target.value)}
  className="w-full border rounded-lg px-3 py-2 text-sm">
  <option value="">All Sub Depts</option>
  {subDepartments.map(s => (
    <option key={s.subdept_id} value={s.subdept_id}>{s.subdept_name}</option>
  ))}
</select>
          </div>

          {/* 5. Item Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Item Name</label>
            <select value={filterItemId} onChange={e => handleItemFilter(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">All Items</option>
              {allItems.map(it => (
                <option key={it.item_id} value={it.item_id}>{it.item_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filter badges */}
        {hasFilter && (
          <div className="flex gap-2 flex-wrap mt-3">
            {filterCatType && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                Type: {filterCatType}
              </span>
            )}
            {filterCatCode && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                Category: {categories.find(c => c.cat_code === filterCatCode)?.category || filterCatCode}
              </span>
            )}
            {filterDept && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                Dept: {departments.find(d => String(d.dept_id) === filterDept)?.dept_name}
              </span>
            )}
            {filterSubDept && (
              <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs rounded-full font-medium">
                Sub Dept: {subDepartments.find(s => String(s.sub_dept_id) === filterSubDept)?.sub_dept_name}
              </span>
            )}
            {filterItemId && (
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                Item: {selectedItemName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">Loading...</div>
      ) : balance.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">No stock data found</div>

      ) : itemFiltered ? (
        /* ── Item filter view — one row per dept ── */
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="bg-gray-700 text-white px-4 py-2 text-sm font-semibold">
            Item: {selectedItemName}
          </div>
          <table className="w-full border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border-b px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Department</th>
                <th className="border-b px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Category Type</th>
                <th className="border-b px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="border-b px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">UOM</th>
                <th className="border-b px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Opening</th>
                <th className="border-b px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">In</th>
                <th className="border-b px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Out</th>
                <th className="border-b px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody>
              {balance.map((row, i) => (
                <tr key={i} className={`border-b hover:bg-gray-50 ${Number(row.current_qty) <= 0 ? "text-red-400" : ""}`}>
                  <td className="px-3 py-2 font-medium">{row.dept_name || `Dept ${row.dept_id}`}</td>
                  <td className="px-3 py-2">
                    {row.category_type
                      ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.category_type?.toLowerCase().includes("non") ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{row.category_type}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2">{row.category || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2">{row.unit_of_measure}</td>
                  <td className="px-3 py-2 text-right">{Number(row.opening_qty).toFixed(3)}</td>
                  <td className="px-3 py-2 text-right text-green-700">{Number(row.total_in).toFixed(3)}</td>
                  <td className="px-3 py-2 text-right text-orange-600">{Number(row.total_out).toFixed(3)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{Number(row.current_qty).toFixed(3)}</td>
                </tr>
              ))}
              {balance.length > 1 && (
                <tr className="bg-blue-50 font-semibold border-t-2 border-blue-200">
                  <td className="px-3 py-2 text-blue-800" colSpan={4}>Grand Total</td>
                  <td className="px-3 py-2 text-right text-blue-800">
                    {balance.reduce((s, r) => s + Number(r.opening_qty||0), 0).toFixed(3)}
                  </td>
                  <td className="px-3 py-2 text-right text-blue-800">{grandIn.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right text-blue-800">{grandOut.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right text-blue-800">{grandBal.toFixed(3)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      ) : (
        /* ── Normal view — grouped by Dept → Category Type → Category ── */
        <>
          {deptNames.map(deptName => {
            const deptRows    = balance.filter(r => (r.dept_name || `Dept ${r.dept_id}`) === deptName);
            const deptIn      = deptRows.reduce((s, r) => s + Number(r.total_in   || 0), 0);
            const deptOut     = deptRows.reduce((s, r) => s + Number(r.total_out  || 0), 0);
            const deptBal     = deptRows.reduce((s, r) => s + Number(r.current_qty|| 0), 0);
            const catTypeMap  = grouped[deptName];

            return (
              <div key={deptName} className="bg-white rounded-xl shadow overflow-hidden">
                <div className="bg-gray-700 text-white px-4 py-2 flex justify-between items-center text-sm">
                  <span className="font-semibold">{deptName}</span>
                  <span className="text-gray-300 text-xs">
                    In: {deptIn.toFixed(3)} · Out: {deptOut.toFixed(3)} · Balance: {deptBal.toFixed(3)}
                  </span>
                </div>

                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border-b px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Item Name</th>
                      <th className="border-b px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Category Type</th>
                      <th className="border-b px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                      <th className="border-b px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase w-16">UOM</th>
                      <th className="border-b px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-24">Opening</th>
                      <th className="border-b px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-24">In</th>
                      <th className="border-b px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-24">Out</th>
                      <th className="border-b px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-24">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(catTypeMap).sort().map(catType => (
                      Object.keys(catTypeMap[catType]).sort().map((cat, catIdx) => {
                        const rows   = catTypeMap[catType][cat];
                        const catIn  = rows.reduce((s, r) => s + Number(r.total_in   || 0), 0);
                        const catOut = rows.reduce((s, r) => s + Number(r.total_out  || 0), 0);
                        const catBal = rows.reduce((s, r) => s + Number(r.current_qty|| 0), 0);
                        return [
                          <tr key={`label-${catType}-${cat}`} className="bg-gray-100">
                            <td colSpan={8} className="px-3 py-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${catType?.toLowerCase().includes("non") ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                                {catType}
                              </span>
                              <span className="text-xs font-semibold text-gray-600">{cat}</span>
                              <span className="ml-3 text-xs text-gray-400">
                                {rows.length} item{rows.length !== 1 ? "s" : ""}
                              </span>
                            </td>
                          </tr>,
                          ...rows.map((row: any, i: number) => (
                            <tr key={`${row.item_id}-${row.dept_id}-${i}`}
                              className={`border-b transition-colors hover:bg-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/30"} ${Number(row.current_qty) <= 0 ? "text-red-400" : ""}`}>
                              <td className="px-3 py-2 pl-6">{row.item_name}</td>
                              <td className="px-3 py-2 text-xs">
                                {row.category_type
                                  ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.category_type?.toLowerCase().includes("non") ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{row.category_type}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-700">{row.category || <span className="text-gray-300">—</span>}</td>
                              <td className="px-3 py-2">{row.unit_of_measure}</td>
                              <td className="px-3 py-2 text-right">{Number(row.opening_qty).toFixed(3)}</td>
                              <td className="px-3 py-2 text-right text-green-700">{Number(row.total_in).toFixed(3)}</td>
                              <td className="px-3 py-2 text-right text-orange-600">{Number(row.total_out).toFixed(3)}</td>
                              <td className="px-3 py-2 text-right font-medium">{Number(row.current_qty).toFixed(3)}</td>
                            </tr>
                          )),
                          <tr key={`sub-${catType}-${cat}`} className="bg-yellow-50 text-xs border-b-2 border-yellow-200">
                            <td className="px-3 py-1.5 pl-6 font-semibold text-yellow-800" colSpan={4}>
                              Subtotal — {cat}
                            </td>
                            <td className="px-3 py-1.5 text-right font-semibold text-yellow-800">
                              {rows.reduce((s: number, r: any) => s + Number(r.opening_qty||0), 0).toFixed(3)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-semibold text-yellow-800">{catIn.toFixed(3)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-yellow-800">{catOut.toFixed(3)}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-yellow-800">{catBal.toFixed(3)}</td>
                          </tr>
                        ];
                      })
                    ))}
                    <tr className="bg-gray-200 font-semibold border-t-2 border-gray-400">
                      <td className="px-3 py-2 text-gray-800" colSpan={4}>Total — {deptName}</td>
                      <td className="px-3 py-2 text-right">
                        {deptRows.reduce((s, r) => s + Number(r.opening_qty||0), 0).toFixed(3)}
                      </td>
                      <td className="px-3 py-2 text-right">{deptIn.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{deptOut.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{deptBal.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}

          {deptNames.length > 1 && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr className="bg-blue-700 text-white font-bold text-base">
                    <td className="px-4 py-3" colSpan={4}>Grand Total ({deptNames.length} Departments)</td>
                    <td className="px-4 py-3 text-right">
                      {balance.reduce((s, r) => s + Number(r.opening_qty||0), 0).toFixed(3)}
                    </td>
                    <td className="px-0 py-3 text-right">{grandIn.toFixed(2)}</td>
                    <td className="px-0 py-3 text-right">{grandOut.toFixed(2)}</td>
                    <td className="px-0 py-3 text-right">{grandBal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-gray-400 text-right">{balance.length} item-dept records</p>
    </div>
  );
}