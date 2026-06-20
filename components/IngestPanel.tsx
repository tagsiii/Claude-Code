'use client';

import { useState } from 'react';
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
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
          running
            ? 'bg-blue-900 text-blue-400 cursor-wait'
            : 'bg-blue-600 hover:bg-blue-500 text-white'
        }`}
      >
        {running ? (
          <>
            <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Scanning…
          </>
        ) : (
          <>
            <span>↻</span> Run Scan
          </>
        )}
      </button>

      {result && (
        <div className="text-xs text-slate-400 text-right space-y-0.5">
          {result.results.map((r) => (
            <div key={r.connector} className={r.error ? 'text-red-400' : 'text-slate-400'}>
              {r.connector}: {r.error ? `⚠ ${r.error.slice(0, 40)}` : `+${r.deals_created} new, ↑${r.deals_updated} updated`}
            </div>
          ))}
          <div className="text-slate-500">
            {result.totals.found} candidate transactions processed
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400">{error}</div>
      )}
    </div>
  );
}
