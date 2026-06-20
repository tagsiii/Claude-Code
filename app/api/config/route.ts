import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getScoreWeights,
  updateScoreWeight,
  getConnectorConfigs,
  updateConnectorEnabled,
  getRecentIngestLogs,
} from '@/lib/db/queries';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [weights, connectors, logs] = await Promise.all([
    getScoreWeights(),
    getConnectorConfigs(),
    getRecentIngestLogs(5),
  ]);

  return NextResponse.json({ weights, connectors, logs });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  if (body.type === 'weight') {
    await updateScoreWeight(body.name, body.weight);
    return NextResponse.json({ ok: true });
  }

  if (body.type === 'connector') {
    await updateConnectorEnabled(body.name, body.enabled);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown update type' }, { status: 400 });
}
