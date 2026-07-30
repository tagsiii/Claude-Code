'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';

// Custom-filter registry: add a new entry here and it appears in the
// "＋ Filter" menu with the right input type — no other code changes needed
// (getDeals must understand the param; see DashboardFilters).
const EXTRA_FILTERS: Array<{ param: string; label: string; type: 'date' | 'number'; hint?: string }> = [
  { param: 'updated_after', label: 'Updated after', type: 'date' },
  { param: 'updated_before', label: 'Updated before', type: 'date' },
  { param: 'seen_after', label: 'First seen after', type: 'date' },
  { param: 'seen_before', label: 'First seen before', type: 'date' },
  { param: 'min_score', label: 'Min score', type: 'number', hint: '0–100' },
  { param: 'min_value', label: 'Min value (USD)', type: 'number', hint: 'e.g. 500000000' },
];

const SECTORS = [
  { value: 'all', label: 'All Sectors' },
  { value: 'strategic_infrastructure', label: 'Strategic Infra' },
  { value: 'digital_connectivity', label: 'Digital' },
  { value: 'energy', label: 'Energy' },
  { value: 'cybersecurity', label: 'Cybersecurity' },
];

const STAGES = [
  { value: 'all', label: 'All Stages' },
  { value: 'rumored', label: 'Rumored' },
  { value: 'exploratory_mou', label: 'MOU' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'signed', label: 'Signed' },
  { value: 'financing_secured', label: 'Financing' },
  { value: 'under_construction', label: 'Construction' },
];

const REGIONS = [
  { value: 'all', label: 'All Regions' },
  { value: 'Africa', label: 'Africa' },
  { value: 'South Asia', label: 'South Asia' },
  { value: 'Southeast Asia', label: 'SE Asia' },
  { value: 'Central Asia', label: 'Central Asia' },
  { value: 'Pacific', label: 'Pacific' },
  { value: 'Latin America', label: 'Latin America' },
  { value: 'MENA', label: 'MENA' },
  { value: 'Europe', label: 'Europe' },
];

const SOURCE_TIERS = [
  { value: 'all', label: 'All Source Types' },
  { value: '1', label: 'T1 · Primary/Official' },
  { value: '2', label: 'T2 · Established Press' },
  { value: '3', label: 'T3 · Secondary' },
];

const TRIAGE_LANES = [
  { value: 'all', label: 'All Lanes' },
  { value: 'act', label: '⚑ Act' },
  { value: 'watching', label: '◉ Watching' },
  { value: 'untriaged', label: 'Untriaged' },
  { value: 'dismissed', label: 'Dismissed' },
];

const SORT_OPTIONS = [
  { value: 'composite_score', label: 'Score ↓' },
  { value: 'last_updated_at', label: 'Updated ↓' },
  { value: 'first_seen_at', label: 'First Seen ↓' },
  { value: 'rom_value_usd', label: 'Deal Size ↓' },
  { value: 'source_count', label: 'Source Count ↓' },
  { value: 'source_confidence_tier', label: 'Source Quality ↑' },
];

interface Props {
  currentFilters: Record<string, string>;
}

