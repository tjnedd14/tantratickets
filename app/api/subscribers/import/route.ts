import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function checkAuth(req: NextRequest): boolean {
  const pw = req.headers.get("x-admin-password");
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

/** Normalize a phone string to "+digits" form (basic). */
function normalizePhone(input: string): string | null {
  if (!input) return null;
  // Strip everything that isn't a digit or leading +
  const trimmed = input.trim();
  let cleaned = trimmed.replace(/[^\d+]/g, "");
  // If multiple + signs, keep only the leading one
  if (cleaned.includes("+")) {
    cleaned = "+" + cleaned.replace(/\+/g, "");
  }
  // Reject if too short (less than 7 digits after +)
  const digitsOnly = cleaned.replace(/\D/g, "");
  if (digitsOnly.length < 7) return null;
  return cleaned;
}

/**
 * POST /api/subscribers/import
 * Imports a list of phone numbers into the subscribers table.
 *
 * Body: {
 *   phones: string[]   // one phone per item, any format
 * }
 *
 * Returns counts: created, duplicates (already in list), invalid.
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { phones } = body;

    if (!Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json({ error: "No phone numbers provided" }, { status: 400 });
    }

    const supabase = getAdminClient();

    let created = 0;
    let duplicates = 0;
    let invalid = 0;
    const invalidExamples: string[] = [];

    // Normalize and dedupe within the input first
    const normalizedSet = new Set<string>();
    for (const raw of phones) {
      if (typeof raw !== "string") {
        invalid++;
        continue;
      }
      const norm = normalizePhone(raw);
      if (!norm) {
        invalid++;
        if (invalidExamples.length < 5) invalidExamples.push(raw);
        continue;
      }
      normalizedSet.add(norm);
    }

    const inputDedup = Array.from(normalizedSet);

    // Check existing in DB
    const { data: existing } = await supabase
      .from("subscribers")
      .select("phone")
      .in("phone", inputDedup);

    const existingSet = new Set((existing || []).map((r) => r.phone));
    const toInsert = inputDedup.filter((p) => !existingSet.has(p));
    duplicates = inputDedup.length - toInsert.length;

    if (toInsert.length > 0) {
      const rows = toInsert.map((phone) => ({
        phone,
        source: "csv_import",
        opted_in: true,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("subscribers")
        .insert(rows)
        .select("id");

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      created = (inserted || []).length;
    }

    return NextResponse.json({
      success: true,
      created,
      duplicates,
      invalid,
      invalid_examples: invalidExamples,
      total_received: phones.length,
    });
  } catch (err: any) {
    console.error("Subscribers import error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
