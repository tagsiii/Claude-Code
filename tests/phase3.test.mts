// Phase-3 tests: map styling helpers (score bands must mirror the table's
// thresholds), radius scaling, choropleth buckets, deal→GeoJSON shaping,
// basemap style shape, and the host_country filter's ISO3/name detection.

import {
  scoreFillColor, dealRadiusPx, isApproximate, cnRadiusPx, choroplethColor,
  CHORO_BUCKETS, basemapStyle, dealsToFeatureCollection, LAYER_FILES,
  type DealGeoRow,
} from '../lib/geo/mapStyle.ts';
import { dedupeOnConflict } from '../scripts/loaders/_shared.mts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}

console.log('── Score colors: same 70/50/30 bands, gold ramp (red = China) ──');
{
  const gold = scoreFillColor(85);
  const amber = scoreFillColor(55);
  const zinc = scoreFillColor(35);
  const gray = scoreFillColor(10);
  check('≥70 is gold (yellow-400)', gold[0] === 250 && gold[1] === 204);
  check('50–69 is amber-500', amber[0] === 245 && amber[1] === 158);
  check('30–49 is muted zinc', zinc[0] === 161);
  check('<30 is neutral', gray[0] === 113);
  check('boundary 70 → gold, 69.9 → amber', scoreFillColor(70)[0] === 250 && scoreFillColor(69.9)[0] === 245);
  check('null score is neutral', scoreFillColor(null)[0] === 113);
  check('deal colors never enter the China-red family', [85, 55, 35, 10].every((s) => {
    const [r, g, b] = scoreFillColor(s);
    return !(r > 200 && g < 90 && b < 90);
  }));
}

console.log('── Deal radius: log-scaled by value, clamped ──');
{
  check('unknown value → min 3.5px', dealRadiusPx(null) === 3.5 && dealRadiusPx(0) === 3.5);
  const m20 = dealRadiusPx(20_000_000);
  const b1 = dealRadiusPx(1_000_000_000);
  const b10 = dealRadiusPx(10_000_000_000);
  check('$20M smaller than $1B smaller than $10B', m20 < b1 && b1 < b10);
  check('monotonic step is log, not linear', b10 - b1 < b1 - m20 + 4); // log flattens
  check('clamped at 13px even for $1T', dealRadiusPx(1_000_000_000_000) === 13);
}

console.log('── Precision honesty: hollow rendering ──');
{
  check('country_centroid is approximate', isApproximate('country_centroid'));
  check('null precision is approximate', isApproximate(null));
  check('facility + city are precise', !isApproximate('facility') && !isApproximate('city'));
}

console.log('── Choropleth buckets ──');
{
  check('zero/negative/null → transparent', choroplethColor(0)[3] === 0 && choroplethColor(null)[3] === 0);
  check('$50M lands in lowest bucket', choroplethColor(50_000_000)[3] === CHORO_BUCKETS[4].color[3]);
  check('$5B lands in $1B–$10B bucket',
    JSON.stringify(choroplethColor(5_000_000_000)) === JSON.stringify(CHORO_BUCKETS[2].color));
  check('$60B lands in top bucket',
    JSON.stringify(choroplethColor(60_000_000_000)) === JSON.stringify(CHORO_BUCKETS[0].color));
  const alphas = CHORO_BUCKETS.map((b) => b.color[3]);
  check('bucket opacity increases with $', alphas.every((a, i) => i === 0 || a < alphas[i - 1]));
}

console.log('── CN point radius ──');
{
  check('unknown CN value → min (pinprick)', cnRadiusPx(null) === 1.5);
  check('CN radius clamped at 6 — precision over blobs', cnRadiusPx(1_000_000_000_000) === 6);
  check('CN radius grows with value', cnRadiusPx(2_000_000_000) > cnRadiusPx(50_000_000));
}

