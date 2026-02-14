import { NextRequest, NextResponse } from "next/server";
import { getDb, LOCAL_USER_ID, newId, transformContact, transformProfile, transformInteraction } from "@/lib/db";

export async function POST(request: NextRequest) {
  const db = getDb();
  const { contact_id, meeting_purpose, meeting_at, calendar_event_id } =
    await request.json();

  const contact = db
    .prepare("SELECT * FROM contacts WHERE id = ?")
    .get(contact_id) as Record<string, unknown> | undefined;
  const profile = db
    .prepare("SELECT * FROM user_profile WHERE user_id = ?")
    .get(LOCAL_USER_ID) as Record<string, unknown> | undefined;

  if (!contact || !profile) {
    return NextResponse.json(
      { error: "Contact or user profile not found" },
      { status: 404 }
    );
  }

  const interactionRows = db
    .prepare(
      "SELECT * FROM interactions WHERE contact_id = ? ORDER BY occurred_at DESC LIMIT 15"
    )
    .all(contact_id) as Record<string, unknown>[];

  const id = newId();

  db.prepare(`
    INSERT INTO call_preps (id, user_id, contact_id, meeting_purpose, meeting_at, calendar_event_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'generating')
  `).run(id, LOCAL_USER_ID, contact_id, meeting_purpose, meeting_at || null, calendar_event_id || null);

  try {
    const { generateCallPrep } = await import("@/lib/claude");
    const result = await generateCallPrep(
      transformContact(contact),
      interactionRows.map(transformInteraction),
      transformProfile(profile),
      meeting_purpose
    );

    db.prepare(`
      UPDATE call_preps SET
        contact_summary = ?, agenda = ?, potential_outcomes = ?,
        full_document = ?, status = 'ready', updated_at = datetime('now')
      WHERE id = ?
    `).run(
      result.contact_summary,
      result.agenda,
      result.potential_outcomes,
      result.full_document,
      id
    );

    return NextResponse.json({
      id,
      ...result,
      status: "ready",
    });
  } catch (err) {
    db.prepare("UPDATE call_preps SET status = 'draft' WHERE id = ?").run(id);
    return NextResponse.json(
      { error: "Call prep generation failed", details: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const db = getDb();
  const prepId = request.nextUrl.searchParams.get("id");
  const contactId = request.nextUrl.searchParams.get("contact_id");

  if (prepId) {
    const row = db
      .prepare("SELECT * FROM call_preps WHERE id = ?")
      .get(prepId) as Record<string, unknown> | undefined;
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const contactRow = db
      .prepare("SELECT * FROM contacts WHERE id = ?")
      .get(row.contact_id as string) as Record<string, unknown> | undefined;
    return NextResponse.json({
      ...row,
      contact: contactRow ? transformContact(contactRow) : null,
    });
  }

  let rows;
  if (contactId) {
    rows = db
      .prepare(
        "SELECT * FROM call_preps WHERE user_id = ? AND contact_id = ? ORDER BY meeting_at ASC LIMIT 20"
      )
      .all(LOCAL_USER_ID, contactId) as Record<string, unknown>[];
  } else {
    rows = db
      .prepare(
        "SELECT * FROM call_preps WHERE user_id = ? ORDER BY meeting_at ASC LIMIT 20"
      )
      .all(LOCAL_USER_ID) as Record<string, unknown>[];
  }

  const result = rows.map((row) => {
    const contactRow = db
      .prepare("SELECT * FROM contacts WHERE id = ?")
      .get(row.contact_id as string) as Record<string, unknown> | undefined;
    return {
      ...row,
      contact: contactRow ? transformContact(contactRow) : null,
    };
  });

  return NextResponse.json(result);
}
