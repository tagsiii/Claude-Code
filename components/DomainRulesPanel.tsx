'use client';

// Config card: manage the outlet blocklist. Blocked domains are dropped
// before extraction, so junk outlets stop feeding the pipeline entirely.

import { useCallback, useEffect, useState } from 'react';

interface Rule { domain: string; note: string | null; created_at: string }

export function DomainRulesPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/config/domains');
      const data = await res.json();
      if (res.ok) { setRules(data.rules ?? []); setStatus(''); }
      else setStatus(data.error ?? 'Could not load');
    } catch {
      setStatus('Could not load');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function add() {
    if (!input.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/config/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setStatus(data.error ?? 'Failed');
      else { setInput(''); await load(); }
    } finally {
      setBusy(false);
    }
  }

  async function remove(domain: string) {
    await fetch(`/api/config/domains?domain=${encodeURIComponent(domain)}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="card space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">Blocked outlets</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Articles from these domains are dropped before analysis. Add an outlet that keeps
          producing junk deals (paste its domain or any article URL from it).
        </p>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
          placeholder="example.com or a full article URL"
          className="flex-1 bg-secondary/60 border border-border rounded-full px-4 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        <button
          onClick={() => void add()}
          disabled={busy || !input.trim()}
          className="text-sm px-4 py-1.5 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
        >
          Block
        </button>
      </div>
      {status && <div className="text-xs text-amber-600 dark:text-amber-400">{status}</div>}
      {rules.length > 0 && (
        <div className="space-y-1.5">
          {rules.map((r) => (
            <div key={r.domain} className="flex items-center justify-between bg-secondary rounded-xl px-4 py-2 text-sm">
              <span className="text-foreground font-mono">{r.domain}</span>
              <button
                onClick={() => void remove(r.domain)}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
