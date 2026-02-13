import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processInteraction, generateContextSummary } from "@/lib/claude";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contactId = request.nextUrl.searchParams.get("contact_id");

  let query = supabase
    .from("interactions")
    .select("*")
    .eq("user_id", user.id)
    .order("occurred_at", { ascending: false });

  if (contactId) {
    query = query.eq("contact_id", contactId);
  }

  const { data, error } = await query.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { contact_id, interaction_type, raw_notes, occurred_at } = body;

  // Fetch contact and user profile for Claude context
  const [contactRes, profileRes, historyRes] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", contact_id).single(),
    supabase.from("user_profile").select("*").eq("user_id", user.id).single(),
    supabase
      .from("interactions")
      .select("*")
      .eq("contact_id", contact_id)
      .order("occurred_at", { ascending: false })
      .limit(5),
  ]);

  if (!contactRes.data || !profileRes.data) {
    return NextResponse.json(
      { error: "Contact or user profile not found" },
      { status: 404 }
    );
  }

  // Process through Claude interaction processor
  let aiResult = null;
  if (raw_notes) {
    try {
      aiResult = await processInteraction(
        raw_notes,
        contactRes.data,
        profileRes.data,
        historyRes.data || []
      );
    } catch (err) {
      console.error("Claude processing failed:", err);
    }
  }

  // Insert interaction with AI-enriched fields
  const { data: interaction, error } = await supabase
    .from("interactions")
    .insert({
      user_id: user.id,
      contact_id,
      interaction_type,
      raw_notes,
      occurred_at: occurred_at || new Date().toISOString(),
      ai_summary: aiResult?.ai_summary || null,
      key_topics: aiResult?.key_topics || [],
      commitments_made: aiResult?.commitments_made || [],
      follow_up_items: aiResult?.follow_up_items || [],
      sentiment: aiResult?.sentiment || null,
      relationship_strength_delta: aiResult?.relationship_strength_delta || 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update contact's last_interaction_at
  await supabase
    .from("contacts")
    .update({ last_interaction_at: occurred_at || new Date().toISOString() })
    .eq("id", contact_id);

  // Regenerate context summary in the background
  if (raw_notes) {
    generateContextSummary(
      contactRes.data,
      [...(historyRes.data || []), interaction],
      profileRes.data
    )
      .then(async (summary) => {
        await supabase
          .from("contacts")
          .update({ context_summary: summary })
          .eq("id", contact_id);
      })
      .catch((err) => console.error("Context summary generation failed:", err));
  }

  return NextResponse.json({
    interaction,
    ai_analysis: aiResult,
  });
}
