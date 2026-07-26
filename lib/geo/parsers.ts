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
  [/terminal/i, 'port'], // coal/other terminals are port infrastructure
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

// Some GEM workbooks (cement, iron/steel, coal terminals, chemicals) put
// title/notes rows above the real header, which surfaces as "__EMPTY" columns.
// Scan the first rows for one that looks like a header (a name-ish column plus
// a geo-ish column) and rebuild records from there.
export function detectHeaderRow(rows: unknown[][], maxScan = 12): number {
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const cells = (rows[i] ?? []).map((c) => String(c ?? '').toLowerCase());
    if (cells.filter((c) => c.trim() !== '').length < 3) continue;
    const hasName = cells.some((c) => /name|project|plant|mine|terminal|pipeline/.test(c));
    const hasGeo = cells.some((c) => /latitude|longitude|coordinates|country/.test(c));
    if (hasName && hasGeo) return i;
  }
  return 0;
}

export function rowsToRecords(rows: unknown[][], headerIdx: number): Array<Record<string, unknown>> {
  const header = (rows[headerIdx] ?? []).map((h) => String(h ?? '').trim());
  const out: Array<Record<string, unknown>> = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const rec: Record<string, unknown> = {};
    let filled = 0;
    header.forEach((h, j) => {
      if (!h) return;
      const v = row[j];
      if (v !== null && v !== undefined && String(v).trim() !== '') filled++;
      rec[h] = v;
    });
    if (filled > 0) out.push(rec);
  }
  return out;
}

// GEM pipeline trackers (GGIT/GOIT) describe routes, not points. For gazetteer
// matching we anchor each pipeline at its start point: named references in
// articles ("Power of Siberia 2") then resolve to a facility. Verified columns:
// PipelineName, SegmentName, ProjectID, CountriesOrAreas, StartCountryOrArea;
// coordinates come from Start latitude/longitude columns or a route string.
export function gemPipelineRecordToFacility(rec: Record<string, unknown>): FacilityRow | null {
  const name = pickField(rec, ['PipelineName', 'Pipeline name', 'Pipeline']);
  if (!name) return null;

  let lat = parseNum(pickField(rec, ['StartLatitude', 'Start Latitude', 'StartLat', 'LatitudeStart']));
  let lon = parseNum(pickField(rec, ['StartLongitude', 'Start Longitude', 'StartLon', 'StartLng', 'LongitudeStart']));
  if (!validCoords(lon, lat)) {
    // Route string fallback: first "lat, lon" pair found.
    const route = pickField(rec, ['Route', 'WKTFormat', 'RouteCoordinates', 'Coordinates']);
    const m = route?.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (m) {
      lat = parseFloat(m[1]);
      lon = parseFloat(m[2]);
    }
  }
  if (!validCoords(lon, lat)) return null;

  const country =
    pickField(rec, ['StartCountryOrArea', 'StartCountry']) ??
    pickField(rec, ['CountriesOrAreas', 'Countries'])?.split(/[,;]/)[0]?.trim() ??
    null;
  const ref = pickField(rec, ['ProjectID', 'Project ID']);

  return {
    name,
    facilityType: 'pipeline',
    iso3: toIso3(country),
    lon: lon!,
    lat: lat!,
    sourceRef: ref ? `GEM:${ref}` : null,
    aliases: [],
  };
}

// ─── Generic flat-XML → records (EXIM FOIA reports etc.) ──────────────────────
// Government data XML is typically one repeated record element, either with
// leaf children (<Record><Country>Kenya</Country>…</Record>) or attribute rows
// (<row Country="Kenya" …/>). Detect whichever shape is present.
function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

export function xmlToRecords(xml: string): Array<Record<string, unknown>> {
  const cleaned = xml.replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');

  // Shape A: self-closing attribute rows.
  const selfClosing = [...cleaned.matchAll(/<(\w[\w.-]*)((?:\s+[\w.-]+="[^"]*")+)\s*\/>/g)];
  const scTally = new Map<string, number>();
  for (const m of selfClosing) scTally.set(m[1], (scTally.get(m[1]) ?? 0) + 1);
  const scBest = [...scTally.entries()].sort((a, b) => b[1] - a[1])[0];
  if (scBest && scBest[1] >= 2) {
    return selfClosing
      .filter((m) => m[1] === scBest[0])
      .map((m) => {
        const rec: Record<string, unknown> = {};
        for (const am of m[2].matchAll(/([\w.-]+)="([^"]*)"/g)) rec[am[1]] = decodeXml(am[2]);
        return rec;
      });
  }

  // Shape B: repeated container elements with leaf children. Try candidate
  // tags from most frequent down; leaf tags yield empty records and are skipped.
  const tally = new Map<string, number>();
  for (const m of cleaned.matchAll(/<(\w[\w.-]*)[\s>]/g)) tally.set(m[1], (tally.get(m[1]) ?? 0) + 1);
  const candidates = [...tally.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  for (const [tag] of candidates) {
    const blocks = [...cleaned.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))];
    if (blocks.length < 2) continue;
    if (!blocks[0][1].includes('<')) continue; // leaf tag, not a record container
    const records = blocks
      .map((b) => {
        const rec: Record<string, unknown> = {};
        for (const fm of b[1].matchAll(/<([\w.-]+)(?:\s[^>]*)?>([^<]*)<\/\1>/g)) {
          rec[fm[1]] = decodeXml(fm[2].trim());
        }
        return rec;
      })
      .filter((r) => Object.keys(r).length >= 2);
    if (records.length >= 2) return records;
  }
  return [];
}

// Top tag names by frequency — printed when an XML file parses to zero rows.
export function xmlTagSummary(xml: string, top = 12): string {
  const tally = new Map<string, number>();
  for (const m of xml.matchAll(/<(\w[\w.-]*)[\s/>]/g)) tally.set(m[1], (tally.get(m[1]) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)
    .map(([t, n]) => `${t}(${n})`).join(' | ');
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
