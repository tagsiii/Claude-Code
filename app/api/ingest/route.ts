import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runIngestionPipeline } from '@/lib/pipeline/runner';

export const maxDuration = 300; // 5 min max on Vercel Pro; 60s on Hobby

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const connectors: string[] | undefined = body.connectors;
  const lookbackDays: number = body.lookbackDays ?? 7;

  const results = await runIngestionPipeline({ connectorNames: connectors, lookbackDays });

  const totals = results.reduce(
    (acc, r) => ({
      found: acc.found + r.deals_found,
      created: acc.created + r.deals_created,
      updated: acc.updated + r.deals_updated,
    }),
    { found: 0, created: 0, updated: 0 }
  );

  return NextResponse.json({ results, totals, ran_at: new Date().toISOString() });
}
