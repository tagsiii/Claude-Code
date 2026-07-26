// Phase-2 parser tests: AidData, EEZ, WB Projects API, USTDA feed, DFC/EXIM/
// MCC/PPI files, OECD CRS rows, country-in-text scanning, shpjs runtime.
// Fixtures mirror the verified live formats (AidData sample project, user
// probe captures of WB/USTDA responses).

import { aidDataProjectToRow, eezFeatureToRow, wbProjectToMdb, ustdaPostToActivity,
  dfcRecordToActivity, eximRecordToActivity, mccRecordToActivity, ppiRecordToMdb,
  oecdCsvRowToFinance, inferSector } from '../lib/geo/activityParsers.ts';
import { findCountryInText } from '../lib/data/countryCodes.ts';
import { xmlToRecords, xmlTagSummary } from '../lib/geo/parsers.ts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}

console.log('── AidData GCDF (fixture = verified live project 35756) ──');
{
  const fc = {
    features: [{
      properties: {
        id: 35756, feature_count: 1,
        Recipient: "Lao People's Democratic Republic", 'Recipient.ISO-3': 'LAO',
        Title: "China Eximbank provides $32 million preferential buyer's credit for Wattay Airport",
        'Amount.(Constant.USD.2021)': 39390602.4479984, Status: 'Completion',
        'Sector.Name': 'TRANSPORT AND STORAGE', 'Commitment.Year': 2011,
      },
      geometry: { type: 'MultiPolygon', coordinates: [] },
    }],
  };
  const row = aidDataProjectToRow(fc as never);
  check('project parsed', row !== null && row.projectRef === '35756');
  check('iso3 from Recipient.ISO-3', row?.iso3 === 'LAO');
  check('amount rounded to integer USD', row?.commitmentUsd === 39390602);
  check('year + status + sector', row?.year === 2011 && row?.status === 'Completion' && row?.sector === 'TRANSPORT AND STORAGE');
  const multi = aidDataProjectToRow({
    features: [
      { properties: { id: 1, Title: 'Rail A' }, geometry: { type: 'LineString', coordinates: [] } },
      { properties: {}, geometry: { type: 'Point', coordinates: [0, 1] } },
    ],
  } as never);
  check('multi-feature → GeometryCollection', multi !== null && multi.geometryJson.includes('GeometryCollection'));
  check('empty featureset rejected', aidDataProjectToRow({ features: [] }) === null);
}

console.log('── EEZ (World EEZ shapefile properties) ──');
{
  const row = eezFeatureToRow({
    properties: { GEONAME: 'Kenyan Exclusive Economic Zone', SOVEREIGN1: 'Kenya', MRGID: 8340 },
    geometry: { type: 'MultiPolygon', coordinates: [] },
  });
  check('EEZ feature parsed', row?.name === 'Kenyan Exclusive Economic Zone' && row?.sovereign === 'Kenya');
  check('EEZ without geometry rejected', eezFeatureToRow({ properties: { GEONAME: 'X' } }) === null);
}

console.log('── World Bank Projects API (fixture = probe capture shape) ──');
{
  const p = {
    id: 'P513206', proj_id: 'P513206', countryshortname: 'Philippines',
    boardapprovaldate: '2100-09-30T00:00:00Z', curr_ibrd_commitment: '647000000',
    project_name: 'Philippines Infrastructure Modernization',
  };
  const row = wbProjectToMdb(p);
  check('WB project parsed', row?.projectRef === 'P513206' && row?.bank === 'WB');
  check('country → ISO3', row?.iso3 === 'PHL');
  check('future board date + no status → pipeline', row?.status === 'pipeline');
  check('commitment parsed from string', row?.valueUsd === 647000000);
  check('explicit closed status honored', wbProjectToMdb({ id: 'P1', status: 'Closed', countryshortname: 'Kenya' })?.status === 'closed');
  check('id required', wbProjectToMdb({ project_name: 'X' }) === null);
}

console.log('── USTDA press feed (standard WP REST shape) ──');
{
  const post = {
    title: { rendered: 'USTDA Funds Feasibility Study for Port Expansion in Kenya' },
    link: 'https://www.ustda.gov/x', date: '2026-07-15T17:03:26',
    excerpt: { rendered: '<p>Grant supports the Port of Mombasa&#8217;s expansion planning.</p>' },
  };
  const row = ustdaPostToActivity(post);
  check('feasibility study detected', row !== null && row.recordType === 'feasibility_study');
  check('leading indicator set', row?.isLeadingIndicator === true);
  check('country extracted from text', row?.iso3 === 'KEN');
  check('sector inferred (ports)', row?.sector === 'ports');
  check('date normalized', row?.announcedDate === '2026-07-15');
  check('non-signal post skipped', ustdaPostToActivity({ title: { rendered: 'USTDA Deputy Director Speaks at Conference' } }) === null);
  check('signal without country skipped', ustdaPostToActivity({ title: { rendered: 'USTDA announces new grant program' } }) === null);
}

