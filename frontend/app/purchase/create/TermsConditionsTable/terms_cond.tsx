"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import stringSimilarity from "string-similarity";
import { API_BASE_URL } from "@/lib/api";
import { Term } from "@/types/term";

interface TermsConditionsTableProps {
  value: Term[];
  onChange: (val: Term[]) => void;
  terms: Term[];          // ✅ ADD THIS
  disabled?: boolean;
}


export default function TermsConditionsTable({
  value,
  onChange,
  disabled = false, // default false
}: TermsConditionsTableProps) {
  const [terms, setTerms] = useState<any[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<number | "">("");

 // Fetch terms from API
const fetchTerms = () => {
  console.log("🚀 Fetching terms from API...");
  fetch(`${API_BASE_URL}/api/terms`, { credentials: "include" })
    .then(res => res.json())
    .then(data => {

const mapped = Array.isArray(data)
  ? data.map((t: any) => ({
      id: t.id,
      title: t.title || "(No Title)",
      content: t.content || "",     // ✅ full content for table
      isCustom: false,
    }))
  : [];


      setTerms(mapped);
      setTermsReady(true);
    })
    .catch(err => console.error("Error fetching terms:", err));
};

useEffect(() => {
  console.log("🔁 terms state changed:", terms);
  console.log("🔁 terms length:", terms.length);
}, [terms]);

useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      console.log("👀 Tab active again → refetching terms...");
      fetchTerms();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}, []);

useEffect(() => {
  fetchTerms();
}, []);


const [termsReady, setTermsReady] = useState(false);

  const normalize = (str: string) =>
    str.toLowerCase().replace(/\s+/g, " ").trim();

const handleAddSelected = () => {
  if (!selectedTermId || disabled) return;

  const termId = Number(selectedTermId); // ✅ convert here
  const term = terms.find(t => t.id === termId);
  if (!term) return;

  if (value.some(v => v.id === termId)) {
    alert("❌ This general term is already added!");
    return;
  }

  onChange([...value, { id: term.id, title: term.title, content: term.content, isCustom: false }]);
  setSelectedTermId("");
};

  const handleDelete = (id: number) => {
    if (disabled) return;
    onChange(value.filter((t) => t.id !== id));
  };

  return (
    <fieldset disabled={disabled}> {/* ✅ everything inside disabled automatically */}
      <div className="bg-gray-100 border border-indigo-600 rounded-md shadow p-2 mt-3">
        <h3 className="bg-gradient-to-r from-indigo-500 to-sky-500 text-white text-center font-bold px-4 py-1 rounded-lg">
          Terms & Conditions
        </h3>

        <div className="flex items-start gap-4 mb-8 mt-2">

<select
  value={selectedTermId}
  onChange={(e) => setSelectedTermId(Number(e.target.value))}
  onMouseDown={(e) => disabled && e.preventDefault()}
  style={{ colorScheme: "light" }}   // ⭐ FIX
  className="flex-1 border border-gray-400 rounded-lg px-3 h-9 text-sm
             focus:outline-none focus:ring-2 focus:ring-blue-400
             bg-white text-black"
>
  <option value="">-- Select a General Term --</option>

  {terms.map((term) => (
    <option
      key={term.id}
      value={term.id}
      disabled={value.some((v) => v.id === term.id)}
    >
      {term.title || term.content}
    </option>
  ))}
</select>






          <button
            type="button"
            onClick={handleAddSelected}
	    disabled={!selectedTermId || disabled}
            className="bg-gradient-to-r from-blue-500 to-teal-500 text-white px-4 h-9 w-20 rounded-lg hover:opacity-90"
          >
            Add
          </button>
        </div>

        <div className="overflow-hidden rounded-lg border -mt-6 mb-1">
          <table className="w-full border border-green-900 border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm">
                <th className="border border-green-900 px-4 py-1.5 font-semibold">#</th>
                <th className="border border-green-900 px-4 py-1.5 font-semibold">Content</th>
                <th className="border border-green-900 px-4 py-1.5 font-semibold text-center">Delete</th>
              </tr>
            </thead>
            <tbody>
              {value.map((term, idx) => (
                <tr key={term.id ?? idx} className="odd:bg-white even:bg-sky-100 text-sm h-9">
                  <td className="border border-green-900 px-4 py-0 text-center">{idx + 1}</td>
                  <td className="border border-green-900 px-4 py-0">{term.content}</td>
                  <td className="border border-green-900 px-4 py-0 text-center">
                    <button
                      type="button"
                      onClick={() => handleDelete(term.id)}
                      className="p-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      <Trash2 size={20} strokeWidth={2.5} />
                    </button>
                  </td>
                </tr>
              ))}
              {value.length === 0 && (
                <tr>
                  <td colSpan={3} className="border border-green-900 text-center h-9 text-gray-900 italic">
                    No terms added
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </fieldset>
  );
}
