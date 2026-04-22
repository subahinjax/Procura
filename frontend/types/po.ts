export type PoHeader = {
  id?: number;          // ✅ ADD THIS
  po_type: string;
  po_no: string;
  po_date: string;
  quot_no: string;
  del_day: string;
  warranty: string;
  freight: string;
  pay_term: string;
  sup_id: string;
  sup_name: string;
  po_title: string;
  prepared_by?: string | null;
  review_by?: string | null;
  prepared_review?: string | null;
  approved_by?: string | null;
  released_by?: string | null;
  dept_id: string;
  subdept_id: string;
  advance_required: boolean;
  advance_percent: string;
  status?: string;
  warningLength?: number;
};
