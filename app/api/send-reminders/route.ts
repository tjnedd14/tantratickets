import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendReminderEmail } from "@/lib/reminder-email";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/**
 * POST /api/send-reminders
 * Body: {
 *   event_date: "YYYY-MM-DD",
 *   openbar_ids: string[],        // signup IDs from preview
 *   reservation_ids: string[],    // registration IDs from preview
 *   image_urls: string[],
 *   custom_message?: string,
 *   confirm_double_send?: boolean
 * }
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      event_date,
      openbar_ids,
      reservation_ids,
      image_urls,
      custom_message,
      confirm_double_send,
    } = body;

    if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
      return NextResponse.json({ error: "Invalid event_date (YYYY-MM-DD)" }, { status: 400 });
    }

    const openBarIds: string[] = Array.isArray(openbar_ids) ? openbar_ids.filter((x) => typeof x === "string") : [];
    const reservationIds: string[] = Array.isArray(reservation_ids) ? reservation_ids.filter((x) => typeof x === "string") : [];

    if (openBarIds.length === 0 && reservationIds.length === 0) {
      return NextResponse.json({ error: "No recipients selected" }, { status: 400 });
    }

    const cleanImages: string[] = Array.isArray(image_urls)
      ? image_urls.filter((u: any) => typeof u === "string" && u.trim().length > 0).slice(0, 3)
      : [];

    const supabase = getAdminClient();
    const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Tantra Night Club";
    const venueName = process.env.NEXT_PUBLIC_VENUE_NAME || "Tantra Aruba";

    // Derive audience for logging
    const audience =
      openBarIds.length > 0 && reservationIds.length > 0
        ? "both"
        : openBarIds.length > 0
        ? "openbar"
        : "reservations";

    // Check for duplicate sends
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: recentLogs } = await supabase
      .from("reminder_logs")
      .select("id, audience, total_sent, created_at")
      .eq("event_date", event_date)
      .gte("created_at", todayStart.toISOString());

    if (recentLogs && recentLogs.length > 0 && !confirm_double_send) {
      return NextResponse.json(
        {
          error: "duplicate",
          message: `Reminders for ${event_date} were already sent today.`,
          previous: recentLogs,
        },
        { status: 409 }
      );
    }

    type Recipient = {
      email: string;
      fullName: string;
      eventDatetime: string | null;
      ticketCode?: string;
      tableNumber?: string | null;
      groupSize?: number;
      isOpenBar: boolean;
    };
    const recipients: Recipient[] = [];

    // Fetch selected Open Bar signups
    if (openBarIds.length > 0) {
      const { data: openBar } = await supabase
        .from("open_bar_signups")
        .select("full_name, email, event_datetime, ticket_code")
        .in("id", openBarIds);

      for (const s of openBar || []) {
        recipients.push({
          email: s.email,
          fullName: s.full_name,
          eventDatetime: s.event_datetime,
          ticketCode: s.ticket_code,
          isOpenBar: true,
        });
      }
    }

    // Fetch selected reservations
    if (reservationIds.length > 0) {
      const { data: regs } = await supabase
        .from("registrations")
        .select(`
          id, full_name, email, event_datetime, group_size, table_number,
          tickets ( ticket_code, checked_in )
        `)
        .in("id", reservationIds);

      for (const r of regs || []) {
        const tickets = ((r as any).tickets || []) as any[];
        const firstTicket = tickets[0];
        recipients.push({
          email: r.email,
          fullName: r.full_name,
          eventDatetime: r.event_datetime,
          ticketCode: firstTicket?.ticket_code,
          tableNumber: r.table_number,
          groupSize: r.group_size,
          isOpenBar: false,
        });
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        sent: 0,
        failed: 0,
        message: "No recipients found for the selected IDs.",
      });
    }

    let sent = 0;
    let failed = 0;
    const failures: { email: string; error: string }[] = [];

    for (const r of recipients) {
      try {
        await sendReminderEmail({
          to: r.email,
          fullName: r.fullName,
          eventDatetime: r.eventDatetime,
          eventName,
          venueName,
          ticketCode: r.ticketCode,
          tableNumber: r.tableNumber,
          groupSize: r.groupSize,
          isOpenBar: r.isOpenBar,
          imageUrls: cleanImages,
          customMessage: custom_message?.trim(),
        });
        sent++;
      } catch (err: any) {
        failed++;
        failures.push({ email: r.email, error: err?.message || "send failed" });
      }
      await new Promise((res) => setTimeout(res, 600));
    }

    // Log
    await supabase.from("reminder_logs").insert({
      audience,
      event_date,
      total_recipients: recipients.length,
      total_sent: sent,
      total_failed: failed,
      image_urls: cleanImages,
      custom_message: custom_message?.trim() || null,
    });

    return NextResponse.json({
      success: true,
      total: recipients.length,
      sent,
      failed,
      failures: failures.slice(0, 10),
    });
  } catch (err: any) {
    console.error("Send reminders error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
