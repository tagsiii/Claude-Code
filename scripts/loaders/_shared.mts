// Shared plumbing for reference-data loaders. Loaders run LOCALLY
// (npm run load:*) — never as Vercel functions (60s limit constraint).

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Load .env.local so loaders work outside Next.js.
export function loadEnv(): void {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawVal.replace(/^["']|["']$/g, '');
  }
}

export function getDb(): SupabaseClient {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (in .env.local)');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Every loader writes a run-log row (existing ingest_logs table) so loads are
// visible on the Activity page like any other pipeline run.
export async function startRunLog(db: SupabaseClient, loader: string): Promise<string | null> {
  const { data } = await db
    .from('ingest_logs')
    .insert({ connector: loader, status: 'running' })
    .select('id')
    .single();
  return (data?.id as string) ?? null;
}

export async function finishRunLog(
  db: SupabaseClient,
  logId: string | null,
  ok: boolean,
  counts: { found?: number; created?: number },
  detail?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  if (!logId) return;
  await db
    .from('ingest_logs')
    .update({
      status: ok ? 'success' : 'error',
      completed_at: new Date().toISOString(),
      deals_found: counts.found ?? 0,
      deals_created: counts.created ?? 0,
      error_message: errorMessage ?? null,
      metadata: detail ?? {},
    })
    .eq('id', logId);
}

export function readLocalFile(relPath: string): string | null {
  const p = resolve(process.cwd(), relPath);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export async function tryDownload(url: string, timeoutMs = 60_000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Small concurrency-limited runner for RPC upsert batches.
export async function inBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<void>
): Promise<{ ok: number; failed: number; firstErrors: string[] }> {
  let ok = 0;
  let failed = 0;
  const firstErrors: string[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(slice.map(fn));
    for (const r of results) {
      if (r.status === 'fulfilled') ok++;
      else {
        failed++;
        if (firstErrors.length < 5) {
          firstErrors.push(String((r.reason as Error)?.message ?? r.reason).slice(0, 160));
        }
      }
    }
    if (i % (batchSize * 10) === 0 && i > 0) console.log(`  … ${i}/${items.length}`);
  }
  return { ok, failed, firstErrors };
}
