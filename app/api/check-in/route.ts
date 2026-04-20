import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

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
    const { ticket_code, checked_in } = body;

    if (!ticket_code || typeof ticket_code !== "string") {
      return NextResponse.json({ error: "ticket_code required" }, { status: 400 });
    }
    if (typeof checked_in !== "boolean") {
      return NextResponse.json(
        { error: "checked_in must be true or false" },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("tickets")
      .update({
        checked_in,
        checked_in_at: checked_in ? new Date().toISOString() : null,
      })
      .eq("ticket_code", ticket_code)
      .select()
      .single();

    if (error || !data) {
      console.error("Check-in update error:", error);
      return NextResponse.json(
        { error: "Failed to update check-in status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ticket_code: data.ticket_code,
      checked_in: data.checked_in,
      checked_in_at: data.checked_in_at,
    });
  } catch (err: any) {
    console.error("Check-in route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
