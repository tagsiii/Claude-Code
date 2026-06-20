import { db } from './client';
import type { Deal, Source, DealEvent, ScoreWeight, ConnectorConfig, IngestLog, DashboardFilters } from '../types';

// ─── Deals ────────────────────────────────────────────────────────────────────

export async function getDeals(filters: DashboardFilters = {}): Promise<Deal[]> {
  let query = db
    .from('deals')
    .select('*')
    .eq('status', 'active');

  if (filters.sector && filters.sector !== 'all') {
    query = query.eq('sector', filters.sector);
  }
  if (filters.sponsoring_state && filters.sponsoring_state !== 'all') {
    query = query.eq('sponsoring_state', filters.sponsoring_state);
  }
  if (filters.lifecycle_stage && filters.lifecycle_stage !== 'all') {
    query = query.eq('lifecycle_stage', filters.lifecycle_stage);
  }
  if (filters.host_region && filters.host_region !== 'all') {
    query = query.eq('host_region', filters.host_region);
  }
  if (filters.min_score !== undefined) {
    query = query.gte('composite_score', filters.min_score);
  }
  if (filters.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,host_country.ilike.%${filters.search}%,sponsoring_state.ilike.%${filters.search}%`
    );
  }

  const sortBy = filters.sort_by ?? 'composite_score';
  const sortDir = filters.sort_dir ?? 'desc';
  query = query.order(sortBy, { ascending: sortDir === 'asc', nullsFirst: false });

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Deal[];
}

export async function getDealById(id: string): Promise<Deal | null> {
  const { data: deal, error } = await db
    .from('deals')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;

  const [sourcesResult, eventsResult] = await Promise.all([
    db
      .from('deal_sources')
      .select('sources(*)')
      .eq('deal_id', id),
    db
      .from('deal_events')
      .select('*, sources(url, title)')
      .eq('deal_id', id)
      .order('event_date', { ascending: false }),
  ]);

  const sources = (sourcesResult.data ?? [])
    .map((r: Record<string, unknown>) => r.sources)
    .filter(Boolean) as Source[];

  const events = (eventsResult.data ?? []) as DealEvent[];

  return { ...deal, sources, events } as Deal;
}

export async function upsertDeal(deal: Partial<Deal>): Promise<Deal> {
  const { data, error } = await db
    .from('deals')
    .upsert(deal, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data as Deal;
}

export async function findSimilarDeals(
  title: string,
  hostCountry: string,
  sector: string
): Promise<Deal[]> {
  // Fetch active deals in same country+sector for dedup comparison
  const { data, error } = await db
    .from('deals')
    .select('*')
    .eq('status', 'active')
    .eq('sector', sector)
    .eq('host_country', hostCountry)
    .order('last_updated_at', { ascending: false })
    .limit(20);

  if (error) return [];
  return (data ?? []) as Deal[];
}

// ─── Sources ──────────────────────────────────────────────────────────────────

export async function upsertSource(source: Partial<Source> & { url: string }): Promise<Source> {
  const { data, error } = await db
    .from('sources')
    .upsert(source, { onConflict: 'url' })
    .select()
    .single();
  if (error) throw error;
  return data as Source;
}

export async function linkSourceToDeal(dealId: string, sourceId: string): Promise<void> {
  const { error } = await db
    .from('deal_sources')
    .upsert({ deal_id: dealId, source_id: sourceId }, { onConflict: 'deal_id,source_id' });
  if (error && !error.message.includes('duplicate')) throw error;
}

export async function sourceExists(url: string): Promise<boolean> {
  const { data } = await db
    .from('sources')
    .select('id')
    .eq('url', url)
    .maybeSingle();
  return !!data;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function addDealEvent(event: Omit<DealEvent, 'id' | 'created_at'>): Promise<void> {
  const { error } = await db.from('deal_events').insert(event);
  if (error) throw error;
}

// ─── Score Config ─────────────────────────────────────────────────────────────

export async function getScoreWeights(): Promise<ScoreWeight[]> {
  const { data, error } = await db
    .from('score_config')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as ScoreWeight[];
}

export async function updateScoreWeight(name: string, weight: number): Promise<void> {
  const { error } = await db
    .from('score_config')
    .update({ weight, updated_at: new Date().toISOString() })
    .eq('name', name);
  if (error) throw error;
}

// ─── Connector Config ─────────────────────────────────────────────────────────

export async function getConnectorConfigs(): Promise<ConnectorConfig[]> {
  const { data, error } = await db
    .from('connector_config')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as ConnectorConfig[];
}

export async function updateConnectorEnabled(name: string, enabled: boolean): Promise<void> {
  const { error } = await db
    .from('connector_config')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('name', name);
  if (error) throw error;
}

export async function markConnectorRunComplete(name: string): Promise<void> {
  const { error } = await db
    .from('connector_config')
    .update({ last_run_at: new Date().toISOString() })
    .eq('name', name);
  if (error) throw error;
}

// ─── Ingest Logs ──────────────────────────────────────────────────────────────

export async function createIngestLog(connector: string | null): Promise<string> {
  const { data, error } = await db
    .from('ingest_logs')
    .insert({ connector, status: 'running' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateIngestLog(
  id: string,
  update: Partial<IngestLog>
): Promise<void> {
  const { error } = await db
    .from('ingest_logs')
    .update({ ...update, completed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function getRecentIngestLogs(limit = 10): Promise<IngestLog[]> {
  const { data, error } = await db
    .from('ingest_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as IngestLog[];
}

export async function getLatestSuccessfulIngest(): Promise<IngestLog | null> {
  const { data } = await db
    .from('ingest_logs')
    .select('*')
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as IngestLog | null;
}

// ─── Top Deals for Email ──────────────────────────────────────────────────────

export async function getTopDealsByScore(limit = 3): Promise<Deal[]> {
  const { data, error } = await db
    .from('deals')
    .select('*')
    .eq('status', 'active')
    .not('composite_score', 'is', null)
    .order('composite_score', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Deal[];
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUserByEmail(email: string) {
  const { data } = await db
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();
  return data;
}

export async function createUser(email: string, passwordHash: string, name: string) {
  const { data, error } = await db
    .from('users')
    .insert({ email, password_hash: passwordHash, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getUserCount(): Promise<number> {
  const { count } = await db
    .from('users')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}
