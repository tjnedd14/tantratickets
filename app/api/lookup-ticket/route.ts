import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code || code.trim().length < 3) {
    return NextResponse.json({ error: "Ticket code required" }, { status: 400 });
  }

  const supabase = getAdminClient();
  const cleanCode = code.trim().toUpperCase();

  // Branch based on prefix
  if (cleanCode.startsWith("OBP-")) {
    // Open Bar Pass lookup
    const { data, error } = await supabase
      .from("open_bar_signups")
      .select("*")
      .eq("ticket_code", cleanCode)
      .maybeSingle();

    if (error) {
      console.error("OBP lookup error:", error);
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      ticket_type: "open_bar",
      ticket: {
        ticket_code: data.ticket_code,
        checked_in: data.checked_in,
        checked_in_at: data.checked_in_at,
        full_name: data.full_name,
        email: data.email,
        date_of_birth: data.date_of_birth,
        event_datetime: data.event_datetime,
      },
    });
  }

  // Regular reservation ticket lookup
  const { data, error } = await supabase
    .from("tickets")
    .select(
      `
      ticket_code,
      guest_name,
      checked_in,
      checked_in_at,
      registration:registrations (
        full_name,
        phone,
        email,
        group_size,
        event_datetime,
        notes,
        table_number,
        issued_by,
        created_at
      )
    `
    )
    .eq("ticket_code", cleanCode)
    .maybeSingle();

  if (error) {
    console.error("Lookup error:", error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ found: false });
  }

  const reg = Array.isArray(data.registration)
    ? data.registration[0]
    : (data.registration as any);

  return NextResponse.json({
    found: true,
    ticket_type: "reservation",
    ticket: {
      ticket_code: data.ticket_code,
      checked_in: data.checked_in,
      checked_in_at: data.checked_in_at,
      client_name: reg?.full_name,
      phone: reg?.phone,
      email: reg?.email,
      group_size: reg?.group_size,
      event_datetime: reg?.event_datetime,
      notes: reg?.notes,
      table_number: reg?.table_number,
      issued_by: reg?.issued_by,
    },
  });
}
