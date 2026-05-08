import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/**
 * GET /api/subscribers
 * Returns the full subscriber list (most recent first).
 */
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("subscribers")
      .select("id, phone, opted_in, source, last_messaged_at, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Source breakdown
    const sourceCounts: Record<string, number> = {};
    for (const r of data || []) {
      sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      subscribers: data || [],
      total: (data || []).length,
      opted_in_count: (data || []).filter((r) => r.opted_in).length,
      sources: sourceCounts,
    });
  } catch (err: any) {
    console.error("Subscribers list error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/subscribers
 * Body: { id: string } OR { ids: string[] } for bulk
 */
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, ids } = body;
    const targetIds: string[] = ids && Array.isArray(ids) ? ids : id ? [id] : [];

    if (targetIds.length === 0) {
      return NextResponse.json({ error: "No id provided" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase.from("subscribers").delete().in("id", targetIds);
    if (error) throw error;

    return NextResponse.json({ success: true, deleted: targetIds.length });
  } catch (err: any) {
    console.error("Subscribers delete error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/subscribers
 * Body: { id: string, opted_in?: boolean }
 */
export async function PATCH(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, opted_in } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const updates: any = {};
    if (typeof opted_in === "boolean") updates.opted_in = opted_in;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { error } = await supabase.from("subscribers").update(updates).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Subscribers update error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
