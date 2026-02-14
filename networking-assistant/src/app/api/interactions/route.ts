import { NextRequest, NextResponse } from "next/server";
import { getDb, LOCAL_USER_ID, newId, toJsonArray, transformInteraction, transformContact, transformProfile } from "@/lib/db";

export async function GET(request: NextRequest) {
  const db = getDb();
  const contactId = request.nextUrl.searchParams.get("contact_id");

  let rows;
  if (contactId) {
    rows = db
      .prepare(
        "SELECT * FROM interactions WHERE user_id = ? AND contact_id = ? ORDER BY occurred_at DESC LIMIT 50"
      )
      .all(LOCAL_USER_ID, contactId) as Record<string, unknown>[];
  } else {
    rows = db
      .prepare(
        "SELECT * FROM interactions WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 50"
      )
      .all(LOCAL_USER_ID) as Record<string, unknown>[];
  }

  return NextResponse.json(rows.map(transformInteraction));
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { contact_id, interaction_type, raw_notes, occurred_at } = body;

  const contact = db
    .prepare("SELECT * FROM contacts WHERE id = ?")
    .get(contact_id) as Record<string, unknown> | undefined;
  const profile = db
    .prepare("SELECT * FROM user_profile WHERE user_id = ?")
    .get(LOCAL_USER_ID) as Record<string, unknown> | undefined;

  if (!contact) {
    return NextResponse.json(
      { error: "Contact not found" },
      { status: 404 }
    );
  }

  const history = db
    .prepare(
      "SELECT * FROM interactions WHERE contact_id = ? ORDER BY occurred_at DESC LIMIT 5"
    )
    .all(contact_id) as Record<string, unknown>[];

  // Try Claude AI processing (gracefully skip if API key not configured)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aiResult: any = null;
  if (raw_notes && profile) {
    try {
      const { processInteraction } = await import("@/lib/claude");
      aiResult = await processInteraction(
        raw_notes,
        transformContact(contact),
        transformProfile(profile),
        history.map(transformInteraction)
      );
    } catch (err) {
      console.error("Claude processing skipped:", err);
    }
  }

  const id = newId();
  const occurredAtVal = occurred_at || new Date().toISOString();

  db.prepare(`
    INSERT INTO interactions (id, user_id, contact_id, interaction_type, raw_notes, occurred_at, ai_summary, key_topics, commitments_made, follow_up_items, sentiment, relationship_strength_delta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    LOCAL_USER_ID,
    contact_id,
    interaction_type,
    raw_notes || null,
    occurredAtVal,
    (aiResult?.ai_summary as string) || null,
    toJsonArray(aiResult?.key_topics as string[] | undefined),
    toJsonArray(aiResult?.commitments_made as string[] | undefined),
    toJsonArray(aiResult?.follow_up_items as string[] | undefined),
    (aiResult?.sentiment as string) || null,
    (aiResult?.relationship_strength_delta as number) || 0
  );

  // Update contact's last_interaction_at
  db.prepare(
    "UPDATE contacts SET last_interaction_at = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(occurredAtVal, contact_id);

  // Try to regenerate context summary in background
  if (raw_notes && profile) {
    import("@/lib/claude")
      .then(({ generateContextSummary }) => {
        const allInteractions = db
          .prepare(
            "SELECT * FROM interactions WHERE contact_id = ? ORDER BY occurred_at DESC LIMIT 10"
          )
          .all(contact_id) as Record<string, unknown>[];
        return generateContextSummary(
          transformContact(contact),
          allInteractions.map(transformInteraction),
          transformProfile(profile)
        );
      })
      .then((summary) => {
        db.prepare("UPDATE contacts SET context_summary = ? WHERE id = ?").run(
          summary,
          contact_id
        );
      })
      .catch((err) => console.error("Context summary skipped:", err));
  }

  const interaction = db
    .prepare("SELECT * FROM interactions WHERE id = ?")
    .get(id) as Record<string, unknown>;

  return NextResponse.json({
    interaction: transformInteraction(interaction),
    ai_analysis: aiResult,
  });
}
