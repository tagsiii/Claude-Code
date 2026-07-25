// Geo Phase 1 test suite: parsers, gazetteers, geocoding inputs, sponsor
// resolution, facility-first dedup, and the sponsor-driven GDELT watchlist.
// Pure-logic only — no database required.

import { toIso3, isValidIso3 } from '../lib/data/countryCodes.ts';
import { lookupCity, CITIES } from '../lib/data/cities.ts';
import {
  parseCsv, csvToRecords, pickField, validCoords,
  wpiRecordToFacility, gemRecordToFacility, gemTypeForFilename, neFeatureToCountry,
} from '../lib/geo/parsers.ts';
import { normalizeCandidate, normalizeNameList, normalizeIso3 } from '../lib/pipeline/normalize.ts';
import { matchSponsor, normalizeSponsorName } from '../lib/pipeline/sponsors.ts';
import { decideFacilityDedup } from '../lib/pipeline/facilityDedup.ts';
import { buildEntityQueriesFromSponsors } from '../lib/connectors/gdeltQueries.ts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}

console.log('── Country codes ──');
{
  check("'Tanzania' → TZA", toIso3('Tanzania') === 'TZA');
  check("'United Republic of Tanzania' → TZA", toIso3('United Republic of Tanzania') === 'TZA');
  check("'PRC' → CHN", toIso3('PRC') === 'CHN');
  check("'UAE' → ARE", toIso3('UAE') === 'ARE');
  check("'DR Congo' → COD", toIso3('DR Congo') === 'COD');
  check("valid code passthrough 'LKA' → LKA", toIso3('LKA') === 'LKA');
  check('unknown → null', toIso3('Atlantis') === null);
  check('isValidIso3 rejects lowercase/short', !isValidIso3('tz') && isValidIso3('TZA'));
}

console.log('── City gazetteer ──');
{
  check('Hambantota found with country', lookupCity('Hambantota', 'LKA')?.lat === 6.1246);
  check('alias lookup (Chittagong → Chattogram)', lookupCity('Chittagong')?.iso3 === 'BGD');
  check('country constraint respected', lookupCity('Hambantota', 'KEN') === null);
  check('case-insensitive', lookupCity('dar es salaam')?.iso3 === 'TZA');
  check('gazetteer has no duplicate name+country', new Set(CITIES.map(c => c.name.toLowerCase() + c.iso3)).size === CITIES.length);
  check('all gazetteer coords valid', CITIES.every(c => validCoords(c.lon, c.lat)));
}

console.log('── CSV / WPI parsing ──');
{
  const csv = 'Main Port Name,Country Code,Latitude,Longitude,World Port Index Number,Alternate Port Name\n' +
    '"Dar es Salaam",Tanzania,-6.8167,39.3,32680,"Daressalam"\n' +
    'Bad Row,Tanzania,,39.3,1,\n' +
    'Null Island,Ghana,0,0,2,\n';
  const recs = csvToRecords(csv);
  check('csvToRecords parses quoted cells', recs[0]['Main Port Name'] === 'Dar es Salaam');
  const f = wpiRecordToFacility(recs[0]);
  check('WPI row → port facility', f?.facilityType === 'port' && f?.name === 'Dar es Salaam');
  check('WPI country name → ISO3', f?.iso3 === 'TZA');
  check('WPI alt name → alias', f?.aliases[0] === 'Daressalam');
  check('WPI source ref', f?.sourceRef === 'WPI:32680');
  check('missing latitude rejected', wpiRecordToFacility(recs[1]) === null);
  check('null island rejected', wpiRecordToFacility(recs[2]) === null);
  check('parseCsv handles embedded commas', parseCsv('a,"b,c",d')[0][1] === 'b,c');
  check('pickField is case/space-insensitive', pickField({ 'PORT_NAME': 'X' }, ['Port Name']) === 'X');
}

console.log('── GEM parsing ──');
{
  check('filename → lng_terminal', gemTypeForFilename('GEM-GGIT-LNG-Terminals-2026.xlsx') === 'lng_terminal');
  check('filename → pipeline', gemTypeForFilename('gas_pipelines_tracker.xlsx') === 'pipeline');
  check('filename → power_plant', gemTypeForFilename('Global-Coal-Plant-Tracker.xlsx') === 'power_plant');
  const rec = { 'Plant name': 'Lamu Coal Power Station', Country: 'Kenya', Latitude: -2.2717, Longitude: 40.902, 'GEM unit ID': 'G1001' };
  const f = gemRecordToFacility(rec, 'power_plant');
  check('GEM row → facility', f?.name === 'Lamu Coal Power Station' && f?.iso3 === 'KEN');
  check('GEM source ref', f?.sourceRef === 'GEM:G1001');
}

console.log('── Natural Earth parsing (format verified against live dataset) ──');
{
  const feat = {
    properties: { ADMIN: 'France', ISO_A3: '-99', ADM0_A3: 'FRA', CONTINENT: 'Europe', REGION_UN: 'Europe', SUBREGION: 'Western Europe' },
    geometry: { type: 'MultiPolygon', coordinates: [] },
  };
  const c = neFeatureToCountry(feat);
  check('ISO_A3=-99 falls back to ADM0_A3', c?.iso3 === 'FRA');
  check('name from ADMIN', c?.name === 'France');
  check('missing geometry rejected', neFeatureToCountry({ properties: { ISO_A3: 'KEN', ADMIN: 'Kenya' } }) === null);
}

