export const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

export const formatAmount = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "0.00";
  const num = Number(value);
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
