import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDealById, setDealReviewStatus, upsertDeal, addDealEvent } from '@/lib/db/queries';
import { scoreDeal } from '@/lib/pipeline/scoring';
import { stampProvenance } from '@/lib/pipeline/quality';
import type { Deal } from '@/lib/types';

// Fields the analyst may edit by hand. Everything else (scores, flags,
// provenance, counts) stays machine-owned.
const EDITABLE = new Set([
  'title', 'host_country', 'host_region', 'sponsoring_state', 'sector',
  'subsector', 'lifecycle_stage', 'rom_value_usd', 'rom_basis',
  'is_confirmed', 'status',
]);

// PATCH handles two shapes:
//   { review_status: 'approved'|'rejected', note? }   — review verdicts
//   { fields: { title?, rom_value_usd?, ... } }        — manual field edits
// Rejected deals stay in the database (hidden everywhere) so dedup keeps
// matching re-reported junk against them — a built-in blocklist.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (body.review_status !== undefined) {
    const status = body.review_status;
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'review_status must be approved or rejected' }, { status: 400 });
    }
    try {
      await setDealReviewStatus(params.id, status, typeof body.note === 'string' ? body.note.slice(0, 300) : undefined);
      return NextResponse.json({ ok: true, review_status: status });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (body.fields && typeof body.fields === 'object') {
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
      if (EDITABLE.has(key)) updates[key] = value === '' ? null : value;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
    }

    try {
      const existing = await getDealById(params.id);
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const changed = Object.keys(updates).filter(
        (k) => (existing as unknown as Record<string, unknown>)[k] !== updates[k]
      );
      if (changed.length === 0) return NextResponse.json({ ok: true, changed: [] });

      // Manual edits are provenance-stamped as such and rescored — analyst
      // corrections should move the score like any other new information.
      const email = session.user?.email ?? 'analyst';
      const provenance = stampProvenance(
        existing.provenance,
        changed,
        `manual edit (${email})`,
        new Date().toISOString().slice(0, 10)
      );
      const { composite, breakdown } = await scoreDeal({ ...existing, ...updates } as Partial<Deal>);

      try {
        await upsertDeal({
          id: params.id,
          ...updates,
          provenance,
          composite_score: composite,
          score_breakdown: breakdown,
          score_calculated_at: new Date().toISOString(),
        } as Partial<Deal>);
      } catch (err) {
        // Pre-migration databases lack the provenance column — retry without.
        const msg = err instanceof Error ? err.message : String(err);
        if (!/column|schema cache/i.test(msg)) throw err;
        await upsertDeal({
          id: params.id,
          ...updates,
          composite_score: composite,
          score_breakdown: breakdown,
          score_calculated_at: new Date().toISOString(),
        } as Partial<Deal>);
      }

      try {
        await addDealEvent({
          deal_id: params.id,
          event_date: new Date().toISOString().slice(0, 10),
          description: `Manually edited: ${changed.join(', ')}`,
          source_id: null,
        });
      } catch { /* non-fatal */ }

      return NextResponse.json({ ok: true, changed });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Provide review_status or fields' }, { status: 400 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const deal = await getDealById(params.id);
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ deal });
}
