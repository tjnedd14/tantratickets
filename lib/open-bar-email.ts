import { Resend } from "resend";
import { formatEventDateCompact } from "./utils";

const LOGO_URL = "https://i.imgur.com/xAQenGt.png";

type SendParams = {
  to: string;
  fullName: string;
  ticketCode: string;
  eventDatetime: string | null;
  eventName: string;
  venueName: string;
  pdfBuffer: Buffer;
};

export async function sendOpenBarPassEmail({
  to,
  fullName,
  ticketCode,
  eventDatetime,
  eventName,
  venueName,
  pdfBuffer,
}: SendParams) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = process.env.RESEND_FROM_EMAIL || "Tantra <onboarding@resend.dev>";

  const dateStr = eventDatetime ? formatEventDateCompact(eventDatetime) : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Your ${eventName} Open Bar Pass</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <div style="background:#000000;padding:36px 30px 32px;text-align:center;border-top:4px solid #DB130D;">
      <img src="${LOGO_URL}" alt="${eventName}" style="height:70px;width:auto;display:inline-block;margin-bottom:8px;" />
      <div style="font-size:10px;letter-spacing:4px;color:#DB130D;font-weight:bold;margin-top:8px;">${venueName.toUpperCase()}</div>
    </div>

    <div style="background:#DB130D;padding:14px 20px;text-align:center;">
      <div style="font-size:11px;letter-spacing:4px;color:#ffffff;font-weight:bold;">COMPLIMENTARY OPEN BAR PASS</div>
    </div>

    <div style="background:#ffffff;padding:36px 30px 32px;">
      <p style="margin:0 0 8px;font-size:18px;color:#000;font-weight:bold;">Hey ${escapeHtml(fullName)},</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.7;">
        You're in. Your <strong>Open Bar Pass</strong> for ${escapeHtml(eventName)} is attached. Flash the QR code at the door and the hostess will get you set.
      </p>

      <div style="border:2px solid #000000;padding:0;margin:20px 0;">
        <div style="background:#000000;padding:12px 16px;text-align:center;">
          <div style="font-family:'Arial Black',sans-serif;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:2px;">OPEN BAR</div>
          <div style="font-size:10px;letter-spacing:3px;color:#DB130D;font-weight:bold;margin-top:4px;">${escapeHtml(eventName).toUpperCase()}</div>
        </div>

        <div style="background:#fafafa;padding:24px 20px;text-align:center;">
          ${dateStr ? `
            <div style="font-size:10px;letter-spacing:3px;color:#999;font-weight:bold;margin-bottom:4px;">VALID</div>
            <div style="font-family:'Arial Black',sans-serif;font-size:18px;color:#000;font-weight:900;margin-bottom:2px;">${escapeHtml(dateStr)}</div>
            <div style="font-size:12px;color:#DB130D;font-weight:bold;margin-bottom:18px;">9:00 PM — 11:00 PM</div>
          ` : ""}

          <div style="border-top:1px solid #e5e5e5;padding-top:16px;">
            <div style="font-size:10px;letter-spacing:3px;color:#999;font-weight:bold;margin-bottom:6px;">PASS NUMBER</div>
            <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:bold;color:#DB130D;letter-spacing:2px;">${ticketCode}</div>
          </div>
        </div>
      </div>

      <div style="border-left:3px solid #DB130D;padding:4px 0 4px 16px;margin-top:28px;">
        <div style="font-size:11px;color:#DB130D;font-weight:bold;letter-spacing:2px;margin-bottom:8px;">IMPORTANT</div>
        <ul style="margin:0;padding-left:18px;color:#444;font-size:13px;line-height:1.9;">
          <li><strong>18+ only</strong> — valid ID required at the door</li>
          <li>Open Bar runs <strong>9:00 PM – 11:00 PM</strong> on Friday &amp; Saturday</li>
          <li>Show this pass (phone or printed) at entry</li>
          <li>One pass per person — non-transferable</li>
        </ul>
      </div>
    </div>

    <div style="background:#000000;padding:20px;text-align:center;">
      <div style="font-family:'Arial Black',sans-serif;font-size:14px;color:#DB130D;letter-spacing:3px;font-weight:900;">SEE YOU AT ${eventName.toUpperCase()}</div>
    </div>

    <p style="margin:20px 0 0;font-size:11px;color:#666;text-align:center;">
      Questions? Reply to this email.
    </p>
  </div>
</body>
</html>
  `.trim();

  const plainText = `
Hey ${fullName},

Your complimentary Open Bar Pass for ${eventName} is confirmed${dateStr ? ` — valid ${dateStr}, 9:00–11:00 PM` : ""}.

Pass: ${ticketCode}

Show the attached PDF (phone or printed) at the door. 18+ only — valid ID required.

See you at ${eventName}.
  `.trim();

  const result = await resend.emails.send({
    from: fromAddress,
    to: [to],
    subject: `Your ${eventName} Open Bar Pass${dateStr ? ` — ${dateStr}` : ""}`,
    html,
    text: plainText,
    attachments: [
      {
        filename: `${eventName}-open-bar-pass.pdf`,
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
