import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeNetworkExpansion } from "@/lib/claude";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contact_id } = await request.json();

  const [contactRes, profileRes, allContactsRes] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", contact_id).single(),
    supabase.from("user_profile").select("*").eq("user_id", user.id).single(),
    supabase.from("contacts").select("*").eq("user_id", user.id).neq("id", contact_id),
  ]);

  if (!contactRes.data || !profileRes.data) {
    return NextResponse.json({ error: "Contact or profile not found" }, { status: 404 });
  }

  const expansion = await analyzeNetworkExpansion(
    contactRes.data,
    allContactsRes.data || [],
    profileRes.data
  );

  return NextResponse.json(expansion);
}
