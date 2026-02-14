import { NextRequest, NextResponse } from "next/server";
import { getDb, LOCAL_USER_ID, newId, transformContact, transformProfile, transformInteraction } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  const profile = db
    .prepare("SELECT * FROM user_profile WHERE user_id = ?")
    .get(LOCAL_USER_ID) as Record<string, unknown> | undefined;

  if (!profile) {
    return NextResponse.json({ message: "No user profile found" });
  }

  try {
    const contacts = db
      .prepare(
        "SELECT * FROM contacts WHERE user_id = ? AND relationship_tier != 'dormant'"
      )
      .all(LOCAL_USER_ID) as Record<string, unknown>[];

    if (contacts.length === 0) {
      return NextResponse.json({ message: "No contacts found" });
    }

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

    const { generateFollowUps } = await import("@/lib/claude");
    const recommendations = await generateFollowUps(
      contactsWithInteractions,
      transformProfile(profile)
    );

    // Clear old pending follow-ups
    db.prepare(
      "UPDATE ai_recommendations SET status = 'dismissed', updated_at = datetime('now') WHERE user_id = ? AND type = 'follow_up' AND status = 'pending'"
    ).run(LOCAL_USER_ID);

    const insertStmt = db.prepare(`
      INSERT INTO ai_recommendations (id, user_id, contact_id, type, priority, title, description, suggested_message, reasoning, status, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const rec of recommendations) {
      insertStmt.run(
        newId(),
        LOCAL_USER_ID,
        rec.contact_id,
        rec.type || "follow_up",
        rec.priority,
        `Follow up with ${rec.contact_name}`,
        rec.reason,
        rec.suggested_message || null,
        rec.reason,
        "pending",
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      );
    }

    return NextResponse.json({
      results: [{ user_id: LOCAL_USER_ID, recommendations: recommendations.length }],
    });
  } catch (err) {
    return NextResponse.json({
      results: [{ user_id: LOCAL_USER_ID, error: String(err) }],
    });
  }
}
