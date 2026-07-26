// Phase-2 pure parsers: AidData GCDF, Marine Regions EEZ, World Bank Projects
// API, USTDA press feed, PPI, DFC/EXIM/MCC files, OECD CRS rows.
// Every function is pure and fixture-tested; loaders stay thin.
// Formats verified against: a live AidData project GeoJSON, the user's
// probe captures (WB API JSON, USTDA WP-JSON), and tolerant field matching
// with zero-count diagnostics for the manually-downloaded files.

import { pickField } from './parsers';
import { toIso3, findCountryInText } from '../data/countryCodes';

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[$,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toDateIso(v: string | null): string | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// ─── AidData GCDF v3 (verified live: latest/geojsons/<id>.geojson) ─────────────
export interface CnProjectRow {
  projectRef: string;
  title: string;
  sector: string | null;
  commitmentUsd: number | null;
  year: number | null;
  status: string | null;
  iso3: string | null;
  geometryJson: string;
}

export function aidDataProjectToRow(fc: {
  features?: Array<{ properties?: Record<string, unknown>; geometry?: unknown }>;
}): CnProjectRow | null {
  const features = fc?.features ?? [];
  if (features.length === 0) return null;
  const p = features[0].properties ?? {};
  const id = p['id'] ?? p['AidData.Record.ID'];
  const title = String(p['Title'] ?? '').trim();
  if (id === undefined || id === null || !title) return null;

  const geometry =
    features.length === 1
      ? features[0].geometry
      : { type: 'GeometryCollection', geometries: features.map((f) => f.geometry).filter(Boolean) };
  if (!geometry) return null;

  const isoRaw = String(p['Recipient.ISO-3'] ?? '');
  const yearNum = num(p['Commitment.Year']);
  return {
    projectRef: String(id),
    title: title.slice(0, 500),
    sector: p['Sector.Name'] ? String(p['Sector.Name']) : null,
    commitmentUsd: num(p['Amount.(Constant.USD.2021)']) !== null ? Math.round(num(p['Amount.(Constant.USD.2021)'])!) : null,
    year: yearNum !== null ? Math.round(yearNum) : null,
    status: p['Status'] ? String(p['Status']) : null,
    iso3: /^[A-Z]{3}$/.test(isoRaw) ? isoRaw : toIso3(String(p['Recipient'] ?? '')),
    geometryJson: JSON.stringify(geometry),
  };
}

// ─── Marine Regions World EEZ (shapefile properties) ──────────────────────────
export interface EezRow {
  name: string;
  sovereign: string | null;
  geometryJson: string;
}

export function eezFeatureToRow(feature: {
  properties?: Record<string, unknown>;
  geometry?: unknown;
}): EezRow | null {
  const p = feature.properties ?? {};
  const name = pickField(p, ['GEONAME', 'geoname', 'Name', 'EEZ']);
  if (!name || !feature.geometry) return null;
  return {
    name: name.slice(0, 300),
    sovereign: pickField(p, ['SOVEREIGN1', 'sovereign1', 'Sovereign', 'TERRITORY1']),
    geometryJson: JSON.stringify(feature.geometry),
  };
}

// ─── World Bank Projects API (verified via user probe: api/v3/projects) ───────
export interface MdbRow {
  bank: string;
  projectRef: string;
  name: string;
  iso3: string | null;
  sector: string | null;
  status: 'pipeline' | 'active' | 'closed';
  valueUsd: number | null;
}

export function wbProjectToMdb(p: Record<string, unknown>): MdbRow | null {
  const id = p['id'] ?? p['proj_id'];
  if (!id) return null;
  const name = String(p['project_name'] ?? p['proj_name'] ?? `WB ${id}`).trim();

  const statusRaw = String(p['status'] ?? p['projectstatusdisplay'] ?? '').toLowerCase();
  let status: MdbRow['status'];
  if (/pipeline|proposed|negotiat/.test(statusRaw)) status = 'pipeline';
  else if (/closed|dropped|completed/.test(statusRaw)) status = 'closed';
  else if (/active/.test(statusRaw)) status = 'active';
  else {
    // Probe showed future boardapprovaldate on rows with no explicit status —
    // an unapproved project is pipeline.
    const board = String(p['boardapprovaldate'] ?? '');
    status = board && new Date(board).getTime() > Date.now() ? 'pipeline' : 'active';
  }

  const value =
    num(p['curr_total_commitment']) ?? num(p['totalcommamt']) ?? num(p['curr_ibrd_commitment']) ?? num(p['grantamt']);
  const sectorObj = p['sector1'] as { Name?: string } | undefined;

  return {
    bank: 'WB',
    projectRef: String(id),
    name: name.slice(0, 400),
    iso3: toIso3(String(p['countryshortname'] ?? '')),
    sector: sectorObj?.Name ?? (p['mjsectorname'] ? String(p['mjsectorname']) : null),
    status,
    valueUsd: value !== null ? Math.round(value) : null,
  };
}

// ─── USTDA press feed (verified via user probe: standard WordPress REST) ──────
export interface UsActivityRow {
  agency: 'DFC' | 'USTDA' | 'EXIM' | 'MCC';
  recordType: 'investment' | 'feasibility_study' | 'authorization' | 'compact' | 'framework';
  projectName: string;
  iso3: string | null;
  sector: string | null;
  valueUsd: number | null;
  announcedDate: string | null;
  isLeadingIndicator: boolean;
  sourceUrl: string | null;
}

const USTDA_SIGNAL = /feasibility|study|grant|technical assistance|pilot|reverse trade|partnership|training/i;

const SECTOR_KEYWORDS: Array<[RegExp, string]> = [
  [/port|maritime|harbor|harbour/i, 'ports'],
  [/rail|metro|transit/i, 'rail'],
  [/airport|aviation/i, 'aviation'],
  [/5g|telecom|broadband|connectivity|data center|datacenter|digital/i, 'digital'],
  [/nuclear|smr/i, 'nuclear'],
  [/solar|wind|renewable|geothermal|hydro/i, 'renewables'],
  [/lng|gas|pipeline|petroleum|oil/i, 'oil_gas'],
  [/grid|transmission|electric|power|energy/i, 'power'],
  [/mine|mining|mineral|lithium|cobalt|copper/i, 'minerals'],
  [/water|sanitation/i, 'water'],
  [/health|hospital/i, 'health'],
  [/agricultur|food/i, 'agriculture'],
];

export function inferSector(text: string): string | null {
  for (const [re, sector] of SECTOR_KEYWORDS) if (re.test(text)) return sector;
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/&#8216;|&lsquo;/gi, "'").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&nbsp;/gi, ' ').replace(/<[^>]+>/g, '').trim();
}

export function ustdaPostToActivity(post: {
  title?: { rendered?: string };
  link?: string;
  date?: string;
  excerpt?: { rendered?: string };
}): UsActivityRow | null {
  const title = decodeEntities(post.title?.rendered ?? '');
  if (!title) return null;
  const haystack = `${title} ${decodeEntities(post.excerpt?.rendered ?? '')}`;
  if (!USTDA_SIGNAL.test(haystack)) return null;
  const country = findCountryInText(haystack);
  if (!country) return null; // country+sector drives flag_us_positioning; no country = no signal

  return {
    agency: 'USTDA',
    recordType: 'feasibility_study',
    projectName: title.slice(0, 400),
    iso3: country.iso3,
    sector: inferSector(haystack),
    valueUsd: null,
    announcedDate: toDateIso(post.date ?? null),
    isLeadingIndicator: true,
    sourceUrl: post.link ?? null,
  };
}

// ─── Agency data files (DFC / EXIM / MCC — user-downloaded, tolerant) ─────────
function fileValue(rec: Record<string, unknown>, candidates: string[]): number | null {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-/()$.]+/g, '');
  const keys = Object.keys(rec);
  for (const c of candidates) {
    const key = keys.find((k) => norm(k).includes(norm(c)));
    if (key) {
      const v = num(rec[key]);
      if (v !== null && v !== 0) {
        // headers stating millions get scaled
        return /million|mm|\(us\$m\)|usd m/i.test(key) ? Math.round(v * 1e6) : Math.round(v);
      }
    }
  }
  return null;
}

