import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { arubaDayBoundsISO } from "@/lib/utils";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/**
 * POST /api/send-reminders/preview
 * Body: { event_date?: "YYYY-MM-DD" }  // omit to load ALL signups
 * Returns: { openbar: Recipient[], reservations: Recipient[] }
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { event_date } = body;

    // event_date is optional — if not provided, load all signups
    const useDateFilter = event_date && /^\d{4}-\d{2}-\d{2}$/.test(event_date);

    const supabase = getAdminClient();

    // Build Open Bar query
    let openBarQuery = supabase
      .from("open_bar_signups")
      .select("id, full_name, email, ticket_code, gender, is_vip, checked_in, event_datetime, date_of_birth")
      .order("full_name", { ascending: true });

    if (useDateFilter) {
      const { startISO, endISO } = arubaDayBoundsISO(event_date);
      openBarQuery = openBarQuery
        .gte("event_datetime", startISO)
        .lt("event_datetime", endISO)
        .eq("checked_in", false);
    }

    const { data: openBarData } = await openBarQuery;

    const openbar = (openBarData || []).map((r: any) => ({
      id: r.id,
      email: r.email,
      full_name: r.full_name,
      ticket_code: r.ticket_code,
      gender: r.gender,
      is_vip: r.is_vip,
      checked_in: r.checked_in,
      event_datetime: r.event_datetime,
      date_of_birth: r.date_of_birth,
    }));

    // Build reservations query
    let regsQuery = supabase
      .from("registrations")
      .select(`
        id, full_name, email, group_size, table_number, is_vip, event_datetime,
        tickets ( ticket_code, checked_in )
      `)
      .order("full_name", { ascending: true });

    if (useDateFilter) {
      const { startISO, endISO } = arubaDayBoundsISO(event_date);
      regsQuery = regsQuery
        .gte("event_datetime", startISO)
        .lt("event_datetime", endISO);
    }

    const { data: regs } = await regsQuery;

    const reservations: any[] = [];
    for (const r of regs || []) {
      const tickets = ((r as any).tickets || []) as any[];
      const allCheckedIn = tickets.length > 0 && tickets.every((t) => t.checked_in);
      // When date-filtering (reminder mode), skip already-attended.
      // When loading all (promo mode), include everyone.
      if (useDateFilter && allCheckedIn) continue;
      reservations.push({
        id: r.id,
        email: r.email,
        full_name: r.full_name,
        ticket_code: tickets[0]?.ticket_code || null,
        group_size: r.group_size,
        table_number: r.table_number,
        is_vip: r.is_vip,
        event_datetime: r.event_datetime,
      });
    }

    return NextResponse.json({
      openbar,
      reservations,
      mode: useDateFilter ? "reminder" : "promo",
    });
  } catch (err: any) {
    console.error("Preview error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
