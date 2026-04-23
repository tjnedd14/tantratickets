import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendWhatsAppReminder } from "@/lib/whatsapp";

/**
 * GET /api/whatsapp/reminder
 *
 * Sends a "tonight's the night" WhatsApp reminder to everyone with a pass for today.
 *
 * Scheduled via Vercel Cron (vercel.json) to run Fri + Sat at 3pm local time.
 *
 * Protected with CRON_SECRET so only Vercel's cron can hit it.
 *
 * NOT ACTIVE until WhatsApp env vars are set.
 */

export async function GET(req: NextRequest) {
  // Vercel cron passes its own Bearer token. Validate it.
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return NextResponse.json(
      { ok: false, skipped: "WhatsApp not configured" },
      { status: 200 }
    );
  }

  const supabase = getAdminClient();

  // Find signups whose event_datetime is today (in Aruba local time).
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: signups, error } = await supabase
    .from("open_bar_signups")
    .select("id, full_name, phone, ticket_code, wa_opt_in, event_datetime, checked_in")
    .eq("wa_opt_in", true)
    .gte("event_datetime", startOfDay.toISOString())
    .lte("event_datetime", endOfDay.toISOString())
    .eq("checked_in", false); // don't remind people who already showed up

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const s of signups || []) {
    if (!s.phone) continue;
    try {
      await sendWhatsAppReminder({
        to: s.phone,
        fullName: s.full_name,
        ticketCode: s.ticket_code,
      });
      sent++;
    } catch (err) {
      failed++;
      console.error(`Reminder failed for ${s.phone}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    total: signups?.length || 0,
    sent,
    failed,
  });
}
