'use client';

// Gaps page controls: a live refresh button (re-runs the gap views against
// current data) and a minimum-commitment filter shared via URL params.

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const MIN_OPTIONS = [
  { value: '', label: 'Any amount' },
  { value: '1000000000', label: '≥ $1B' },
  { value: '5000000000', label: '≥ $5B' },
  { value: '10000000000', label: '≥ $10B' },
];

export function GapsControls() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');

  const minUsd = searchParams.get('min_usd') ?? '';

  function setMin(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('min_usd', value);
    else params.delete('min_usd');
    router.push(`${pathname}?${params.toString()}`);
  }

  async function refresh() {
    setRefreshing(true);
    setMsg('');
    try {
      const res = await fetch('/api/gaps/refresh', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) setMsg(data.error ?? 'Refresh failed');
      else {
        setMsg('✓ Refreshed');
        router.refresh();
      }
    } catch {
      setMsg('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select
        value={minUsd}
        onChange={(e) => setMin(e.target.value)}
        className="bg-card border border-border text-foreground text-sm rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/40 cursor-pointer hover:bg-secondary transition-colors"
      >
        {MIN_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        onClick={() => void refresh()}
        disabled={refreshing}
        className="border border-border rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
      >
        {refreshing ? 'Refreshing…' : '↻ Refresh now'}
      </button>
      {msg && <span className="text-muted-foreground">{msg}</span>}
      <span className="text-muted-foreground/70 ml-auto">
        Auto-refreshes after every scan and recompute:spatial run
      </span>
    </div>
  );
}
