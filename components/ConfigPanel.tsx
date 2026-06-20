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

  return (
    <div className="space-y-6">
      {/* Score Weights */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Executability Score Weights</h2>
            <p className="text-xs text-slate-500 mt-0.5">Weights must sum to 1.00</p>
          </div>
          <div className={`text-xs font-mono-numbers ${weightValid ? 'text-green-400' : 'text-red-400'}`}>
            Σ = {totalWeight.toFixed(2)}
          </div>
        </div>

        <div className="space-y-4">
          {weights.map((w) => (
            <div key={w.name}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-slate-300">{dimLabels[w.name] ?? w.name}</label>
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
                    className="w-16 bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded px-2 py-1 font-mono-numbers text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-slate-500 text-xs w-8">
                    {(Number(localWeights[w.name]) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600">{w.description}</p>
            </div>
          ))}
        </div>

        <button
          onClick={saveWeights}
          disabled={saving || !weightValid}
          className="mt-5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Weights'}
        </button>
      </div>

      {/* Connectors */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Data Connectors</h2>
        <div className="space-y-2">
          {connectors.map((c) => (
            <div key={c.name} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
              <div>
                <div className="text-sm text-slate-300">{c.display_name ?? c.name}</div>
                <div className="text-xs text-slate-600">
                  {c.last_run_at ? `Last run: ${formatDate(c.last_run_at)}` : 'Never run'}
                </div>
              </div>
              <button
                onClick={() => toggleConnector(c.name, !c.enabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  c.enabled ? 'bg-blue-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${
                    c.enabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Ingest Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Pipeline History</h2>
        {logs.length === 0 ? (
          <p className="text-xs text-slate-600">No pipeline runs yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="text-xs py-2 border-b border-slate-800 last:border-0 flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  log.status === 'success' ? 'bg-green-500' :
                  log.status === 'error' ? 'bg-red-500' :
                  'bg-yellow-500 animate-pulse'
                }`} />
                <span className="text-slate-400 font-mono-numbers">
                  {formatDate(log.started_at)}
                </span>
                <span className="text-slate-500">{log.connector ?? 'all'}</span>
                <span className="text-slate-400">
                  {log.deals_created} new · {log.deals_updated} updated
                </span>
                {log.error_message && (
                  <span className="text-red-400 truncate max-w-xs">{log.error_message}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
