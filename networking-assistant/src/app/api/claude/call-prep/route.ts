import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCallPrep } from "@/lib/claude";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contact_id, meeting_purpose, meeting_at, calendar_event_id } =
    await request.json();

  // Fetch all context
  const [contactRes, profileRes, interactionsRes] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", contact_id).single(),
    supabase.from("user_profile").select("*").eq("user_id", user.id).single(),
    supabase
      .from("interactions")
      .select("*")
      .eq("contact_id", contact_id)
      .order("occurred_at", { ascending: false })
      .limit(15),
  ]);

  if (!contactRes.data || !profileRes.data) {
    return NextResponse.json(
      { error: "Contact or user profile not found" },
      { status: 404 }
    );
  }

  // Create a draft call prep record
  const { data: prep, error: insertError } = await supabase
    .from("call_preps")
    .insert({
      user_id: user.id,
      contact_id,
      meeting_purpose,
      meeting_at,
      calendar_event_id,
      status: "generating",
    })
    .select()
    .single();

  if (insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Generate the multi-step call prep via Claude
  try {
    const result = await generateCallPrep(
      contactRes.data,
      interactionsRes.data || [],
      profileRes.data,
      meeting_purpose
    );

    const { error: updateError } = await supabase
      .from("call_preps")
      .update({
        contact_summary: result.contact_summary,
        agenda: result.agenda,
        potential_outcomes: result.potential_outcomes,
        full_document: result.full_document,
        status: "ready",
      })
      .eq("id", prep.id);

    if (updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({
      id: prep.id,
      ...result,
      status: "ready",
    });
  } catch (err) {
    await supabase
      .from("call_preps")
      .update({ status: "draft" })
      .eq("id", prep.id);

    return NextResponse.json(
      { error: "Call prep generation failed", details: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prepId = request.nextUrl.searchParams.get("id");
  const contactId = request.nextUrl.searchParams.get("contact_id");

  if (prepId) {
    const { data, error } = await supabase
      .from("call_preps")
      .select("*, contact:contacts(*)")
      .eq("id", prepId)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  let query = supabase
    .from("call_preps")
    .select("*, contact:contacts(*)")
    .eq("user_id", user.id)
    .order("meeting_at", { ascending: true });

  if (contactId) query = query.eq("contact_id", contactId);

  const { data, error } = await query.limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
