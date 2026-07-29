import Link from 'next/link';
import { getWhiteSpaceRows, getUnpositionedRows, getConcentrationRows } from '@/lib/db/queries';
import { toCsv } from '@/lib/gaps';
import { formatUsd } from '@/lib/utils/format';
import { CsvDownloadButton } from '@/components/CsvDownloadButton';

export const dynamic = 'force-dynamic';

// Gap analysis: where is China contesting the space and the US absent?
// All three tables read pre-computed materialized views (refreshed after each
// scan and by npm run recompute:spatial) — zero AI, fully explainable.
export default async function GapsPage() {
  const [ws, up, conc] = await Promise.all([
    getWhiteSpaceRows(),
    getUnpositionedRows(),
    getConcentrationRows(),
  ]);

  const setupNeeded = [ws.error, up.error, conc.error].some(
    (e) => e && /does not exist|schema cache/i.test(e)
  );
  const otherError = [ws.error, up.error, conc.error].find(
    (e) => e && !/does not exist|schema cache/i.test(e)
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Gaps</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Where Chinese state-backed money is concentrated and US presence is missing.
          Click a country to see its tracked deals.
        </p>
      </div>

      {setupNeeded && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          Gap views not set up yet — run <code className="font-mono">lib/db/geo4.sql</code> in the
          Supabase SQL editor, then <code className="font-mono">npm run recompute:spatial</code>.
        </div>
      )}
      {otherError && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          Could not load gap views: {otherError}
        </div>
      )}

      {/* White space */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">White space countries</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Top tier of cumulative Chinese commitments (≥ 60th percentile) with{' '}
              <span className="font-medium">zero recorded US activity</span>.
            </p>
          </div>
          {ws.rows.length > 0 && (
            <CsvDownloadButton
              filename="white-space.csv"
              csv={toCsv(ws.rows as never, [
                { key: 'iso3', label: 'ISO3' },
                { key: 'country_name', label: 'Country' },
                { key: 'cn_usd', label: 'Chinese Commitments (USD)' },
                { key: 'cn_count', label: 'Projects' },
                { key: 'latest_year', label: 'Latest Year' },
              ])}
            />
          )}
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-2.5 font-medium">Country</th>
                <th className="px-4 py-2.5 font-medium text-right">Chinese commitments</th>
                <th className="px-4 py-2.5 font-medium text-right">Projects</th>
                <th className="px-4 py-2.5 font-medium text-right">Latest year</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {ws.rows.map((r) => (
                <tr key={r.iso3} className="border-b border-border/60 last:border-0 hover:bg-secondary/40 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.country_name}</td>
                  <td className="px-4 py-2.5 text-right font-mono-numbers text-violet-600 dark:text-violet-400">
                    {formatUsd(r.cn_usd)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-numbers">{r.cn_count}</td>
                  <td className="px-4 py-2.5 text-right font-mono-numbers">{r.latest_year ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/dashboard?host_country=${r.iso3}`} className="text-primary hover:underline text-xs">
                      Deals →
                    </Link>
                  </td>
                </tr>
              ))}
              {ws.rows.length === 0 && !setupNeeded && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">
                  No white-space countries — either US activity data covers every top-tier country, or reference data is still loading.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Unpositioned MDB pipeline */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Unpositioned MDB pipeline</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upcoming multilateral development bank projects with no matching-sector US activity in the country.
            </p>
          </div>
          {up.rows.length > 0 && (
            <CsvDownloadButton
              filename="unpositioned-pipeline.csv"
              csv={toCsv(up.rows as never, [
                { key: 'bank', label: 'Bank' },
                { key: 'project_ref', label: 'Ref' },
                { key: 'name', label: 'Project' },
                { key: 'country_name', label: 'Country' },
                { key: 'sector', label: 'Sector' },
                { key: 'value_usd', label: 'Value (USD)' },
              ])}
            />
          )}
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-4 py-2.5 font-medium">Country</th>
                <th className="px-4 py-2.5 font-medium">Sector</th>
                <th className="px-4 py-2.5 font-medium text-right">Value</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {up.rows.slice(0, 40).map((r) => (
                <tr key={`${r.bank}-${r.project_ref}`} className="border-b border-border/60 last:border-0 hover:bg-secondary/40 transition-colors">
                  <td className="px-4 py-2.5 text-foreground max-w-md">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted-foreground text-xs"> · {r.bank}</span>
                  </td>
                  <td className="px-4 py-2.5">{r.country_name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.sector ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono-numbers">
                    {r.value_usd ? formatUsd(r.value_usd) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/dashboard?host_country=${r.iso3}`} className="text-primary hover:underline text-xs">
                      Deals →
                    </Link>
                  </td>
                </tr>
              ))}
              {up.rows.length === 0 && !setupNeeded && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">
                  No unpositioned pipeline projects — load MDB data with npm run sync:wb / load:ppi.
                </td></tr>
              )}
            </tbody>
          </table>
          {up.rows.length > 40 && (
            <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
              Showing top 40 of {up.rows.length} by value — export the CSV for the full list.
            </div>
          )}
        </div>
      </section>

      {/* Sector concentration */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sector concentration</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Countries where ≥40% of Chinese money (of a ≥$500M total) targets a single sector.
            </p>
          </div>
          {conc.rows.length > 0 && (
            <CsvDownloadButton
              filename="sector-concentration.csv"
              csv={toCsv(conc.rows as never, [
                { key: 'iso3', label: 'ISO3' },
                { key: 'country_name', label: 'Country' },
                { key: 'sector', label: 'Sector' },
                { key: 'usd', label: 'USD' },
                { key: 'cnt', label: 'Projects' },
                { key: 'share_pct', label: 'Share %' },
              ])}
            />
          )}
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-2.5 font-medium">Country</th>
                <th className="px-4 py-2.5 font-medium">Sector</th>
                <th className="px-4 py-2.5 font-medium text-right">Chinese $</th>
                <th className="px-4 py-2.5 font-medium text-right">Share</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {conc.rows.slice(0, 40).map((r) => (
                <tr key={`${r.iso3}-${r.sector}`} className="border-b border-border/60 last:border-0 hover:bg-secondary/40 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.country_name}</td>
                  <td className="px-4 py-2.5">{r.sector}</td>
                  <td className="px-4 py-2.5 text-right font-mono-numbers text-violet-600 dark:text-violet-400">
                    {formatUsd(r.usd)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono-numbers">{r.share_pct}%</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/dashboard?host_country=${r.iso3}`} className="text-primary hover:underline text-xs">
                      Deals →
                    </Link>
                  </td>
                </tr>
              ))}
              {conc.rows.length === 0 && !setupNeeded && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">
                  No concentration signals yet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
