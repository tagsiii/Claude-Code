// Phase 4 gap-analysis helpers — pure and testable. DB access stays in
// lib/db/queries.ts; email rendering in lib/email/templates.ts.

export interface WhiteSpaceRow {
  iso3: string;
  country_name: string;
  cn_usd: number;
  cn_count: number;
  latest_year: number | null;
}

export interface UnpositionedRow {
  bank: string;
  project_ref: string;
  name: string;
  iso3: string;
  country_name: string;
  sector: string | null;
  value_usd: number | null;
}

export interface ConcentrationRow {
  iso3: string;
  country_name: string;
  sector: string;
  usd: number;
  cnt: number;
  share_pct: number;
}

// Diff the current white-space country set against the previous snapshot.
// `previous === null` means no snapshot exists yet (first run): treat as
// unchanged so the email stays silent and the baseline gets stored.
export function diffWhiteSpace(
  current: string[],
  previous: string[] | null
): { added: string[]; removed: string[]; changed: boolean } {
  if (previous === null) return { added: [], removed: [], changed: false };
  const cur = new Set(current);
  const prev = new Set(previous);
  const added = [...cur].filter((c) => !prev.has(c)).sort();
  const removed = [...prev].filter((c) => !cur.has(c)).sort();
  return { added, removed, changed: added.length > 0 || removed.length > 0 };
}

// Minimal CSV builder (RFC-4180 quoting) for the Gaps page export buttons.
export function toCsv(
  rows: Array<Record<string, unknown>>,
  columns: Array<{ key: string; label: string }>
): string {
  const quote = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => quote(c.label)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => quote(row[c.key])).join(','));
  }
  return lines.join('\r\n');
}
