import { NextRequest, NextResponse } from 'next/server';
import { runIngestionPipeline } from '@/lib/pipeline/runner';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await runIngestionPipeline({ lookbackDays: 1 });
  return NextResponse.json({ ok: true, results });
}
