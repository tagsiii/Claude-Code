// Pure, testable styling + data-shaping helpers for the map page.
// Colors deliberately mirror the app's existing score semantics
// (scoreBarClass thresholds 70/50/30 → red/orange/amber/neutral) and the
// sector palette, so the map reads like the rest of the dashboard.

export type RGBA = [number, number, number, number];

// ─── Deal points ──────────────────────────────────────────────────────────────

// Tailwind red-500 / orange-500 / amber-500 / zinc-500 — same bands as
// scoreBarClass in lib/utils/format.ts.
export function scoreFillColor(score: number | null | undefined): RGBA {
  if (score == null) return [113, 113, 122, 160];
  if (score >= 70) return [239, 68, 68, 210];
  if (score >= 50) return [249, 115, 22, 210];
  if (score >= 30) return [245, 158, 11, 210];
  return [113, 113, 122, 180];
}

// Radius in pixels, log-scaled by deal value so a $10B port doesn't just look
// like a $20M study. Unknown value → smallest dot.
export function dealRadiusPx(valueUsd: number | null | undefined): number {
  if (!valueUsd || valueUsd <= 0) return 4;
  const r = 4 + 3 * Math.log10(valueUsd / 1_000_000 + 1);
  return Math.min(18, Math.max(4, r));
}

// Country-centroid locations are approximate — render hollow (transparent fill,
// solid outline) so precision is visually honest. Facility/city = solid.
export function isApproximate(precision: string | null | undefined): boolean {
  return precision !== 'facility' && precision !== 'city';
}

// ─── Reference layers ─────────────────────────────────────────────────────────

// CN state-backed finance: violet family (matches digital/purple accent usage).
export const CN_POINT_COLOR: RGBA = [139, 92, 246, 190];
// US agency activity: blue (primary accent).
export const US_POINT_COLOR: RGBA = [59, 130, 246, 200];
export const US_LEADING_COLOR: RGBA = [14, 165, 233, 220]; // sky-500 — leading indicators pop
export const FACILITY_COLOR: RGBA = [100, 116, 139, 140]; // slate-500, muted
export const CABLE_COLOR: RGBA = [71, 85, 105, 170]; // slate-600 (light theme core)
export const CABLE_CORE_DARK: RGBA = [148, 184, 226, 210]; // luminous blue-grey on dark
export const CABLE_HALO: RGBA = [100, 140, 200, 40]; // wide soft glow under the core line
export const EEZ_LINE_COLOR: RGBA = [20, 184, 166, 90]; // teal-500, faint
// Hover/selection accent — amber, like the reference infrastructure maps.
export const HIGHLIGHT_COLOR: RGBA = [245, 158, 11, 220];

export function cnRadiusPx(usd: number | null | undefined): number {
  if (!usd || usd <= 0) return 2.5;
  return Math.min(12, Math.max(2.5, 2.5 + 2 * Math.log10(usd / 1_000_000 + 1)));
}

// ─── Choropleth (Chinese cumulative commitments per country) ─────────────────

// Fixed, documented buckets (USD) — a legend must be able to state them.
export const CHORO_BUCKETS: Array<{ min: number; color: RGBA; label: string }> = [
  { min: 50_000_000_000, color: [91, 33, 182, 190], label: '≥ $50B' },
  { min: 10_000_000_000, color: [124, 58, 237, 165], label: '$10B – $50B' },
  { min: 1_000_000_000, color: [167, 139, 250, 140], label: '$1B – $10B' },
  { min: 100_000_000, color: [196, 181, 253, 115], label: '$100M – $1B' },
  { min: 1, color: [221, 214, 254, 90], label: '< $100M' },
];

export function choroplethColor(totalUsd: number | null | undefined): RGBA {
  if (!totalUsd || totalUsd <= 0) return [0, 0, 0, 0];
  for (const b of CHORO_BUCKETS) {
    if (totalUsd >= b.min) return b.color;
  }
  return [0, 0, 0, 0];
}

// ─── Basemap ──────────────────────────────────────────────────────────────────

// Carto raster basemaps: no API key, generous free tier, light + dark variants.
// Raster (not vector) keeps the bundle small and works identically in both themes.
export function basemapStyle(dark: boolean): Record<string, unknown> {
  const variant = dark ? 'dark_all' : 'light_all';
  return {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: ['a', 'b', 'c', 'd'].map(
          (s) => `https://${s}.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`
        ),
        tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO',
      },
    },
    layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
  };
}

// ─── Deal GeoJSON shaping (used by /api/map/deals) ───────────────────────────

export interface DealGeoRow {
  id: string;
  title: string;
  sector: string | null;
  lifecycle_stage: string | null;
  composite_score: number | null;
  rom_value_usd: number | null;
  country_iso3: string | null;
  location_precision: string | null;
  lon: number;
  lat: number;
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: Record<string, unknown>;
  }>;
}

export function dealsToFeatureCollection(rows: DealGeoRow[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows
      .filter((r) => Number.isFinite(r.lon) && Number.isFinite(r.lat))
      .map((r) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [r.lon, r.lat] as [number, number] },
        properties: {
          id: r.id,
          title: r.title,
          sector: r.sector,
          stage: r.lifecycle_stage,
          score: r.composite_score,
          value: r.rom_value_usd,
          iso3: r.country_iso3,
          precision: r.location_precision,
        },
      })),
  };
}

// Static layer filenames in the public `map-layers` Storage bucket — the single
// source of truth shared by scripts/export-tiles.mts and MapView.
export const LAYER_FILES = {
  facilities: 'facilities.geojson',
  cnProjects: 'cn-projects.geojson',
  cnCountrySums: 'cn-country-sums.json',
  usActivity: 'us-activity.geojson',
  cables: 'cables.geojson',
  eez: 'eez.geojson',
  countries: 'countries.geojson',
} as const;
