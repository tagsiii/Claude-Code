import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateFollowUps } from "@/lib/claude";

// Vercel Cron or manual trigger
// vercel.json: { "crons": [{ "path": "/api/cron/daily-followup", "schedule": "0 8 * * *" }] }
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get all users with profiles
  const { data: profiles } = await supabase.from("user_profile").select("*");
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ message: "No users found" });
  }

  const results = [];

  for (const profile of profiles) {
    try {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", profile.user_id)
        .neq("relationship_tier", "dormant");

      if (!contacts || contacts.length === 0) continue;

      // Fetch recent interactions per contact
      const contactsWithInteractions = await Promise.all(
        contacts.slice(0, 50).map(async (contact: Record<string, any>) => {
          const { data } = await supabase
            .from("interactions")
            .select("*")
            .eq("contact_id", contact.id)
            .order("occurred_at", { ascending: false })
            .limit(3);
          return { ...contact, recent_interactions: data || [] };
        })
      );

      const recommendations = await generateFollowUps(
        contactsWithInteractions,
        profile
      );

      // Clear old pending, insert new
      await supabase
        .from("ai_recommendations")
        .update({ status: "dismissed" })
        .eq("user_id", profile.user_id)
        .eq("type", "follow_up")
        .eq("status", "pending");

      const toInsert = recommendations.map((rec) => ({
        user_id: profile.user_id,
        contact_id: rec.contact_id,
        type: rec.type,
        priority: rec.priority,
        title: `Follow up with ${rec.contact_name}`,
        description: rec.reason,
        suggested_message: rec.suggested_message,
        reasoning: rec.reason,
        status: "pending" as const,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));

      if (toInsert.length > 0) {
        await supabase.from("ai_recommendations").insert(toInsert);
      }

      results.push({
        user_id: profile.user_id,
        recommendations: recommendations.length,
      });
    } catch (err) {
      results.push({
        user_id: profile.user_id,
        error: String(err),
      });
    }
  }

  return NextResponse.json({ results });
}
