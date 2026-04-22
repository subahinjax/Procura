// ✅ /utils/dateUtils.ts

/**
 * FIX: new Date("2026-03-01") parses as UTC midnight.
 * In IST (UTC+5:30) that becomes 28 Feb 18:30 — wrong date shown.
 * Solution: append T00:00 to force LOCAL midnight parse.
 */
export const formatDateIndian = (dateString: string | null) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  const day = String(local.getDate()).padStart(2, "0");
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const year = local.getFullYear();

  return `${day}-${month}-${year}`;
};


export const parseIndianDate = (indianDate: string | null | undefined): string => {
  if (!indianDate) return "";

  const s = String(indianDate).trim();

  // If ISO (has time) → convert to LOCAL date
  if (s.includes("T")) {
    const d = new Date(s);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`; // ✅ LOCAL date
  }

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD-MM-YYYY → YYYY-MM-DD
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [day, month, year] = s.split("-");
    return `${year}-${month}-${day}`;
  }

  return "";
};
