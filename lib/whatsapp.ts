/**
 * WhatsApp Business API helper.
 * Uses Meta's Cloud API (free messaging, but requires Business Verification + approved templates).
 *
 * Setup required before this works:
 *   1. Meta Business Suite → verify business (3-7 days)
 *   2. Create WhatsApp Business phone number
 *   3. Get approved templates: "openbar_confirmation", "openbar_reminder"
 *   4. Get permanent access token + phone number ID
 *   5. Set env vars:
 *      WHATSAPP_ACCESS_TOKEN=EAAG...
 *      WHATSAPP_PHONE_NUMBER_ID=123456789
 *      WHATSAPP_BUSINESS_ID=98765
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import { formatEventDate } from "./utils";

const META_API_VERSION = "v21.0";

type SendTemplateParams = {
  to: string; // phone with country code, e.g. "2977123456"
  templateName: string;
  languageCode?: string; // "en" or "en_US"
  variables?: string[]; // positional {{1}}, {{2}}, ...
};

/** Low-level: send a pre-approved WhatsApp template message. */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = "en",
  variables = [],
}: SendTemplateParams): Promise<{ id: string } | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.warn("WhatsApp not configured — skipping send");
    return null;
  }

  // Clean phone: digits only, no + or spaces
  const cleanTo = to.replace(/[^\d]/g, "");

  const body = {
    messaging_product: "whatsapp",
    to: cleanTo,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: variables.length
        ? [
            {
              type: "body",
              parameters: variables.map((v) => ({ type: "text", text: v })),
            },
          ]
        : [],
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      data?.error?.message || `WhatsApp API error: ${res.status}`
    );
  }

  return { id: data?.messages?.[0]?.id || "unknown" };
}

/** High-level: send the open bar confirmation after signup. */
export async function sendWhatsAppConfirmation(params: {
  to: string;
  fullName: string;
  ticketCode: string;
  eventDatetime: string | null;
}) {
  const firstName = params.fullName.split(" ")[0];
  const dateStr = params.eventDatetime
    ? formatEventDate(params.eventDatetime)
    : "this weekend";

  return sendWhatsAppTemplate({
    to: params.to,
    templateName: "openbar_confirmation",
    variables: [firstName, dateStr, params.ticketCode],
  });
}

/** High-level: day-of reminder (call this from a cron job on Fri/Sat afternoons). */
export async function sendWhatsAppReminder(params: {
  to: string;
  fullName: string;
  ticketCode: string;
}) {
  const firstName = params.fullName.split(" ")[0];

  return sendWhatsAppTemplate({
    to: params.to,
    templateName: "openbar_reminder",
    variables: [firstName, params.ticketCode],
  });
}

/** High-level: marketing broadcast with custom template. */
export async function sendWhatsAppBroadcast(params: {
  to: string;
  templateName: string;
  variables?: string[];
}) {
  return sendWhatsAppTemplate({
    to: params.to,
    templateName: params.templateName,
    variables: params.variables || [],
  });
}
