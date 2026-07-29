import { getConnectorConfigs, markConnectorRunComplete, createIngestLog, updateIngestLog } from '../db/queries';
import { getConnectorByName } from '../connectors';
import { extractDealsFromArticles } from '../llm/analyze';
import { upsertSource } from '../db/queries';
import { ingestCandidate, type IngestSourceRef } from './ingestCandidate';
import { refreshGapViews } from './spatialFlags';
import type { IngestResult, RawArticle } from '../types';

export interface RunOptions {
  connectorNames?: string[]; // if omitted, runs all enabled
  lookbackDays?: number;
  skipLlm?: boolean;
  // Wall-clock budget. On Vercel a hard function timeout kills the process
  // mid-run and leaves ingest_logs rows stuck at 'running' forever — so the
  // pipeline stops itself before that and finalizes cleanly. Deals dedup is
  // idempotent: whatever gets deferred is picked up by the next scan.
  budgetMs?: number;
}

export async function runIngestionPipeline(opts: RunOptions = {}): Promise<IngestResult[]> {
  // The tight default budget exists for Vercel's hard function timeout. On a
  // local machine (npm run dev) there is no platform timeout — a manual scan
  // should run to completion, not get truncated at 4.5 minutes.
  const defaultBudget = process.env.VERCEL ? 270_000 : 1_800_000;
  const deadline = Date.now() + (opts.budgetMs ?? defaultBudget);
  const configs = await getConnectorConfigs();
  const enabledConfigs = configs.filter((c) =>
    c.enabled && (opts.connectorNames ? opts.connectorNames.includes(c.name) : true)
  );

  const results: IngestResult[] = [];

  for (const config of enabledConfigs) {
    if (Date.now() > deadline) break; // next scan picks this connector up
    const connector = getConnectorByName(config.name);
    if (!connector || !connector.isAvailable()) continue;

    const logId = await createIngestLog(config.name);
    const t0 = Date.now();
    let dealsCreated = 0;
    let dealsUpdated = 0;
    let dealsFound = 0;

    try {
      // 1. Fetch raw articles
      const articles: RawArticle[] = await connector.fetchArticles({
        lookbackDays: opts.lookbackDays ?? 7,
      });
      const connectorWarnings = connector.getWarnings();

      // 2. Persist all sources first (for auditability regardless of LLM result)
      const sourcesByUrl = new Map<string, IngestSourceRef>();
      for (const article of articles) {
        try {
          const source = await upsertSource({
            url: article.url,
            title: article.title || null,
            published_at: article.published_at,
            connector: article.connector,
            confidence_tier: article.confidence_tier,
          });
          sourcesByUrl.set(article.url, {
            id: source.id,
            url: article.url,
            title: article.title || null,
            published_at: article.published_at,
          });
        } catch {
          // skip duplicate or errored source
        }
      }

      if (opts.skipLlm) {
        await updateIngestLog(logId, {
          status: 'success',
          deals_found: 0,
          deals_created: 0,
          deals_updated: 0,
        });
        results.push(connector.buildResult(0, 0, 0, Date.now() - t0));
        continue;
      }

      // 3. LLM: extract deal candidates from article titles
      const { candidates, errors: llmErrors } = await extractDealsFromArticles(articles);
      dealsFound = candidates.length;

      // 4. Process each candidate through the shared running-tab pipeline.
      // Collect (don't swallow) per-candidate failures — a vanished deal with
      // no trace is undebuggable.
      const candidateErrors: string[] = [];
      const geoWarnings: string[] = [];
      let deferred = 0;
      let processed = 0;
      for (const candidate of candidates) {
        if (Date.now() > deadline) {
          deferred = candidates.length - processed;
          break;
        }
        try {
          const outcome = await ingestCandidate(candidate, {
            sourcesByUrl,
            sourceConfidenceTier: 2,
            generateSummaries: true,
            warnings: geoWarnings,
          });
          if (outcome === 'created') dealsCreated++;
          else if (outcome === 'updated') dealsUpdated++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          candidateErrors.push(`${candidate.title || 'untitled'}: ${msg}`.slice(0, 200));
        }
        processed++;
      }

      await markConnectorRunComplete(config.name);
      await updateIngestLog(logId, {
        status: 'success',
        deals_found: dealsFound,
        deals_created: dealsCreated,
        deals_updated: dealsUpdated,
        metadata: {
          // Funnel visibility: how many raw articles this scan actually saw.
          articles_scanned: articles.length,
        },
        ...(candidateErrors.length > 0 || llmErrors.length > 0 || connectorWarnings.length > 0 || geoWarnings.length > 0 || deferred > 0
          ? {
              metadata: {
                articles_scanned: articles.length,
                ...(connectorWarnings.length > 0 ? { connector_warnings: connectorWarnings.slice(0, 8) } : {}),
                ...(llmErrors.length > 0 ? { llm_errors: llmErrors.slice(0, 6) } : {}),
                ...(candidateErrors.length > 0 ? { candidate_errors: candidateErrors.slice(0, 12) } : {}),
                ...(geoWarnings.length > 0 ? { geo_warnings: [...new Set(geoWarnings)].slice(0, 6) } : {}),
                ...(deferred > 0
                  ? { connector_warnings: [
                      ...connectorWarnings.slice(0, 7),
                      `time budget reached — ${deferred} candidate(s) deferred to the next scan`,
                    ] }
                  : {}),
              },
            }
          : {}),
      });

      results.push(connector.buildResult(dealsFound, dealsCreated, dealsUpdated, Date.now() - t0));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateIngestLog(logId, { status: 'error', error_message: message });
      results.push(connector.buildResult(dealsFound, dealsCreated, dealsUpdated, Date.now() - t0, message));
    }
  }

  // Phase 4: gap views feed the white-space flag, the Gaps page, and the email
  // diff — refresh after every scan so they track the latest activity data.
  if (!opts.skipLlm && results.length > 0) await refreshGapViews();

  return results;
}
