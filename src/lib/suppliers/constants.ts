export const SUPPLIER_TYPES = [
  "raccoglitore_diretto",
  "centro_selezione",
  "grossista_documentato",
  "rivenditore",
  "origine_non_verificata",
] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  raccoglitore_diretto: "Raccoglitore diretto",
  centro_selezione: "Centro di selezione",
  grossista_documentato: "Grossista con provenienza documentata",
  rivenditore: "Rivenditore",
  origine_non_verificata: "Origine non verificata",
};

export const CONTACT_STATUSES = [
  "da_contattare",
  "contattata",
  "in_attesa",
  "risposta_ricevuta",
  "campione_richiesto",
  "verificata",
  "scartata",
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  da_contattare: "Da contattare",
  contattata: "Contattata",
  in_attesa: "In attesa di risposta",
  risposta_ricevuta: "Risposta ricevuta",
  campione_richiesto: "Campione richiesto",
  verificata: "Verificata",
  scartata: "Scartata",
};

export const EVIDENCE_LEVELS = ["documentato", "dichiarato", "ipotesi"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  documentato: "Documentato",
  dichiarato: "Dichiarato dall'azienda",
  ipotesi: "Ipotesi",
};

export const EVIDENCE_HINTS: Record<EvidenceLevel, string> = {
  documentato: "Supportato da una fonte che hai registrato.",
  dichiarato: "Lo afferma l'azienda, non è stato verificato.",
  ipotesi: "Una tua congettura, senza prove.",
};

export const CLAIM_FIELDS = [
  "provenienza",
  "tipo",
  "moq",
  "prezzo",
  "contatto",
  "altro",
] as const;
export type ClaimField = (typeof CLAIM_FIELDS)[number];

export const CLAIM_FIELD_LABELS: Record<ClaimField, string> = {
  provenienza: "Provenienza della merce",
  tipo: "Tipo di attività",
  moq: "Ordine minimo",
  prezzo: "Prezzi",
  contatto: "Contatto",
  altro: "Altro",
};
