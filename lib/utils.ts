export function generateTicketCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TNT-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

export function formatEventDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";

  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const date = d.getDate();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${day}, ${month} ${date} · ${time}`;
}

export function formatEventDateCompact(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const date = d.getDate();
  return `${day} ${month} ${date}`;
}

export function formatEventTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function getDefaultEventDatetime(): string {
  const d = new Date();
  d.setHours(23, 0, 0, 0);
  if (new Date() > d) {
    d.setDate(d.getDate() + 1);
  }
  return toDatetimeLocal(d);
}

export function toDatetimeLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

// Get YYYY-MM-DD from a Date in local timezone
export function toDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Get YYYY-MM-DD from an ISO datetime string in local timezone
export function isoToDateKey(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return toDateKey(d);
}

// "Today" = the current nightlife day. Nightlife day changes at 6am (so 2am bookings count as the previous night's event)
// But we'll keep it simple: "today" is just today's date.
export function getTodayKey(): string {
  return toDateKey(new Date());
}

export function getTomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateKey(d);
}

// "Tonight" = this Friday or Saturday (or today if it's Fri/Sat)
export function getTonightKey(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday, 5 = Fri, 6 = Sat
  if (day === 5 || day === 6 || day === 4) {
    // Thu/Fri/Sat → tonight
    return toDateKey(d);
  }
  // Otherwise, jump to next Friday
  const daysToFri = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysToFri);
  return toDateKey(d);
}

// Get date keys for "this weekend" (upcoming Fri + Sat + Sun)
export function getThisWeekendKeys(): string[] {
  const d = new Date();
  const day = d.getDay();
  const keys: string[] = [];
  // Starting this Friday
  const fri = new Date(d);
  const daysToFri = day <= 5 ? 5 - day : 6; // if today is Sat/Sun, use nearest Fri (already past)
  fri.setDate(d.getDate() + daysToFri);
  for (let i = 0; i < 3; i++) {
    const x = new Date(fri);
    x.setDate(fri.getDate() + i);
    keys.push(toDateKey(x));
  }
  return keys;
}

// Format a date key (YYYY-MM-DD) for display: "Friday, Apr 24"
export function formatDateKey(key: string): string {
  if (!key) return "";
  const [yyyy, mm, dd] = key.split("-").map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// Short day label: "Fri · Apr 24"
export function formatDateKeyShort(key: string): string {
  if (!key) return "";
  const [yyyy, mm, dd] = key.split("-").map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  const wk = d.toLocaleDateString("en-US", { weekday: "short" });
  const mo = d.toLocaleDateString("en-US", { month: "short" });
  return `${wk} · ${mo} ${dd}`;
}
