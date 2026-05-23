import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/**
 * POST /api/reassign-event-date
 *
 * Bulk-updates `event_datetime` on a list of reservations. Used to recover
 * from the May 2026 clustering bug, but also useful any time you need to
 * move a batch of guests to a different night.
 *
 * Body: {
 *   ids: string[],                // registration IDs
 *   new_event_datetime: string,   // ISO timestamptz (use localToArubaIso on the form value)
 *   confirm_password: string      // re-typed admin password for safety
 * }
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ids, new_event_datetime, confirm_password } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No reservation IDs provided" }, { status: 400 });
    }
    if (ids.length > 500) {
      return NextResponse.json({ error: "Too many at once (max 500)" }, { status: 400 });
    }
    if (!new_event_datetime || typeof new_event_datetime !== "string") {
      return NextResponse.json({ error: "Missing new_event_datetime" }, { status: 400 });
    }
    const d = new Date(new_event_datetime);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid new_event_datetime" }, { status: 400 });
    }
    if (!confirm_password || confirm_password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Confirmation password is incorrect" },
        { status: 401 }
      );
    }

    const cleanIds = ids.filter((x) => typeof x === "string" && x.length > 0);
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from("registrations")
      .update({ event_datetime: d.toISOString() })
      .in("id", cleanIds)
      .select("id");

    if (error) {
      console.error("Reassign error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated: (data || []).length,
      new_event_datetime: d.toISOString(),
    });
  } catch (err: any) {
    console.error("Reassign route error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
