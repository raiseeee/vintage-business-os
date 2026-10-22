import type {
  ClaimField,
  ContactStatus,
  EvidenceLevel,
  SupplierType,
} from "./constants";
import type { Evaluation } from "./score";

/** Riga della tabella suppliers (nomi delle colonne come nel database). */
export interface Supplier {
  id: string;
  name: string;
  website: string | null;
  country: string | null;
  languages: string[];
  stock_types: string[];
  brands: string[];
  supplier_type: SupplierType;
  min_order_qty: number | null;
  min_order_weight_kg: number | null;
  min_order_value_cents: number | null;
  price_per_kg_cents: number | null;
  price_notes: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_status: ContactStatus;
  next_action: string | null;
  next_action_date: string | null;
  last_contacted_at: string | null;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierSource {
  id: string;
  supplier_id: string;
  url: string | null;
  title: string;
  retrieved_at: string | null;
  note: string | null;
  created_at: string;
}

export interface SupplierClaim {
  id: string;
  supplier_id: string;
  field: ClaimField;
  statement: string;
  evidence_level: EvidenceLevel;
  source_id: string | null;
  created_at: string;
}

export interface SupplierEvaluation extends Evaluation {
  id: string;
  supplier_id: string;
  comment: string | null;
  created_at: string;
}

export interface SupplierFilters {
  q?: string;
  country?: string;
  language?: string;
  stock?: string;
  brand?: string;
  type?: string;
}
