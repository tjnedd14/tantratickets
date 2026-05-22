import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendPassSms } from "@/lib/twilio-sms";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/**
 * POST /api/send-pass-sms
 * Body: { signup_id: string }
 *
 * Sends the Open Bar Pass SMS to the signup's stored phone number.
 * Hard-fails if the number isn't Aruba (+297).
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { signup_id } = body;

  if (!signup_id) {
    return NextResponse.json({ error: "signup_id is required" }, { status: 400 });
  }

  const supabase = getAdminClient();

  const { data: signup, error: fetchErr } = await supabase
    .from("open_bar_signups")
    .select("id, full_name, email, phone, ticket_code, event_datetime")
    .eq("id", signup_id)
    .single();

  if (fetchErr || !signup) {
    return NextResponse.json({ error: "Signup not found" }, { status: 404 });
  }

  if (!signup.phone || signup.phone.trim().length === 0) {
    return NextResponse.json(
      { error: "This guest has no phone number on file. Add one in Supabase or via the admin tools." },
      { status: 400 }
    );
  }

  // Build the public base URL — prefer the request origin, fall back to env var
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host");
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || "https://tickets.tantraaruba.com");

  try {
    const result = await sendPassSms({
      to: signup.phone,
      fullName: signup.full_name,
      ticketCode: signup.ticket_code,
      eventDatetime: signup.event_datetime,
      baseUrl,
    });

    // Mark sms_sent (column may not exist yet — ignore errors silently so the send still counts)
    await supabase
      .from("open_bar_signups")
      .update({ sms_sent: true, sms_sent_at: new Date().toISOString() })
      .eq("id", signup_id)
      .then(() => {})
      .catch(() => {});

    return NextResponse.json({
      ok: true,
      sid: result.sid,
      to: result.to,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to send SMS" },
      { status: 500 }
    );
  }
}
