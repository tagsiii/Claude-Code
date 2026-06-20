import { getScoreWeights, getConnectorConfigs, getRecentIngestLogs } from '@/lib/db/queries';
import { ConfigPanel } from '@/components/ConfigPanel';

export const dynamic = 'force-dynamic';

export default async function ConfigPage() {
  const [weights, connectors, logs] = await Promise.all([
    getScoreWeights(),
    getConnectorConfigs(),
    getRecentIngestLogs(10),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Configuration</h1>
        <p className="text-slate-500 text-sm mt-1">Manage scoring weights, data connectors, and pipeline history.</p>
      </div>
      <ConfigPanel weights={weights} connectors={connectors} logs={logs} />
    </div>
  );
}
