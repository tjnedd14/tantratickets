import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendReminderEmail } from "@/lib/reminder-email";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/**
 * POST /api/email-existing-pass
 * Sends a single open bar signup their EXISTING pass code (no regeneration).
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

    // Send the email — using promo subject style with pass code shown
    await sendReminderEmail({
      to: signup.email,
      fullName: signup.full_name,
      eventDatetime: signup.event_datetime,
      eventName,
      venueName,
      ticketCode: signup.ticket_code,
      isOpenBar: true,
      imageUrls: [],
      customSubject: "🎁 Your Open Bar Pass at Tantra",
      customMessage: "Your Open Bar Pass is below. Just show this at the door — no need to sign up. See you there!",
    });

    // Mark as email sent
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