export function dfcRecordToActivity(rec: Record<string, unknown>): UsActivityRow | null {
  const name = pickField(rec, ['Project Name', 'Project', 'Project Description', 'Name']);
  const country = pickField(rec, ['Country', 'Countries', 'Project Country', 'Country Name']);
  if (!name || !country) return null;
  const iso3 = toIso3(country.split(/[,;/]/)[0].trim());
  if (!iso3) return null;
  return {
    agency: 'DFC', recordType: 'investment',
    projectName: name.slice(0, 400), iso3,
    sector: pickField(rec, ['Sector', 'NAICS Sector', 'Project Type', 'Department']) ?? inferSector(name),
    valueUsd: fileValue(rec, ['committed', 'dfc support', 'commitment', 'amount', 'total']),
    announcedDate: toDateIso(pickField(rec, ['Board Date', 'Commitment Date', 'Fiscal Year', 'FY'])),
    isLeadingIndicator: false, sourceUrl: null,
  };
}

export function eximRecordToActivity(rec: Record<string, unknown>): UsActivityRow | null {
  const name = pickField(rec, ['Project', 'Primary Borrower', 'Borrower', 'Obligor', 'Deal Description', 'Transaction Description', 'Purpose']);
  const country = pickField(rec, ['Country', 'Primary Country', 'Country Name', 'Primary Source of Repayment Country']);
  if (!name || !country) return null;
  const iso3 = toIso3(country.split(/[,;/]/)[0].trim());
  if (!iso3) return null;
  return {
    agency: 'EXIM', recordType: 'authorization',
    projectName: name.slice(0, 400), iso3,
    sector: pickField(rec, ['Sector', 'Industry', 'Program']) ?? inferSector(name),
    valueUsd: fileValue(rec, ['authorized', 'approved', 'amount', 'disbursed', 'exposure']),
    announcedDate: toDateIso(pickField(rec, ['Authorization Date', 'Approval Date', 'Fiscal Year', 'FY'])),
    isLeadingIndicator: false, sourceUrl: null,
  };
}

