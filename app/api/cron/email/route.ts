import { NextRequest, NextResponse } from 'next/server';
import { getTopDealsByScore } from '@/lib/db/queries';
import { buildDailyEmailHtml } from '@/lib/email/templates';
import { sendDailyBrief, isEmailAvailable } from '@/lib/email/client';
import { db } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isEmailAvailable()) {
    return NextResponse.json({ ok: false, reason: 'Email not configured' });
  }

  const deals = await getTopDealsByScore(3);
  if (deals.length === 0) {
    return NextResponse.json({ ok: false, reason: 'No scored deals yet' });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const dateStr = new Date().toISOString().slice(0, 10);
  const html = buildDailyEmailHtml(deals, baseUrl, dateStr);

  await sendDailyBrief(html, dateStr);

  await db.from('email_logs').insert({
    recipient: process.env.EMAIL_TO,
    deal_ids: deals.map((d) => d.id),
    status: 'sent',
  });

  return NextResponse.json({ ok: true, sent_to: process.env.EMAIL_TO, deal_count: deals.length });
}
