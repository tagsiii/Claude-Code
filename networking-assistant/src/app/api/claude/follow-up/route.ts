import { NextResponse } from "next/server";
import { getDb, LOCAL_USER_ID, newId, transformContact, transformProfile, transformInteraction } from "@/lib/db";

export async function POST() {
  const db = getDb();

  const profile = db
    .prepare("SELECT * FROM user_profile WHERE user_id = ?")
    .get(LOCAL_USER_ID) as Record<string, unknown> | undefined;

  if (!profile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  const contacts = db
    .prepare(
      "SELECT * FROM contacts WHERE user_id = ? AND relationship_tier != 'dormant' ORDER BY last_interaction_at ASC"
    )
    .all(LOCAL_USER_ID) as Record<string, unknown>[];

  const contactsWithInteractions = contacts.slice(0, 50).map((contact) => {
    const interactions = db
      .prepare(
        "SELECT * FROM interactions WHERE contact_id = ? ORDER BY occurred_at DESC LIMIT 3"
      )
      .all(contact.id as string) as Record<string, unknown>[];
    return {
      ...transformContact(contact),
      recent_interactions: interactions.map(transformInteraction),
    };
  });

  try {
    const { generateFollowUps } = await import("@/lib/claude");
    const recommendations = await generateFollowUps(
      contactsWithInteractions,
      transformProfile(profile)
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toInsert = recommendations.map((rec: any) => ({
      id: newId(),
      user_id: LOCAL_USER_ID,
      contact_id: rec.contact_id,
      type: rec.type || "follow_up",
      priority: rec.priority,
      title: `Follow up with ${rec.contact_name}`,
      description: rec.reason,
      suggested_message: rec.suggested_message,
      reasoning: rec.reason,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }));

    if (toInsert.length > 0) {
      db.prepare(
        "UPDATE ai_recommendations SET status = 'dismissed', updated_at = datetime('now') WHERE user_id = ? AND type = 'follow_up' AND status = 'pending'"
      ).run(LOCAL_USER_ID);

      const insertStmt = db.prepare(`
        INSERT INTO ai_recommendations (id, user_id, contact_id, type, priority, title, description, suggested_message, reasoning, status, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const rec of toInsert) {
        insertStmt.run(
          rec.id, rec.user_id, rec.contact_id, rec.type, rec.priority,
          rec.title, rec.description, rec.suggested_message || null,
          rec.reasoning, rec.status, rec.expires_at
        );
      }
    }

    return NextResponse.json({ recommendations, stored: toInsert.length });
  } catch (err) {
    return NextResponse.json(
      { error: "Follow-up generation failed", details: String(err) },
      { status: 500 }
    );
  }
}
