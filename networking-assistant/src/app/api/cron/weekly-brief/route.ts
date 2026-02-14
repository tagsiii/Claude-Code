import { NextRequest, NextResponse } from "next/server";
import { getDb, LOCAL_USER_ID, newId, transformContact, transformProfile, transformInteraction } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const profile = db
    .prepare("SELECT * FROM user_profile WHERE user_id = ?")
    .get(LOCAL_USER_ID) as Record<string, unknown> | undefined;

  if (!profile) {
    return NextResponse.json({ message: "No user profile found" });
  }

  try {
    const contacts = db
      .prepare("SELECT * FROM contacts WHERE user_id = ?")
      .all(LOCAL_USER_ID) as Record<string, unknown>[];

    const interactions = db
      .prepare(
        "SELECT * FROM interactions WHERE user_id = ? AND occurred_at >= ? ORDER BY occurred_at DESC"
      )
      .all(LOCAL_USER_ID, sevenDaysAgo) as Record<string, unknown>[];

    const { generateWeeklyBrief } = await import("@/lib/claude");
    const brief = await generateWeeklyBrief(
      contacts.map(transformContact),
      interactions.map(transformInteraction),
      transformProfile(profile)
    );

    const id = newId();
    db.prepare(`
      INSERT INTO ai_recommendations (id, user_id, type, priority, title, description, status, expires_at)
      VALUES (?, ?, 'relationship_alert', 1, 'Weekly Network Brief', ?, 'pending', ?)
    `).run(
      id,
      LOCAL_USER_ID,
      brief,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    );

    return NextResponse.json({ results: [{ user_id: LOCAL_USER_ID, status: "ok" }] });
  } catch (err) {
    return NextResponse.json({
      results: [{ user_id: LOCAL_USER_ID, error: String(err) }],
    });
  }
}
