import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

// GET → list all open bar signups (admin only)
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("open_bar_signups")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("List error:", error);
    return NextResponse.json({ error: "Failed to fetch signups" }, { status: 500 });
  }

  return NextResponse.json({ signups: data || [] });
}

// POST → toggle check-in on an Open Bar signup
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ticket_code, checked_in } = body;

    if (!ticket_code) {
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
      .from("open_bar_signups")
      .update({
        checked_in,
        checked_in_at: checked_in ? new Date().toISOString() : null,
      })
      .eq("ticket_code", ticket_code)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to update check-in" },
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
    console.error("Open bar check-in error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE → remove a signup
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, confirm_password } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    if (!confirm_password || confirm_password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Confirmation password is incorrect" },
        { status: 401 }
      );
    }

    const supabase = getAdminClient();
    const { error } = await supabase.from("open_bar_signups").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Open bar delete error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
