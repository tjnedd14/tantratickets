import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendOpenBarPassEmail } from "@/lib/open-bar-email";
import { buildOpenBarPassPDF } from "@/lib/open-bar-pdf";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/**
 * POST /api/email-existing-pass
 * Sends a single open bar signup their EXISTING pass code, with the
 * branded PDF attachment (same as the signup confirmation flow).
 *
 * Body: { signup_id: string }
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { signup_id } = body;

    if (!signup_id || typeof signup_id !== "string") {
      return NextResponse.json({ error: "Missing signup_id" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data: signup, error } = await supabase
      .from("open_bar_signups")
      .select("full_name, email, ticket_code, event_datetime")
      .eq("id", signup_id)
      .single();

    if (error || !signup) {
      return NextResponse.json({ error: "Signup not found" }, { status: 404 });
    }

    const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Tantra Night Club";
    const venueName = process.env.NEXT_PUBLIC_VENUE_NAME || "Tantra Aruba";

    // Generate the branded PDF with QR code (same fn used at signup)
    const pdfBuffer = await buildOpenBarPassPDF({
      ticketCode: signup.ticket_code,
      fullName: signup.full_name,
      eventDatetime: signup.event_datetime,
      eventName,
      venueName,
    });

    // Send using the same email function the signup flow uses (with PDF attached)
    await sendOpenBarPassEmail({
      to: signup.email,
      fullName: signup.full_name,
      ticketCode: signup.ticket_code,
      eventDatetime: signup.event_datetime,
      eventName,
      venueName,
      pdfBuffer,
    });

    // Mark email_sent
    await supabase
      .from("open_bar_signups")
      .update({ email_sent: true, email_sent_at: new Date().toISOString() })
      .eq("id", signup_id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Email pass error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
