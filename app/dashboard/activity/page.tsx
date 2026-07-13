import Link from 'next/link';
import { getRecentIngestLogs, getRecentDealActivity } from '@/lib/db/queries';
import { TimeAgo } from '@/components/TimeAgo';
import { formatStage, formatDate, stageColorClass, scorePillClass } from '@/lib/utils/format';
import type { IngestLog } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface LogMeta {
  filename?: string;
  document_id?: string;
  candidate_errors?: string[];
  llm_errors?: string[];
}

function meta(log: IngestLog): LogMeta {
  return (log.metadata ?? {}) as LogMeta;
}

function runLabel(log: IngestLog): string {
  if (log.connector === 'upload') {
    const m = meta(log);
    return m.filename ? `Document: ${m.filename}` : 'Document upload';
  }
  return log.connector ?? 'All connectors';
}

function duration(log: IngestLog): string | null {
  if (!log.completed_at) return null;
  const ms = new Date(log.completed_at).getTime() - new Date(log.started_at).getTime();
  if (ms < 1000) return '<1s';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

export default async function ActivityPage() {
  const [logs, recentDeals] = await Promise.all([
    getRecentIngestLogs(20),
    getRecentDealActivity(15),
  ]);

  const latest = logs[0] ?? null;
  const now = Date.now();

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Scan Activity</h1>
        <p className="text-muted-foreground text-sm mt-1">
          What each scan and document analysis found, and which deals moved as a result.
        </p>
      </div>

      {/* Latest run */}
      {latest ? (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Latest run
            </div>
            <StatusBadge status={latest.status} />
          </div>
          <div className="text-lg font-semibold text-foreground">{runLabel(latest)}</div>
          <div className="text-sm text-muted-foreground mt-0.5">
            <TimeAgo iso={latest.started_at} />
            {duration(latest) && <span> · took {duration(latest)}</span>}
          </div>
          <div className="flex gap-6 mt-4">
            <Stat label="Candidates found" value={latest.deals_found} />
            <Stat label="Deals created" value={latest.deals_created} accent />
            <Stat label="Deals updated" value={latest.deals_updated} />
          </div>
          <RunErrors log={latest} />
        </div>
      ) : (
        <div className="card p-8 text-center text-muted-foreground text-sm">
          No scans yet — run a scan or analyze a document to see activity here.
        </div>
      )}

      {/* Recently touched deals */}
      <div className="card p-5">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Recently added or updated deals
        </div>
        {recentDeals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deals tracked yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {recentDeals.map((deal) => {
              const isNew = now - new Date(deal.first_seen_at).getTime() < NEW_WINDOW_MS;
              return (
                <Link
                  key={deal.id}
                  href={`/dashboard/deals/${deal.id}`}
                  className="flex items-center gap-3 py-2.5 group"
                >
                  <span
                    className={`inline-flex items-center justify-center min-w-[2.1rem] px-1.5 py-0.5 rounded-lg text-xs font-semibold font-mono-numbers ${scorePillClass(deal.composite_score)}`}
                  >
                    {deal.composite_score != null ? deal.composite_score.toFixed(0) : '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground group-hover:text-primary truncate">
                        {deal.title}
                      </span>
                      {isNew && (
                        <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          NEW
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {deal.host_country ?? 'Unknown country'}
                      {deal.sponsoring_state && <span> · {deal.sponsoring_state}</span>}
                    </div>
                  </div>
                  <span className={`shrink-0 hidden sm:inline-block px-2 py-0.5 rounded-full text-xs font-medium ${stageColorClass(deal.lifecycle_stage)}`}>
                    {formatStage(deal.lifecycle_stage)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground w-16 text-right">
                    <TimeAgo iso={deal.last_updated_at} />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Run history */}
      <div className="card p-5">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Run history
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs recorded.</p>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div key={log.id} className="py-2.5">
                <div className="flex items-center gap-3">
                  <StatusBadge status={log.status} dotOnly />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-foreground truncate">{runLabel(log)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(log.started_at)} · <TimeAgo iso={log.started_at} />
                      {duration(log) && <span> · {duration(log)}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs font-mono-numbers text-muted-foreground">
                    <span className="text-foreground">{log.deals_created}</span> new ·{' '}
                    <span className="text-foreground">{log.deals_updated}</span> updated
                    <span className="hidden sm:inline"> · {log.deals_found} found</span>
                  </div>
                </div>
                <RunErrors log={log} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div>
      <div className={`text-2xl font-semibold font-mono-numbers ${accent && value > 0 ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function StatusBadge({ status, dotOnly = false }: { status: IngestLog['status']; dotOnly?: boolean }) {
  const dot =
    status === 'success' ? 'bg-[hsl(var(--success))]' :
    status === 'error' ? 'bg-destructive' :
    'bg-[hsl(var(--warning))] animate-pulse';
  if (dotOnly) return <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function RunErrors({ log }: { log: IngestLog }) {
  const m = meta(log);
  const errors: string[] = [];
  if (log.error_message) errors.push(log.error_message);
  if (Array.isArray(m.llm_errors)) errors.push(...m.llm_errors);
  if (Array.isArray(m.candidate_errors)) errors.push(...m.candidate_errors);
  if (errors.length === 0) return null;
  return (
    <div className="mt-2 rounded-xl bg-destructive/5 border border-destructive/20 px-3 py-2 space-y-0.5">
      {errors.slice(0, 6).map((e, i) => (
        <div key={i} className="text-xs text-destructive truncate">{e}</div>
      ))}
      {errors.length > 6 && (
        <div className="text-xs text-muted-foreground">+{errors.length - 6} more</div>
      )}
    </div>
  );
}
