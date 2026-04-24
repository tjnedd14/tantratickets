import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/**
 * POST /api/send-reminders/preview
 * Body: { audience, event_date }
 * Returns: { openbar_count, reservations_count, total }
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

    // Open Bar: count those not yet checked in
    const { count: openBarCount } = await supabase
      .from("open_bar_signups")
      .select("id", { count: "exact", head: true })
      .gte("event_datetime", dayStart.toISOString())
      .lte("event_datetime", dayEnd.toISOString())
      .eq("checked_in", false);

    // Reservations: count registrations with event on that date
    const { data: regs } = await supabase
      .from("registrations")
      .select(`id, tickets ( checked_in )`)
      .gte("event_datetime", dayStart.toISOString())
      .lte("event_datetime", dayEnd.toISOString());

    // Filter out those where all tickets are checked in
    let reservationsCount = 0;
    for (const r of regs || []) {
      const tickets = ((r as any).tickets || []) as any[];
      const allCheckedIn = tickets.length > 0 && tickets.every((t) => t.checked_in);
      if (!allCheckedIn) reservationsCount++;
    }

    return NextResponse.json({
      openbar_count: openBarCount || 0,
      reservations_count: reservationsCount,
      total: (openBarCount || 0) + reservationsCount,
    });
  } catch (err: any) {
    console.error("Preview error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
