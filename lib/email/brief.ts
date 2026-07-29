// Builds and sends the daily brief: top-3 deals + the Phase-4 "white space
// changes" section. Shared by the scheduled cron route and the Config page's
// "Send test brief" button. The white-space section only appears when the set
// CHANGED since the last snapshot; the first run stores a silent baseline.

import {
  getTopDealsByScore,
  getWhiteSpaceRows,
  getLatestWhiteSpaceSnapshot,
  insertWhiteSpaceSnapshot,
} from '../db/queries';
import { db } from '../db/client';
import { diffWhiteSpace } from '../gaps';
import { buildDailyEmailHtml, type WhiteSpaceDiffSection } from './templates';
import { sendDailyBrief, isEmailAvailable } from './client';

export interface BriefResult {
  ok: boolean;
  reason?: string;
  sent_to?: string;
  deal_count?: number;
  white_space_changes?: number;
}

export async function sendBrief(): Promise<BriefResult> {
  if (!isEmailAvailable()) {
    return { ok: false, reason: 'Email not configured — set RESEND_API_KEY and EMAIL_TO in .env.local (see Config page)' };
  }

  const deals = await getTopDealsByScore(3);
  if (deals.length === 0) return { ok: false, reason: 'No scored deals yet' };

  // White-space diff — best-effort: pre-geo4 databases just skip the section.
  let diffSection: WhiteSpaceDiffSection | null = null;
  try {
    const ws = await getWhiteSpaceRows();
    if (!ws.error) {
      const current = ws.rows.map((r) => r.iso3);
      const previous = await getLatestWhiteSpaceSnapshot();
      const diff = diffWhiteSpace(current, previous?.iso3s ?? null);
      if (diff.changed) {
        const byIso = new Map(ws.rows.map((r) => [r.iso3, r]));
        diffSection = {
          added: diff.added.map((i) => ({
            iso3: i,
            name: byIso.get(i)?.country_name ?? i,
            cnUsd: byIso.get(i)?.cn_usd ?? 0,
          })),
          removed: diff.removed.map((i) => ({ iso3: i, name: previous?.names[i] ?? i })),
        };
      }
      // Store a new snapshot on first run (baseline) or whenever the set moved.
      if (previous === null || diff.changed) {
        await insertWhiteSpaceSnapshot(current, {
          names: Object.fromEntries(ws.rows.map((r) => [r.iso3, r.country_name])),
        });
      }
    }
  } catch { /* the brief must send even if the gap views are unavailable */ }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const dateStr = new Date().toISOString().slice(0, 10);
  const html = buildDailyEmailHtml(deals, `${baseUrl}/dashboard`, dateStr, diffSection);

  await sendDailyBrief(html, dateStr);

  await db.from('email_logs').insert({
    recipient: process.env.EMAIL_TO,
    deal_ids: deals.map((d) => d.id),
    status: 'sent',
  });

  return {
    ok: true,
    sent_to: process.env.EMAIL_TO,
    deal_count: deals.length,
    white_space_changes: diffSection ? diffSection.added.length + diffSection.removed.length : 0,
  };
}
