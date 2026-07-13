'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

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
