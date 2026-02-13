import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateWeeklyBrief } from "@/lib/claude";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles } = await supabase.from("user_profile").select("*");
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ message: "No users found" });
  }

  const results = [];

  for (const profile of profiles) {
    try {
      const [contactsRes, interactionsRes] = await Promise.all([
        supabase.from("contacts").select("*").eq("user_id", profile.user_id),
        supabase
          .from("interactions")
          .select("*")
          .eq("user_id", profile.user_id)
          .gte("occurred_at", sevenDaysAgo)
          .order("occurred_at", { ascending: false }),
      ]);

      const brief = await generateWeeklyBrief(
        contactsRes.data || [],
        interactionsRes.data || [],
        profile
      );

      // Store as a recommendation
      await supabase.from("ai_recommendations").insert({
        user_id: profile.user_id,
        type: "relationship_alert",
        priority: 1,
        title: "Weekly Network Brief",
        description: brief,
        status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      results.push({ user_id: profile.user_id, status: "ok" });
    } catch (err) {
      results.push({ user_id: profile.user_id, error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
