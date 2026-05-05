import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/**
 * POST /api/bulk-reset-checkins
 * Resets check-ins. Requires confirmation flag.
 *
 * Body: {
 *   target: "openbar" | "reservations" | "both",
 *   confirm: true                    // safety flag, must be exactly true
 * }
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { target, confirm } = body;

    if (confirm !== true) {
      return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
    }

    if (!["openbar", "reservations", "both"].includes(target)) {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }

    const supabase = getAdminClient();
    let openBarReset = 0;
    let ticketsReset = 0;

    if (target === "openbar" || target === "both") {
      const { data, error } = await supabase
        .from("open_bar_signups")
        .update({ checked_in: false, checked_in_at: null })
        .eq("checked_in", true)
        .select("id");
      if (error) {
        console.error("Open bar reset error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      openBarReset = (data || []).length;
    }

    if (target === "reservations" || target === "both") {
      const { data, error } = await supabase
        .from("tickets")
        .update({ checked_in: false, checked_in_at: null })
        .eq("checked_in", true)
        .select("id");
      if (error) {
        console.error("Tickets reset error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      ticketsReset = (data || []).length;
    }

    return NextResponse.json({
      success: true,
      openbar_reset: openBarReset,
      tickets_reset: ticketsReset,
      total: openBarReset + ticketsReset,
    });
  } catch (err: any) {
    console.error("Bulk reset error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