console.log('── Basemap style ──');
{
  const light = basemapStyle(false);
  const dark = basemapStyle(true);
  const tiles = (s: Record<string, unknown>) =>
    ((s.sources as Record<string, { tiles: string[] }>).carto.tiles ?? []).join(' ');
  check('light uses light_all tiles', tiles(light).includes('light_all'));
  check('dark uses dark_all tiles', tiles(dark).includes('dark_all'));
  check('4 subdomains for parallel tile loads', (light.sources as Record<string, { tiles: string[] }>).carto.tiles.length === 4);
  check('valid style version 8', light.version === 8 && Array.isArray(light.layers));
}

console.log('── Deal GeoJSON shaping ──');
{
  const rows: DealGeoRow[] = [
    {
      id: 'a1', title: 'Gwadar Port Expansion', sector: 'strategic_infrastructure',
      lifecycle_stage: 'signed', composite_score: 78.2, rom_value_usd: 1_600_000_000,
      country_iso3: 'PAK', location_precision: 'facility', lon: 62.3225, lat: 25.1216,
    },
    {
      id: 'b2', title: 'Unknown-loc deal', sector: 'energy', lifecycle_stage: 'rumored',
      composite_score: null, rom_value_usd: null, country_iso3: null,
      location_precision: null, lon: NaN, lat: 10,
    },
  ];
  const fc = dealsToFeatureCollection(rows);
  check('FeatureCollection type', fc.type === 'FeatureCollection');
  check('non-finite coordinates dropped', fc.features.length === 1);
  const f = fc.features[0];
  check('[lon, lat] order (GeoJSON)', f.geometry.coordinates[0] === 62.3225 && f.geometry.coordinates[1] === 25.1216);
  check('properties carry id/score/stage/precision',
    f.properties.id === 'a1' && f.properties.score === 78.2 &&
    f.properties.stage === 'signed' && f.properties.precision === 'facility');
  check('empty input → empty features', dealsToFeatureCollection([]).features.length === 0);
}

console.log('── Layer filename contract (exporter ↔ map client) ──');
{
  const files = Object.values(LAYER_FILES);
  check('7 layers defined', files.length === 7);
  check('all lowercase json/geojson', files.every((f) => /^[a-z0-9-]+\.(geo)?json$/.test(f)));
  check('no duplicate filenames', new Set(files).size === files.length);
}

console.log('── host_country filter: ISO3 vs name detection ──');
{
  // Mirrors the branch in getDeals — ISO3 codes go to country_iso3 equality,
  // anything else becomes a name match.
  const isIso3 = (s: string) => /^[A-Z]{3}$/.test(s.trim());
  check('PAK detected as ISO3', isIso3('PAK') && isIso3(' KEN '));
  check('names are not ISO3', !isIso3('Kenya') && !isIso3('pak') && !isIso3('LAOS'));
}

console.log('── Batch dedupe on conflict key (DFC/MCC "affect row a second time" fix) ──');
{
  const rows = [
    { agency: 'DFC', project_name: 'Solar Fund II', country_iso3: 'KEN', value_usd: 100 },
    { agency: 'DFC', project_name: 'Solar Fund II', country_iso3: 'KEN', value_usd: 250 },
    { agency: 'DFC', project_name: 'Solar Fund II', country_iso3: 'NGA', value_usd: 300 },
    { agency: 'EXIM', project_name: 'Solar Fund II', country_iso3: 'KEN', value_usd: 400 },
  ];
  const out = dedupeOnConflict(rows, 'agency,project_name,country_iso3');
  check('duplicate conflict key collapsed', out.length === 3);
  check('last occurrence wins', out.some((r) => r.country_iso3 === 'KEN' && r.agency === 'DFC' && r.value_usd === 250));
  check('different country kept', out.some((r) => r.country_iso3 === 'NGA'));
  check('different agency kept', out.some((r) => r.agency === 'EXIM'));
  const clean = [{ bank: 'WB', project_ref: 'P1' }, { bank: 'WB', project_ref: 'P2' }];
  check('no-duplicate batch returned as-is', dedupeOnConflict(clean, 'bank,project_ref') === clean);
  check('null key values dedupe safely', dedupeOnConflict(
    [{ a: null, b: 'x' }, { a: null, b: 'y' }] as never, 'a').length === 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
