import type { Deal } from '../types';
import { formatSector, formatStage, formatDate } from '../utils/format';

export interface ExportField {
  key: string;
  label: string;
  numeric?: boolean;
  longText?: boolean; // excluded from docx/pdf grid (rendered as narrative instead)
  get: (d: Deal) => string | number | null;
}

export const EXPORT_FIELDS: ExportField[] = [
  { key: 'title', label: 'Transaction', get: (d) => d.title },
  { key: 'sponsoring_state', label: 'Sponsor', get: (d) => d.sponsoring_state },
  { key: 'host_country', label: 'Host Country', get: (d) => d.host_country },
  { key: 'host_region', label: 'Region', get: (d) => d.host_region },
  { key: 'sector', label: 'Sector', get: (d) => formatSector(d.sector) },
  { key: 'subsector', label: 'Subsector', get: (d) => d.subsector },
  { key: 'lifecycle_stage', label: 'Stage', get: (d) => formatStage(d.lifecycle_stage) },
  { key: 'rom_value_usd', label: 'Value (USD)', numeric: true, get: (d) => d.rom_value_usd },
  { key: 'composite_score', label: 'Score', numeric: true, get: (d) => d.composite_score },
  { key: 'likelihood', label: 'Likelihood', numeric: true, get: (d) => d.score_breakdown?.likelihood.score ?? null },
  { key: 'actionability', label: 'Actionability', numeric: true, get: (d) => d.score_breakdown?.actionability.score ?? null },
  { key: 'financing', label: 'Financing', numeric: true, get: (d) => d.score_breakdown?.financing.score ?? null },
  { key: 'corroboration', label: 'Corroboration', numeric: true, get: (d) => d.score_breakdown?.corroboration.score ?? null },
  { key: 'strategic_priority', label: 'Strategic Priority', numeric: true, get: (d) => d.score_breakdown?.strategic_priority.score ?? null },
  { key: 'source_count', label: 'Sources', numeric: true, get: (d) => d.source_count },
  { key: 'source_confidence_tier', label: 'Best Tier', numeric: true, get: (d) => d.source_confidence_tier },
  { key: 'is_confirmed', label: 'Confirmed', get: (d) => (d.is_confirmed ? 'Yes' : 'No') },
  { key: 'first_seen_at', label: 'First Seen', get: (d) => formatDate(d.first_seen_at) },
  { key: 'last_updated_at', label: 'Last Updated', get: (d) => formatDate(d.last_updated_at) },
  { key: 'executive_summary', label: 'Executive Summary', longText: true, get: (d) => d.executive_summary },
  { key: 'us_diplomatic_context', label: 'US Diplomatic Context', longText: true, get: (d) => d.us_diplomatic_context },
];

export const FIELD_MAP: Record<string, ExportField> = Object.fromEntries(
  EXPORT_FIELDS.map((f) => [f.key, f])
);

export const DEFAULT_COLUMNS = [
  'title',
  'sponsoring_state',
  'host_country',
  'sector',
  'lifecycle_stage',
  'rom_value_usd',
  'composite_score',
  'source_count',
  'last_updated_at',
];

// Resolve a config's column keys to field definitions, preserving order.
export function resolveFields(columns: string[]): ExportField[] {
  return columns.map((k) => FIELD_MAP[k]).filter(Boolean);
}

export function cellString(value: string | number | null): string {
  if (value == null || value === '') return '—';
  return String(value);
}