export function DashboardControls({ currentFilters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Extra filters visible either because the URL carries them or the user just
  // added them from the ＋ Filter menu (value pending).
  const [openExtras, setOpenExtras] = useState<string[]>([]);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(currentFilters);
      if (value === 'all' || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [currentFilters, router, pathname]
  );

  const clearAll = () => router.push(pathname);

  const hasFilters = Object.entries(currentFilters).some(
    ([k, v]) => v && v !== 'all' && k !== 'sort_by'
  );

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Search */}
      <input
        type="text"
        placeholder="Search deals…"
        defaultValue={currentFilters.search ?? ''}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            updateFilter('search', (e.target as HTMLInputElement).value);
          }
        }}
        onBlur={(e) => updateFilter('search', e.target.value)}
        className="bg-card border border-border text-foreground placeholder-muted-foreground text-sm rounded-full px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring w-48 transition-shadow"
      />

      <Select
        value={currentFilters.sector ?? 'all'}
        onChange={(v) => updateFilter('sector', v)}
        options={SECTORS}
      />
      <Select
        value={currentFilters.lifecycle_stage ?? 'all'}
        onChange={(v) => updateFilter('lifecycle_stage', v)}
        options={STAGES}
      />
      <Select
        value={currentFilters.host_region ?? 'all'}
        onChange={(v) => updateFilter('host_region', v)}
        options={REGIONS}
      />
      <Select
        value={currentFilters.source_tier ?? 'all'}
        onChange={(v) => updateFilter('source_tier', v)}
        options={SOURCE_TIERS}
      />
      <Select
        value={currentFilters.triage ?? 'all'}
        onChange={(v) => updateFilter('triage', v)}
        options={TRIAGE_LANES}
      />

      {/* Custom filter builder */}
      {EXTRA_FILTERS.filter((f) => currentFilters[f.param] || openExtras.includes(f.param)).map((f) => (
        <span
          key={f.param}
          className="inline-flex items-center gap-1.5 text-xs bg-card border border-border rounded-full pl-3 pr-2 py-1"
        >
          <span className="text-muted-foreground whitespace-nowrap">{f.label}</span>
          <input
            type={f.type}
            defaultValue={currentFilters[f.param] ?? ''}
            placeholder={f.hint}
            autoFocus={!currentFilters[f.param]}
            onChange={(e) => {
              if (f.type === 'date') updateFilter(f.param, e.target.value);
            }}
            onBlur={(e) => updateFilter(f.param, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateFilter(f.param, (e.target as HTMLInputElement).value);
            }}
            className="bg-secondary/60 border border-transparent focus:border-ring rounded-md px-2 py-0.5 text-xs text-foreground w-[8.5rem] focus:outline-none"
          />
          <button
            onClick={() => {
              setOpenExtras((o) => o.filter((p) => p !== f.param));
              updateFilter(f.param, '');
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remove ${f.label} filter`}
          >
            ✕
          </button>
        </span>
      ))}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) setOpenExtras((o) => [...o, e.target.value]);
        }}
        className="bg-card border border-dashed border-border text-muted-foreground text-xs rounded-full px-3 py-1.5 focus:outline-none cursor-pointer hover:text-foreground transition-colors"
      >
        <option value="">＋ Filter</option>
        {EXTRA_FILTERS.filter((f) => !currentFilters[f.param] && !openExtras.includes(f.param)).map((f) => (
          <option key={f.param} value={f.param}>{f.label}</option>
        ))}
      </select>

      {/* Unlocated chip — set from the Map page's "without coordinates" link */}
      {currentFilters.located === 'no' && (
        <button
          onClick={() => updateFilter('located', '')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-900/50 rounded-full px-3 py-1.5 transition-colors"
          title="Deals with no map coordinates — add a country or run geocode:backfill"
        >
          No coordinates
          <span aria-hidden>✕</span>
        </button>
      )}

      {/* Country filter chip — set by clicking a country on the Map page */}
      {currentFilters.host_country && (
        <button
          onClick={() => updateFilter('host_country', '')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5 hover:bg-primary/15 transition-colors"
          title="Remove country filter"
        >
          Country: {currentFilters.host_country}
          <span aria-hidden>✕</span>
        </button>
      )}

      <div className="h-5 w-px bg-border hidden sm:block" />

      <Select
        value={currentFilters.sort_by ?? 'composite_score'}
        onChange={(v) => updateFilter('sort_by', v)}
        options={SORT_OPTIONS}
      />

      {hasFilters && (
        <button
          onClick={clearAll}
          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1.5 hover:bg-secondary transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-card border border-border text-foreground text-sm rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/40 cursor-pointer hover:bg-secondary transition-colors"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
