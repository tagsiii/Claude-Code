import { db } from '../db/client';
import { lookupCity } from '../data/cities';
import type { DealCandidate, LocationPrecision } from '../types';

// The geocoding ladder — highest precision wins:
//   1. facility  — a named facility matches the gazetteer (exact/alias/trigram)
//   2. city      — a place name matches the static city-centroid table
//   3. country_centroid — fallback to the country's centroid
// No external geocoding APIs, ever (design constraint). All DB access is
// best-effort so scans keep working before the geo migration is applied.

export interface GeoResult {
  lon: number;
  lat: number;
  precision: LocationPrecision;
  facilityId: string | null;
  facilityName: string | null;
  iso3: string | null;
}

export async function geocodeCandidate(
  candidate: Pick<DealCandidate, 'named_facilities' | 'place_names' | 'host_country_iso3' | 'host_country'>,
  warnings?: string[]
): Promise<GeoResult | null> {
  const iso3 = candidate.host_country_iso3 ?? null;

  // Rung 1: named facility → gazetteer
  for (const name of candidate.named_facilities ?? []) {
    try {
      const { data, error } = await db.rpc('match_facility', { p_name: name, p_iso3: iso3 });
      if (error) throw new Error(error.message);
      const hit = Array.isArray(data) ? data[0] : null;
      if (hit && typeof hit.lon === 'number' && typeof hit.lat === 'number') {
        return {
          lon: hit.lon, lat: hit.lat, precision: 'facility',
          facilityId: hit.id as string, facilityName: hit.name as string,
          iso3: (hit.country_iso3 as string | null) ?? iso3,
        };
      }
    } catch (err) {
      warnings?.push(`facility match unavailable: ${err instanceof Error ? err.message : err}`.slice(0, 140));
      break; // DB-side matcher missing — don't retry per name
    }
  }

  // Rung 2: place names (then facility names as loose place references)
  // against the static city gazetteer.
  for (const name of [...(candidate.place_names ?? []), ...(candidate.named_facilities ?? [])]) {
    const city = lookupCity(name, iso3) ?? lookupCity(name);
    if (city) {
      return {
        lon: city.lon, lat: city.lat, precision: 'city',
        facilityId: null, facilityName: null, iso3: iso3 ?? city.iso3,
      };
    }
  }

  // Rung 3: country centroid
  if (iso3) {
    try {
      const { data } = await db
        .from('countries')
        .select('centroid_lon, centroid_lat')
        .eq('iso3', iso3)
        .maybeSingle();
      if (data?.centroid_lon != null && data?.centroid_lat != null) {
        return {
          lon: data.centroid_lon, lat: data.centroid_lat, precision: 'country_centroid',
          facilityId: null, facilityName: null, iso3,
        };
      }
    } catch {
      // countries not loaded yet — fine
    }
  }

  return null;
}

// Persist a geocode result onto a deal (RPC writes PostGIS geometry).
export async function applyDealLocation(
  dealId: string,
  geo: GeoResult,
  warnings?: string[]
): Promise<boolean> {
  try {
    const { error } = await db.rpc('set_deal_location', {
      p_deal_id: dealId,
      p_lon: geo.lon,
      p_lat: geo.lat,
      p_precision: geo.precision,
      p_facility_id: geo.facilityId,
      p_iso3: geo.iso3 ?? '',
    });
    if (error) throw new Error(error.message);
    return true;
  } catch (err) {
    warnings?.push(`set_deal_location failed: ${err instanceof Error ? err.message : err}`.slice(0, 140));
    return false;
  }
}
