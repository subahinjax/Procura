"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import useAuthGuard from "@/hooks/useAuthGuard";
import { API_BASE_URL } from "@/lib/api";
import { PencilLine, Trash2, Eye, Plus, X, Check, Sparkles, ToggleLeft, ToggleRight, Tag } from "lucide-react";

// mas_cat: cat_code VARCHAR(20) PK, category VARCHAR(30),
//          category_type VARCHAR(30), description VARCHAR(255),
//          active BOOLEAN, created_at TIMESTAMP
interface Category {
  cat_code: string; category: string; category_type: string;
  description: string | null; active: boolean; created_at: string;
}

const TYPE_BADGE: Record<string, string> = {
  "Non-Consumable": "bg-blue-100 text-blue-700",
  "Consumable":     "bg-green-100 text-green-700",
};

const Req = () => <span className="text-red-500 ml-0.5">*</span>;

// ── View Modal ────────────────────────────────────────────────────────────────
function ViewModal({ cat, onClose }: { cat: Category; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Tag className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-mono text-gray-400">Code: {cat.cat_code}</p>
              <h3 className="text-lg font-bold text-gray-800">{cat.category}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">×</button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-500 font-medium">Category Type</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[cat.category_type] || "bg-gray-100 text-gray-600"}`}>
              {cat.category_type}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-500 font-medium">Status</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
              {cat.active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="py-2 border-b">
            <p className="text-gray-500 font-medium mb-1">Description</p>
            <p className="text-gray-700">{cat.description || "—"}</p>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-500 font-medium">Created At</span>
            <span className="text-gray-600 text-xs">
              {new Date(cat.created_at).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit Modal with AI Suggestion ──────────────────────────────────────
// Code ranges: Non-Consumable = 10001–19999 | Consumable = 20001–29999
function FormModal({ cat, catTypes, onSave, onClose }: {
  cat: Category | null;
  catTypes: string[];
  onSave: (data: Partial<Category>) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!cat;
  const [catCode,       setCatCode]       = useState(cat?.cat_code || "");
  const [category,      setCategory]      = useState(cat?.category || "");
  const [categoryType,  setCategoryType]  = useState(cat?.category_type || "");
  const [customType,    setCustomType]    = useState("");
  const [description,   setDescription]  = useState(cat?.description || "");
  const [active,        setActive]        = useState(cat?.active !== false);
  const [saving,        setSaving]        = useState(false);
  const [codeLoading,   setCodeLoading]   = useState(false);

  const effectiveType = categoryType === "__custom__" ? customType : categoryType;

  // Fetch next cat_code from server based on type range
  // Only called in Add mode — edit mode always keeps original cat_code
  const fetchNextCode = async (type: string) => {
    if (isEdit || !type || type === "__custom__") return;
    setCodeLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/mas-cat/next-code?type=${encodeURIComponent(type)}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setCatCode(data.next_code);
      }
    } catch { /* silent */ }
    finally { setCodeLoading(false); }
  };

  // On mount — if Add mode, fetch code based on initial type (if any)
  React.useEffect(() => {
    if (!isEdit && effectiveType) fetchNextCode(effectiveType);
  }, []); // eslint-disable-line

  // When type changes:
  //   Add mode  → fetch new code for the selected range
  //   Edit mode → NEVER change cat_code (it's the PK linked to mas_item)
  const handleTypeChange = async (val: string) => {
    setCategoryType(val);
    if (isEdit) return; // cat_code frozen in edit mode
    const resolvedType = val === "__custom__" ? "" : val;
    if (resolvedType) await fetchNextCode(resolvedType);
    else setCatCode("");
  };

  // AI suggestion
  const [aiInput,       setAiInput]       = useState("");
  const [aiLoading,     setAiLoading]     = useState(false);
  const [aiSuggestion,  setAiSuggestion]  = useState<{
    cat_code: string | null; category: string | null;
    category_type: string | null; reason: string;
  } | null>(null);

  const getSuggestion = async () => {
    if (!aiInput.trim()) return alert("Enter an item description to get suggestions");
    setAiLoading(true); setAiSuggestion(null);
    try {
      // Step 1: fetch active category list from our backend
      const catRes = await fetch(`${API_BASE_URL}/api/mas-cat/suggest`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ description: aiInput }),
      });
      if (!catRes.ok) { alert("Failed to load categories"); return; }
      const { categories } = await catRes.json();

      if (!categories?.length) {
        setAiSuggestion({ cat_code: null, category: null, category_type: null, reason: "No active categories found" });
        return;
      }

      const catList = categories.map((c: any) =>
        `${c.cat_code} | ${c.category} | ${c.category_type} | ${c.description || ""}`
      ).join("\n");

      // Step 2: call Anthropic directly from frontend
      const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || "";
      if (!apiKey || apiKey.startsWith("sk-ant-xxx")) {
        alert("Please set a valid NEXT_PUBLIC_ANTHROPIC_API_KEY in your .env.local file (not the placeholder)");
        return;
      }
      console.log("API key prefix:", apiKey.substring(0, 20) + "...");
      const userPrompt =
        `Available Categories (cat_code | category | category_type | description):\n${catList}\n\n` +
        `Item: "${aiInput}"\n\n` +
        `Pick the best matching category. Return ONLY a JSON object with keys: cat_code, category, category_type, reason.`;

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          system: "You are a procurement category classifier. Output ONLY raw JSON, no markdown, no backticks.",
          messages: [
            { role: "user",      content: userPrompt },
            { role: "assistant", content: "{" }
          ]
        })
      });

      if (!aiRes.ok) {
        const errData = await aiRes.json().catch(() => ({}));
        alert("AI error: " + (errData?.error?.message || aiRes.status));
        return;
      }

      const aiData = await aiRes.json();
      const partial = (aiData.content?.[0]?.text || "").trim();
      const fullJson = "{" + partial; // prepend the prefilled "{"

      let suggestion;
      try {
        suggestion = JSON.parse(fullJson);
      } catch {
        const match = fullJson.match(/\{[\s\S]*\}/);
        if (!match) { alert("Could not parse AI response"); return; }
        suggestion = JSON.parse(match[0]);
      }
      setAiSuggestion(suggestion);
    } catch (e: any) {
      alert("Suggestion error: " + (e?.message || "Unknown error"));
    }
    finally { setAiLoading(false); }
  };

  const applySuggestion = async () => {
    if (!aiSuggestion?.category) return;
    setCategory(aiSuggestion.category);
    if (aiSuggestion.category_type) {
      setCategoryType(aiSuggestion.category_type);
      // fetchNextCode is a no-op in edit mode — cat_code stays frozen
      if (!isEdit) await fetchNextCode(aiSuggestion.category_type);
    }
    setAiSuggestion(null);
  };

  const handleSave = async () => {
    // catCode is always auto-generated — no need to validate
    if (!category.trim())           return alert("Category name is required");
    if (!effectiveType.trim())      return alert("Category type is required");
    setSaving(true);
    await onSave({
      cat_code:      catCode.trim(),
      category:      category.trim(),
      category_type: effectiveType.trim(),
      description:   description.trim() || undefined,
      active,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-semibold text-gray-800">
            {isEdit ? `Edit Category — ${cat?.cat_code}` : "Add New Category"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none">×</button>
        </div>

        {/* ── AI Suggestion Box ── */}
        <div className="mb-5 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold text-purple-700">AI Category Suggestion</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Describe your item — AI will suggest the best matching category and type.
          </p>
          <div className="flex gap-2">
            <input value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && getSuggestion()}
              placeholder="e.g. Laptop charger, lab microscope, office chair..."
              className="flex-1 border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-200 outline-none" />
            <button onClick={getSuggestion} disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? "Thinking..." : "Suggest"}
            </button>
          </div>

          {/* AI result */}
          {aiSuggestion && (
            <div className={`mt-3 rounded-lg p-3 border text-sm ${aiSuggestion.cat_code ? "bg-white border-purple-200" : "bg-gray-50 border-gray-200"}`}>
              {aiSuggestion.cat_code ? (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800">{aiSuggestion.category}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[aiSuggestion.category_type || ""] || "bg-gray-100 text-gray-600"}`}>
                        {aiSuggestion.category_type}
                      </span>
                      <span className="text-xs font-mono text-gray-400">{aiSuggestion.cat_code}</span>
                    </div>
                    <button onClick={applySuggestion}
                      className="flex items-center gap-1 px-2.5 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 font-medium whitespace-nowrap">
                      <Check className="w-3 h-3" /> Apply
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 italic">"{aiSuggestion.reason}"</p>
                </>
              ) : (
                <p className="text-gray-500 italic text-xs">{aiSuggestion.reason}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Form Fields ── */}
        <div className="space-y-4">
          {/* Cat Code — read-only always. Edit: frozen (PK linked to mas_item). Add: auto by type range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Code
              {isEdit
                ? <span className="ml-2 text-xs font-normal text-amber-600">🔒 Cannot change — linked to item records</span>
                : <span className="ml-2 text-xs font-normal text-gray-400">
                    {effectiveType
                      ? effectiveType.toLowerCase().includes("consumable") && !effectiveType.toLowerCase().includes("non")
                        ? "(Consumable: 20001–29999)"
                        : "(Non-Consumable: 10001–19999)"
                      : "(select type first)"}
                  </span>}
            </label>
            <div className="relative">
              <input value={codeLoading ? "Generating..." : (catCode || "—")} readOnly
                className="w-full border rounded px-3 py-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed font-mono tracking-wider" />
              {codeLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>

          {/* Category Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Name <Req /></label>
            <input value={category} onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Furniture"
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
          </div>

          {/* Category Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Type <Req /></label>
            <select value={categoryType} onChange={e => handleTypeChange(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none">
              <option value="">-- Select Type --</option>
              {catTypes.map(t => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">+ Add new type...</option>
            </select>
            {categoryType === "__custom__" && (
              <input value={customType}
                onChange={async e => {
                  setCustomType(e.target.value);
                  if (e.target.value.trim()) await fetchNextCode(e.target.value.trim());
                }}
                placeholder="Enter new category type"
                className="mt-2 w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} placeholder="Describe what items belong to this category..."
              className="w-full border rounded px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-200 outline-none" />
            <p className="text-xs text-gray-400 mt-0.5 text-right">{description.length}/255</p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-2 border rounded px-3 bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-700">Active Status</p>
              <p className="text-xs text-gray-400">Inactive categories won't appear in item forms</p>
            </div>
            <button onClick={() => setActive(p => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
              {active
                ? <><ToggleRight className="w-4 h-4" /> Active</>
                : <><ToggleLeft className="w-4 h-4" /> Inactive</>}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5 pt-4 border-t">
          <button onClick={onClose} className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
            <Check className="w-4 h-4" /> {saving ? "Saving..." : isEdit ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CategoryMasterPage() {
  const router  = useRouter();
  const { user, loading: authLoading } = useAuth();
  useAuthGuard();
  const isAdmin = user?.user_type?.toUpperCase() === "ADMIN";

  const [cats, setCats]         = useState<Category[]>([]);
  const [catTypes, setCatTypes] = useState<string[]>([]);
  // nextCode now fetched inside FormModal based on selected type
  const [loading, setLoading]   = useState(true);

  // Filters
  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");

  // Modals
  const [addModal, setAddModal]   = useState(false);
  const [editCat, setEditCat]     = useState<Category | null>(null);
  const [viewCat, setViewCat]     = useState<Category | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    loadAll();
  }, [authLoading, user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [cRes, tRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/mas-cat`,       { credentials: "include" }),
        fetch(`${API_BASE_URL}/api/mas-cat/types`, { credentials: "include" }),
      ]);
      if (cRes.status === 401) { router.replace("/session-expired"); return; }
      if (cRes.ok) setCats(await cRes.json());
      if (tRes.ok) setCatTypes(await tRes.json());
    } finally { setLoading(false); }
  };

  // Save new category
  const handleAdd = async (data: Partial<Category>) => {
    const res = await fetch(`${API_BASE_URL}/api/mas-cat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify(data),
    });
    if (!res.ok) { alert((await res.json()).error || "Failed to save"); return; }
    setAddModal(false);
    await loadAll();
  };

  // Update category
  const handleEdit = async (data: Partial<Category>) => {
    if (!editCat) return;
    const res = await fetch(`${API_BASE_URL}/api/mas-cat/${editCat.cat_code}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify(data),
    });
    if (!res.ok) { alert((await res.json()).error || "Failed to update"); return; }
    setEditCat(null); await loadAll();
  };

  // Delete
  const handleDelete = async (cat: Category) => {
    if (!window.confirm(`Delete category "${cat.category}" (${cat.cat_code})?`)) return;
    const res = await fetch(`${API_BASE_URL}/api/mas-cat/${cat.cat_code}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { alert((await res.json()).error || "Failed to delete"); return; }
    await loadAll();
  };

  // Toggle active
  const handleToggle = async (cat: Category) => {
    const res = await fetch(`${API_BASE_URL}/api/mas-cat/${cat.cat_code}/toggle`, { method: "PATCH", credentials: "include" });
    if (!res.ok) { alert("Failed to toggle status"); return; }
    await loadAll();
  };

  // Filtered list
  const filtered = cats.filter(c => {
    const matchSearch = !search
      || c.category.toLowerCase().includes(search.toLowerCase())
      || c.cat_code.includes(search)
      || (c.description || "").toLowerCase().includes(search.toLowerCase());
    const matchType   = !typeFilter   || c.category_type === typeFilter;
    const matchActive = !activeFilter || String(c.active) === activeFilter;
    return matchSearch && matchType && matchActive;
  });

  // Stats
  const totalActive   = cats.filter(c => c.active).length;
  const totalInactive = cats.filter(c => !c.active).length;
  const typeGroups    = [...new Set(cats.map(c => c.category_type))];

  if (authLoading || !user) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 bg-gray-100 min-h-screen max-w-5xl mx-auto space-y-4">

      {/* Modals */}
      {viewCat && <ViewModal cat={viewCat} onClose={() => setViewCat(null)} />}
      {addModal && (
        <FormModal cat={null} catTypes={catTypes} onSave={handleAdd} onClose={() => setAddModal(false)} />
      )}
      {editCat && (
        <FormModal cat={editCat} catTypes={catTypes} onSave={handleEdit} onClose={() => setEditCat(null)} />
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total",    value: cats.length,    color: "bg-blue-600",  text: "text-blue-600"  },
          { label: "Active",   value: totalActive,    color: "bg-green-600", text: "text-green-600" },
          { label: "Inactive", value: totalInactive,  color: "bg-red-500",   text: "text-red-500"   },
          { label: "Types",    value: typeGroups.length, color: "bg-purple-600", text: "text-purple-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow px-4 py-3 flex items-center gap-3">
            <div className={`w-2 h-10 rounded-full ${s.color}`} />
            <div>
              <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Header / Filters ── */}
      <div className="bg-white rounded-xl shadow px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-gray-700">
          <Tag className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-bold">Category Master</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search category..."
            className="border rounded-lg px-3 py-2 text-sm w-44 outline-none focus:ring-2 focus:ring-blue-200" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200">
            <option value="">All Types</option>
            {catTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={activeFilter} onChange={e => setActiveFilter(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200">
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {isAdmin && (
            <button onClick={() => setAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
              <Plus className="w-4 h-4" /> Add Category
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-700 text-white">
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide w-24">Code</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Category</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Type</th>
              <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide">Description</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide w-24">Status</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No categories found</td></tr>
            ) : filtered.map((c, i) => (
              <tr key={c.cat_code}
                className={`border-b transition-colors hover:bg-gray-50 ${!c.active ? "opacity-60" : ""} ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                <td className="px-3 py-3 font-mono text-xs text-gray-500 font-medium">{c.cat_code}</td>
                <td className="px-3 py-3 font-semibold text-gray-800">{c.category}</td>
                <td className="px-3 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[c.category_type] || "bg-gray-100 text-gray-600"}`}>
                    {c.category_type}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500 text-xs max-w-xs truncate" title={c.description || ""}>
                  {c.description || <span className="italic text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  {isAdmin ? (
                    <button onClick={() => handleToggle(c)} title="Toggle status"
                      className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${c.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-600 hover:bg-red-200"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </button>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  )}
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button title="View" onClick={() => setViewCat(c)}
                      className="p-1.5 rounded hover:bg-gray-200 transition-colors">
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    {isAdmin && (
                      <>
                        <button title="Edit" onClick={() => setEditCat(c)}
                          className="p-1.5 rounded hover:bg-green-100 transition-colors">
                          <PencilLine className="w-4 h-4 text-green-600" />
                        </button>
                        <button title="Delete" onClick={() => handleDelete(c)}
                          className="p-1.5 rounded hover:bg-red-100 transition-colors">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5 bg-gray-50 border-t text-xs text-gray-400 text-right">
          Showing {filtered.length} of {cats.length} categories
        </div>
      </div>
    </div>
  );
}
