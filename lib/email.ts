import { Resend } from "resend";
import { formatEventDate } from "./utils";

const LOGO_URL = "https://i.imgur.com/tEFCuKr.png";

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
    ? `<div style="background:#000000;padding:14px 20px;text-align:center;border-bottom:1px solid #1a1a1a;"><div style="font-size:10px;letter-spacing:3px;color:#DB130D;font-weight:bold;margin-bottom:4px;">EVENT DATE</div><div style="font-family:'Archivo Black','Arial Black',sans-serif;font-size:18px;color:#ffffff;letter-spacing:1px;font-weight:900;">${escapeHtml(dateStr)}</div></div>`
    : "";

  const tableBlock = tableNumber
    ? `<div style="border-top:1px solid #e5e5e5;padding-top:16px;margin-top:16px;"><div style="font-size:10px;letter-spacing:3px;color:#999;font-weight:bold;margin-bottom:6px;">TABLE</div><div style="font-family:'Archivo Black','Arial Black',sans-serif;font-size:32px;font-weight:900;color:#DB130D;letter-spacing:1px;">${escapeHtml(tableNumber)}</div></div>`
    : "";

  const notesBlock =
    notes && notes.trim()
      ? `<div style="border-top:1px solid #e5e5e5;padding-top:16px;margin-top:16px;"><div style="font-size:10px;letter-spacing:3px;color:#999;font-weight:bold;margin-bottom:6px;">NOTES</div><div style="font-size:14px;color:#000;font-style:italic;">${escapeHtml(notes)}</div></div>`
      : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Your ${eventName} Reservation</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <div style="background:#000000;padding:36px 30px 32px;text-align:center;border-top:4px solid #DB130D;">
      <img src="${LOGO_URL}" alt="${eventName}" style="height:70px;width:auto;display:inline-block;margin-bottom:8px;" />
      <div style="font-size:10px;letter-spacing:4px;color:#DB130D;font-weight:bold;margin-top:8px;">${venueName.toUpperCase()}</div>
    </div>

    ${dateBlock}

    <div style="background:#DB130D;padding:10px 20px;text-align:center;">
      <div style="font-size:11px;letter-spacing:4px;color:#ffffff;font-weight:bold;">YOU'RE ON THE LIST</div>
    </div>

    <div style="background:#ffffff;padding:36px 30px 32px;">
      <p style="margin:0 0 8px;font-size:18px;color:#000;font-weight:bold;">Hi ${clientName},</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.7;">
        Your reservation at <strong>${eventName}</strong> is confirmed${dateStr ? ` for <strong>${escapeHtml(dateStr)}</strong>` : ""}. Your ticket is attached — show it at the door and the hostess will take care of your group.
      </p>

      <div style="border:2px solid #000000;padding:0;margin:20px 0;">
        <div style="background:#DB130D;padding:8px 16px;">
          <div style="font-size:10px;letter-spacing:3px;color:#ffffff;font-weight:bold;">YOUR TICKET</div>
        </div>

        <div style="background:#fafafa;padding:24px 20px;text-align:center;">
          <div style="font-size:10px;letter-spacing:3px;color:#999;font-weight:bold;margin-bottom:6px;">TICKET NUMBER</div>
          <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:bold;color:#DB130D;letter-spacing:2px;margin-bottom:20px;">${ticketCode}</div>

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
          <li>Show this ticket to the hostess (PDF or this email)</li>
          <li>She'll verify your party size${tableNumber ? " and table" : ""}</li>
          <li>Your group receives wristbands and enters</li>
        </ol>
      </div>
    </div>

    <div style="background:#000000;padding:20px;text-align:center;">
      <div style="font-family:'Archivo Black','Arial Black',sans-serif;font-size:14px;color:#DB130D;letter-spacing:3px;font-weight:900;">SEE YOU AT ${eventName.toUpperCase()}</div>
    </div>

    <p style="margin:20px 0 0;font-size:11px;color:#666;text-align:center;">
      Questions? Reply to this email or contact the venue directly.
    </p>
  </div>
</body>
</html>
  `.trim();

  const plainText = `
Hi ${clientName},

Your reservation at ${venueName} is confirmed${dateStr ? ` for ${dateStr}` : ""}.

Ticket: ${ticketCode}
Party size: ${guestCount} ${guestCount === 1 ? "guest" : "guests"}
${tableNumber ? `Table: ${tableNumber}\n` : ""}${notes ? `Notes: ${notes}\n` : ""}
Show the attached ticket at the door — the hostess will verify your party size${tableNumber ? " and table" : ""} and hand out wristbands.

See you at ${eventName}.
  `.trim();

  const result = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject: `Your ${eventName} Reservation${dateStr ? ` — ${dateStr}` : ""} · ${guestCount} ${guestCount === 1 ? "Guest" : "Guests"}${tableNumber ? ` · Table ${tableNumber}` : ""}`,
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