console.log('── Extraction normalization: geo fields ──');
{
  const cand = normalizeCandidate({
    title: 'Port deal', sector: 'strategic_infrastructure', lifecycle_stage: 'signed',
    host_country: 'Tanzania', host_country_iso3: 'not-a-code',
    named_facilities: ['  Hambantota Port ', 'Hambantota Port', '', 42],
    place_names: ['Colombo'],
  } as never);
  check('named_facilities trimmed + deduped + junk dropped', cand.named_facilities.length === 1 && cand.named_facilities[0] === 'Hambantota Port');
  check('place_names preserved', cand.place_names[0] === 'Colombo');
  check('bad iso3 code falls back to host_country name', cand.host_country_iso3 === 'TZA');
  check('normalizeIso3 accepts valid code directly', normalizeIso3('lka', null) === 'LKA');
  check('normalizeNameList caps at 8', normalizeNameList(Array.from({ length: 20 }, (_, i) => `f${i}`)).length === 8);
}

console.log('── Sponsor resolution (COSCO alias acceptance test) ──');
{
  const sponsors = [
    { id: '1', canonical_name: 'COSCO', aliases: ['COSCO Shipping', 'COSCO Shipping Ports', 'China COSCO Shipping'] },
    { id: '2', canonical_name: 'China Merchants', aliases: ['China Merchants Port', 'China Merchants Group'] },
    { id: '3', canonical_name: 'CNPC', aliases: ['China National Petroleum Corporation', 'PetroChina'] },
  ];
  check("'COSCO Shipping Ports' → COSCO", matchSponsor('COSCO Shipping Ports', sponsors)?.id === '1');
  check("'COSCO Shipping Ports Limited' → COSCO (suffix stripped)", matchSponsor('COSCO Shipping Ports Limited', sponsors)?.id === '1');
  check("'cosco' → COSCO (case)", matchSponsor('cosco', sponsors)?.id === '1');
  check("'China Merchants Port Holdings' → China Merchants (prefix)", matchSponsor('China Merchants Port Holdings', sponsors)?.id === '2');
  check("'PetroChina' → CNPC (alias)", matchSponsor('PetroChina', sponsors)?.id === '3');
  check("'CNOOC' does NOT match CNPC", matchSponsor('CNOOC', sponsors) === null);
  check("unknown sponsor → null (becomes needs_review)", matchSponsor('Acme Infrastructure Partners', sponsors) === null);
  check('suffix normalization', normalizeSponsorName('COSCO Shipping Ports Ltd.') === 'cosco shipping ports');
}

console.log('── Facility-first dedup (acceptance tests) ──');
{
  // Two headlines resolving to the same facility, same subsector, shared sponsor → MERGE
  const merge = decideFacilityDedup(
    { facilityId: 'F1', subsector: 'port terminal', sponsorKeys: ['COSCO'] },
    { facilityId: 'F1', subsector: 'Port Terminal', sponsorKeys: ['COSCO', 'China Merchants'] }
  );
  check('same facility + same subsector + sponsor overlap → merge', merge === 'merge');

  // Chinese terminal deal vs US dredging contract at the same port → DISTINCT
  const distinct = decideFacilityDedup(
    { facilityId: 'F1', subsector: 'port terminal', sponsorKeys: ['COSCO'] },
    { facilityId: 'F1', subsector: 'dredging', sponsorKeys: ['Great Lakes Dredge & Dock'] }
  );
  check('same facility + different subsector + disjoint sponsors → distinct', distinct === 'distinct');

  check('same facility + same subsector + unknown sponsors → merge', decideFacilityDedup(
    { facilityId: 'F1', subsector: 'port terminal', sponsorKeys: [] },
    { facilityId: 'F1', subsector: 'port terminal', sponsorKeys: ['COSCO'] }
  ) === 'merge');
  check('different facilities → inconclusive (title path decides)', decideFacilityDedup(
    { facilityId: 'F1', subsector: 'port', sponsorKeys: ['COSCO'] },
    { facilityId: 'F2', subsector: 'port', sponsorKeys: ['COSCO'] }
  ) === 'inconclusive');
  check('no facility on one side → inconclusive', decideFacilityDedup(
    { facilityId: null, subsector: 'port', sponsorKeys: [] },
    { facilityId: 'F1', subsector: 'port', sponsorKeys: [] }
  ) === 'inconclusive');
}

console.log('── Sponsor-driven GDELT watchlist ──');
{
  const sponsors = [
    { canonical_name: 'COSCO', is_state_backed: true, entity_type: 'soe' },
    { canonical_name: 'China Development Bank', is_state_backed: true, entity_type: 'policy_bank' },
    { canonical_name: 'Public Investment Fund', is_state_backed: true, entity_type: 'sovereign_fund' },
    { canonical_name: 'DFC', is_state_backed: true, entity_type: 'agency' },       // excluded: US agency
    { canonical_name: 'Acme Partners', is_state_backed: false, entity_type: 'private' }, // excluded: private
    ...Array.from({ length: 12 }, (_, i) => ({ canonical_name: `SOE Number ${i}`, is_state_backed: true, entity_type: 'soe' })),
  ];
  const queries = buildEntityQueriesFromSponsors(sponsors);
  const all = queries.map((q) => q.query).join(' ');
  check('agencies and private entities excluded', !all.includes('DFC') && !all.includes('Acme'));
  check('multiword names quoted', all.includes('"China Development Bank"'));
  check('every query within term budget', queries.every((q) => (q.query.match(/ OR /g) ?? []).length <= 6));
  check('every query within length budget', queries.every((q) => q.query.length < 200),
    `longest=${Math.max(...queries.map((q) => q.query.length))}`);
  check('all watch entities covered', sponsors.filter(s => s.is_state_backed && s.entity_type !== 'agency' && (s.entity_type as string) !== 'private').every(s =>
    all.includes(/\s/.test(s.canonical_name) ? `"${s.canonical_name}"` : s.canonical_name)));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
