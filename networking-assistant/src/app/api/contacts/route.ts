import { NextRequest, NextResponse } from "next/server";
import { getDb, LOCAL_USER_ID, newId, toJsonArray, transformContact } from "@/lib/db";

export async function GET(request: NextRequest) {
  const db = getDb();
  const contactId = request.nextUrl.searchParams.get("id");

  if (contactId) {
    const row = db
      .prepare("SELECT * FROM contacts WHERE id = ? AND user_id = ?")
      .get(contactId, LOCAL_USER_ID) as Record<string, unknown> | undefined;
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(transformContact(row));
  }

  const rows = db
    .prepare(
      "SELECT * FROM contacts WHERE user_id = ? ORDER BY CASE WHEN last_interaction_at IS NULL THEN 1 ELSE 0 END, last_interaction_at DESC"
    )
    .all(LOCAL_USER_ID) as Record<string, unknown>[];

  return NextResponse.json(rows.map(transformContact));
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const id = newId();

  db.prepare(`
    INSERT INTO contacts (id, user_id, full_name, email, phone, company, role, linkedin_url, twitter_handle, location, industries, tags, how_we_met, relationship_tier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    LOCAL_USER_ID,
    body.full_name,
    body.email || null,
    body.phone || null,
    body.company || null,
    body.role || null,
    body.linkedin_url || null,
    body.twitter_handle || null,
    body.location || null,
    toJsonArray(body.industries),
    toJsonArray(body.tags),
    body.how_we_met || null,
    body.relationship_tier || "acquaintance"
  );

  const row = db
    .prepare("SELECT * FROM contacts WHERE id = ?")
    .get(id) as Record<string, unknown>;

  return NextResponse.json(transformContact(row));
}
