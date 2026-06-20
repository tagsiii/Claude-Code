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
  // joined fields
  sources?: Source[];
  events?: DealEvent[];
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

export interface DashboardFilters {
  sector?: Sector | 'all';
  sponsoring_state?: string | 'all';
  lifecycle_stage?: LifecycleStage | 'all';
  host_region?: string | 'all';
  min_score?: number;
  search?: string;
  sort_by?: 'composite_score' | 'last_updated_at' | 'first_seen_at' | 'rom_value_usd';
  sort_dir?: 'asc' | 'desc';
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
}
