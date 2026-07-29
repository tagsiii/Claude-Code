'use client';

// Excel-style data browser: dataset tabs, sortable columns, a filter box under
// every header, pagination, and CSV export of the current filtered view.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { DATASETS, type Dataset, type DataColumn } from '@/lib/data/datasets';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ dataset: datasetKey, page: String(page), sort, dir });
    for (const [k, v] of Object.entries(filters)) {
      if (v.trim()) params.set(`f_${k}`, v);
    }
    return params.toString();
  }, [datasetKey, page, sort, dir, filters]);

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
      })
      .catch(() => { if (!cancelled) setError('Request failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [queryString]);

  const switchDataset = (key: string) => {
    const d = DATASETS[key];
    setDatasetKey(key);
    setSort(d.defaultSort);
    setDir(d.defaultDir);
    setFilters({});
    setPage(1);
  };

  const toggleSort = (col: DataColumn) => {
    if (col.sortable === false) return;
    if (sort === col.key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(col.key); setDir(col.type === 'text' ? 'asc' : 'desc'); }
    setPage(1);
  };

  const setFilter = useCallback((key: string, value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, [key]: value }));
      setPage(1);
    }, 400);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);
  const csvHref = `/api/data?${queryString}&format=csv`;
  const hasFilters = Object.values(filters).some((v) => v.trim());

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

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{dataset.description}</span>
        <span className="ml-auto whitespace-nowrap">
          {loading ? 'Loading…' : `${firstRow.toLocaleString()}–${lastRow.toLocaleString()} of ${total.toLocaleString()}`}
        </span>
        {hasFilters && (
          <button
            onClick={() => { setFilters({}); setPage(1); }}
            className="border border-border rounded-full px-2.5 py-1 hover:bg-secondary transition-colors"
          >
            Clear filters
          </button>
        )}
        <a
          href={csvHref}
          className="border border-border rounded-full px-2.5 py-1 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          Export CSV{total > 10000 ? ' (first 10k)' : ''}
        </a>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          {/does not exist|schema cache/i.test(error)
            ? `This dataset's table doesn't exist yet — run the corresponding migration/loader first. (${error})`
            : error}
        </div>
      )}

      {/* Grid */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border text-left text-muted-foreground select-none">
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
              {dataset.columns.map((c) => (
                <th key={c.key} className="px-1.5 py-1.5 font-normal">
                  {c.filterable === false ? null : (
                    <input
                      key={`${datasetKey}-${c.key}`}
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
              <tr key={String(row[dataset.rowLinkKey ?? ''] ?? i)} className="border-b border-border/50 last:border-0 hover:bg-secondary/40 transition-colors">
                {dataset.columns.map((c, ci) => (
                  <td key={c.key} className="px-3 py-1.5 max-w-[26rem] overflow-hidden text-ellipsis text-foreground/90">
                    {ci === 0 && dataset.rowLinkPrefix && row[dataset.rowLinkKey ?? ''] ? (
                      <Link
                        href={`${dataset.rowLinkPrefix}${row[dataset.rowLinkKey ?? '']}`}
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
                <td colSpan={dataset.columns.length} className="px-4 py-8 text-center text-muted-foreground">
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
