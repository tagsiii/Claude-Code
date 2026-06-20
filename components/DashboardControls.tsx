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

const SORT_OPTIONS = [
  { value: 'composite_score', label: 'Score ↓' },
  { value: 'last_updated_at', label: 'Updated ↓' },
  { value: 'first_seen_at', label: 'First Seen ↓' },
  { value: 'rom_value_usd', label: 'Deal Size ↓' },
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
        className="bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44"
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

      <div className="h-5 w-px bg-slate-700 hidden sm:block" />

      <Select
        value={currentFilters.sort_by ?? 'composite_score'}
        onChange={(v) => updateFilter('sort_by', v)}
        options={SORT_OPTIONS}
      />

      {hasFilters && (
        <button
          onClick={clearAll}
          className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors"
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
      className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
