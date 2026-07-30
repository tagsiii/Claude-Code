'use client';

// Analyst triage: Act / Watching / Dismissed with an optional note.
// Dismissed deals disappear from default views; changed deals get flagged
// in the table until re-triaged.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Deal } from '@/lib/types';

const LANES = [
  { value: 'act', label: '⚑ Act', active: 'bg-red-600 text-white', hint: 'Needs action — surfaces in the Act lane' },
  { value: 'watching', label: '◉ Watching', active: 'bg-blue-600 text-white', hint: 'Monitor for changes' },
  { value: 'dismissed', label: '✕ Dismiss', active: 'bg-zinc-600 text-white', hint: 'Hide from default views (reversible)' },
] as const;

export function TriagePanel({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(deal.triage_note ?? '');
  const [msg, setMsg] = useState('');
  const current = deal.triage_status ?? 'none';

  async function setLane(status: string) {
    setBusy(true);
    setMsg('');
    try {
      const next = current === status ? 'none' : status; // click again to clear
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triage_status: next, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
          Triage
        </span>
        {LANES.map((l) => (
          <button
            key={l.value}
            onClick={() => void setLane(l.value)}
            disabled={busy}
            title={l.hint}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 ${
              current === l.value
                ? l.active
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {l.label}
          </button>
        ))}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => { if (current !== 'none') void setLane(current); }}
          placeholder="Note to self (saved with the lane)…"
          className="flex-1 min-w-[180px] bg-secondary/60 border border-border rounded-full px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>
      {deal.triaged_at && (
        <div className="text-[11px] text-muted-foreground mt-2">
          Last triaged {deal.triaged_at.slice(0, 10)}
          {new Date(deal.last_updated_at) > new Date(deal.triaged_at) && (
            <span className="text-amber-600 dark:text-amber-400 font-medium"> · deal has changed since — re-review</span>
          )}
        </div>
      )}
      {msg && <div className="text-xs text-destructive mt-1">{msg}</div>}
    </div>
  );
}
