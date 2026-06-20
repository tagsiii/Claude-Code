import { callClaude, isLlmAvailable } from './client';
import {
  DEAL_EXTRACTION_SYSTEM,
  DEAL_SUMMARY_SYSTEM,
  buildExtractionPrompt,
  buildSummaryPrompt,
} from './prompts';
import type { RawArticle, DealCandidate, Source } from '../types';

const BATCH_SIZE = 60; // articles per LLM call

export async function extractDealsFromArticles(
  articles: RawArticle[]
): Promise<DealCandidate[]> {
  if (!isLlmAvailable() || articles.length === 0) return [];

  const allCandidates: DealCandidate[] = [];

  // Process in batches to stay within token limits
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    try {
      const prompt = buildExtractionPrompt(batch);
      const response = await callClaude(DEAL_EXTRACTION_SYSTEM, prompt, 8000);

      const parsed = parseJsonSafely<DealCandidate[]>(response);
      if (Array.isArray(parsed)) {
        // Attach source URLs from the batch for each candidate
        for (const candidate of parsed) {
          // Resolve source URLs: the LLM cites URLs from the batch
          const validUrls = (candidate.source_urls ?? []).filter((url: string) =>
            batch.some((a) => a.url === url)
          );
          candidate.source_urls = validUrls.length > 0
            ? validUrls
            : batch.slice(0, 2).map((a) => a.url); // fallback to first 2 in batch
          allCandidates.push(candidate);
        }
      }
    } catch {
      // skip failed batch
    }

    // Avoid hammering the API between batches
    if (i + BATCH_SIZE < articles.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return allCandidates;
}

export async function generateDealSummary(
  dealTitle: string,
  hostCountry: string,
  sponsoringState: string | null,
  sector: string,
  sources: Source[]
): Promise<{ executive_summary: string; us_diplomatic_context: string } | null> {
  if (!isLlmAvailable() || sources.length === 0) return null;

  try {
    const prompt = buildSummaryPrompt(dealTitle, hostCountry, sponsoringState, sector, sources);
    const response = await callClaude(DEAL_SUMMARY_SYSTEM, prompt, 2048);
    const parsed = parseJsonSafely<{ executive_summary: string; us_diplomatic_context: string }>(response);
    if (parsed?.executive_summary && parsed?.us_diplomatic_context) return parsed;
  } catch {
    // fall through
  }
  return null;
}

export async function inferLifecycleStage(
  dealTitle: string,
  articleTitles: string[],
  currentStage: string
): Promise<{ stage: string; reasoning: string } | null> {
  if (!isLlmAvailable()) return null;

  const systemPrompt = `You are an economic statecraft analyst. Infer the most likely current lifecycle stage of a cross-border infrastructure deal based on article titles and the typical progression of such deals.

Lifecycle stages (in order):
- rumored: Speculation, analyst commentary, no official confirmation
- exploratory_mou: Feasibility studies, MOU signed, official talks announced
- negotiation: Active contract negotiation, terms being finalized
- signed: Contract/agreement formally signed
- financing_secured: Loan agreement signed, funds committed by lender
- under_construction: Construction/implementation actively underway
- completed: Project complete and operational
- cancelled: Deal collapsed or officially cancelled

Consider: language used in headlines (e.g., "signs deal" → signed; "breaks ground" → under_construction; "in talks" → negotiation; "eyes deal" → rumored/exploratory). Weight recent articles more heavily.

Return JSON: {"stage": "lifecycle_stage_value", "reasoning": "1-2 sentence explanation citing specific language"}`;

  const userMessage = `Deal: ${dealTitle}
Current stage: ${currentStage}
Recent article titles:
${articleTitles.slice(0, 10).map((t, i) => `${i + 1}. ${t}`).join('\n')}`;

  try {
    const response = await callClaude(systemPrompt, userMessage, 512);
    return parseJsonSafely<{ stage: string; reasoning: string }>(response);
  } catch {
    return null;
  }
}

function parseJsonSafely<T>(text: string): T | null {
  try {
    // Strip markdown code blocks if present
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to extract JSON array or object from mixed text
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]) as T; } catch { /* ignore */ }
    }
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]) as T; } catch { /* ignore */ }
    }
    return null;
  }
}
