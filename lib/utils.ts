// ============================================================
// Tantra Tickets — shared utilities
// ============================================================
//
// IMPORTANT TIMEZONE NOTE
// -----------------------
// Aruba (AST) has a constant UTC offset of -04:00 year-round (no DST).
// All event_datetime values stored in the database are timestamptz
// values that represent a real moment in Aruba time.
//
// The browser/server local time CAN'T be trusted: a hostess might be
// on a laptop set to UTC, or this code may run on a Vercel server
// (UTC). All date-key derivations and "today/tonight" calculations
// MUST go through the Aruba helpers below.
// ============================================================

export const ARUBA_OFFSET = "-04:00";

// ------------------------------------------------------------
// Ticket codes
// ------------------------------------------------------------

export function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TNT-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function generateOpenBarCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "OBP-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ------------------------------------------------------------
// Validation
// ------------------------------------------------------------

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^\+?[0-9]{7,15}$/.test(cleaned);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ------------------------------------------------------------
// Age helpers
// ------------------------------------------------------------

export function calculateAge(dob: string): number {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
    age -= 1;
  }
  return age;
}

// ============================================================
// ARUBA TIMEZONE HELPERS
// ============================================================

/**
 * Get the current moment as an object representing Aruba wall-clock time.
 * Works regardless of the host's local timezone (browser or Vercel server).
 */
export function nowInAruba(): { y: number; m: number; d: number; wd: number; h: number; min: number } {
  return arubaPartsFromDate(new Date());
}

/**
 * Break an ISO/Date into its Aruba wall-clock parts.
 * Uses Intl with timeZone "America/Aruba" so it's correct regardless of host TZ.
 */
export function arubaPartsFromDate(date: Date): { y: number; m: number; d: number; wd: number; h: number; min: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Aruba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    wd: wdMap[map.weekday] ?? 0,
    // Intl returns "24" for midnight in en-US 24h mode; normalize to 0
    h: Number(map.hour) % 24,
    min: Number(map.minute),
  };
}

/**
 * Convert an ISO timestamp (UTC or with any offset) to an Aruba YYYY-MM-DD key.
 * This is the *correct* way to bucket events into "Friday's reservations"
 * vs "Saturday's reservations" — using Aruba wall-clock, not UTC.
 */
