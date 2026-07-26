import { NextRequest, NextResponse } from 'next/server';
import { runIngestionPipeline } from '@/lib/pipeline/runner';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // With CRON_SECRET unset the interpolated string would be "Bearer undefined"
  // — a guessable credential. No secret configured = endpoint disabled.
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 7-day rolling window: dedup makes re-scans idempotent, and the wider net
  // catches stories that surface days after the fact.
  const results = await runIngestionPipeline({ lookbackDays: 7 });
  return NextResponse.json({ ok: true, results });
}
