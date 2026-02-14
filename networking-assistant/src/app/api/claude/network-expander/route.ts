import { NextRequest, NextResponse } from "next/server";
import { getDb, LOCAL_USER_ID, transformContact, transformProfile } from "@/lib/db";

export async function POST(request: NextRequest) {
  const db = getDb();
  const { contact_id } = await request.json();

  const contact = db
    .prepare("SELECT * FROM contacts WHERE id = ?")
    .get(contact_id) as Record<string, unknown> | undefined;
  const profile = db
    .prepare("SELECT * FROM user_profile WHERE user_id = ?")
    .get(LOCAL_USER_ID) as Record<string, unknown> | undefined;

  if (!contact || !profile) {
    return NextResponse.json({ error: "Contact or profile not found" }, { status: 404 });
  }

  const allContacts = db
    .prepare("SELECT * FROM contacts WHERE user_id = ? AND id != ?")
    .all(LOCAL_USER_ID, contact_id) as Record<string, unknown>[];

  try {
    const { analyzeNetworkExpansion } = await import("@/lib/claude");
    const expansion = await analyzeNetworkExpansion(
      transformContact(contact),
      allContacts.map(transformContact),
      transformProfile(profile)
    );

    return NextResponse.json(expansion);
  } catch (err) {
    return NextResponse.json(
      { error: "Network expansion analysis failed", details: String(err) },
      { status: 500 }
    );
  }
}
