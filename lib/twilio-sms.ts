/**
 * Twilio SMS sender — Aruba-only.
 *
 * Hard-rejects any phone number that doesn't start with +297 so we don't
 * accidentally burn credits on international sends or hit US 10DLC issues.
 */
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let client: ReturnType<typeof twilio> | null = null;
function getClient() {
  if (!accountSid || !authToken) {
    throw new Error("Twilio not configured — set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars");
  }
  if (!client) {
    client = twilio(accountSid, authToken);
  }
  return client;
}

/**
 * Normalize a phone number to E.164 format with +297 for Aruba.
 * Accepts inputs like:
 *   "+297 593 4567" → "+2975934567"
 *   "297 593 4567"  → "+2975934567"
 *   "5934567"       → "+2975934567"  (assumes Aruba)
 *   "+1 555 1234"   → throws (not Aruba)
 */
export function normalizeArubaPhone(input: string): string {
  if (!input) throw new Error("No phone number provided");
  // Strip everything except digits
  let digits = input.replace(/\D/g, "");
  if (!digits) throw new Error("Phone number has no digits");

  // If starts with 297, prefix is already there
  if (digits.startsWith("297")) {
    // 297XXXXXXX (10 digits total: 297 + 7-digit local)
    if (digits.length !== 10) {
      throw new Error(`Invalid Aruba number: expected 10 digits including 297 prefix, got ${digits.length}`);
    }
    return "+" + digits;
  }
  // Bare 7-digit local Aruba number → prepend 297
  if (digits.length === 7) {
    return "+297" + digits;
  }
  // Anything else — reject as non-Aruba (could be +1, +599, etc.)
  throw new Error(`SMS to non-Aruba numbers is disabled. Phone "${input}" did not normalize to +297 format.`);
}

/**
 * Send an Open Bar pass via SMS to an Aruba phone number.
 * Returns the Twilio message SID on success.
 */
export async function sendPassSms(params: {
  to: string;
  fullName: string;
  ticketCode: string;
  eventDatetime?: string | null;
  baseUrl: string;
}): Promise<{ sid: string; to: string }> {
  if (!fromNumber) {
    throw new Error("TWILIO_PHONE_NUMBER env var is not set");
  }

  // Validate & normalize the destination
  const toFormatted = normalizeArubaPhone(params.to);

  // Build a friendly date label, e.g. "Sat May 23 9pm"
  let eventLabel = "Fri & Sat 9-11pm";
  if (params.eventDatetime) {
    try {
      const d = new Date(params.eventDatetime);
      if (!isNaN(d.getTime())) {
        const day = d.toLocaleDateString("en-US", { weekday: "short" });
        const month = d.toLocaleDateString("en-US", { month: "short" });
        const date = d.getDate();
        const hour = d.getHours();
        const minute = d.getMinutes();
        const time = hour > 12 ? `${hour - 12}${minute > 0 ? ":" + String(minute).padStart(2, "0") : ""}pm`
          : hour === 12 ? `12${minute > 0 ? ":" + String(minute).padStart(2, "0") : ""}pm`
          : `${hour || 12}am`;
        eventLabel = `${day} ${month} ${date} ${time}`;
      }
    } catch {
      /* fall back to default */
    }
  }

  const viewUrl = `${params.baseUrl.replace(/\/$/, "")}/p/${params.ticketCode}`;
  const firstName = params.fullName.trim().split(/\s+/)[0] || "there";

  const body = [
    `🎉 Hi ${firstName}, your TANTRA Open Bar Pass:`,
    "",
    `Pass: ${params.ticketCode}`,
    `View: ${viewUrl}`,
    "",
    `${eventLabel} · Show QR at door`,
    "",
    "Reply STOP to opt out",
  ].join("\n");

  const message = await getClient().messages.create({
    body,
    from: fromNumber,
    to: toFormatted,
  });

  return { sid: message.sid, to: toFormatted };
}
