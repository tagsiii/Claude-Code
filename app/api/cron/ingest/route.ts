import { NextRequest, NextResponse } from 'next/server';
import { runIngestionPipeline } from '@/lib/pipeline/runner';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 7-day rolling window: dedup makes re-scans idempotent, and the wider net
  // catches stories that surface days after the fact.
  const results = await runIngestionPipeline({ lookbackDays: 7 });
  return NextResponse.json({ ok: true, results });
}
