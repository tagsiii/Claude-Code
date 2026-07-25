// Run every reference loader in dependency order, continuing past failures.
import { spawnSync } from 'node:child_process';

const LOADERS = ['load-countries.mts', 'load-wpi.mts', 'load-gem.mts', 'load-cables.mts'];
const results: Array<{ loader: string; ok: boolean }> = [];

for (const loader of LOADERS) {
  console.log(`\n══ ${loader} ══`);
  const r = spawnSync('npx', ['--yes', 'tsx', `scripts/loaders/${loader}`], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  results.push({ loader, ok: r.status === 0 });
}

console.log('\n══ Summary ══');
for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.loader}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
