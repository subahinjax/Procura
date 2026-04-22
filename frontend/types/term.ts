export type Term = {
  id: number;
  content: string;   // ✅ canonical field
  title?: string;    // ✅ optional
  isCustom?: boolean;
};
