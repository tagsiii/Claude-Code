import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export function isEmailAvailable(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_TO;
}

export async function sendDailyBrief(html: string, dateStr: string): Promise<void> {
  const resend = getResend();
  const to = process.env.EMAIL_TO!;
  const from = process.env.EMAIL_FROM ?? 'Economic Statecraft Monitor <onboarding@resend.dev>';

  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: `Economic Statecraft Brief — ${dateStr} — Top 3 Deals`,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}
