import { Resend } from "resend";
import { formatEventDate } from "./utils";

const LOGO_URL = "https://i.imgur.com/xAQenGt.png";

type SendTicketEmailParams = {
  to: string;
  clientName: string;
  eventName: string;
  venueName: string;
  guestCount: number;
  ticketCode: string;
  notes: string | null;
  tableNumber: string | null;
  eventDatetime: string | null;
  pdfBuffer: Buffer;
};

export async function sendTicketEmail({
  to,
  clientName,
  eventName,
  venueName,
  guestCount,
  ticketCode,
  notes,
  tableNumber,
  eventDatetime,
  pdfBuffer,
}: SendTicketEmailParams) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = process.env.RESEND_FROM_EMAIL || "Tantra <onboarding@resend.dev>";

  const dateStr = eventDatetime ? formatEventDate(eventDatetime) : "";

  const dateBlock = dateStr
    ? `<div style="background:#000000;padding:14px 20px;text-align:center;border-bottom:1px solid #1a1a1a;">
        <div style="font-size:10px;letter-spacing:3px;color:#DB130D;font-weight:bold;margin-bottom:4px;">EVENT DATE</div>
        <div style="font-family:'Archivo Black','Arial Black',sans-serif;font-size:18px;color:#ffffff;letter-spacing:1px;font-weight:900;">${escapeHtml(dateStr)}</div>
      </div>`
    : "";

  const tableBlock = tableNumber
    ? `<div style="border-top:1px solid #e5e5e5;padding-top:16px;margin-top:16px;">
        <div style="font-size:10px;letter-spacing:3px;color:#999;font-weight:bold;margin-bottom:6px;">TABLE</div>
        <div style="font-family:'Archivo Black','Arial Black',sans-serif;font-size:32px;font-weight:900;color:#DB130D;letter-spacing:1px;">${escapeHtml(tableNumber)}</div>
      </div>`
    : "";

  const notesBlock =
    notes && notes.trim()
      ? `<div style="border-top:1px solid #e5e5e5;padding-top:16px;margin-top:16px;">
          <div style="font-size:10px;letter-spacing:3px;color:#999;font-weight:bold;margin-bottom:6px;">NOTES</div>
          <div style="font-size:14px;color:#000;font-style:italic;">${escapeHtml(notes)}</div>
        </div>`
      : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Your reservation is confirmed — Tantra</title>
