import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import {
  isValidEmail,
  isValidPhone,
  normalizePhone,
} from "@/lib/utils";
import { buildTicketPDF } from "@/lib/pdf";
import { sendTicketEmail } from "@/lib/email";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

// ========== DELETE ==========
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, confirm_password } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Reservation ID required" }, { status: 400 });
    }

    // Require a second password confirmation (from the dialog)
    if (!confirm_password || confirm_password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Confirmation password is incorrect" },
        { status: 401 }
      );
    }

    const supabase = getAdminClient();

    // Delete tickets first (FK), then registration
    // Actually, we have ON DELETE CASCADE in theory, but let's be explicit for safety
    const { error: tickErr } = await supabase
      .from("tickets")
      .delete()
      .eq("registration_id", id);

    if (tickErr) {
      console.error("Ticket delete error:", tickErr);
      return NextResponse.json(
        { error: "Failed to delete tickets" },
        { status: 500 }
      );
    }

    const { error: regErr } = await supabase.from("registrations").delete().eq("id", id);

    if (regErr) {
      console.error("Registration delete error:", regErr);
      return NextResponse.json(
        { error: "Failed to delete reservation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("Delete route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ========== PATCH (edit) ==========
export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      id,
      full_name,
      phone,
      email,
      group_size,
      notes,
      table_number,
      event_datetime,
      issued_by,
      send_email,
    } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Reservation ID required" }, { status: 400 });
    }
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

    let eventDateISO: string | null = null;
    if (event_datetime) {
      const d = new Date(event_datetime);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid event date/time" }, { status: 400 });
      }
      eventDateISO = d.toISOString();
    }

    const supabase = getAdminClient();
    const normalizedPhone = normalizePhone(phone);
    const cleanName = full_name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanNotes = notes?.trim() || null;
    const cleanTable = table_number?.trim() || null;
    const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Tantra";
    const venueName = process.env.NEXT_PUBLIC_VENUE_NAME || "Tantra Aruba";

    // Update registration
    const { data: registration, error: regErr } = await supabase
      .from("registrations")
      .update({
        full_name: cleanName,
        phone: normalizedPhone,
        email: cleanEmail,
        group_size,
        notes: cleanNotes,
        table_number: cleanTable,
        event_datetime: eventDateISO,
        issued_by: issued_by?.trim() || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (regErr || !registration) {
      console.error("Registration update error:", regErr);
      return NextResponse.json(
        { error: "Failed to update reservation" },
        { status: 500 }
      );
    }

    // Update the ticket's guest_name and phone (to keep in sync)
    const { data: ticket, error: tickErr } = await supabase
      .from("tickets")
      .update({
        guest_name: cleanName,
        phone: normalizedPhone,
      })
      .eq("registration_id", id)
      .select()
      .single();

    if (tickErr) {
      console.error("Ticket update error:", tickErr);
      // Not fatal — continue
    }

    let emailSent = false;
    let emailError: string | null = null;

    if (send_email && ticket) {
      try {
        const pdfBuffer = await buildTicketPDF({
          ticketCode: ticket.ticket_code,
          clientName: cleanName,
          guestCount: group_size,
          notes: cleanNotes,
          tableNumber: cleanTable,
          eventDatetime: eventDateISO,
          eventName,
          venueName,
        });

        await sendTicketEmail({
          to: cleanEmail,
          clientName: cleanName,
          eventName,
          venueName,
          guestCount: group_size,
          ticketCode: ticket.ticket_code,
          notes: cleanNotes,
          tableNumber: cleanTable,
          eventDatetime: eventDateISO,
          pdfBuffer,
        });
        emailSent = true;

        await supabase
          .from("registrations")
          .update({ email_sent: true, email_sent_at: new Date().toISOString() })
          .eq("id", id);
      } catch (err: any) {
        console.error("Email re-send error:", err);
        emailError = err.message || "Email failed to send";
      }
    }

    return NextResponse.json({
      success: true,
      registration_id: id,
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (err: any) {
    console.error("Patch route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
