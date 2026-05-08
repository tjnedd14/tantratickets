import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { generateOpenBarCode } from "@/lib/utils";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

type Guest = {
  full_name: string;
  email: string;
  phone?: string;
};

/**
 * POST /api/issue-open-bar-pass
 * Generates pass codes for one or more guests, saves to open_bar_signups.
 * Does NOT send emails.
 *
 * Body: {
 *   guests: Guest[],
 *   event_datetime: string  // ISO datetime
 * }
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { guests, event_datetime } = body;

    if (!Array.isArray(guests) || guests.length === 0) {
      return NextResponse.json({ error: "No guests provided" }, { status: 400 });
    }

    if (!event_datetime) {
      return NextResponse.json({ error: "Missing event_datetime" }, { status: 400 });
    }

    const eventDate = new Date(event_datetime);
    if (isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: "Invalid event_datetime" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const created: { name: string; email: string; phone: string | null; ticket_code: string }[] = [];
    const errors: { name: string; email: string; error: string }[] = [];

    for (const g of guests as Guest[]) {
      const name = (g.full_name || "").trim();
      const email = (g.email || "").trim().toLowerCase();
      const phone = (g.phone || "").trim() || null;

      if (!name || name.length < 2) {
        errors.push({ name: name || "(no name)", email, error: "Invalid name" });
        continue;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ name, email, error: "Invalid email" });
        continue;
      }

      // Check if email already exists for this event date
      const dayStart = new Date(eventDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(eventDate);
      dayEnd.setHours(23, 59, 59, 999);

      const { data: existing } = await supabase
        .from("open_bar_signups")
        .select("id, ticket_code")
        .eq("email", email)
        .gte("event_datetime", dayStart.toISOString())
        .lte("event_datetime", dayEnd.toISOString())
        .maybeSingle();

      if (existing) {
        errors.push({ name, email, error: `Already has pass ${existing.ticket_code} for this date` });
        continue;
      }

      const ticketCode = generateOpenBarCode();

      // Use placeholder DOB to satisfy NOT NULL — admin-issued passes don't collect DOB
      const placeholderDob = "1990-01-01";

      const { error: insertError } = await supabase.from("open_bar_signups").insert({
        full_name: name,
        email,
        phone,
        gender: null,
        wa_opt_in: false,
        location: null,
        date_of_birth: placeholderDob,
        ticket_code: ticketCode,
        event_datetime: eventDate.toISOString(),
        email_sent: false,
        is_vip: false,
      });

      if (insertError) {
        errors.push({ name, email, error: insertError.message });
        continue;
      }

      created.push({ name, email, phone, ticket_code: ticketCode });
    }

    return NextResponse.json({
      success: true,
      created,
      errors,
      total_created: created.length,
      total_errors: errors.length,
    });
  } catch (err: any) {
    console.error("Issue pass error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