</head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <div style="background:#000000;padding:36px 30px 32px;text-align:center;border-top:4px solid #DB130D;">
      <img src="${LOGO_URL}" alt="${escapeHtml(eventName)}" style="height:70px;width:auto;display:inline-block;margin-bottom:8px;" />
      <div style="font-size:10px;letter-spacing:4px;color:#DB130D;font-weight:bold;margin-top:8px;">${escapeHtml(venueName.toUpperCase())}</div>
    </div>

    ${dateBlock}

    <div style="background:#DB130D;padding:10px 20px;text-align:center;">
      <div style="font-size:11px;letter-spacing:4px;color:#ffffff;font-weight:bold;">RESERVATION CONFIRMED</div>
    </div>

    <div style="background:#ffffff;padding:36px 30px 32px;">
      <p style="margin:0 0 8px;font-size:18px;color:#000;font-weight:bold;">Hi ${escapeHtml(clientName)},</p>

      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.7;">
        We've received your reservation at <strong>Tantra</strong>. Here's everything you need for the night — keep this email handy and bring it to the door.
      </p>

      <div style="border:2px solid #000000;padding:0;margin:20px 0;">
        <div style="background:#DB130D;padding:8px 16px;">
          <div style="font-size:10px;letter-spacing:3px;color:#ffffff;font-weight:bold;">YOUR RESERVATION</div>
        </div>

        <div style="background:#fafafa;padding:24px 20px;text-align:center;">
          <div style="font-size:10px;letter-spacing:3px;color:#999;font-weight:bold;margin-bottom:6px;">TICKET NUMBER</div>
          <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:bold;color:#DB130D;letter-spacing:2px;margin-bottom:20px;">${escapeHtml(ticketCode)}</div>

          <div style="border-top:1px solid #e5e5e5;padding-top:16px;">
            <div style="font-size:10px;letter-spacing:3px;color:#999;font-weight:bold;margin-bottom:4px;">PARTY SIZE</div>
            <div style="font-family:'Archivo Black','Arial Black',sans-serif;font-size:48px;font-weight:900;color:#000;line-height:1;">${guestCount}</div>
            <div style="font-size:11px;color:#999;margin-top:4px;letter-spacing:1px;">${guestCount === 1 ? "GUEST" : "GUESTS"}</div>
          </div>

          ${tableBlock}
          ${notesBlock}
        </div>
      </div>

      <div style="border-left:3px solid #DB130D;padding:4px 0 4px 16px;margin-top:28px;">
        <div style="font-size:11px;color:#DB130D;font-weight:bold;letter-spacing:2px;margin-bottom:8px;">AT THE DOOR</div>
        <ol style="margin:0;padding-left:18px;color:#444;font-size:13px;line-height:1.9;">
          <li>Show this email or your PDF ticket</li>
          <li>Present a valid ID</li>
          <li>Collect your wristbands after verification</li>
        </ol>
      </div>

      <div style="margin-top:32px;padding:24px 20px;background:#0b0b0b;border-top:4px solid #DB130D;color:#ffffff;">
        <div style="font-family:'Archivo Black','Arial Black',sans-serif;font-size:18px;line-height:1.35;color:#ffffff;letter-spacing:1px;font-weight:900;text-align:center;margin-bottom:20px;">
          TANTRA NIGHTCLUB<br />VIP RESERVATION RULES
        </div>

        <div style="border-bottom:1px solid #2a2a2a;padding-bottom:18px;margin-bottom:18px;">
          <div style="font-size:12px;color:#DB130D;font-weight:bold;letter-spacing:2px;margin-bottom:8px;">
            RULE 1: QR TICKET &amp; ARRIVAL
          </div>

          <p style="margin:0 0 12px;font-size:13px;color:#d8d8d8;line-height:1.7;">
            Your QR ticket is your entry pass. It's sent to the reservation's primary contact — have it ready at the door on arrival.
          </p>

          <p style="margin:0;font-size:13px;color:#d8d8d8;line-height:1.7;">
            <strong style="color:#ffffff;">Arrival cutoff: 12:00 AM.</strong> At least one guest must be checked in at your table by midnight. At 12:01 AM, unclaimed tables are released to the Terrace waitlist — no exceptions.
          </p>
        </div>

        <div>
          <div style="font-size:12px;color:#DB130D;font-weight:bold;letter-spacing:2px;margin-bottom:8px;">
            RULE 2: GROUP DOWNPAYMENT
          </div>

          <p style="margin:0;font-size:13px;color:#d8d8d8;line-height:1.7;">
            Parties of 11 or more require a downpayment to hold the table. Your dedicated Tantra VIP Host will reach out on WhatsApp with the amount and payment details. Your reservation is confirmed once the downpayment is received.
          </p>
        </div>
      </div>
    </div>

    <div style="background:#000000;padding:22px 20px;text-align:center;">
      <div style="font-family:'Archivo Black','Arial Black',sans-serif;font-size:14px;color:#DB130D;letter-spacing:3px;font-weight:900;margin-bottom:8px;">SEE YOU AT TANTRA.</div>
      <div style="font-size:12px;color:#bbbbbb;letter-spacing:1px;">The Village Mall · Noord, Aruba</div>
    </div>

    <p style="margin:20px 0 0;font-size:11px;color:#666;text-align:center;line-height:1.6;">
      Questions? Just reply here or message your VIP Host on WhatsApp.
    </p>
  </div>
</body>
</html>
  `.trim();

  const plainText = `
Hi ${clientName},

We've received your reservation at Tantra. Here's everything you need for the night — keep this email handy and bring it to the door.

Ticket: ${ticketCode}
Party size: ${guestCount} ${guestCount === 1 ? "guest" : "guests"}
${dateStr ? `Event date: ${dateStr}\n` : ""}${tableNumber ? `Table: ${tableNumber}\n` : ""}${notes ? `Notes: ${notes}\n` : ""}
AT THE DOOR
1. Show this email or your PDF ticket
2. Present a valid ID
3. Collect your wristbands after verification

TANTRA NIGHTCLUB — VIP RESERVATION RULES

Rule 1: QR Ticket & Arrival
Your QR ticket is your entry pass. It's sent to the reservation's primary contact — have it ready at the door on arrival.

Arrival cutoff: 12:00 AM. At least one guest must be checked in at your table by midnight. At 12:01 AM, unclaimed tables are released to the Terrace waitlist — no exceptions.

Rule 2: Group Downpayment
Parties of 11 or more require a downpayment to hold the table. Your dedicated Tantra VIP Host will reach out on WhatsApp with the amount and payment details. Your reservation is confirmed once the downpayment is received.

See you at Tantra.
The Village Mall · Noord, Aruba

Questions? Just reply here or message your VIP Host on WhatsApp.
  `.trim();

  const result = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject: "Your reservation is confirmed — Tantra",
    html,
    text: plainText,
    attachments: [
      {
        filename: `${eventName}-ticket.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  if (result.error) {
    throw new Error(result.error.message || "Failed to send email");
  }

  return result.data;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
