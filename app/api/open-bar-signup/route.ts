import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import {
  isValidEmail,
  generateOpenBarCode,
  calculateAge,
  getNextOpenBarDatetime,
} from "@/lib/utils";
import { buildOpenBarPassPDF } from "@/lib/open-bar-pdf";
import { sendOpenBarPassEmail } from "@/lib/open-bar-email";

// No admin auth — this endpoint is public
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { full_name, email, date_of_birth } = body;

    // Validate name
    if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
      return NextResponse.json({ error: "Please enter your full name" }, { status: 400 });
    }

    // Validate email
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Validate DOB
    if (!date_of_birth || typeof date_of_birth !== "string") {
      return NextResponse.json(
        { error: "Please enter your date of birth" },
        { status: 400 }
      );
    }
    const dob = new Date(date_of_birth);
    if (isNaN(dob.getTime())) {
      return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });
    }

    // Age check (18+)
    const age = calculateAge(date_of_birth);
    if (age < 18) {
      return NextResponse.json(
        {
          error: "You must be 18 or older to sign up for the Open Bar Pass.",
        },
        { status: 400 }
      );
    }
    if (age > 120) {
      return NextResponse.json({ error: "Please enter a valid date of birth" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const cleanName = full_name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Tantra";
    const venueName = process.env.NEXT_PUBLIC_VENUE_NAME || "Tantra Aruba";

    // Duplicate check (case-insensitive via the unique index)
    const { data: existing } = await supabase
      .from("open_bar_signups")
      .select("id")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: "This email has already signed up. Check your inbox for your pass.",
        },
        { status: 409 }
      );
    }

    // Next open bar session (Fri or Sat 9:00pm)
    const eventDateISO = getNextOpenBarDatetime();

    // Generate unique ticket code (retry on collision)
    let ticketCode = generateOpenBarCode();
    for (let i = 0; i < 5; i++) {
      const { data: clash } = await supabase
        .from("open_bar_signups")
        .select("id")
        .eq("ticket_code", ticketCode)
        .maybeSingle();
      if (!clash) break;
      ticketCode = generateOpenBarCode();
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const ua = req.headers.get("user-agent") || null;

    // Insert
    const { data: signup, error: insertErr } = await supabase
      .from("open_bar_signups")
      .insert({
        full_name: cleanName,
        email: cleanEmail,
        date_of_birth,
        ticket_code: ticketCode,
        event_datetime: eventDateISO,
        ip_address: ip,
        user_agent: ua,
      })
      .select()
      .single();

    if (insertErr || !signup) {
      console.error("Open bar signup insert error:", insertErr);
      // Unique constraint hit → duplicate email
      if (insertErr?.code === "23505") {
        return NextResponse.json(
          {
            error: "This email has already signed up. Check your inbox for your pass.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }

    // Build PDF + send email
    let emailSent = false;
    let emailError: string | null = null;
    try {
      const pdfBuffer = await buildOpenBarPassPDF({
        ticketCode,
        fullName: cleanName,
        eventDatetime: eventDateISO,
        eventName,
        venueName,
      });

      await sendOpenBarPassEmail({
        to: cleanEmail,
        fullName: cleanName,
        ticketCode,
        eventDatetime: eventDateISO,
        eventName,
        venueName,
        pdfBuffer,
      });
      emailSent = true;

      await supabase
        .from("open_bar_signups")
        .update({ email_sent: true, email_sent_at: new Date().toISOString() })
        .eq("id", signup.id);
    } catch (err: any) {
      console.error("Open bar email error:", err);
      emailError = err.message || "Email failed to send";
    }

    return NextResponse.json({
      success: true,
      ticket_code: ticketCode,
      event_datetime: eventDateISO,
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (err: any) {
    console.error("Open bar signup route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