export function isoToArubaDateKey(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = arubaPartsFromDate(d);
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

/** Legacy alias — same behavior, kept so existing imports keep working. */
export const isoToDateKey = isoToArubaDateKey;

/** Today's date key in Aruba time (YYYY-MM-DD). */
export function getTodayKey(): string {
  const p = nowInAruba();
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

/** Tomorrow's date key in Aruba time. */
export function getTomorrowKey(): string {
  // Add 24h to "now" then format in Aruba. Crossing midnight in Aruba happens at the same instant
  // for everyone, so adding 24h is safe.
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const p = arubaPartsFromDate(d);
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}

/**
 * "Tonight" = the upcoming Fri or Sat night, OR today if today is Thu/Fri/Sat in Aruba.
 * Used as the default date for "remind people about tonight's event".
 */
export function getTonightKey(): string {
  const p = nowInAruba();
  // Thu/Fri/Sat → tonight is today
  if (p.wd === 4 || p.wd === 5 || p.wd === 6) {
    return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
  }
  // Otherwise → jump forward to next Friday
  const daysToFri = (5 - p.wd + 7) % 7 || 7;
  return arubaDateKeyAddDays(`${p.y}-${pad2(p.m)}-${pad2(p.d)}`, daysToFri);
}

/** Add N days to a YYYY-MM-DD key (calendar-day math, timezone-agnostic). */
export function arubaDateKeyAddDays(key: string, days: number): string {
  const [yyyy, mm, dd] = key.split("-").map(Number);
  // Build a UTC date so arithmetic doesn't drift across DST in the host's tz
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Convert an Aruba YYYY-MM-DD date key into the half-open UTC range
 * that spans that calendar day in Aruba.
 *
 *   Aruba 2026-05-23 00:00 = UTC 2026-05-23 04:00
 *   Aruba 2026-05-24 00:00 = UTC 2026-05-24 04:00
 *
 * Use this when querying Supabase: a reservation made at 11pm Aruba
 * Saturday has a timestamptz of Sunday 03:00 UTC, but it belongs to
 * Saturday. Filtering with these bounds catches that correctly.
 */
export function arubaDayBoundsISO(dateKey: string): { startISO: string; endISO: string } {
  // Aruba is UTC-04:00 year-round (no DST). Start of Aruba day = key T00:00 -04:00.
  const startISO = `${dateKey}T00:00:00${ARUBA_OFFSET}`;
  // End is exclusive: next day at 00:00:00 -04:00
  const nextKey = arubaDateKeyAddDays(dateKey, 1);
  const endISO = `${nextKey}T00:00:00${ARUBA_OFFSET}`;
  return { startISO, endISO };
}

// ------------------------------------------------------------
// Format helpers
// ------------------------------------------------------------

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a YYYY-MM-DD date key for display: "Friday, Apr 24". */
export function formatDateKey(key: string): string {
  if (!key) return "";
  const [yyyy, mm, dd] = key.split("-").map(Number);
  // Use a UTC-anchored Date so the display doesn't shift in odd host TZs.
  const d = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Short day label: "Fri · Apr 24". */
export function formatDateKeyShort(key: string): string {
  if (!key) return "";
  const [yyyy, mm, dd] = key.split("-").map(Number);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd, 12, 0, 0));
  const wk = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const mo = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${wk} · ${mo} ${dd}`;
}

/** Format an event datetime ISO in Aruba time: "Sat, May 23 · 9:00 PM". */
export function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Aruba" });
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "America/Aruba" });
  const dayNum = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/Aruba" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Aruba",
  });
  return `${day}, ${month} ${dayNum} · ${time}`;
}

export function formatEventDateCompact(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Aruba" }).toUpperCase();
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "America/Aruba" }).toUpperCase();
  const dayNum = d.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/Aruba" });
  return `${day} ${month} ${dayNum}`;
}

export function formatEventTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Aruba",
  });
}

// ------------------------------------------------------------
// Default event datetime — used by the admin issue form
// ------------------------------------------------------------

/**
 * The form's <input type="datetime-local"> wants "YYYY-MM-DDTHH:MM"
 * with NO timezone suffix. We use Aruba wall-clock parts so the
 * default lines up with the next Tantra event night.
 *
 * Returns the next Fri or Sat at 9:00 PM Aruba time.
 * If today is already Thu/Fri/Sat and before 9pm Aruba, returns today at 9pm.
 */
export function getDefaultEventDatetime(): string {
  const p = nowInAruba();
  // If today is Fri/Sat and it's before 9pm in Aruba → today at 9pm
  if ((p.wd === 5 || p.wd === 6) && p.h < 21) {
    return `${p.y}-${pad2(p.m)}-${pad2(p.d)}T21:00`;
  }
  // Otherwise find the next Fri or Sat
  let daysAhead = 1;
  let key = `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
  let wd = p.wd;
  while (daysAhead <= 7) {
    wd = (wd + 1) % 7;
    key = arubaDateKeyAddDays(key, 1);
    if (wd === 5 || wd === 6) {
      return `${key}T21:00`;
    }
    daysAhead++;
  }
  // Unreachable fallback
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}T21:00`;
}

/**
 * For the public Open Bar signup confirmation: which is the next active
 * Open Bar session (Fri or Sat 9pm Aruba)? Returns an ISO timestamptz
 * pinned to Aruba (-04:00). This is what gets stored in Supabase.
 */
export function getNextOpenBarDatetime(): string {
  const p = nowInAruba();
  // If it's Fri/Sat in Aruba and we're before 11pm → tonight at 9pm
  if ((p.wd === 5 || p.wd === 6) && p.h < 23) {
    return `${p.y}-${pad2(p.m)}-${pad2(p.d)}T21:00:00${ARUBA_OFFSET}`;
  }
  // Otherwise → upcoming Friday at 9pm
  let key = `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
  let wd = p.wd;
  let safety = 0;
  while (wd !== 5 && safety < 7) {
    wd = (wd + 1) % 7;
    key = arubaDateKeyAddDays(key, 1);
    safety++;
  }
  return `${key}T21:00:00${ARUBA_OFFSET}`;
}

/**
 * Convert a datetime-local string (no timezone, e.g. from <input type="datetime-local">)
 * into an ISO timestamp pinned to Aruba (-04:00).
 *
 *   Input:  "2026-05-23T21:00"
 *   Output: "2026-05-23T21:00:00-04:00"
 */
export function localToArubaIso(local: string): string {
  if (!local) return "";
  if (local.length === 16) return `${local}:00${ARUBA_OFFSET}`;
  if (local.length === 19) return `${local}${ARUBA_OFFSET}`;
  return local;
}

/**
 * Inverse of localToArubaIso — render an ISO timestamp as Aruba wall-clock
 * "YYYY-MM-DDTHH:MM" suitable for a datetime-local input.
 */
export function arubaIsoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = arubaPartsFromDate(d);
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}T${pad2(p.h)}:${pad2(p.min)}`;
}

// ------------------------------------------------------------
// "This weekend" helpers — Aruba time
// ------------------------------------------------------------

export function getThisWeekendKeys(): string[] {
  const p = nowInAruba();
  const daysToFri = p.wd <= 5 ? 5 - p.wd : 6;
  const friKey = arubaDateKeyAddDays(`${p.y}-${pad2(p.m)}-${pad2(p.d)}`, daysToFri);
  return [friKey, arubaDateKeyAddDays(friKey, 1), arubaDateKeyAddDays(friKey, 2)];
}

// ------------------------------------------------------------
// LEGACY (kept for backward compat — do NOT use in new code)
// ------------------------------------------------------------

/** @deprecated Use `arubaIsoToLocal` instead. */
export function toDatetimeLocal(d: Date): string {
  const p = arubaPartsFromDate(d);
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}T${pad2(p.h)}:${pad2(p.min)}`;
}

/** @deprecated Use `isoToArubaDateKey` instead. */
export function toDateKey(d: Date): string {
  const p = arubaPartsFromDate(d);
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`;
}
