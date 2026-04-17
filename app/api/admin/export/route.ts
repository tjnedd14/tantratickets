import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function checkAuth(req: NextRequest): boolean {
  const headerPw = req.headers.get("x-admin-password");
  const queryPw = req.nextUrl.searchParams.get("pw");
  const pw = headerPw || queryPw;
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdminClient();
  const format = req.nextUrl.searchParams.get("format");

  const { data, error } = await supabase
    .from("registrations")
    .select(
      `
      id,
      full_name,
      phone,
      email,
      group_size,
      event_name,
      event_datetime,
      notes,
      table_number,
      issued_by,
      email_sent,
      email_sent_at,
      created_at,
      tickets (
        ticket_code,
        guest_name,
        person_number,
        checked_in,
        checked_in_at
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Export fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }

  if (format === "csv") {
    const rows: string[] = [];
    rows.push(
      "Issued At,Event Date,Client,Email,Phone,Guest Count,Table,Ticket Code,Ticket Number,Checked In,Checked In At,Notes,Issued By,Email Sent"
    );

    for (const r of data || []) {
      const tickets = (r.tickets as any[]) || [];
      const sortedTickets = tickets.sort((a, b) => a.person_number - b.person_number);
      for (const t of sortedTickets) {
        rows.push(
          [
            new Date(r.created_at).toISOString(),
            r.event_datetime ? new Date(r.event_datetime).toISOString() : "",
            csv(r.full_name),
            csv(r.email),
            csv(r.phone),
            r.group_size,
            csv(r.table_number || ""),
            t.ticket_code,
            t.person_number,
            t.checked_in ? "YES" : "NO",
            t.checked_in_at ? new Date(t.checked_in_at).toISOString() : "",
            csv(r.notes || ""),
            csv(r.issued_by || ""),
            r.email_sent ? "YES" : "NO",
          ].join(",")
        );
      }
    }

    const csvBody = rows.join("\n");
    const date = new Date().toISOString().split("T")[0];
    return new NextResponse(csvBody, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tantra-guests-${date}.csv"`,
      },
    });
  }

  return NextResponse.json({ registrations: data || [] });
}

function csv(value: any): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
