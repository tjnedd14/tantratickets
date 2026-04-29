import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/**
 * POST /api/toggle-vip
 * Body: { table: "open_bar_signups" | "registrations", id: string, is_vip: boolean }
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { table, id, is_vip } = body;

    if (!["open_bar_signups", "registrations"].includes(table)) {
      return NextResponse.json({ error: "Invalid table" }, { status: 400 });
    }
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase
      .from(table)
      .update({ is_vip: Boolean(is_vip) })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
