import { NextRequest, NextResponse } from "next/server";
import { getDb, LOCAL_USER_ID } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { access_token } = await request.json();
  if (!access_token) {
    return NextResponse.json(
      { error: "Google OAuth access_token required" },
      { status: 400 }
    );
  }

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

  const db = getDb();
  const contacts = db
    .prepare("SELECT id, full_name, email FROM contacts WHERE user_id = ?")
    .all(LOCAL_USER_ID) as { id: string; full_name: string; email: string | null }[];

  if (contacts.length === 0) return NextResponse.json({ matched: [] });

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
        const existingPrep = db
          .prepare("SELECT id FROM call_preps WHERE calendar_event_id = ?")
          .get(event.id);

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
