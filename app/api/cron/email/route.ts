import { NextRequest, NextResponse } from 'next/server';
import { sendBrief } from '@/lib/email/brief';

export async function GET(req: NextRequest) {
  // With CRON_SECRET unset the interpolated string would be "Bearer undefined"
  // — a guessable credential. No secret configured = endpoint disabled.
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await sendBrief();
  return NextResponse.json(result);
}
