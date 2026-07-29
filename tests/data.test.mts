// Data-browser tests: registry sanity (whitelist integrity) and the
// Excel-ish filter-input parser that turns box text into query operations.

import { DATASETS, parseFilterInput } from '../lib/data/datasets.ts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}

console.log('── Dataset registry sanity ──');
{
  const keys = Object.keys(DATASETS);
  check('10 datasets registered', keys.length === 10);
  check('registry keys match dataset.key', keys.every((k) => DATASETS[k].key === k));
  for (const d of Object.values(DATASETS)) {
    check(`${d.key}: defaultSort is a real column`, d.columns.some((c) => c.key === d.defaultSort));
    check(`${d.key}: no geometry columns exposed`,
      d.columns.every((c) => !/^(geom|centroid|geom_point|geom_display)$/.test(c.key)));
    check(`${d.key}: column keys unique`, new Set(d.columns.map((c) => c.key)).size === d.columns.length);
  }
  check('deals rows link to detail page',
    DATASETS.deals.rowLinkPrefix === '/dashboard/deals/' && DATASETS.deals.rowLinkKey === 'id');
  check('array columns are not filterable',
    DATASETS.sponsors.columns.find((c) => c.key === 'aliases')?.filterable === false &&
    DATASETS.cables.columns.find((c) => c.key === 'owners')?.filterable === false);
}

console.log('── Filter parsing: text ──');
{
  check('empty → no ops', parseFilterInput('', 'text').length === 0 && parseFilterInput('  ', 'text').length === 0);
  const t = parseFilterInput('port', 'text');
  check('bare text → contains', t.length === 1 && t[0].op === 'ilike' && t[0].value === '%port%');
  const dangerous = parseFilterInput('a,b(c)"d\'e%f', 'text');
  check('PostgREST-structural chars stripped', dangerous[0].op === 'ilike' &&
    !String(dangerous[0].value).match(/[,()"'%]{2}/) && String(dangerous[0].value).includes('a b'));
}

console.log('── Filter parsing: number ──');
{
  const gt = parseFilterInput('>1000000', 'number');
  check('>N → at least', gt.length === 1 && gt[0].op === 'gte' && gt[0].value === 1000000);
  const lt = parseFilterInput('<50', 'number');
  check('<N → at most', lt[0].op === 'lte' && lt[0].value === 50);
  const eq = parseFilterInput('2024', 'number');
  check('bare → equals', eq[0].op === 'eq' && eq[0].value === 2024);
  const range = parseFilterInput('50..70', 'number');
  check('range → gte + lte', range.length === 2 && range[0].op === 'gte' && range[0].value === 50 && range[1].op === 'lte' && range[1].value === 70);
  const commas = parseFilterInput('>1,000,000', 'number');
  check('commas tolerated', commas[0].value === 1000000);
  check('garbage → no ops', parseFilterInput('abc', 'number').length === 0 && parseFilterInput('>abc', 'number').length === 0);
}

console.log('── Filter parsing: date + boolean ──');
{
  const d = parseFilterInput('2024-01-01', 'date');
  check('bare date → on/after', d[0].op === 'gte' && d[0].value === '2024-01-01');
  check('<date → before', parseFilterInput('<2025-06-01', 'date')[0].op === 'lte');
  check('yes/true/1 → true', ['yes', 'true', '1', 'Y'].every((v) => parseFilterInput(v, 'boolean')[0]?.value === true));
  check('no/false/0 → false', ['no', 'false', '0'].every((v) => parseFilterInput(v, 'boolean')[0]?.value === false));
  check('boolean garbage → no ops', parseFilterInput('maybe', 'boolean').length === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
