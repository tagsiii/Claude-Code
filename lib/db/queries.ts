import { db } from './client';
import type { Deal, Source, DealEvent, ScoreWeight, ConnectorConfig, IngestLog, DashboardFilters, DocumentRecord } from '../types';

// ─── Deals ────────────────────────────────────────────────────────────────────

// Sort params come straight from the URL — whitelist them so an unexpected value
// can't error the whole dashboard query (which would render an empty page).
const SORTABLE_COLUMNS = new Set([
  'composite_score',
  'last_updated_at',
  'first_seen_at',
  'rom_value_usd',
  'source_count',
  'source_confidence_tier',
]);

export function resolveSort(filters: DashboardFilters): { column: string; ascending: boolean } {
  const column =
    filters.sort_by && SORTABLE_COLUMNS.has(filters.sort_by) ? filters.sort_by : 'composite_score';
  // Tier 1 is the BEST source quality, so tier sorts ascending by default;
  // everything else defaults to descending (highest/newest first).
  const ascending = filters.sort_dir
    ? filters.sort_dir === 'asc'
    : column === 'source_confidence_tier';
  return { column, ascending };
}

// PostgREST's .or() syntax treats commas/parens as structure — strip them from
// user search text so a search like "port, energy" can't break the query.
export function sanitizeSearch(search: string): string {
  return search.replace(/[,()"'\\%]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function getDeals(filters: DashboardFilters = {}): Promise<Deal[]> {
  try {
    return await getDealsInner(filters, true);
  } catch (err) {
    // Pre-migration resilience: if the vetting/triage columns from quality.sql
    // don't exist yet, retry without those clauses instead of 500ing the app.
    const msg = err instanceof Error ? err.message : String(err);
    if (/review_status|triage_status|column/i.test(msg)) {
      return getDealsInner(filters, false);
    }
    throw err;
  }
}

async function getDealsInner(filters: DashboardFilters, vetting: boolean): Promise<Deal[]> {
  let query = db
    .from('deals')
    .select('*')
    .eq('status', 'active');

  if (vetting) {
    // Review workflow: default view shows vetted deals only (approved or
    // pre-migration nulls); 'pending' shows the review queue; 'all' shows both.
    // Rejected deals stay hidden everywhere — they act as a dedup blocklist.
    if (filters.review === 'pending') {
      query = query.eq('review_status', 'pending');
    } else if (filters.review === 'all') {
      query = query.or('review_status.is.null,review_status.neq.rejected');
    } else {
      query = query.or('review_status.is.null,review_status.eq.approved');
    }

    // Triage lanes: explicit lane filters, or the default view which only
    // hides what the analyst dismissed.
    if (filters.triage === 'act' || filters.triage === 'watching' || filters.triage === 'dismissed') {
      query = query.eq('triage_status', filters.triage);
    } else if (filters.triage === 'untriaged') {
      query = query.or('triage_status.is.null,triage_status.eq.none');
    } else if (filters.triage !== 'all') {
      query = query.or('triage_status.is.null,triage_status.neq.dismissed');
    }
  }

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
  if (filters.located === 'no') {
    // Deals the map can't plot: never geocoded, or only 'unknown' precision.
    query = query.or('location_precision.is.null,location_precision.eq.unknown');
  }
  if (filters.host_country && filters.host_country !== 'all') {
    const c = filters.host_country.trim();
    // Map clicks send ISO3 codes; typed input matches the country name.
    if (/^[A-Z]{3}$/.test(c)) {
      query = query.eq('country_iso3', c);
    } else {
      query = query.ilike('host_country', `%${sanitizeSearch(c)}%`);
    }
  }
  if (filters.source_tier && filters.source_tier !== 'all') {
    const tier = Number(filters.source_tier);
    if ([1, 2, 3].includes(tier)) {
      query = query.eq('source_confidence_tier', tier);
    }
  }
  if (filters.min_score !== undefined) {
    query = query.gte('composite_score', filters.min_score);
  }
  if (filters.min_value !== undefined) {
    query = query.gte('rom_value_usd', filters.min_value);
  }
  // Date-range filters (inclusive; *_before extends to end of day).
  if (filters.updated_after) query = query.gte('last_updated_at', filters.updated_after);
  if (filters.updated_before) query = query.lte('last_updated_at', `${filters.updated_before}T23:59:59`);
  if (filters.seen_after) query = query.gte('first_seen_at', filters.seen_after);
  if (filters.seen_before) query = query.lte('first_seen_at', `${filters.seen_before}T23:59:59`);
  if (filters.search) {
    const s = sanitizeSearch(filters.search);
    if (s) {
      query = query.or(
        `title.ilike.%${s}%,host_country.ilike.%${s}%,sponsoring_state.ilike.%${s}%`
      );
    }
  }

  const { column, ascending } = resolveSort(filters);
  query = query.order(column, { ascending, nullsFirst: false });

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

// Active deals resolved to the same physical facility (facility-first dedup).
export async function findDealsByFacility(facilityId: string): Promise<Deal[]> {
  const { data, error } = await db
    .from('deals')
    .select('*')
    .eq('status', 'active')
    .eq('facility_id', facilityId)
    .limit(20);
  if (error) return [];
  return (data ?? []) as Deal[];
}

export async function linkDealSponsor(dealId: string, sponsorId: string): Promise<void> {
  const { error } = await db
    .from('deal_sponsors')
    .upsert({ deal_id: dealId, sponsor_id: sponsorId }, { onConflict: 'deal_id,sponsor_id' });
  if (error && !error.message.includes('duplicate')) throw error;
}

// Wider dedup pool for candidates with no host country — caller compensates by
// demanding a stronger title match.
export async function findSimilarDealsBySector(sector: string, limit = 50): Promise<Deal[]> {
  const { data, error } = await db
    .from('deals')
    .select('*')
    .eq('status', 'active')
    .eq('sector', sector)
    .order('last_updated_at', { ascending: false })
    .limit(limit);

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

export async function updateSourceExcerpt(id: string, excerpt: string): Promise<void> {
  await db.from('sources').update({ content_excerpt: excerpt.slice(0, 2000) }).eq('id', id);
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

// Most recently touched deals (created or updated) — powers the Activity page.
export async function getRecentDealActivity(limit = 15): Promise<Deal[]> {
  const { data, error } = await db
    .from('deals')
    .select('*')
    .eq('status', 'active')
    .order('last_updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Deal[];
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

// ─── Documents ────────────────────────────────────────────────────────────────

export async function createDocument(doc: Partial<DocumentRecord>): Promise<DocumentRecord> {
  const { data, error } = await db.from('documents').insert(doc).select().single();
  if (error) throw error;
  return data as DocumentRecord;
}

export async function updateDocument(id: string, update: Partial<DocumentRecord>): Promise<void> {
  const { error } = await db.from('documents').update(update).eq('id', id);
  if (error) throw error;
}

export async function getDocumentById(id: string): Promise<DocumentRecord | null> {
  const { data, error } = await db.from('documents').select('*').eq('id', id).single();
  if (error) return null;
  return data as DocumentRecord;
}

// List documents without the (potentially large) parsed_text blob.
export async function getDocuments(limit = 100): Promise<Omit<DocumentRecord, 'parsed_text'>[]> {
  const { data, error } = await db
    .from('documents')
    .select('id, filename, mime_type, byte_size, sha256, storage_path, kind, page_count, char_count, status, error_message, source_id, deals_found, deals_created, deals_updated, notes, uploaded_by, created_at, analyzed_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Omit<DocumentRecord, 'parsed_text'>[];
}

export async function getDocumentBySha(sha256: string): Promise<DocumentRecord | null> {
  const { data } = await db.from('documents').select('*').eq('sha256', sha256).maybeSingle();
  return (data as DocumentRecord) ?? null;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await db.from('documents').delete().eq('id', id);
  if (error) throw error;
}

// ─── Data-quality vetting ─────────────────────────────────────────────────────

// Fuzzy match against the official AidData record (quality.sql RPC). Only a
// confident match (similarity ≥ 0.45) counts as corroboration.
export async function matchCnProject(
  title: string,
  iso3: string
): Promise<{ ref: string; title: string; note: string } | null> {
  try {
    const { data, error } = await db.rpc('match_cn_project', { p_title: title, p_iso3: iso3 });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const top = data[0] as { project_ref: string; title: string; commitment_usd: number | null; year: number | null; sim: number };
    if (top.sim < 0.45) return null;
    const usd = top.commitment_usd ? `$${(top.commitment_usd / 1e6).toFixed(0)}M` : 'value n/a';
    return {
      ref: top.project_ref,
      title: top.title,
      note: `AidData ${top.project_ref} (${usd}${top.year ? `, ${top.year}` : ''}) — similarity ${(top.sim * 100).toFixed(0)}%`,
    };
  } catch {
    return null; // pre-migration
  }
}

export async function getPendingReviewCount(): Promise<number> {
  try {
    const { count } = await db
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('review_status', 'pending');
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function setDealTriage(
  id: string,
  status: 'none' | 'act' | 'watching' | 'dismissed',
  note?: string
): Promise<void> {
  const { error } = await db
    .from('deals')
    .update({
      triage_status: status,
      triaged_at: new Date().toISOString(),
      ...(note !== undefined ? { triage_note: note || null } : {}),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function setDealReviewStatus(
  id: string,
  status: 'approved' | 'rejected',
  note?: string
): Promise<void> {
  const { error } = await db
    .from('deals')
    .update({ review_status: status, ...(note ? { review_note: note } : {}) })
    .eq('id', id);
  if (error) throw error;
}

// Domain blocklist (A6): outlets the analyst never wants ingested again.
export async function getBlockedDomains(): Promise<string[]> {
  try {
    const { data, error } = await db.from('domain_rules').select('domain').eq('action', 'block');
    if (error) return [];
    return (data ?? []).map((r) => r.domain as string);
  } catch {
    return [];
  }
}

export async function listDomainRules(): Promise<Array<{ domain: string; note: string | null; created_at: string }>> {
  const { data, error } = await db.from('domain_rules').select('domain, note, created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Array<{ domain: string; note: string | null; created_at: string }>;
}

export async function addDomainRule(domain: string, note?: string): Promise<void> {
  const { error } = await db.from('domain_rules').upsert({ domain, action: 'block', note: note ?? null }, { onConflict: 'domain' });
  if (error) throw error;
}

export async function removeDomainRule(domain: string): Promise<void> {
  const { error } = await db.from('domain_rules').delete().eq('domain', domain);
  if (error) throw error;
}

// ─── Phase 4: gap views + white-space snapshots ──────────────────────────────
// The materialized views only exist after lib/db/geo4.sql has been run — every
// reader returns {rows, error} so the Gaps page can show a setup notice
// instead of crashing pre-migration.

async function readView<T>(view: string): Promise<{ rows: T[]; error: string | null }> {
  const { data, error } = await db.from(view).select('*');
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as T[], error: null };
}

export function getWhiteSpaceRows() {
  return readView<import('../gaps').WhiteSpaceRow>('mv_white_space');
}
export function getUnpositionedRows() {
  return readView<import('../gaps').UnpositionedRow>('mv_unpositioned_pipeline');
}
export function getConcentrationRows() {
  return readView<import('../gaps').ConcentrationRow>('mv_sector_concentration');
}

export async function getLatestWhiteSpaceSnapshot(): Promise<{
  iso3s: string[];
  // iso3 → country name at snapshot time (names countries that later drop out)
  names: Record<string, string>;
} | null> {
  const { data, error } = await db
    .from('white_space_snapshots')
    .select('iso3s, detail')
    .order('taken_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    iso3s: (data.iso3s as string[]) ?? [],
    names: ((data.detail as Record<string, unknown>)?.names as Record<string, string>) ?? {},
  };
}

export async function insertWhiteSpaceSnapshot(iso3s: string[], detail: Record<string, unknown>): Promise<void> {
  await db.from('white_space_snapshots').insert({ iso3s, detail });
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
