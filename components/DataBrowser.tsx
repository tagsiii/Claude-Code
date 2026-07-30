'use client';

// Excel-style data workbench: dataset tabs, a global query box, sortable
// columns, per-column filter boxes, CLICK-A-CELL-TO-FILTER, row selection
// with copy-to-clipboard (pastes straight into Excel), expandable rows, and
// CSV export of the current filtered view.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { DATASETS, type Dataset, type DataColumn } from '@/lib/data/datasets';
import { SOURCE_CATALOG } from '@/lib/data/catalog';

type Row = Record<string, unknown>;

const FILTER_HINTS: Record<string, string> = {
  text: 'contains…',
  number: '> < .. or exact',
  date: 'yyyy-mm-dd, > <',
  boolean: 'yes / no',
};

export function DataBrowser() {
  const [datasetKey, setDatasetKey] = useState('deals');
  const dataset: Dataset = DATASETS[datasetKey];

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [sort, setSort] = useState<string>(dataset.defaultSort);
  const [dir, setDir] = useState<'asc' | 'desc'>(dataset.defaultDir);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [globalQ, setGlobalQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wrap, setWrap] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  const [catalogStats, setCatalogStats] = useState<Record<string, { rows: number | null; lastLoaded: string | null }>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterInputsKey = useRef(0); // bump to remount filter inputs on clear

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ dataset: datasetKey, page: String(page), sort, dir });
    if (globalQ.trim()) params.set('q', globalQ.trim());
    for (const [k, v] of Object.entries(filters)) {
      if (v.trim()) params.set(`f_${k}`, v);
    }
    return params.toString();
  }, [datasetKey, page, sort, dir, filters, globalQ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`/api/data?${queryString}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) { setError(j.error); setRows([]); setTotal(0); }
        else { setRows(j.rows ?? []); setTotal(j.total ?? 0); setPageSize(j.pageSize ?? 100); }
        setSelected(new Set());
      })
      .catch(() => { if (!cancelled) setError('Request failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [queryString]);

  useEffect(() => {
    fetch('/api/data/catalog')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.stats) setCatalogStats(j.stats); })
      .catch(() => {});
  }, []);

  const switchDataset = (key: string) => {
    const d = DATASETS[key];
    setDatasetKey(key);
    setSort(d.defaultSort);
    setDir(d.defaultDir);
    setFilters({});
    setGlobalQ('');
    setPage(1);
    filterInputsKey.current++;
  };

  const toggleSort = (col: DataColumn) => {
    if (col.sortable === false) return;
    if (sort === col.key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(col.key); setDir(col.type === 'text' ? 'asc' : 'desc'); }
    setPage(1);
  };

  const setFilter = useCallback((key: string, value: string, immediate = false) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const apply = () => {
      setFilters((f) => ({ ...f, [key]: value }));
      setPage(1);
    };
    if (immediate) apply();
    else debounceRef.current = setTimeout(apply, 400);
  }, []);

  // Click a cell → filter that column to the cell's value (Excel's
  // "filter by selection"). Numbers/booleans/dates match exactly; text contains.
  const filterBySelection = (col: DataColumn, value: unknown) => {
    if (col.filterable === false || value == null || value === '') return;
    let v: string;
    if (col.type === 'boolean') v = value === true ? 'yes' : 'no';
    else if (col.type === 'date') v = String(value).slice(0, 10);
    else v = String(value);
    setFilter(col.key, v, true);
    filterInputsKey.current++;
  };

  // Copy rows as TSV — pastes into Excel/Sheets with columns intact.
  async function copyRows(which: 'selected' | 'page') {
    const chosen = which === 'selected' ? rows.filter((_, i) => selected.has(i)) : rows;
    if (chosen.length === 0) return;
    const cell = (v: unknown): string => {
      if (v == null) return '';
      if (Array.isArray(v)) return v.join('; ');
      return String(v).replace(/[\t\n\r]/g, ' ');
    };
    const tsv = [
      dataset.columns.map((c) => c.label).join('\t'),
      ...chosen.map((r) => dataset.columns.map((c) => cell(r[c.key])).join('\t')),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(`✓ Copied ${chosen.length} row${chosen.length !== 1 ? 's' : ''}`);
      setTimeout(() => setCopied(''), 2500);
    } catch {
      setCopied('Clipboard blocked by browser');
    }
  }

  const toggleRow = (i: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const allSelected = rows.length > 0 && selected.size === rows.length;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const csvHref = `/api/data?${queryString}&format=csv`;
  const hasFilters = Object.values(filters).some((v) => v.trim()) || !!globalQ.trim();

  return (
    <div className="space-y-3">
      {/* Dataset tabs */}
      <div className="flex flex-wrap gap-1.5">
        {Object.values(DATASETS).map((d) => (
          <button
            key={d.key}
            onClick={() => switchDataset(d.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              d.key === datasetKey
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Toolbar: global query + actions */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input
          key={`q-${datasetKey}`}
          type="text"
          placeholder={`Query ${dataset.label} — search all text columns…`}
          defaultValue={globalQ}
          onChange={(e) => {
            const v = e.target.value;
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => { setGlobalQ(v); setPage(1); }, 400);
          }}
          className="w-64 bg-card border border-border text-foreground placeholder-muted-foreground text-sm rounded-full px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        <button
          onClick={() => setWrap((w) => !w)}
          className={`border rounded-full px-2.5 py-1 transition-colors ${
            wrap ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
          title="Expand rows to show full cell contents"
        >
          {wrap ? '≡ Expanded rows' : '— Compact rows'}
        </button>
        <button
          onClick={() => void copyRows('selected')}
          disabled={selected.size === 0}
          className="border border-border rounded-full px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
          title="Copy the checked rows as tab-separated text — paste into Excel"
        >
          Copy {selected.size > 0 ? selected.size : ''} selected
        </button>
        <button
          onClick={() => void copyRows('page')}
          disabled={rows.length === 0}
          className="border border-border rounded-full px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
        >
          Copy page
        </button>
        {copied && <span className="text-[hsl(var(--success))]">{copied}</span>}
        <span className="ml-auto whitespace-nowrap text-muted-foreground">
          {loading ? 'Loading…' : `${firstRow.toLocaleString()}–${lastRow.toLocaleString()} of ${total.toLocaleString()}`}
        </span>
        {hasFilters && (
          <button
            onClick={() => { setFilters({}); setGlobalQ(''); setPage(1); filterInputsKey.current++; }}
            className="border border-border rounded-full px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Clear filters
          </button>
        )}
        <a
          href={csvHref}
          className="border border-border rounded-full px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          Export CSV{total > 10000 ? ' (first 10k)' : ''}
        </a>
      </div>

      <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
        <span>{dataset.description} · Click any cell to filter by its value · check rows to copy them</span>
        <button
          onClick={() => setShowAbout((v) => !v)}
          className="text-primary hover:underline"
        >
          {showAbout ? 'Hide source details' : 'About this source →'}
        </button>
      </div>

      {showAbout && SOURCE_CATALOG[datasetKey] && (
        <SourceDetails
          info={SOURCE_CATALOG[datasetKey]}
          stats={catalogStats[datasetKey]}
        />
      )}

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          {/does not exist|schema cache/i.test(error)
            ? `This dataset's table doesn't exist yet — run the corresponding migration/loader first. (${error})`
            : error}
        </div>
      )}

      {/* Grid */}
      <div className="card p-0 overflow-x-auto">
        <table className={`w-full text-xs ${wrap ? '' : 'whitespace-nowrap'}`}>
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border text-left text-muted-foreground select-none">
              <th className="px-2 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((_, i) => i)))}
                  title="Select all rows on this page"
                />
              </th>
              {dataset.columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c)}
                  className={`px-3 py-2 font-medium ${c.sortable === false ? '' : 'cursor-pointer hover:text-foreground'}`}
                >
                  {c.label}
                  {sort === c.key && <span className="ml-1">{dir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
            <tr className="border-b border-border">
              <th />
              {dataset.columns.map((c) => (
                <th key={`${c.key}-${filterInputsKey.current}`} className="px-1.5 py-1.5 font-normal">
                  {c.filterable === false ? null : (
                    <input
                      type="text"
                      placeholder={FILTER_HINTS[c.type]}
                      defaultValue={filters[c.key] ?? ''}
                      onChange={(e) => setFilter(c.key, e.target.value)}
                      className="w-full min-w-[5.5rem] bg-secondary/60 border border-transparent focus:border-ring rounded-md px-2 py-1 text-xs text-foreground placeholder-muted-foreground/60 focus:outline-none"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={loading ? 'opacity-50' : ''}>
            {rows.map((row, i) => (
              <tr
                key={String(row[dataset.rowLinkKey ?? ''] ?? i)}
                className={`border-b border-border/50 last:border-0 transition-colors ${
                  selected.has(i) ? 'bg-primary/5' : 'hover:bg-secondary/40'
                }`}
              >
                <td className="px-2 py-1.5">
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggleRow(i)} />
                </td>
                {dataset.columns.map((c, ci) => (
                  <td
                    key={c.key}
                    onClick={() => filterBySelection(c, row[c.key])}
                    title={c.filterable === false ? undefined : 'Click to filter by this value'}
                    className={`px-3 py-1.5 text-foreground/90 ${
                      wrap
                        ? 'align-top whitespace-normal break-words max-w-[30rem]'
                        : 'max-w-[26rem] overflow-hidden text-ellipsis'
                    } ${c.filterable === false ? '' : 'cursor-pointer'}`}
                  >
                    {ci === 0 && dataset.rowLinkPrefix && row[dataset.rowLinkKey ?? ''] ? (
                      <Link
                        href={`${dataset.rowLinkPrefix}${row[dataset.rowLinkKey ?? '']}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:underline"
                      >
                        {formatCell(row[c.key], c)}
                      </Link>
                    ) : (
                      formatCell(row[c.key], c)
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && !loading && !error && (
              <tr>
                <td colSpan={dataset.columns.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                  No rows match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          className="border border-border rounded-full px-3 py-1.5 hover:bg-secondary disabled:opacity-40 transition-colors"
        >
          ← Previous
        </button>
        <span className="font-mono-numbers">Page {page} of {totalPages.toLocaleString()}</span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || loading}
          className="border border-border rounded-full px-3 py-1.5 hover:bg-secondary disabled:opacity-40 transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function SourceDetails({
  info, stats,
}: {
  info: (typeof SOURCE_CATALOG)[string];
  stats?: { rows: number | null; lastLoaded: string | null };
}) {
  const rows: Array<[string, string]> = [
    ['Provider', info.provider],
    ['What it is', info.what],
    ['Coverage', info.coverage],
    ['License', info.license],
    ['How it updates', info.refresh],
    ...(stats?.rows != null ? [['Rows loaded', stats.rows.toLocaleString()] as [string, string]] : []),
    ...(stats?.lastLoaded ? [['Last loaded', stats.lastLoaded.slice(0, 16).replace('T', ' ')] as [string, string]] : []),
  ];
  return (
    <div className="card p-4 text-xs space-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[110px_1fr] gap-3">
          <span className="text-muted-foreground">{k}</span>
          <span className="text-foreground/90">{v}</span>
        </div>
      ))}
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <span className="text-muted-foreground">Link</span>
        <a href={info.url} target="_blank" rel="noreferrer" className="text-primary hover:underline break-all">
          {info.url}
        </a>
      </div>
    </div>
  );
}

function formatCell(value: unknown, col: DataColumn): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.join('; ');
  if (col.type === 'boolean') return value === true ? '✓' : '—';
  if (col.type === 'number' && typeof value === 'number') {
    return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (col.type === 'date' && typeof value === 'string') return value.slice(0, 10);
  return String(value);
}
