// Phase-4 tests: spatial flag score contributions (fixed documented points),
// flag change detection, white-space diffing, CSV building, and the email's
// white-space section rendering.

import {
  spatialBonus, anyFlagSet, flagsChanged, newlyRaisedFlags,
  SPATIAL_PRIORITY_POINTS, SPATIAL_ACTIONABILITY_POINTS, FLAG_KEYS,
} from '../lib/pipeline/spatialFlags.ts';
import { diffWhiteSpace, toCsv } from '../lib/gaps.ts';
import { buildDailyEmailHtml } from '../lib/email/templates.ts';
import type { Deal } from '../lib/types.ts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}

console.log('── Spatial score contributions (fixed, documented) ──');
{
  const none = spatialBonus({}, SPATIAL_PRIORITY_POINTS);
  check('no flags → no bonus', none.bonus === 0 && none.notes.length === 0);

  const priority = spatialBonus(
    { flag_near_cable_landing: true, flag_contested_asset: true, flag_white_space: true },
    SPATIAL_PRIORITY_POINTS
  );
  check('priority: cable(12) + contested(12) + white space(10) = 34', priority.bonus === 34);
  check('priority notes name each flag', priority.notes.length === 3 && priority.notes[0].startsWith('+12'));

  const action = spatialBonus(
    { flag_us_positioning: true, flag_unpositioned_mdb: true, flag_white_space: true },
    SPATIAL_ACTIONABILITY_POINTS
  );
  check('actionability: positioning(10) + mdb(8) + white space(5) = 23', action.bonus === 23);

  const crossed = spatialBonus({ flag_us_positioning: true }, SPATIAL_PRIORITY_POINTS);
  check('actionability-only flag adds nothing to priority', crossed.bonus === 0);

  check('false flags contribute nothing',
    spatialBonus({ flag_white_space: false } as Partial<Deal>, SPATIAL_PRIORITY_POINTS).bonus === 0);
}

console.log('── Flag change detection ──');
{
  check('anyFlagSet false on empty', !anyFlagSet({}) && !anyFlagSet(null));
  check('anyFlagSet true on one flag', anyFlagSet({ flag_white_space: true }));

  const prev = { flag_white_space: true, flag_us_positioning: false } as Partial<Deal>;
  check('no change when identical', !flagsChanged(prev, { flag_white_space: true, flag_us_positioning: false }));
  check('raise detected', flagsChanged(prev, { flag_white_space: true, flag_us_positioning: true }));
  check('clear detected', flagsChanged(prev, { flag_white_space: false }));

  const raised = newlyRaisedFlags(prev, {
    flag_white_space: true, // already set — not "newly" raised
    flag_us_positioning: true,
    flag_us_positioning_reason: 'USTDA leading indicator in-country: "Feasibility study"',
  });
  check('only newly-true flags reported', raised.length === 1 && raised[0].key === 'flag_us_positioning');
  check('reason text carried', raised[0].reason.includes('Feasibility study'));
  check('all five flags covered by keys', FLAG_KEYS.length === 5);
}

console.log('── White-space diff (email change detection) ──');
{
  const first = diffWhiteSpace(['KEN', 'LAO'], null);
  check('first run (no snapshot) → silent baseline', !first.changed && first.added.length === 0);

  const same = diffWhiteSpace(['KEN', 'LAO'], ['LAO', 'KEN']);
  check('unchanged set → silent (order-insensitive)', !same.changed);

  const moved = diffWhiteSpace(['KEN', 'PAK'], ['KEN', 'LAO']);
  check('added country detected', moved.added.length === 1 && moved.added[0] === 'PAK');
  check('removed country detected', moved.removed.length === 1 && moved.removed[0] === 'LAO');
  check('changed flag set', moved.changed);

  check('empty current, prior rows → all removed',
    diffWhiteSpace([], ['KEN']).removed.length === 1 && diffWhiteSpace([], ['KEN']).changed);
}

console.log('── CSV builder ──');
{
  const csv = toCsv(
    [
      { iso3: 'KEN', name: 'Kenya', usd: 1200000000 },
      { iso3: 'LAO', name: 'Lao, "PDR"', usd: null },
    ],
    [
      { key: 'iso3', label: 'ISO3' },
      { key: 'name', label: 'Country' },
      { key: 'usd', label: 'USD' },
    ]
  );
  const lines = csv.split('\r\n');
  check('header row', lines[0] === 'ISO3,Country,USD');
  check('plain row unquoted', lines[1] === 'KEN,Kenya,1200000000');
  check('commas + quotes escaped', lines[2] === 'LAO,"Lao, ""PDR""",');
}

console.log('── Email white-space section ──');
{
  const deal = {
    id: 'x', title: 'Test Deal', sector: 'energy', lifecycle_stage: 'signed',
    composite_score: 75, score_breakdown: null, financial_sponsors: [],
    executive_summary: 'Summary.', sponsoring_state: 'China',
    rom_value_usd: null, source_count: 1,
  } as unknown as Deal;

  const withDiff = buildDailyEmailHtml([deal], 'https://x.test/dashboard', '2026-07-29', {
    added: [{ iso3: 'KEN', name: 'Kenya', cnUsd: 2_400_000_000 }],
    removed: [{ iso3: 'LAO', name: 'Laos' }],
  });
  check('section renders when diff present', withDiff.includes('WHITE SPACE — CHANGES SINCE LAST BRIEF'));
  check('added country with $B and link', withDiff.includes('Kenya') && withDiff.includes('$2.4B') && withDiff.includes('host_country=KEN'));
  check('removed country listed', withDiff.includes('Laos') && withDiff.includes('no longer white space'));

  const without = buildDailyEmailHtml([deal], 'https://x.test/dashboard', '2026-07-29', null);
  check('section absent when no diff', !without.includes('WHITE SPACE — CHANGES'));
  check('deal block still renders', without.includes('Test Deal'));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
