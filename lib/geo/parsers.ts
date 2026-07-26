// Pure parsing helpers for the reference-data loaders. Dependency-free and
// fixture-tested; loaders stay thin wrappers around these.

import { toIso3 } from '../data/countryCodes';

// ─── Minimal RFC-4180-ish CSV parser (quotes, embedded commas/newlines) ────────
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

// Header-keyed records with case/space-insensitive header normalization.
export function csvToRecords(text: string): Array<Record<string, string>> {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => { rec[h] = (r[i] ?? '').trim(); });
    return rec;
  });
}

// Find the first present key among candidates (case/space-insensitive).
export function pickField(rec: Record<string, unknown>, candidates: string[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-/]+/g, '');
  const map = new Map(Object.keys(rec).map((k) => [norm(k), k]));
  for (const c of candidates) {
    const k = map.get(norm(c));
    if (k !== undefined) {
      const v = rec[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
    }
  }
  return null;
}

export interface FacilityRow {
  name: string;
  facilityType: 'port' | 'power_plant' | 'lng_terminal' | 'pipeline' | 'mine' | 'rail' | 'cable_landing' | 'other';
  iso3: string | null;
  lon: number;
  lat: number;
  sourceRef: string | null;
  aliases: string[];
}

function parseNum(v: string | null): number | null {
  if (v === null) return null;
  const n = parseFloat(v.replace(/[^\d.+-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function validCoords(lon: number | null, lat: number | null): boolean {
  return (
    lon !== null && lat !== null &&
    lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90 &&
    !(lon === 0 && lat === 0) // null-island rows are data errors, not ports
  );
}

// ─── World Port Index (NGA MSI CSV, e.g. UpdatedPub150.csv) ────────────────────
export function wpiRecordToFacility(rec: Record<string, string>): FacilityRow | null {
  const name = pickField(rec, ['Main Port Name', 'PORT_NAME', 'Port Name', 'portName']);
  const lat = parseNum(pickField(rec, ['Latitude', 'LATITUDE', 'Lat', 'ylat']));
  const lon = parseNum(pickField(rec, ['Longitude', 'LONGITUDE', 'Long', 'Lon', 'xlon']));
  if (!name || !validCoords(lon, lat)) return null;

  const country = pickField(rec, ['Country Code', 'COUNTRY', 'Country']);
  const altName = pickField(rec, ['Alternate Port Name', 'ALT_NAME']);
  const wpiNumber = pickField(rec, ['World Port Index Number', 'INDEX_NO', 'WPI Number']);

  return {
    name,
    facilityType: 'port',
    iso3: toIso3(country),
    lon: lon!,
    lat: lat!,
    sourceRef: wpiNumber ? `WPI:${wpiNumber}` : null,
    aliases: altName && altName !== name ? [altName] : [],
  };
}

// ─── Global Energy Monitor tracker spreadsheets ────────────────────────────────
// Sheets vary per tracker; the loader passes a default type inferred from the
// filename, and rows are matched on well-known GEM column names.
export const GEM_TYPE_BY_FILENAME: Array<[RegExp, FacilityRow['facilityType']]> = [
  [/lng|liquef/i, 'lng_terminal'],
  [/pipeline/i, 'pipeline'],
  [/gmet|coal.*mine|iron.*ore|mine/i, 'mine'],
  [/extraction/i, 'other'], // oil/gas fields — not plants
  [/portal.?energetico|integrated.?power/i, 'power_plant'],
  [/coal|gas|nuclear|wind|solar|hydro|geother|bioenergy|power/i, 'power_plant'],
];

// Datasets that are NOT facility-level location lists (financing transactions,
// historical production tables, ownership graphs, vessel registries). Skipped
// explicitly so a zero-count reads as intentional, not as a parse failure.
export const GEM_SKIP_FILENAME =
  /finance|supplement|production-consumption|ownership|carrier|historical/i;

export function gemTypeForFilename(filename: string): FacilityRow['facilityType'] {
  for (const [re, type] of GEM_TYPE_BY_FILENAME) {
    if (re.test(filename)) return type;
  }
  return 'other';
}

export function gemRecordToFacility(
  rec: Record<string, unknown>,
  defaultType: FacilityRow['facilityType']
): FacilityRow | null {
  const name = pickField(rec, [
    'Plant name', 'Project name', 'Plant / Project name', 'Terminal name', 'Pipeline name',
    'Mine name', 'Unit name', 'Facility name', 'Site name', 'Project', 'Name',
  ]);
  let lat = parseNum(pickField(rec, ['Latitude', 'Lat']));
  let lon = parseNum(pickField(rec, ['Longitude', 'Lng', 'Lon', 'Long']));
  // Several GEM trackers ship a single "Coordinates" column as "lat, lon".
  if (!validCoords(lon, lat)) {
    const coords = pickField(rec, ['Coordinates', 'Coordinate', 'Lat/Long', 'Lat, Long', 'Location coordinates']);
    const m = coords?.match(/(-?\d+(?:\.\d+)?)[,;\s]+(-?\d+(?:\.\d+)?)/);
    if (m) {
      lat = parseFloat(m[1]);
      lon = parseFloat(m[2]);
    }
  }
  if (!name || !validCoords(lon, lat)) return null;

  const country = pickField(rec, ['Country', 'Country/Area', 'Countries']);
  const ref = pickField(rec, ['GEM unit ID', 'GEM unit/phase ID', 'GEM phase ID', 'Tracker ID', 'ProjectID', 'GEM location ID', 'Wiki URL']);

  return {
    name,
    facilityType: defaultType,
    iso3: toIso3(country),
    lon: lon!,
    lat: lat!,
    sourceRef: ref ? `GEM:${ref}` : null,
    aliases: [],
  };
}

// ─── Natural Earth admin-0 GeoJSON feature → country row ──────────────────────
export interface CountryRow {
  iso3: string;
  name: string;
  continent: string | null;
  unRegion: string | null;
  subregion: string | null;
  geometryJson: string;
}

export function neFeatureToCountry(feature: {
  properties?: Record<string, unknown>;
  geometry?: unknown;
}): CountryRow | null {
  const p = feature.properties ?? {};
  // ISO_A3 is '-99' for a handful of countries (France, Norway, Kosovo…);
  // ADM0_A3 is always populated — verified against the live dataset.
  const isoRaw = String(p.ISO_A3 ?? '');
  const iso3 = /^[A-Z]{3}$/.test(isoRaw) ? isoRaw : String(p.ADM0_A3 ?? '');
  const name = String(p.ADMIN ?? p.NAME ?? '');
  if (!/^[A-Z]{3}$/.test(iso3) || !name || !feature.geometry) return null;
  return {
    iso3,
    name,
    continent: p.CONTINENT ? String(p.CONTINENT) : null,
    unRegion: p.REGION_UN ? String(p.REGION_UN) : null,
    subregion: p.SUBREGION ? String(p.SUBREGION) : null,
    geometryJson: JSON.stringify(feature.geometry),
  };
}
