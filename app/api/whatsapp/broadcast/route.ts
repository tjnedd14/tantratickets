import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { sendWhatsAppBroadcast } from "@/lib/whatsapp";

/**
 * POST /api/whatsapp/broadcast
 * Body: { template_name, variables?, gender_filter?, opt_in_only? }
 *
 * Sends a WhatsApp template message to an audience of open bar signups.
 * Only sends to people who opted in (wa_opt_in = true).
 *
 * Note: WhatsApp templates must be pre-approved in Meta Business Manager.
 *
 * NOT ACTIVE until WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID env vars are set.
 */

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return NextResponse.json(
      {
        error:
          "WhatsApp not configured yet. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID env vars after Meta approval.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const { template_name, variables, gender_filter, opt_in_only = true } = body;

    if (!template_name) {
      return NextResponse.json({ error: "template_name required" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Build query
    let query = supabase
      .from("open_bar_signups")
      .select("id, full_name, phone, gender, wa_opt_in");

    if (opt_in_only) {
      query = query.eq("wa_opt_in", true);
    }
    if (gender_filter && ["male", "female"].includes(gender_filter)) {
      query = query.eq("gender", gender_filter);
    }

    const { data: recipients, error } = await query;

    if (error) {
      return NextResponse.json({ error: "DB query failed" }, { status: 500 });
    }

    let sent = 0;
    let failed = 0;
    const failures: Array<{ phone: string; error: string }> = [];

    for (const r of recipients || []) {
      if (!r.phone) continue;
      try {
        await sendWhatsAppBroadcast({
          to: r.phone,
          templateName: template_name,
          variables: variables || [],
        });
        sent++;
      } catch (err: any) {
        failed++;
        failures.push({ phone: r.phone, error: err.message || "unknown" });
      }
    }

    return NextResponse.json({
      success: true,
      total: recipients?.length || 0,
      sent,
      failed,
      failures: failures.slice(0, 10), // cap for response size
    });
  } catch (err: any) {
    console.error("Broadcast error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
