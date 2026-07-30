export type Sector =
  | 'strategic_infrastructure'
  | 'digital_connectivity'
  | 'energy'
  | 'cybersecurity'
  | 'other';

export type LifecycleStage =
  | 'rumored'
  | 'exploratory_mou'
  | 'negotiation'
  | 'signed'
  | 'financing_secured'
  | 'under_construction'
  | 'completed'
  | 'cancelled';

export type ConfidenceTier = 1 | 2 | 3; // 1=primary/official, 2=established press, 3=secondary

export type LocationPrecision = 'exact' | 'facility' | 'city' | 'country_centroid' | 'unknown';

export interface SponsorRow {
  id: string;
  canonical_name: string;
  aliases: string[];
  country_iso3: string | null;
  is_state_backed: boolean;
  entity_type: 'soe' | 'policy_bank' | 'dfi' | 'private' | 'sovereign_fund' | 'agency';
  needs_review: boolean;
}

export interface SponsoringEntity {
  name: string;
  type: 'policy_bank' | 'soe' | 'sovereign_fund' | 'commercial' | 'unknown';
  country: string;
  commitment_status: 'rumored' | 'identified' | 'committed' | 'signed';
}

export interface ScoreBreakdown {
  likelihood: SubScore;
  actionability: SubScore;
  financing: SubScore;
  corroboration: SubScore;
  strategic_priority: SubScore;
}

export interface SubScore {
  score: number;     // 0–100 raw sub-score
  weight: number;    // configured weight (0–1)
  contribution: number; // score × weight → contribution to composite
  reasoning: string;
}

export interface DealEvent {
  id: string;
  deal_id: string;
  event_date: string | null;
  description: string;
  source_id: string | null;
  source_url?: string;
  source_title?: string;
  created_at: string;
}

export interface Source {
  id: string;
  url: string;
  title: string | null;
  published_at: string | null;
  retrieved_at: string;
  connector: string;
  confidence_tier: ConfidenceTier;
}

export interface Deal {
  id: string;
  title: string;
  slug: string | null;
  sponsoring_state: string | null;
  sponsoring_entities: SponsoringEntity[];
  host_country: string | null;
  host_region: string | null;
  sector: Sector;
  subsector: string | null;
  lifecycle_stage: LifecycleStage;
  lifecycle_reasoning: string | null;
  lifecycle_inferred_at: string | null;
  rom_value_usd: number | null;
  rom_value_min: number | null;
  rom_value_max: number | null;
  rom_basis: string | null;
  financial_sponsors: SponsoringEntity[];
  is_confirmed: boolean;
  executive_summary: string | null;
  executive_summary_generated_at: string | null;
  us_diplomatic_context: string | null;
  us_diplomatic_context_generated_at: string | null;
  composite_score: number | null;
  score_breakdown: ScoreBreakdown | null;
  score_calculated_at: string | null;
  source_count: number;
  source_confidence_tier: ConfidenceTier;
  status: 'active' | 'archived' | 'duplicate';
  first_seen_at: string;
  last_updated_at: string;
  created_at: string;
  // geospatial (Phase 1+; nullable until geo.sql migration is applied)
  country_iso3?: string | null;
  location_precision?: LocationPrecision | null;
  facility_id?: string | null;
  flag_near_cable_landing?: boolean;
  flag_near_cable_landing_reason?: string | null;
  flag_white_space?: boolean;
  flag_white_space_reason?: string | null;
  flag_contested_asset?: boolean;
  flag_contested_asset_reason?: string | null;
  flag_us_positioning?: boolean;
  flag_us_positioning_reason?: string | null;
  flag_unpositioned_mdb?: boolean;
  flag_unpositioned_mdb_reason?: string | null;
  // Data-quality vetting (quality.sql)
  data_quality_grade?: 'A' | 'B' | 'C' | 'D' | null;
  quality_components?: Record<string, unknown> | null;
  independent_source_count?: number;
  provenance?: Record<string, { source: string; date: string }> | null;
  enrichment_details?: EnrichmentDetails | null;
  review_status?: 'pending' | 'approved' | 'rejected';
  review_note?: string | null;
  triage_status?: 'none' | 'act' | 'watching' | 'dismissed';
  triage_note?: string | null;
  triaged_at?: string | null;
  xref_cn_ref?: string | null;
  xref_note?: string | null;
  last_corroborated_at?: string | null;
  // joined fields
  sources?: Source[];
  events?: DealEvent[];
}

