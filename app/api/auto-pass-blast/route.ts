import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendReminderEmail } from "@/lib/reminder-email";
import { generateOpenBarCode } from "@/lib/utils";
import QRCode from "qrcode";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/**
 * POST /api/auto-pass-blast
 * Generates new pass codes for selected recipients and emails them.
 * Overwrites existing pass codes.
 *
 * Body: {
 *   openbar_ids: string[],
 *   reservation_ids: string[],     // (reservations get new ticket codes too)
 *   new_event_datetime: string,    // ISO datetime for the new event
 *   subject?: string,              // custom subject (defaults to "Welcome Back...")
 *   message?: string,              // optional message
 *   image_urls?: string[]
 * }
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      openbar_ids,
      reservation_ids,
      new_event_datetime,
      subject,
      message,
      image_urls,
    } = body;

    if (!new_event_datetime) {
      return NextResponse.json({ error: "Missing new_event_datetime" }, { status: 400 });
    }
    const eventDate = new Date(new_event_datetime);
    if (isNaN(eventDate.getTime())) {
      return NextResponse.json({ error: "Invalid new_event_datetime" }, { status: 400 });
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
    const finalSubject = (subject?.trim() || "🎉 Your VIP pass is ready — see you Saturday").trim();

    type Recipient = {
      table: "open_bar_signups" | "registrations" | "tickets";
      id: string;
      ticketRowId?: string; // for registrations: the related ticket row id
      email: string;
      fullName: string;
      newCode: string;
      tableNumber?: string | null;
      groupSize?: number;
      isOpenBar: boolean;
    };
    const recipients: Recipient[] = [];

    // Generate new pass codes + update DB for Open Bar signups
    if (openBarIds.length > 0) {
      const { data: openBar } = await supabase
        .from("open_bar_signups")
        .select("id, full_name, email")
        .in("id", openBarIds);

      for (const s of openBar || []) {
        const newCode = generateOpenBarCode();
        // Update DB: new code, new event datetime, reset check-in
        const { error } = await supabase
          .from("open_bar_signups")
          .update({
            ticket_code: newCode,
            event_datetime: eventDate.toISOString(),
            checked_in: false,
            checked_in_at: null,
            email_sent: false,
            email_sent_at: null,
          })
          .eq("id", s.id);
        if (error) continue;
        recipients.push({
          table: "open_bar_signups",
          id: s.id,
          email: s.email,
          fullName: s.full_name,
          newCode,
          isOpenBar: true,
        });
      }
    }

    // For reservations: update the related ticket row
    if (reservationIds.length > 0) {
      const { data: regs } = await supabase
        .from("registrations")
        .select(`
          id, full_name, email, group_size, table_number,
          tickets ( id, ticket_code )
        `)
        .in("id", reservationIds);

      for (const r of regs || []) {
        const tickets = ((r as any).tickets || []) as any[];
        const firstTicket = tickets[0];
        const newCode = generateOpenBarCode().replace("OBP-", "TNT-");

        // Update reservation event_datetime
        await supabase
          .from("registrations")
          .update({ event_datetime: eventDate.toISOString() })
          .eq("id", r.id);

        // Update or create the ticket row
        if (firstTicket?.id) {
          await supabase
            .from("tickets")
            .update({
              ticket_code: newCode,
              checked_in: false,
              checked_in_at: null,
            })
            .eq("id", firstTicket.id);
        }

        recipients.push({
          table: "registrations",
          id: r.id,
          ticketRowId: firstTicket?.id,
          email: r.email,
          fullName: r.full_name,
          newCode,
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
        message: "No recipients found.",
      });
    }

    // Send emails (with their NEW pass codes)
    let sent = 0;
    let failed = 0;
    const failures: { email: string; error: string }[] = [];

    for (const r of recipients) {
      try {
        // Generate inline QR data URL for Open Bar passes
        let qrDataUrl: string | undefined;
        if (r.isOpenBar) {
          qrDataUrl = await QRCode.toDataURL(r.newCode, {
            width: 300,
            margin: 2,
            color: { dark: "#000000", light: "#FFFFFF" },
            errorCorrectionLevel: "M",
          });
        }

        await sendReminderEmail({
          to: r.email,
          fullName: r.fullName,
          eventDatetime: eventDate.toISOString(),
          eventName,
          venueName,
          ticketCode: r.newCode,
          tableNumber: r.tableNumber,
          groupSize: r.groupSize,
          isOpenBar: r.isOpenBar,
          imageUrls: cleanImages,
          customMessage: message?.trim(),
          customSubject: finalSubject,
          showPassInPromo: true,
          qrDataUrl,
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
      audience: openBarIds.length > 0 && reservationIds.length > 0 ? "both" : openBarIds.length > 0 ? "openbar" : "reservations",
      event_date: eventDate.toISOString().slice(0, 10),
      total_recipients: recipients.length,
      total_sent: sent,
      total_failed: failed,
      image_urls: cleanImages,
      custom_message: `[AUTO-PASS BLAST: ${finalSubject}] ${message?.trim() || ""}`.trim(),
    });

    return NextResponse.json({
      success: true,
      total: recipients.length,
      sent,
      failed,
      failures: failures.slice(0, 10),
    });
  } catch (err: any) {
    console.error("Auto-pass blast error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
