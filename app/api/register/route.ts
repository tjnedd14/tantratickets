import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";
import { generateTicketCode, isValidPhone, normalizePhone } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { full_name, phone, group_size, guest_names } = body;

    // Validation
    if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
      return NextResponse.json({ error: "Invalid full name" }, { status: 400 });
    }
    if (!phone || !isValidPhone(phone)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }
    if (!Number.isInteger(group_size) || group_size < 1 || group_size > 5) {
      return NextResponse.json({ error: "Group size must be 1-5" }, { status: 400 });
    }
    if (!Array.isArray(guest_names) || guest_names.length !== group_size) {
      return NextResponse.json({ error: "Guest names mismatch" }, { status: 400 });
    }
    if (guest_names.some((n: any) => typeof n !== "string" || n.trim().length < 2)) {
      return NextResponse.json({ error: "Each guest must have a name" }, { status: 400 });
    }

    const supabase = getAdminClient();
    const normalizedPhone = normalizePhone(phone);
    const cleanName = full_name.trim();

    // Capture request metadata
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const ua = req.headers.get("user-agent") || null;

    // 1. Insert registration
    const { data: registration, error: regErr } = await supabase
      .from("registrations")
      .insert({
        full_name: cleanName,
        phone: normalizedPhone,
        group_size,
        event_name: process.env.NEXT_PUBLIC_EVENT_NAME || "Tantra",
        ip_address: ip,
        user_agent: ua,
      })
      .select()
      .single();

    if (regErr || !registration) {
      console.error("Registration insert error:", regErr);
      return NextResponse.json({ error: "Failed to save registration" }, { status: 500 });
    }

    // 2. Build tickets — unique code per ticket, retry on collision
    const ticketsToInsert = guest_names.map((name: string, idx: number) => ({
      registration_id: registration.id,
      ticket_code: generateTicketCode(),
      guest_name: name.trim(),
      phone: normalizedPhone,
      person_number: idx + 1,
    }));

    const { data: insertedTickets, error: tickErr } = await supabase
      .from("tickets")
      .insert(ticketsToInsert)
      .select();

    if (tickErr || !insertedTickets) {
      console.error("Tickets insert error:", tickErr);
      // rollback registration if tickets fail
      await supabase.from("registrations").delete().eq("id", registration.id);
      return NextResponse.json({ error: "Failed to create tickets" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      registration_id: registration.id,
      tickets: insertedTickets.map((t) => ({
        ticket_code: t.ticket_code,
        guest_name: t.guest_name,
        phone: t.phone,
        person_number: t.person_number,
      })),
    });
  } catch (err: any) {
    console.error("Register route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
