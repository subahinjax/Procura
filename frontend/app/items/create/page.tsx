"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Pencil, Save, X, Package, Tag } from "lucide-react";

/* =======================
   TYPES
======================= */
type Item = {
  item_code: number | null;
  item_name: string;
  description: string | null;
  unit: string;
  rate: string;
  hsn_code: string | null;
  gst_per: string;
  cat_code: string;
  category: string;
  category_type: string;
  active: boolean;
};

type Unit = { id: number; unit_code: string; };
type Category = { cat_code: string; category: string; category_type: string; };
type IndexedItem = Item & { _base: string; _model: string | null; _normName: string; };

/* =======================
   STRING HELPERS
======================= */
const getBaseWord  = (str: string) => str.toLowerCase().replace(/[^a-z ]/g,"").trim().split(/\s+/)[0];
const normalizeMain = (str: string) => str.toLowerCase().replace(/[^a-z]/g,"");
const getModelToken = (str: string) => {
  const match = str.match(/\b(?:aa|aaa|c|d|9v|[a-z]*\d+[a-z]*)\b/i);
  if (!match) return null;
  const token = match[0].toLowerCase();
  if (/\d+(\.\d+)?tr/.test(token)) return null;
  return token;
};
const removeCapacity = (str: string) => str.replace(/\d+(\.\d+)?\s*tr/gi,"");
const getTR = (str: string) => { const m = str.match(/\d+(\.\d+)?\s*tr/i); return m ? m[0].toLowerCase().replace(/\s+/g,"") : null; };
const cleanName  = (str: string) => str.toLowerCase().replace(/\d+(\.\d+)?\s*tr/gi,"").replace(/\s+/g," ").trim();
const toTitleCase = (v: string) => v.toLowerCase().split(" ").filter(Boolean).map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({length: b.length+1}, () => Array(a.length+1).fill(0));
  for (let i=0;i<=a.length;i++) matrix[0][i]=i;
  for (let j=0;j<=b.length;j++) matrix[j][0]=j;
  for (let j=1;j<=b.length;j++) for (let i=1;i<=a.length;i++) {
    const cost = a[i-1]===b[j-1]?0:1;
    matrix[j][i]=Math.min(matrix[j-1][i]+1,matrix[j][i-1]+1,matrix[j-1][i-1]+cost);
  }
  return matrix[b.length][a.length];
}

const EMPTY: Item = {
  item_code: null, item_name: "", description: "", unit: "",
  rate: "", hsn_code: "", gst_per: "",
  cat_code: "", category: "", category_type: "", active: true,
};

