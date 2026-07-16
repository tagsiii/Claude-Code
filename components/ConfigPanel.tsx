'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ScoreWeight, ConnectorConfig, IngestLog } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

export function ConfigPanel({
  weights,
  connectors,
  logs,
}: {
  weights: ScoreWeight[];
  connectors: ConnectorConfig[];
  logs: IngestLog[];
}) {
  const router = useRouter();
  const [localWeights, setLocalWeights] = useState(
    Object.fromEntries(weights.map((w) => [w.name, w.weight]))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const totalWeight = Object.values(localWeights).reduce((a, b) => a + Number(b), 0);
  const weightValid = Math.abs(totalWeight - 1) < 0.01;

  async function saveWeights() {
    setSaving(true);
    for (const [name, weight] of Object.entries(localWeights)) {
      await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'weight', name, weight: Number(weight) }),
      });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function toggleConnector(name: string, enabled: boolean) {
    await fetch('/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'connector', name, enabled }),
    });
    router.refresh();
  }

  const dimLabels: Record<string, string> = {
    likelihood: 'Likelihood to Close',
    actionability: 'US Actionability Window',
    financing: 'Financing Certainty',
    corroboration: 'Source Corroboration',
    strategic_priority: 'Strategic Priority',
  };

  // Connectors with actual fetch code behind them. The others exist as config
  // rows for future build-out — show them honestly instead of a dead toggle.
  const implemented = new Set(['gdelt', 'worldbank', 'newsapi']);
  const needsKey: Record<string, string> = { newsapi: 'NEWSAPI_KEY' };

  return (
    <div className="space-y-6">
      {/* Score Weights */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Executability Score Weights</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Weights must sum to 1.00</p>
          </div>
          <div className={`text-xs font-mono-numbers ${weightValid ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
            Σ = {totalWeight.toFixed(2)}
          </div>
        </div>

        <div className="space-y-4">
          {weights.map((w) => (
            <div key={w.name}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-foreground">{dimLabels[w.name] ?? w.name}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={localWeights[w.name]}
                    onChange={(e) =>
                      setLocalWeights((prev) => ({ ...prev, [w.name]: Number(e.target.value) }))
                    }
                    className="w-16 bg-background border border-border text-foreground text-sm rounded-lg px-2 py-1 font-mono-numbers text-center focus:outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  <span className="text-muted-foreground text-xs w-8">
                    {(Number(localWeights[w.name]) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{w.description}</p>
            </div>
          ))}
        </div>

        <button
          onClick={saveWeights}
          disabled={saving || !weightValid}
          className="mt-5 px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-50 text-primary-foreground text-sm font-medium rounded-full transition-opacity"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Weights'}
        </button>
      </div>

      {/* Connectors */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Data Connectors</h2>
        <div className="space-y-1">
          {connectors.map((c) => {
            const isImplemented = implemented.has(c.name);
            return (
              <div key={c.name} className={`flex items-center justify-between py-2.5 border-b border-border last:border-0 ${isImplemented ? '' : 'opacity-50'}`}>
                <div>
                  <div className="text-sm text-foreground">
                    {c.display_name ?? c.name}
                    {!isImplemented && (
                      <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground align-middle">
                        coming soon
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {!isImplemented
                      ? 'Connector not built yet'
                      : needsKey[c.name]
                        ? `Requires ${needsKey[c.name]} in environment · ${c.last_run_at ? `Last run: ${formatDate(c.last_run_at)}` : 'Never run'}`
                        : c.last_run_at
                          ? `Last run: ${formatDate(c.last_run_at)}`
                          : 'Never run'}
                  </div>
                </div>
                <button
                  onClick={() => toggleConnector(c.name, !c.enabled)}
                  disabled={!isImplemented}
                  className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors disabled:cursor-not-allowed ${
                    c.enabled && isImplemented ? 'bg-primary' : 'bg-secondary'
                  }`}
                  aria-label={`Toggle ${c.display_name ?? c.name}`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      c.enabled && isImplemented ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Ingest Logs */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Pipeline History</h2>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No pipeline runs yet.</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="text-xs py-2.5 border-b border-border last:border-0 flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  log.status === 'success' ? 'bg-[hsl(var(--success))]' :
                  log.status === 'error' ? 'bg-destructive' :
                  'bg-[hsl(var(--warning))] animate-pulse'
                }`} />
                <span className="text-muted-foreground font-mono-numbers">
                  {formatDate(log.started_at)}
                </span>
                <span className="text-muted-foreground">{log.connector ?? 'all'}</span>
                <span className="text-foreground">
                  {log.deals_created} new · {log.deals_updated} updated
                </span>
                {log.error_message && (
                  <span className="text-destructive truncate max-w-xs">{log.error_message}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
