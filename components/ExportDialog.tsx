'use client';

import { useState } from 'react';
import { EXPORT_FIELDS, DEFAULT_COLUMNS } from '@/lib/export/fields';
import type { ExportFormat } from '@/lib/types';

const FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: 'xlsx', label: 'Excel', hint: '.xlsx spreadsheet' },
  { value: 'docx', label: 'Word', hint: '.docx report' },
  { value: 'pdf', label: 'PDF', hint: '.pdf briefing' },
];

export function ExportDialog({
  filters,
  dealCount,
}: {
  filters: Record<string, string>;
  dealCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [includeSummary, setIncludeSummary] = useState(false);
  const [includeDiplomatic, setIncludeDiplomatic] = useState(false);
  const [includeScoreBreakdown, setIncludeScoreBreakdown] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const narrativeCapable = format === 'docx' || format === 'pdf';

  function toggleColumn(key: string) {
    setColumns((cols) => (cols.includes(key) ? cols.filter((c) => c !== key) : [...cols, key]));
  }

  async function runExport() {
    setBusy(true);
    setError('');
    try {
      const config = {
        format,
        columns,
        includeSummary: narrativeCapable && includeSummary,
        includeDiplomatic: narrativeCapable && includeDiplomatic,
        includeScoreBreakdown: narrativeCapable && includeScoreBreakdown,
        title: title.trim() || undefined,
      };
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, filters }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `economic-statecraft.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-secondary text-foreground hover:bg-border transition-colors"
      >
        <span>↓</span> Export
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto card p-6 shadow-pop animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Export transactions</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground w-8 h-8 rounded-full hover:bg-secondary"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Exports the <span className="font-medium text-foreground">{dealCount}</span> deal
              {dealCount !== 1 ? 's' : ''} matching your current filters.
            </p>

            {/* Format */}
            <div className="mb-5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Format</div>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      format === f.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    <div className="text-sm font-medium text-foreground">{f.label}</div>
                    <div className="text-[11px] text-muted-foreground">{f.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Report title */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Report title (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Economic Statecraft — Transaction Report"
                className="mt-1.5 w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>

            {/* Columns */}
            <div className="mb-5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Columns</div>
              <div className="grid grid-cols-2 gap-1.5">
                {EXPORT_FIELDS.map((f) => (
                  <label
                    key={f.key}
                    className="flex items-center gap-2 text-sm text-foreground cursor-pointer rounded-lg px-2 py-1 hover:bg-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={columns.includes(f.key)}
                      onChange={() => toggleColumn(f.key)}
                      className="accent-[hsl(var(--primary))]"
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Narrative includes */}
            <div className="mb-5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Include narrative sections
                <span className="ml-2 font-normal normal-case text-muted-foreground/70">Word &amp; PDF only</span>
              </div>
              <div className={`space-y-1.5 ${narrativeCapable ? '' : 'opacity-40 pointer-events-none'}`}>
                <Check label="Executive summaries" checked={includeSummary} onChange={setIncludeSummary} />
                <Check label="US diplomatic context" checked={includeDiplomatic} onChange={setIncludeDiplomatic} />
                <Check label="Score breakdown + reasoning" checked={includeScoreBreakdown} onChange={setIncludeScoreBreakdown} />
              </div>
            </div>

            {error && (
              <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="px-4 py-2 rounded-full text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={runExport}
                disabled={busy || columns.length === 0}
                className="px-5 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {busy ? 'Generating…' : `Export ${format.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[hsl(var(--primary))]"
      />
      {label}
    </label>
  );
}
