"use client";

import { useState, useEffect } from "react";

type TermsCond = {
  id: string;
  title: string;
  content: string;
};

interface FieldProps {
  label: string;
  name: keyof TermsCond;
  value: string | null | undefined;
  readOnly: boolean;
  onChange: (name: keyof TermsCond, value: string) => void;
}

function Field({ label, name, value, readOnly, onChange }: FieldProps) {
  const isTextArea = name === "content"; // make content a multiline box
  return (
    <div className="mb-3">
      <label className="block text-gray-700 font-medium mb-1">{label}</label>
      {isTextArea ? (
        <textarea
          name={String(name)}
          value={value ?? ""}
          onChange={(e) => onChange(name, e.target.value)}
          readOnly={readOnly}
          rows={5}
          className={`w-full border border-gray-300 rounded-lg p-2 ${
            readOnly ? "bg-gray-100" : "bg-white"
          }`}
        />
      ) : (
        <input
          type="text"
          name={String(name)}
          value={value ?? ""}
          onChange={(e) => onChange(name, e.target.value)}
          readOnly={readOnly}
          className={`w-full border border-gray-300 rounded-lg p-2 ${
            readOnly ? "bg-gray-100" : "bg-white"
          }`}
        />
      )}
    </div>
  );
}

export default function TermsConditionsForm() {
  const [terms, setTerms] = useState<TermsCond[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<TermsCond | null>(null);
  const [mode, setMode] = useState<"view" | "add" | "edit">("view");

  const emptyTerm: TermsCond = {
    id: "",
    title: "",
    content: "",
  };

  const [termData, setTermData] = useState<TermsCond>(emptyTerm);

  const sanitize = (t: any): TermsCond => ({
    id: String(t?.id ?? ""),
    title: t?.title ?? "",
    content: t?.content ?? "",
  });

  // Fetch all terms
  useEffect(() => {
    async function fetchTerms() {
      try {
        const res = await fetch("/api/terms");
        const data = await res.json();
        setTerms(Array.isArray(data) ? data.map(sanitize) : []);
      } catch (err) {
        console.error("Error fetching terms:", err);
      }
    }
    fetchTerms();
  }, []);

  const handleSelectChange = (termId: string) => {
    const term = terms.find((t) => t.id === termId) || null;
    setSelectedTerm(term);
    if (term) {
      setTermData(term);
      setMode("view");
    } else {
      setTermData(emptyTerm);
      setMode("view");
    }
      setTermSearch("");
    };

  const handleAdd = () => {
    setMode("add");
    setSelectedTerm(null);
    setTermData(emptyTerm);
  };

  const handleEdit = () => {
    if (!selectedTerm) return;
    setMode("edit");
  };

  // ✅ Save new or updated term
  const handleSave = async () => {
    try {

   // ⚠️ Title Case warning (NON-BLOCKING)
    if (termData.title) {
      const recommended = toTitleCase(termData.title);

      if (termData.title !== recommended) {
        alert(
          `⚠️ Recommended Title format:\n\n${recommended}\n\nSaving is allowed.`
        );
      }
    }



      if (mode === "add") {
        const res = await fetch("/api/terms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(termData),
        });
        if (!res.ok) throw new Error("Failed to save term");

        // ✅ THIS IS THE CORRECT PLACE
           localStorage.setItem("MASTER_UPDATED", "supplier"); 

        const newTerm = sanitize(await res.json());
        setTerms((prev) => [...prev, newTerm]);
        setSelectedTerm(newTerm);
        setTermData(newTerm);
      } else if (mode === "edit") {
        const res = await fetch("/api/terms", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(termData),
        });
        if (!res.ok) throw new Error("Failed to update term");

        const updatedTerm = sanitize(await res.json());
        setTerms((prev) =>
          prev.map((t) => (t.id === updatedTerm.id ? updatedTerm : t))
        );
        setSelectedTerm(updatedTerm);
        setTermData(updatedTerm);
      }

      setMode("view");
      alert("Term saved successfully ✅");
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save term ❌");
    }
  };

  const handleCancel = () => {
    setTermData(emptyTerm);
    setSelectedTerm(null);
    setMode("view");
  };

const handleChange = (name: keyof TermsCond, value: string) => {
  setTermData((prev) => ({ ...prev, [name]: value }));

  // ⚠️ Inline Title Case warning (ONLY for title)
  if (name === "title") {
    const recommended = toTitleCase(value);
    setShowTitleCaseWarning(!!value && value !== recommended);
  }
};

const [termSearch, setTermSearch] = useState("");

const filteredTerms = termSearch.trim()
  ? terms.filter((t) =>
      t.title.toLowerCase().includes(termSearch.toLowerCase())
    )
  : terms;

const [showTitleCaseWarning, setShowTitleCaseWarning] = useState(false);


const toTitleCase = (str: string) =>
  str.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );




  return (
    <div className="flex justify-center mt-10">
      <div className="w-full max-w-3xl bg-white shadow-lg rounded-2xl px-4 mt-2 border border-gray-200">
        <h2 className="text-xl font-semibold mb-2 mt-2 border-b pb-2">
          Terms & Conditions
        </h2>

{/* Search */}
<div className="mb-3">
  <input
    type="text"
    placeholder="Search term title"
    value={termSearch}
    disabled={mode !== "view"}
    onChange={(e) => setTermSearch(e.target.value)}
    className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-400"
  />
</div>


        {/* Dropdown */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mb-1">
            Select Term
          </label>
          <select
            disabled={mode !== "view"}
            className={`w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-400 ${
              mode !== "view"
                ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                : ""
            }`}
            value={selectedTerm?.id ?? ""}
            onChange={(e) => handleSelectChange(e.target.value)}
          >
            <option value="">-- Select Term --</option>
            {filteredTerms.map((t) => (

              <option key={t.id || t.title} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 gap-1">
          <Field
            label="Title"
            name="title"
            value={termData.title}
            readOnly={mode === "view"}
            onChange={handleChange}
           />

		{mode !== "view" && showTitleCaseWarning && (
		   <p className="text-sm text-orange-600 mt-1">
		      ⚠️ Recommended format: Title Case (Eg: Payment Terms)
   		   </p>
		 )}

          <Field
            label="Content"
            name="content"
            value={termData.content}
            readOnly={mode === "view"}
            onChange={handleChange}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-4 mt-2 mb-2">
          {mode === "view" && (
            <>
              <button
                className="bg-blue-500 text-white w-20 px-2 py-2 rounded-lg hover:bg-blue-600"
                onClick={handleAdd}
              >
                Add
              </button>
              <button
                className="bg-green-500 text-white w-20 px-2 py-2 rounded-lg hover:bg-green-600"
                onClick={handleEdit}
                disabled={!selectedTerm}
              >
                Edit
              </button>
            </>
          )}

          {(mode === "add" || mode === "edit") && (
            <>
              <button
                className="bg-purple-500 text-white w-20 px-2 py-2 rounded-lg hover:bg-purple-600"
                onClick={handleSave}
              >
                Save
              </button>
              <button
                className="bg-gray-400 text-white w-20 px-2 py-2 rounded-lg hover:bg-gray-500"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
