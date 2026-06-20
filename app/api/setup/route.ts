import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserCount, createUser } from '@/lib/db/queries';

// One-time setup: creates the first admin user.
// This endpoint disables itself once any user exists.
export async function POST(req: NextRequest) {
  const count = await getUserCount();
  if (count > 0) {
    return NextResponse.json({ error: 'Setup already complete' }, { status: 403 });
  }

  const body = await req.json();
  const { email, password, name } = body ?? {};

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'email, password, and name required' }, { status: 400 });
  }
  if (password.length < 12) {
    return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await createUser(email, hash, name);

  return NextResponse.json({ ok: true, id: user.id, email: user.email });
}
