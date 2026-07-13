import { neon } from "@neondatabase/serverless";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "../../../lib/auth";

// Single-user state blob in Postgres (Neon via Vercel Storage).
// Degrades gracefully: with no database provisioned, GET/PUT answer
// { available: false } and the app stays localStorage-only.

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

async function authed(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value === sessionToken();
}

async function getSql() {
  if (!DB_URL) return null;
  const sql = neon(DB_URL);
  await sql`CREATE TABLE IF NOT EXISTS train_state (
    id int PRIMARY KEY,
    data jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  return sql;
}

export async function GET() {
  if (!(await authed())) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ ok: true, available: false });
    const rows = await sql`SELECT data FROM train_state WHERE id = 1`;
    return NextResponse.json({ ok: true, available: true, state: rows[0]?.data ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, available: false, error: "db" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await authed())) return NextResponse.json({ ok: false }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const sql = await getSql();
    if (!sql) return NextResponse.json({ ok: true, available: false });
    await sql`INSERT INTO train_state (id, data, updated_at) VALUES (1, ${JSON.stringify(body)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
    return NextResponse.json({ ok: true, available: true });
  } catch {
    return NextResponse.json({ ok: false, available: false, error: "db" }, { status: 500 });
  }
}
