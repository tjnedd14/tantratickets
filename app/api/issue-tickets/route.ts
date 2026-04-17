import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import {
  generateTicketCode,
  isValidPhone,
  normalizePhone,
  isValidEmail,
} from "@/lib/utils";
import { buildTicketPDF } from "@/lib/pdf";
import { sendTicketEmail } from "@/lib/email";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      full_name,
      phone,
      email,
      group_size,
      notes,
      issued_by,
      table_number,
    } = body;

    if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
      return NextResponse.json({ error: "Invalid client name" }, { status: 400 });
    }
    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (!Number.isInteger(group_size) || group_size < 1 || group_size > 50) {
      return NextResponse.json(
        { error: "Party size must be between 1 and 50" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const normalizedPhone = normalizePhone(phone);
    const cleanName = full_name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanNotes = notes?.trim() || null;
    const cleanTable = table_number?.trim() || null;
    const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Tantra";
    const venueName = process.env.NEXT_PUBLIC_VENUE_NAME || "Tantra Aruba";

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const ua = req.headers.get("user-agent") || null;

    const { data: registration, error: regErr } = await supabase
      .from("registrations")
      .insert({
        full_name: cleanName,
        phone: normalizedPhone,
        email: cleanEmail,
        group_size,
        notes: cleanNotes,
        table_number: cleanTable,
        issued_by: issued_by?.trim() || null,
        event_name: eventName,
        ip_address: ip,
        user_agent: ua,
      })
      .select()
      .single();

    if (regErr || !registration) {
      console.error("Registration insert error:", regErr);
      return NextResponse.json(
        { error: "Failed to save registration" },
        { status: 500 }
      );
    }

    const ticketCode = generateTicketCode();
    const { data: insertedTicket, error: tickErr } = await supabase
      .from("tickets")
      .insert({
        registration_id: registration.id,
        ticket_code: ticketCode,
        guest_name: cleanName,
        phone: normalizedPhone,
        person_number: 1,
      })
      .select()
      .single();

    if (tickErr || !insertedTicket) {
      console.error("Ticket insert error:", tickErr);
      await supabase.from("registrations").delete().eq("id", registration.id);
      return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
    }

    const pdfBuffer = buildTicketPDF({
      ticketCode,
      clientName: cleanName,
      guestCount: group_size,
      notes: cleanNotes,
      tableNumber: cleanTable,
      eventName,
      venueName,
    });

    let emailSent = false;
    let emailError: string | null = null;
    try {
      await sendTicketEmail({
        to: cleanEmail,
        clientName: cleanName,
        eventName,
        venueName,
        guestCount: group_size,
        ticketCode,
        notes: cleanNotes,
        tableNumber: cleanTable,
        pdfBuffer,
      });
      emailSent = true;

      await supabase
        .from("registrations")
        .update({ email_sent: true, email_sent_at: new Date().toISOString() })
        .eq("id", registration.id);
    } catch (err: any) {
      console.error("Email send error:", err);
      emailError = err.message || "Email failed to send";
    }

    return NextResponse.json({
      success: true,
      registration_id: registration.id,
      client_name: cleanName,
      email: cleanEmail,
      guest_count: group_size,
      ticket_code: ticketCode,
      notes: cleanNotes,
      table_number: cleanTable,
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (err: any) {
    console.error("Issue ticket route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
