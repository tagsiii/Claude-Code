import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFollowUps } from "@/lib/claude";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profileRes, contactsRes] = await Promise.all([
    supabase.from("user_profile").select("*").eq("user_id", user.id).single(),
    supabase
      .from("contacts")
      .select("*")
      .eq("user_id", user.id)
      .neq("relationship_tier", "dormant")
      .order("last_interaction_at", { ascending: true, nullsFirst: true }),
  ]);

  if (!profileRes.data) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  const contacts = contactsRes.data || [];

  // Fetch recent interactions for each contact
  const contactsWithInteractions = await Promise.all(
    contacts.slice(0, 50).map(async (contact) => {
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
    profileRes.data
  );

  // Store recommendations
  const toInsert = recommendations.map((rec) => ({
    user_id: user.id,
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
    // Clear old pending follow-up recommendations
    await supabase
      .from("ai_recommendations")
      .update({ status: "dismissed" })
      .eq("user_id", user.id)
      .eq("type", "follow_up")
      .eq("status", "pending");

    await supabase.from("ai_recommendations").insert(toInsert);
  }

  return NextResponse.json({ recommendations, stored: toInsert.length });
}
