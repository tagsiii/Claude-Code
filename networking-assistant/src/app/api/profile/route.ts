import { NextRequest, NextResponse } from "next/server";
import { getDb, LOCAL_USER_ID, newId, toJsonArray, transformProfile } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM user_profile WHERE user_id = ?")
    .get(LOCAL_USER_ID) as Record<string, unknown> | undefined;

  return NextResponse.json(row ? transformProfile(row) : null);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();

  const existing = db
    .prepare("SELECT id FROM user_profile WHERE user_id = ?")
    .get(LOCAL_USER_ID) as { id: string } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE user_profile SET
        full_name = ?, bio = ?, job_title = ?, company = ?,
        industries = ?, goals = ?,
        what_i_offer = ?, what_i_need = ?, networking_style = ?,
        updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      body.full_name,
      body.bio || null,
      body.job_title || null,
      body.company || null,
      toJsonArray(body.industries),
      toJsonArray(body.goals),
      body.what_i_offer || null,
      body.what_i_need || null,
      body.networking_style || null,
      LOCAL_USER_ID
    );
  } else {
    const id = newId();
    db.prepare(`
      INSERT INTO user_profile (id, user_id, full_name, bio, job_title, company, industries, goals, what_i_offer, what_i_need, networking_style)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      LOCAL_USER_ID,
      body.full_name,
      body.bio || null,
      body.job_title || null,
      body.company || null,
      toJsonArray(body.industries),
      toJsonArray(body.goals),
      body.what_i_offer || null,
      body.what_i_need || null,
      body.networking_style || null
    );
  }

  const row = db
    .prepare("SELECT * FROM user_profile WHERE user_id = ?")
    .get(LOCAL_USER_ID) as Record<string, unknown>;

  return NextResponse.json(transformProfile(row));
}
