import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/**
 * POST /api/send-reminders/preview
 * Body: { event_date: "YYYY-MM-DD" }
 * Returns: { openbar: Recipient[], reservations: Recipient[] }
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { event_date } = body;

    if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
      return NextResponse.json({ error: "Invalid event_date" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const dayStart = new Date(`${event_date}T00:00:00`);
    const dayEnd = new Date(`${event_date}T23:59:59.999`);

    // Open Bar: those not yet checked in
    const { data: openBarData } = await supabase
      .from("open_bar_signups")
      .select("id, full_name, email, ticket_code, checked_in")
      .gte("event_datetime", dayStart.toISOString())
      .lte("event_datetime", dayEnd.toISOString())
      .eq("checked_in", false)
      .order("full_name", { ascending: true });

    const openbar = (openBarData || []).map((r: any) => ({
      id: r.id,
      email: r.email,
      full_name: r.full_name,
      ticket_code: r.ticket_code,
    }));

    // Reservations: with event on that date
    const { data: regs } = await supabase
      .from("registrations")
      .select(`
        id, full_name, email, group_size, table_number,
        tickets ( ticket_code, checked_in )
      `)
      .gte("event_datetime", dayStart.toISOString())
      .lte("event_datetime", dayEnd.toISOString())
      .order("full_name", { ascending: true });

    const reservations: any[] = [];
    for (const r of regs || []) {
      const tickets = ((r as any).tickets || []) as any[];
      const allCheckedIn = tickets.length > 0 && tickets.every((t) => t.checked_in);
      if (allCheckedIn) continue;
      reservations.push({
        id: r.id,
        email: r.email,
        full_name: r.full_name,
        ticket_code: tickets[0]?.ticket_code || null,
        group_size: r.group_size,
        table_number: r.table_number,
      });
    }

    return NextResponse.json({
      openbar,
      reservations,
    });
  } catch (err: any) {
    console.error("Preview error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
