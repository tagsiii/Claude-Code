import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWeeklyBrief } from "@/lib/claude";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [profileRes, contactsRes, interactionsRes] = await Promise.all([
    supabase.from("user_profile").select("*").eq("user_id", user.id).single(),
    supabase.from("contacts").select("*").eq("user_id", user.id),
    supabase
      .from("interactions")
      .select("*")
      .eq("user_id", user.id)
      .gte("occurred_at", sevenDaysAgo)
      .order("occurred_at", { ascending: false }),
  ]);

  if (!profileRes.data) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  const brief = await generateWeeklyBrief(
    contactsRes.data || [],
    interactionsRes.data || [],
    profileRes.data
  );

  return NextResponse.json({ brief });
}