/* =======================
   MAIN
======================= */
export default function CreateItemPage() {
  const [items,      setItems]      = useState<Item[]>([]);
  const [units,      setUnits]      = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mode,       setMode]       = useState<"view"|"add"|"edit">("view");
  const [item,       setItem]       = useState<Item>(EMPTY);
  const [selCatType, setSelCatType] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [titleWarn,  setTitleWarn]  = useState(false);

  /* ── Fetch ── */
  useEffect(() => {
    const load = async () => {
      try {
        const [ir, ur, cr] = await Promise.all([
          fetch("/api/items"), fetch("/api/units"), fetch("/api/categories"),
        ]);
        setItems(Array.isArray(await ir.json()) ? await (await fetch("/api/items")).json() : []);
        const ud = await ur.json(); setUnits(Array.isArray(ud) ? ud : []);
        const cd = await cr.json(); setCategories(Array.isArray(cd) ? cd : []);
      } catch { setItems([]); setUnits([]); setCategories([]); }
    };
    load();
  }, []);

  // Cleaner fetch
  useEffect(() => {
    Promise.all([
      fetch("/api/items").then(r=>r.json()),
      fetch("/api/units").then(r=>r.json()),
      fetch("/api/categories").then(r=>r.json()),
    ]).then(([id,ud,cd]) => {
      setItems(Array.isArray(id)?id:[]);
      setUnits(Array.isArray(ud)?ud:[]);
      setCategories(Array.isArray(cd)?cd:[]);
    }).catch(()=>{setItems([]);setUnits([]);setCategories([]);});
  }, []);

  const categoryTypes      = useMemo(() => [...new Set(categories.map(c=>c.category_type))],[categories]);
  const filteredCategories = useMemo(() => categories.filter(c=>c.category_type===selCatType),[categories,selCatType]);
  const filteredItems      = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const q = normalizeMain(itemSearch);
    return items.filter(i=>normalizeMain(i.item_name).includes(q));
  },[itemSearch,items]);

  /* ── Handlers ── */
  const handleChange = (name: keyof Item, value: any) => setItem(prev=>({...prev,[name]:value}));

  const resetForm = () => { setItem(EMPTY); setSelCatType(""); setMode("view"); setTitleWarn(false); };

  const handleSelect = (id: number|null) => {
    if (!id) { resetForm(); return; }
    const sel = items.find(i=>i.item_code===id); if (!sel) return;
    const cat = categories.find(c=>String(c.cat_code)===String(sel.cat_code));
    setItem({...sel, cat_code:String(sel.cat_code), category:cat?.category??"", category_type:cat?.category_type??""});
    setSelCatType(cat?.category_type??"");
    setMode("view"); setItemSearch("");
  };

  const handleSave = async () => {
    try {
      if (item.item_name && item.item_name !== toTitleCase(item.item_name))
        alert(`⚠️ Recommended format:\n\n${toTitleCase(item.item_name)}\n\nSaving is allowed.`);

      if (!item.item_name||!item.cat_code) { alert("Item name & category required"); return; }

      const cleaned = cleanName(item.item_name);
      const inBase = getBaseWord(cleaned), inModel = getModelToken(cleaned), inNorm = normalizeMain(cleaned);
      const indexed: IndexedItem[] = items.map(i=>({...i,_base:getBaseWord(i.item_name),_model:getModelToken(i.item_name),_normName:normalizeMain(cleanName(i.item_name))}));

      const isDup = indexed.some(it => {
        if (item.item_code && it.item_code===item.item_code) return false;
        const em=it._model, im=inModel;
        if (em&&im&&em!==im) return false;
        if ((em&&!im)||(!em&&im)) return false;
        const exTR=getTR(it.item_name), inTR=getTR(item.item_name);
        const d=levenshteinDistance(normalizeMain(removeCapacity(it.item_name)),normalizeMain(removeCapacity(item.item_name)));
        if (d<=1&&exTR!==inTR) return false;
        return d<=1;
      });
      if (isDup) { alert("Item name already exists or is too similar."); return; }

      const payload = {...item, description:item.description?.trim()||null, hsn_code:item.hsn_code?.trim()||null};
      delete (payload as any).category; delete (payload as any).category_type;

      const res = await fetch("/api/items",{method:mode==="add"?"POST":"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if (!res.ok) throw new Error("Save failed");
      const saved = await res.json();
      localStorage.setItem("MASTER_UPDATED", Date.now().toString());
      setItems(prev=>mode==="add"?[...prev,saved]:prev.map(i=>i.item_code===saved.item_code?saved:i));
      setItem(saved); setMode("view");
      alert("Item saved successfully ✅");
    } catch { alert("Error while saving item"); }
  };

  const isView = mode === "view";

  /* ── UI ── */
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Item Master</h1>
              <p className="text-xs text-gray-400">{items.length} items registered</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isView && (<>
              <button onClick={()=>{resetForm();setMode("add");}}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium shadow-sm">
                <Plus className="w-4 h-4"/>Add New
              </button>
              <button onClick={()=>setMode("edit")} disabled={!item.item_code}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 font-medium shadow-sm disabled:opacity-40">
                <Pencil className="w-4 h-4"/>Edit
              </button>
            </>)}
            {!isView && (<>
              <button onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium shadow-sm">
                <Save className="w-4 h-4"/>Save
              </button>
              <button onClick={resetForm}
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-400 text-white text-sm rounded-lg hover:bg-gray-500 font-medium shadow-sm">
                <X className="w-4 h-4"/>Cancel
              </button>
            </>)}
          </div>
        </div>

        {/* ── Search + Select ── */}
        <div className="bg-white rounded-xl shadow p-4 mb-4 flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input type="text" placeholder="Search item..." value={itemSearch}
              disabled={!isView}
              onChange={e=>setItemSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"/>
          </div>
          <select value={item.item_code??""} disabled={!isView}
            onChange={e=>handleSelect(e.target.value?Number(e.target.value):null)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-50">
            <option value="">-- Select Item --</option>
            {filteredItems.map(i=>(
              <option key={i.item_code!} value={i.item_code!}>{i.item_name}</option>
            ))}
          </select>
          {item.item_code && isView && (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full whitespace-nowrap">
              {item.item_name}
            </span>
          )}
        </div>

        {/* ── Item Details Card ── */}
        <div className="bg-white rounded-xl shadow overflow-hidden mb-4">
          <div className="flex items-center gap-2 px-5 py-3 bg-blue-600">
            <Package className="w-4 h-4 text-white"/>
            <h2 className="text-sm font-semibold text-white">Item Details</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 p-5">

            {/* Item Name */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Item Name</label>
              <input value={item.item_name} readOnly={isView}
                onChange={e=>{handleChange("item_name",e.target.value);setTitleWarn(!!e.target.value&&e.target.value!==toTitleCase(e.target.value));}}
                className={`w-full h-10 px-3 border rounded-lg text-base font-normal text-black focus:ring-2 focus:ring-blue-200 outline-none ${isView?"bg-gray-50 cursor-default":"bg-white"}`}/>
              {!isView && titleWarn && <p className="text-xs text-amber-600 mt-1">⚠ Recommended: Title Case — e.g. Steel Bolt M10</p>}
            </div>

            {/* Description */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Description</label>
              <input value={item.description??""} readOnly={isView}
                onChange={e=>handleChange("description",e.target.value)}
                className={`w-full h-10 px-3 border rounded-lg text-base font-normal text-black focus:ring-2 focus:ring-blue-200 outline-none ${isView?"bg-gray-50 cursor-default":"bg-white"}`}/>
            </div>

            {/* Unit */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Unit of Measure</label>
              <select value={item.unit} disabled={isView}
                onChange={e=>handleChange("unit",e.target.value)}
                className={`w-full h-10 px-3 border rounded-lg text-base font-normal text-black focus:ring-2 focus:ring-blue-200 outline-none ${isView?"bg-gray-50":"bg-white"}`}>
                <option value="">-- Select Unit --</option>
                {units.map(u=><option key={u.id} value={u.unit_code}>{u.unit_code}</option>)}
              </select>
            </div>

            {/* Rate */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Rate per Unit</label>
              <input value={item.rate} readOnly={isView}
                onChange={e=>handleChange("rate",e.target.value)}
                className={`w-full h-10 px-3 border rounded-lg text-base font-normal text-black focus:ring-2 focus:ring-blue-200 outline-none ${isView?"bg-gray-50 cursor-default":"bg-white"}`}/>
            </div>

            {/* HSN */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">HSN Code</label>
              <input value={item.hsn_code??""} readOnly={isView}
                onChange={e=>handleChange("hsn_code",e.target.value)}
                className={`w-full h-10 px-3 border rounded-lg text-base font-normal text-black focus:ring-2 focus:ring-blue-200 outline-none ${isView?"bg-gray-50 cursor-default":"bg-white"}`}/>
            </div>

            {/* GST */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">GST %</label>
              <input value={item.gst_per} readOnly={isView}
                onChange={e=>handleChange("gst_per",e.target.value)}
                className={`w-full h-10 px-3 border rounded-lg text-base font-normal text-black focus:ring-2 focus:ring-blue-200 outline-none ${isView?"bg-gray-50 cursor-default":"bg-white"}`}/>
            </div>

            {/* Active */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Active</label>
              <select value={item.active?"Yes":"No"} disabled={isView}
                onChange={e=>handleChange("active",e.target.value==="Yes")}
                className={`w-full h-10 px-3 border rounded-lg text-base font-normal text-black focus:ring-2 focus:ring-blue-200 outline-none ${isView?"bg-gray-50":"bg-white"}`}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

          </div>
        </div>

        {/* ── Category Card ── */}
        <div className="bg-white rounded-xl shadow overflow-hidden mb-4">
          <div className="flex items-center gap-2 px-5 py-3 bg-emerald-600">
            <Tag className="w-4 h-4 text-white"/>
            <h2 className="text-sm font-semibold text-white">Category</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 p-5">

            {/* Category Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Category Type</label>
              <select value={selCatType} disabled={isView}
                onChange={e=>{setSelCatType(e.target.value);setItem(prev=>({...prev,category_type:e.target.value,cat_code:"",category:""}));}}
                className={`w-full h-10 px-3 border rounded-lg text-base font-normal text-black focus:ring-2 focus:ring-blue-200 outline-none ${isView?"bg-gray-50":"bg-white"}`}>
                <option value="">-- Select Type --</option>
                {categoryTypes.map(ct=><option key={ct} value={ct}>{ct}</option>)}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Category</label>
              <select value={item.cat_code??""} disabled={isView||!selCatType}
                onChange={e=>{const c=categories.find(c=>String(c.cat_code)===e.target.value);if(c)setItem(prev=>({...prev,cat_code:String(c.cat_code),category:c.category}));}}
                className={`w-full h-10 px-3 border rounded-lg text-base font-normal text-black focus:ring-2 focus:ring-blue-200 outline-none ${isView||!selCatType?"bg-gray-50":"bg-white"}`}>
                <option value="">-- Select Category --</option>
                {filteredCategories.map(c=><option key={c.cat_code} value={String(c.cat_code)}>{c.category}</option>)}
              </select>
            </div>

          </div>
        </div>

        {/* ── Empty state ── */}
        {isView && !item.item_code && (
          <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30"/>
            <p className="text-sm">Select an item above to view details</p>
          </div>
        )}

      </div>
    </div>
  );
}