export type DocumentKind = 'word' | 'excel' | 'pdf' | 'csv' | 'text' | 'other';

export type DocumentStatus =
  | 'uploaded'
  | 'parsing'
  | 'parsed'
  | 'analyzing'
  | 'analyzed'
  | 'error';

export interface DocumentRecord {
  id: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  sha256: string | null;
  storage_path: string;
  kind: DocumentKind;
  parsed_text: string | null;
  page_count: number | null;
  char_count: number;
  status: DocumentStatus;
  error_message: string | null;
  source_id: string | null;
  deals_found: number;
  deals_created: number;
  deals_updated: number;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  analyzed_at: string | null;
}

export interface ScoreWeight {
  id: string;
  name: string;
  weight: number;
  description: string;
}

export interface ConnectorConfig {
  id: string;
  name: string;
  display_name: string;
  enabled: boolean;
  last_run_at: string | null;
  config: Record<string, unknown>;
}

export interface IngestLog {
  id: string;
  connector: string | null;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'error';
  deals_found: number;
  deals_created: number;
  deals_updated: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface IngestResult {
  connector: string;
  deals_found: number;
  deals_created: number;
  deals_updated: number;
  duration_ms: number;
  error?: string;
}

// Richer facts extracted from article bodies (enrichment pass).
export interface EnrichmentDetails {
  financing_structure?: { type?: string | null; details?: string | null } | null;
  counterparties?: Array<{ name: string; role?: string | null; country?: string | null }> | null;
  verification?: { is_genuine_deal?: boolean; confidence?: number; note?: string | null } | null;
}

export interface DashboardFilters {
  // 'pending' shows the review queue; default hides pending + rejected.
  review?: 'pending' | 'all';
  // 'no' → only deals without map coordinates (nothing geocodable yet).
  located?: 'no' | 'all';
  // Analyst triage lane; default hides 'dismissed'.
  triage?: 'act' | 'watching' | 'dismissed' | 'untriaged' | 'all';
  // Custom filter builder (dates as YYYY-MM-DD).
  updated_after?: string;
  updated_before?: string;
  seen_after?: string;
  seen_before?: string;
  min_value?: number;
  sector?: Sector | 'all';
  sponsoring_state?: string | 'all';
  lifecycle_stage?: LifecycleStage | 'all';
  host_region?: string | 'all';
  // Country filter — an ISO3 code (from a map click) or a country-name fragment.
  host_country?: string | 'all';
  source_tier?: string | 'all'; // '1' | '2' | '3' — best confidence tier on the deal
  min_score?: number;
  search?: string;
  sort_by?:
    | 'composite_score'
    | 'last_updated_at'
    | 'first_seen_at'
    | 'rom_value_usd'
    | 'source_count'
    | 'source_confidence_tier';
  sort_dir?: 'asc' | 'desc';
}

export type ExportFormat = 'xlsx' | 'docx' | 'pdf';

export interface ExportConfig {
  format: ExportFormat;
  columns: string[];              // field keys to include as table columns
  includeSummary: boolean;        // executive summary (docx/pdf narrative)
  includeDiplomatic: boolean;     // US diplomatic context (docx/pdf narrative)
  includeScoreBreakdown: boolean; // per-sub-score reasoning (docx/pdf narrative)
  title?: string;                 // report title
}

// Raw article from connector before LLM processing
export interface RawArticle {
  url: string;
  title: string;
  published_at: string | null;
  source_country: string | null;
  language: string | null;
  domain: string | null;
  connector: string;
  confidence_tier: ConfidenceTier;
}

// Extracted deal candidate from LLM
export interface DealCandidate {
  title: string;
  sponsoring_state: string | null;
  sponsoring_entities: SponsoringEntity[];
  host_country: string | null;
  host_region: string | null;
  sector: Sector;
  subsector: string | null;
  lifecycle_stage: LifecycleStage;
  lifecycle_reasoning: string;
  rom_value_usd: number | null;
  rom_basis: string | null;
  financial_sponsors: SponsoringEntity[];
  is_confirmed: boolean;
  executive_summary: string;
  us_diplomatic_context: string;
  key_dates: Array<{ date: string; description: string }>;
  source_urls: string[];
  confidence: number; // 0–1, LLM self-assessed
  // geospatial extraction fields (Phase 1)
  named_facilities: string[];
  place_names: string[];
  host_country_iso3: string | null;
}
