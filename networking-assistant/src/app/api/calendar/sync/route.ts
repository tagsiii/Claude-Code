import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google Calendar sync endpoint
// This route fetches upcoming calendar events and matches them against known contacts
// to auto-trigger call prep generation.
//
// Usage: POST /api/calendar/sync with a Google OAuth access token
// In production, you'd store the refresh token in Supabase and auto-refresh.

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { access_token } = await request.json();
  if (!access_token) {
    return NextResponse.json(
      { error: "Google OAuth access_token required" },
      { status: 400 }
    );
  }

  // Fetch upcoming events from Google Calendar
  const now = new Date().toISOString();
  const oneWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const calendarUrl = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events"
  );
  calendarUrl.searchParams.set("timeMin", now);
  calendarUrl.searchParams.set("timeMax", oneWeek);
  calendarUrl.searchParams.set("singleEvents", "true");
  calendarUrl.searchParams.set("orderBy", "startTime");

  const calRes = await fetch(calendarUrl.toString(), {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!calRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: calRes.status }
    );
  }

  const calData = await calRes.json();
  const events = calData.items || [];

  // Fetch user's contacts for matching
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, email")
    .eq("user_id", user.id);

  if (!contacts) return NextResponse.json({ matched: [] });

  const matched = [];

  for (const event of events) {
    const attendees: { email?: string; displayName?: string }[] =
      event.attendees || [];

    for (const attendee of attendees) {
      const contact = contacts.find(
        (c) =>
          (c.email && attendee.email && c.email.toLowerCase() === attendee.email.toLowerCase()) ||
          (c.full_name &&
            attendee.displayName &&
            c.full_name.toLowerCase() === attendee.displayName.toLowerCase())
      );

      if (contact) {
        // Check if we already have a prep for this event
        const { data: existingPrep } = await supabase
          .from("call_preps")
          .select("id")
          .eq("calendar_event_id", event.id)
          .single();

        if (!existingPrep) {
          matched.push({
            event_id: event.id,
            event_summary: event.summary,
            contact_id: contact.id,
            contact_name: contact.full_name,
            start: event.start?.dateTime || event.start?.date,
          });
        }
      }
    }
  }

  return NextResponse.json({ matched, total_events: events.length });
}
