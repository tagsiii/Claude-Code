'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface IngestResult {
  connector: string;
  deals_found: number;
  deals_created: number;
  deals_updated: number;
  duration_ms: number;
  error?: string;
}

interface IngestResponse {
  results: IngestResult[];
  totals: { found: number; created: number; updated: number };
  ran_at: string;
}

export function IngestPanel() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [error, setError] = useState('');

  async function runScan() {
    setRunning(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookbackDays: 7 }),
      });
      if (!res.ok) throw new Error('Scan failed');
      const data: IngestResponse = await res.json();
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={runScan}
        disabled={running}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
          running
            ? 'bg-secondary text-muted-foreground cursor-wait'
            : 'bg-primary text-primary-foreground hover:opacity-90'
        }`}
      >
        {running ? (
          <>
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
            Scanning…
          </>
        ) : (
          <>
            <span>↻</span> Run Scan
          </>
        )}
      </button>

      {result && (
        <div className="text-xs text-muted-foreground text-right space-y-0.5 max-w-xs">
          {result.results.map((r) => (
            <div key={r.connector} className={r.error ? 'text-destructive' : 'text-muted-foreground'}>
              {r.connector}: {r.error ? `⚠ ${r.error.slice(0, 40)}` : `+${r.deals_created} new, ↑${r.deals_updated} updated`}
            </div>
          ))}
          <div className="text-muted-foreground/70">
            {result.totals.found} candidate transactions processed
          </div>
          {/* Explain the funnel — "few new deals" usually means dedup did its job. */}
          {result.totals.found > 0 && result.totals.created === 0 && result.totals.updated > 0 && (
            <div className="text-muted-foreground/70">
              All candidates matched deals already tracked — existing records were updated instead.
            </div>
          )}
          {result.totals.found === 0 && !result.results.some((r) => r.error) && (
            <div className="text-muted-foreground/70">
              No deal-shaped news matched this window — check Activity for articles scanned.
            </div>
          )}
          <Link href="/dashboard/activity" className="text-primary hover:underline">
            View full results →
          </Link>
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}
    </div>
  );
}
