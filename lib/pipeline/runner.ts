import { getConnectorConfigs, markConnectorRunComplete, createIngestLog, updateIngestLog } from '../db/queries';
import { getConnectorByName } from '../connectors';
import { extractDealsFromArticles, generateDealSummary } from '../llm/analyze';
import { scoreDeal } from './scoring';
import { findDuplicateDeal, mergeCandidateIntoDeal } from './deduplication';
import { upsertDeal, upsertSource, linkSourceToDeal, addDealEvent, getDealById } from '../db/queries';
import type { IngestResult, RawArticle, DealCandidate } from '../types';

export interface RunOptions {
  connectorNames?: string[]; // if omitted, runs all enabled
  lookbackDays?: number;
  skipLlm?: boolean;
}

export async function runIngestionPipeline(opts: RunOptions = {}): Promise<IngestResult[]> {
  const configs = await getConnectorConfigs();
  const enabledConfigs = configs.filter((c) =>
    c.enabled && (opts.connectorNames ? opts.connectorNames.includes(c.name) : true)
  );

  const results: IngestResult[] = [];

  for (const config of enabledConfigs) {
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

      // 2. Persist all sources first (for auditability regardless of LLM result)
      const sourceMap = new Map<string, string>(); // url → source.id
      for (const article of articles) {
        try {
          const source = await upsertSource({
            url: article.url,
            title: article.title || null,
            published_at: article.published_at,
            connector: article.connector,
            confidence_tier: article.confidence_tier,
          });
          sourceMap.set(article.url, source.id);
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
      const candidates: DealCandidate[] = await extractDealsFromArticles(articles);
      dealsFound = candidates.length;

      // 4. Process each candidate
      for (const candidate of candidates) {
        if (!candidate.title || !candidate.sector) continue;

        try {
          const dup = await findDuplicateDeal(candidate);

          if (dup && !dup.isNew) {
            // Update existing deal
            const existing = await getDealById(dup.dealId);
            if (!existing) continue;

            const merged = mergeCandidateIntoDeal(existing, candidate);
            if (Object.keys(merged).length > 0) {
              const { composite, breakdown } = await scoreDeal({ ...existing, ...merged });
              await upsertDeal({
                id: existing.id,
                ...merged,
                composite_score: composite,
                score_breakdown: breakdown,
                score_calculated_at: new Date().toISOString(),
                source_count: existing.source_count + 1,
              });
              dealsUpdated++;
            }

            // Link new sources
            for (const url of candidate.source_urls) {
              const srcId = sourceMap.get(url);
              if (srcId) await linkSourceToDeal(existing.id, srcId);
            }
          } else {
            // Create new deal
            const { composite, breakdown } = await scoreDeal(candidate as Partial<import('../types').Deal>);

            const newDeal = await upsertDeal({
              title: candidate.title,
              sponsoring_state: candidate.sponsoring_state,
              sponsoring_entities: candidate.sponsoring_entities ?? [],
              host_country: candidate.host_country,
              host_region: candidate.host_region,
              sector: candidate.sector,
              subsector: candidate.subsector,
              lifecycle_stage: candidate.lifecycle_stage ?? 'rumored',
              lifecycle_reasoning: candidate.lifecycle_reasoning,
              lifecycle_inferred_at: new Date().toISOString(),
              rom_value_usd: candidate.rom_value_usd,
              rom_basis: candidate.rom_basis,
              financial_sponsors: candidate.financial_sponsors ?? [],
              is_confirmed: candidate.is_confirmed ?? false,
              composite_score: composite,
              score_breakdown: breakdown,
              score_calculated_at: new Date().toISOString(),
              source_count: candidate.source_urls.length,
              source_confidence_tier: 2,
              status: 'active',
            });

            // Link sources
            for (const url of candidate.source_urls) {
              const srcId = sourceMap.get(url);
              if (srcId) await linkSourceToDeal(newDeal.id, srcId);
            }

            // Add timeline events from LLM-extracted key dates
            for (const evt of candidate.key_dates ?? []) {
              await addDealEvent({
                deal_id: newDeal.id,
                event_date: evt.date.slice(0, 10),
                description: evt.description,
                source_id: null,
              });
            }

            // Generate full summary if we have sources
            const dealSources = candidate.source_urls
              .map((url) => {
                const a = articles.find((x) => x.url === url);
                return a ? { id: sourceMap.get(url) ?? '', url, title: a.title, published_at: a.published_at } : null;
              })
              .filter(Boolean) as Array<{ id: string; url: string; title: string | null; published_at: string | null }>;

            if (dealSources.length > 0 && candidate.host_country) {
              const summaries = await generateDealSummary(
                newDeal.title,
                candidate.host_country,
                candidate.sponsoring_state,
                candidate.sector,
                dealSources as Parameters<typeof generateDealSummary>[4]
              );
              if (summaries) {
                await upsertDeal({
                  id: newDeal.id,
                  executive_summary: summaries.executive_summary,
                  executive_summary_generated_at: new Date().toISOString(),
                  us_diplomatic_context: summaries.us_diplomatic_context,
                  us_diplomatic_context_generated_at: new Date().toISOString(),
                });
              }
            }

            dealsCreated++;
          }
        } catch {
          // skip failed candidate; continue pipeline
        }
      }

      await markConnectorRunComplete(config.name);
      await updateIngestLog(logId, {
        status: 'success',
        deals_found: dealsFound,
        deals_created: dealsCreated,
        deals_updated: dealsUpdated,
      });

      results.push(connector.buildResult(dealsFound, dealsCreated, dealsUpdated, Date.now() - t0));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await updateIngestLog(logId, { status: 'error', error_message: message });
      results.push(connector.buildResult(dealsFound, dealsCreated, dealsUpdated, Date.now() - t0, message));
    }
  }

  return results;
}
