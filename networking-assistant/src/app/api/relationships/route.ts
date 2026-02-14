import { NextResponse } from "next/server";
import { getDb, LOCAL_USER_ID } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM relationship_graph WHERE user_id = ?")
    .all(LOCAL_USER_ID);

  return NextResponse.json(rows);
}
