// Domain blocklist management (Config page): outlets whose articles the
// pipeline should never ingest again.

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listDomainRules, addDomainRule, removeDomainRule } from '@/lib/db/queries';
import { registrableDomain } from '@/lib/pipeline/quality';

export const dynamic = 'force-dynamic';

async function guard() {
  const session = await getServerSession(authOptions);
  return session ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  try {
    return NextResponse.json({ rules: await listDomainRules() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const setup = /does not exist|schema cache/i.test(msg);
    return NextResponse.json(
      { error: setup ? 'Run lib/db/quality.sql in the Supabase SQL editor first.' : msg },
      { status: setup ? 409 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const raw = typeof body.domain === 'string' ? body.domain.trim() : '';
  if (!raw) return NextResponse.json({ error: 'domain required' }, { status: 400 });
  // Accept either a bare domain or a full URL; store the registrable domain.
  const domain = registrableDomain(raw.includes('://') ? raw : `https://${raw}`);
  await addDomainRule(domain, typeof body.note === 'string' ? body.note.slice(0, 200) : undefined);
  return NextResponse.json({ ok: true, domain });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const domain = req.nextUrl.searchParams.get('domain');
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 });
  await removeDomainRule(domain);
  return NextResponse.json({ ok: true });
}