console.log('── Agency files (tolerant parsing) ──');
{
  const dfc = dfcRecordToActivity({ 'Project Name': 'Lobito Rail Refinancing', Country: 'Angola', 'Committed (US$ millions)': 250, Sector: 'Transport', 'Fiscal Year': '2024' });
  check('DFC row parsed', dfc?.agency === 'DFC' && dfc?.iso3 === 'AGO');
  check('DFC millions header scaled', dfc?.valueUsd === 250_000_000);
  check('DFC fiscal year → date', dfc?.announcedDate === '2024-01-01');

  const exim = eximRecordToActivity({ 'Primary Borrower': 'Bharat Power Ltd', 'Primary Country': 'India', 'Authorized Amount': '1,200,000', 'Authorization Date': '2025-03-12' });
  check('EXIM row parsed', exim?.agency === 'EXIM' && exim?.recordType === 'authorization' && exim?.iso3 === 'IND');
  check('EXIM comma value parsed', exim?.valueUsd === 1_200_000);

  const mcc = mccRecordToActivity({ 'Compact Name': 'Benin Power Compact', Country: 'Benin', 'Compact Amount': 375_000_000 });
  check('MCC row parsed', mcc?.agency === 'MCC' && mcc?.recordType === 'compact' && mcc?.iso3 === 'BEN');

  const ppi = ppiRecordToMdb({ 'Project Name': 'Manila Water PPP', Country: 'Philippines', 'Project Status': 'Under construction... active', 'Total Investment (US$ millions)': 500, 'Project ID': '9001' });
  check('PPI row parsed', ppi?.bank === 'WB-PPI' && ppi?.projectRef === '9001' && ppi?.iso3 === 'PHL');
  check('PPI millions scaled', ppi?.valueUsd === 500_000_000);
  check('PPI cancelled → closed', ppiRecordToMdb({ 'Project Name': 'X', Country: 'Kenya', 'Project Status': 'Cancelled' })?.status === 'closed');
  check('country-less rows rejected', dfcRecordToActivity({ 'Project Name': 'X' }) === null);
}

console.log('── OECD CRS rows ──');
{
  const row = oecdCsvRowToFinance({ DONOR: 'JPN', RECIPIENT: 'KEN', SECTOR: '1000', TIME_PERIOD: '2022', OBS_VALUE: '123.4' });
  check('CRS row parsed', row?.donor === 'JPN' && row?.iso3 === 'KEN' && row?.year === 2022);
  check('millions scaled to USD', row?.commitmentUsd === 123_400_000);
  check('recipient name resolved when not a code', oecdCsvRowToFinance({ DONOR: 'KOR', RECIPIENT: 'Kenya', TIME_PERIOD: '2021', OBS_VALUE: '5' })?.iso3 === 'KEN');
  check('missing value rejected', oecdCsvRowToFinance({ DONOR: 'JPN', RECIPIENT: 'KEN', TIME_PERIOD: '2022', OBS_VALUE: '' }) === null);
}

console.log('── Country-in-text + sector inference ──');
{
  check('longest name wins (South Sudan over Sudan)', findCountryInText('New grant program in South Sudan announced')?.iso3 === 'SSD');
  check('case-insensitive', findCountryInText('PARTNERSHIP WITH SRI LANKA')?.iso3 === 'LKA');
  check('no false positive on unrelated text', findCountryInText('Quarterly results improve margins') === null);
  check('sector: nuclear beats power ordering', inferSector('nuclear power plant study') === 'nuclear');
  check('sector: unknown → null', inferSector('miscellaneous administrative notice') === null);
}

console.log('── shpjs loads under this runtime (EEZ loader dependency) ──');
{
  (globalThis as { self?: unknown }).self = globalThis;
  const m = await import('shpjs');
  const d = (m as { default?: unknown }).default;
  check('default export is callable', typeof d === 'function');
  check('parseZip export present', typeof (m as never as Record<string, unknown>).parseZip === 'function');
}


console.log('── Flat-XML parsing (EXIM FOIA style) ──');
{
  const elementXml = `<?xml version="1.0"?><Report><Meta>FY2023</Meta>
    <Authorization><Country>Kenya</Country><PrimaryBorrower>Acme Power Ltd</PrimaryBorrower><AuthorizedAmount>1,200,000</AuthorizedAmount></Authorization>
    <Authorization><Country>India</Country><PrimaryBorrower>Bharat Rail</PrimaryBorrower><AuthorizedAmount>5&amp;500</AuthorizedAmount></Authorization>
  </Report>`;
  const recs = xmlToRecords(elementXml);
  check('element-children XML → records', recs.length === 2 && recs[0]['Country'] === 'Kenya');
  check('XML entities decoded', recs[1]['AuthorizedAmount'] === '5&500');
  check('EXIM parser consumes XML records', eximRecordToActivity(recs[0] as never)?.iso3 === 'KEN');

  const attrXml = `<data><row Country="Benin" Program="Power Compact" Amount="375"/><row Country="Ghana" Program="Roads" Amount="12"/></data>`;
  const attrRecs = xmlToRecords(attrXml);
  check('attribute-row XML → records', attrRecs.length === 2 && attrRecs[1]['Country'] === 'Ghana');
  check('tag summary names frequent tags', xmlTagSummary(elementXml).includes('Authorization(2)'));
  check('empty/unstructured XML → []', xmlToRecords('<a>plain text only</a>').length === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
