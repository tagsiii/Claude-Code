// Run every reference loader in dependency order, continuing past failures.
import { spawnSync } from 'node:child_process';

const LOADERS = [
  'load-countries.mts', 'load-wpi.mts', 'load-gem.mts', 'load-cables.mts',
  // Phase 2 activity layers (file-based ones skip cleanly when files absent)
  'load-aiddata.mts', 'load-eez.mts',
  'load-activity-file.mts dfc', 'load-activity-file.mts exim',
  'load-activity-file.mts ppi',
  'sync-ustda.mts', 'sync-wb.mts', 'sync-mcc.mts', 'sync-oecd.mts',
];
const results: Array<{ loader: string; ok: boolean }> = [];

for (const loader of LOADERS) {
  console.log(`\n══ ${loader} ══`);
  const parts = loader.split(' ');
  const r = spawnSync('npx', ['--yes', 'tsx', `scripts/loaders/${parts[0]}`, ...parts.slice(1)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  results.push({ loader, ok: r.status === 0 });
}

console.log('\n══ Summary ══');
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.loader}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
