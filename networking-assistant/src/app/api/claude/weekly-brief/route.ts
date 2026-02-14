import { NextResponse } from "next/server";
import { getDb, LOCAL_USER_ID, transformContact, transformProfile, transformInteraction } from "@/lib/db";

export async function POST() {
  const db = getDb();

  const profile = db
    .prepare("SELECT * FROM user_profile WHERE user_id = ?")
    .get(LOCAL_USER_ID) as Record<string, unknown> | undefined;

  if (!profile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const contacts = db
    .prepare("SELECT * FROM contacts WHERE user_id = ?")
    .all(LOCAL_USER_ID) as Record<string, unknown>[];

  const interactions = db
    .prepare(
      "SELECT * FROM interactions WHERE user_id = ? AND occurred_at >= ? ORDER BY occurred_at DESC"
    )
    .all(LOCAL_USER_ID, sevenDaysAgo) as Record<string, unknown>[];

  try {
    const { generateWeeklyBrief } = await import("@/lib/claude");
    const brief = await generateWeeklyBrief(
      contacts.map(transformContact),
      interactions.map(transformInteraction),
      transformProfile(profile)
    );

    return NextResponse.json({ brief });
  } catch (err) {
    return NextResponse.json(
      { error: "Weekly brief generation failed", details: String(err) },
      { status: 500 }
    );
  }
}
