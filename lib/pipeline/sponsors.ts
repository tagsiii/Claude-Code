import { db } from '../db/client';
import type { SponsoringEntity, SponsorRow } from '../types';

// Canonical sponsor entity resolution. The pure matcher handles exact,
// alias, and prefix-containment matches ("COSCO Shipping Ports" → COSCO);
// SQL trigram similarity (resolve_sponsor_fuzzy RPC) is the fallback; strings
// nothing matches become new sponsor rows flagged needs_review.

const STOP_SUFFIXES = new Set([
  'ltd', 'limited', 'co', 'company', 'corp', 'corporation', 'group', 'holdings',
  'holding', 'inc', 'plc', 'llc', 'sa', 'pjsc', 'jsc', 'ag', 'gmbh', 'international',
]);

export function normalizeSponsorName(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s&]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && STOP_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(' ');
}

// Pure matcher over an in-memory sponsor list (fixture-testable).
export function matchSponsor(
  raw: string,
  sponsors: Array<Pick<SponsorRow, 'id' | 'canonical_name' | 'aliases'>>
): { id: string; canonical_name: string } | null {
  const rawNorm = normalizeSponsorName(raw);
  if (!rawNorm) return null;

  for (const s of sponsors) {
    const canonNorm = normalizeSponsorName(s.canonical_name);
    if (rawNorm === canonNorm) return { id: s.id, canonical_name: s.canonical_name };
    for (const a of s.aliases) {
      if (rawNorm === normalizeSponsorName(a)) return { id: s.id, canonical_name: s.canonical_name };
    }
  }
  // Prefix containment: "cosco shipping ports" starts with canonical "cosco";
  // requires a word boundary so "cnooc" can't match canonical "cnpc".
  for (const s of sponsors) {
    const names = [s.canonical_name, ...s.aliases].map(normalizeSponsorName).filter(Boolean);
    for (const n of names) {
      if (rawNorm === n || rawNorm.startsWith(n + ' ')) {
        return { id: s.id, canonical_name: s.canonical_name };
      }
    }
  }
  return null;
}

export interface ResolvedSponsor {
  entity: SponsoringEntity;
  sponsorId: string | null;
}

// DB-backed resolution. Best-effort: if the sponsors table doesn't exist yet
// (migration not applied), returns entities unmodified with null ids and
// reports a single warning.
export async function resolveSponsorEntities(
  entities: SponsoringEntity[],
  warnings?: string[]
): Promise<ResolvedSponsor[]> {
  if (entities.length === 0) return [];

  let sponsorList: SponsorRow[] = [];
  try {
    const { data, error } = await db
      .from('sponsors')
      .select('id, canonical_name, aliases, country_iso3, is_state_backed, entity_type, needs_review');
    if (error) throw new Error(error.message);
    sponsorList = (data ?? []) as SponsorRow[];
  } catch (err) {
    warnings?.push(`sponsor resolution unavailable: ${err instanceof Error ? err.message : err}`.slice(0, 160));
    return entities.map((entity) => ({ entity, sponsorId: null }));
  }

  const out: ResolvedSponsor[] = [];
  for (const entity of entities) {
    let match = matchSponsor(entity.name, sponsorList);

    if (!match) {
      // Trigram fallback in SQL.
      try {
        const { data } = await db.rpc('resolve_sponsor_fuzzy', { p_name: entity.name });
        const hit = Array.isArray(data) ? data[0] : null;
        if (hit?.id) match = { id: hit.id as string, canonical_name: hit.canonical_name as string };
      } catch {
        // fall through to needs_review creation
      }
    }

    if (!match) {
      // Unknown entity → create it, flagged for analyst review.
      try {
        const { data, error } = await db
          .from('sponsors')
          .insert({ canonical_name: entity.name.slice(0, 160), needs_review: true, entity_type: 'private' })
          .select('id, canonical_name')
          .single();
        if (!error && data) {
          match = { id: data.id as string, canonical_name: data.canonical_name as string };
          sponsorList.push({
            id: match.id, canonical_name: match.canonical_name, aliases: [],
            country_iso3: null, is_state_backed: false, entity_type: 'private', needs_review: true,
          });
        }
      } catch {
        // duplicate insert race or missing table — non-fatal
      }
    }

    out.push({
      entity: match ? { ...entity, name: match.canonical_name } : entity,
      sponsorId: match?.id ?? null,
    });
  }
  return out;
}