export function mccRecordToActivity(rec: Record<string, unknown>): UsActivityRow | null {
  const name = pickField(rec, ['Compact Name', 'Program Name', 'Program', 'Project Name', 'Agreement Name', 'Name']);
  const country = pickField(rec, ['Country', 'Country Name', 'Partner Country']);
  if (!name || !country) return null;
  const iso3 = toIso3(country.split(/[,;/]/)[0].trim());
  if (!iso3) return null;
  return {
    agency: 'MCC', recordType: 'compact',
    projectName: name.slice(0, 400), iso3,
    sector: pickField(rec, ['Sector', 'Project Sector']) ?? inferSector(name),
    valueUsd: fileValue(rec, ['compact amount', 'total amount', 'obligated', 'commitment', 'amount']),
    announcedDate: toDateIso(pickField(rec, ['Signed Date', 'Entry Into Force', 'Signature Date', 'Fiscal Year'])),
    isLeadingIndicator: false, sourceUrl: null,
  };
}

// ─── World Bank PPI bulk file (user-downloaded, tolerant) ─────────────────────
export function ppiRecordToMdb(rec: Record<string, unknown>): MdbRow | null {
  const name = pickField(rec, ['Project Name', 'Project name', 'Project']);
  const country = pickField(rec, ['Country', 'Country Name']);
  if (!name || !country) return null;

  const statusRaw = (pickField(rec, ['Project Status', 'Status', 'Contract Status']) ?? '').toLowerCase();
  const status: MdbRow['status'] = /pre|pipeline|award|tender|planned/.test(statusRaw)
    ? 'pipeline'
    : /cancel|distress|conclud|expired|terminated/.test(statusRaw)
      ? 'closed'
      : 'active';

  const ref = pickField(rec, ['Project ID', 'PPI Project ID', 'ID']) ?? `${country}:${name}`.slice(0, 80);
  return {
    bank: 'WB-PPI',
    projectRef: ref,
    name: name.slice(0, 400),
    iso3: toIso3(country),
    sector: pickField(rec, ['Primary Sector', 'Sector', 'Subsector']),
    status,
    valueUsd: fileValue(rec, ['total investment', 'investment', 'physical assets']),
  };
}

// ─── OECD CRS SDMX-CSV rows ───────────────────────────────────────────────────
export interface IntlFinanceRow {
  donor: string;
  iso3: string;
  sector: string;
  year: number;
  commitmentUsd: number;
}

export function oecdCsvRowToFinance(rec: Record<string, string>): IntlFinanceRow | null {
  const donor = pickField(rec, ['DONOR', 'Donor']);
  const recipient = pickField(rec, ['RECIPIENT', 'Recipient']);
  const yearStr = pickField(rec, ['TIME_PERIOD', 'Time', 'Year']);
  const value = num(pickField(rec, ['OBS_VALUE', 'Value']));
  if (!donor || !recipient || !yearStr || value === null) return null;
  const iso3 = /^[A-Z]{3}$/.test(recipient) ? recipient : toIso3(recipient);
  const year = parseInt(yearStr, 10);
  if (!iso3 || !Number.isFinite(year)) return null;
  return {
    donor,
    iso3,
    sector: pickField(rec, ['SECTOR', 'Sector']) ?? 'all',
    year,
    // CRS values are reported in USD millions
    commitmentUsd: Math.round(value * 1e6),
  };
}
