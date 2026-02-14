import { NextRequest, NextResponse } from "next/server";
import { getDb, LOCAL_USER_ID, transformContact } from "@/lib/db";

export async function GET(request: NextRequest) {
  const db = getDb();
  const status = request.nextUrl.searchParams.get("status") || "pending";
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");

  const rows = db
    .prepare(
      "SELECT * FROM ai_recommendations WHERE user_id = ? AND status = ? ORDER BY priority ASC LIMIT ?"
    )
    .all(LOCAL_USER_ID, status, limit) as Record<string, unknown>[];

  const result = rows.map((row) => {
    let contact = null;
    if (row.contact_id) {
      const contactRow = db
        .prepare("SELECT * FROM contacts WHERE id = ?")
        .get(row.contact_id as string) as Record<string, unknown> | undefined;
      contact = contactRow ? transformContact(contactRow) : null;
    }
    return { ...row, contact };
  });

  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest) {
  const db = getDb();
  const { id, status } = await request.json();

  db.prepare(
    "UPDATE ai_recommendations SET status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).run(status, id, LOCAL_USER_ID);

  const row = db
    .prepare("SELECT * FROM ai_recommendations WHERE id = ?")
    .get(id) as Record<string, unknown>;

  return NextResponse.json(row);
}
