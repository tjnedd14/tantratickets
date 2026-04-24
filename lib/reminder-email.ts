import { Resend } from "resend";
import { formatEventDateCompact } from "./utils";

const LOGO_URL = "https://i.imgur.com/xAQenGt.png";

type SendReminderParams = {
  to: string;
  fullName: string;
  eventDatetime: string | null;
  eventName: string;
  venueName: string;
  ticketCode?: string; // Open Bar pass code, or null for reservations
  tableNumber?: string | null;
  groupSize?: number;
  isOpenBar: boolean;
  imageUrls: string[];
  customMessage?: string;
};

export async function sendReminderEmail(params: SendReminderParams) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromAddress = process.env.RESEND_FROM_EMAIL || "Tantra <onboarding@resend.dev>";

  const dateStr = params.eventDatetime ? formatEventDateCompact(params.eventDatetime) : "";
  const firstName = params.fullName.split(" ")[0];

  const subject = params.isOpenBar
    ? `🔥 Tonight — Your Open Bar Pass at Tantra`
    : `🔥 Tonight — Your Reservation at Tantra`;

  const imagesHtml = params.imageUrls
    .filter((url) => url.trim().length > 0)
    .map(
      (url) => `
      <tr>
        <td style="padding: 0 0 12px 0;">
          <img src="${url}" alt="Tantra Event" style="width: 100%; max-width: 560px; height: auto; display: block; border: 0;" />
        </td>
      </tr>
    `
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background:#050505; font-family: 'Helvetica Neue', Arial, sans-serif; color:#fff;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#050505;">
    <tr>
      <td align="center" style="padding: 30px 15px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px; background:#0E0E0E; border: 1px solid #1a1a1a;">

          <!-- Red top bar -->
          <tr><td style="background:#DB130D; height:6px; font-size:0; line-height:0;">&nbsp;</td></tr>

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding: 40px 30px 20px;">
              <img src="${LOGO_URL}" alt="Tantra" style="height:60px; width:auto; display:inline-block;" />
            </td>
          </tr>

          <!-- TONIGHT banner -->
          <tr>
            <td align="center" style="padding: 0 30px 30px;">
              <div style="font-size:11px; letter-spacing:4px; color:#DB130D; font-weight:bold; margin-bottom:8px;">TONIGHT · ${dateStr.toUpperCase()}</div>
              <div style="font-size:32px; font-weight:900; letter-spacing:-1px; line-height:1.1; color:#fff;">
                ${params.isOpenBar ? "YOUR OPEN BAR<br/>STARTS AT 9PM" : "SEE YOU<br/>TONIGHT"}
              </div>
              <div style="width:40px; height:2px; background:#DB130D; margin:20px auto 0;"></div>
            </td>
          </tr>

          ${imagesHtml ? `
          <!-- Event images -->
          <tr>
            <td style="padding: 0 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${imagesHtml}
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 30px 10px; color:#fff;">
              <p style="font-size:18px; font-weight:bold; margin:0 0 8px;">Hey ${firstName},</p>
              <p style="font-size:15px; line-height:1.5; color:#bbb; margin:0;">
                ${
                  params.isOpenBar
                    ? "Just a reminder — your Open Bar Pass is active tonight. Doors at 9PM sharp, bar runs until 11PM."
                    : `Your table's locked in for tonight. Party of ${params.groupSize || 1}${params.tableNumber ? ` at Table ${params.tableNumber}` : ""}.`
                }
              </p>
              ${params.customMessage ? `<p style="font-size:15px; line-height:1.5; color:#fff; margin:16px 0 0; padding:16px; background:#1a1a1a; border-left:3px solid #DB130D;">${params.customMessage}</p>` : ""}
            </td>
          </tr>

          <!-- Ticket/Pass card -->
          ${params.ticketCode ? `
          <tr>
            <td style="padding: 20px 30px 10px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#000; border:1px solid #2a2a2a;">
                <tr>
                  <td style="padding: 24px; text-align:center;">
                    <div style="font-size:10px; letter-spacing:3px; color:#888; margin-bottom:8px;">
                      ${params.isOpenBar ? "YOUR PASS" : "TICKET NUMBER"}
                    </div>
                    <div style="font-family:'Courier New', monospace; font-size:22px; font-weight:bold; color:#fff; letter-spacing:3px;">
                      ${params.ticketCode}
                    </div>
                    <div style="font-size:11px; color:#888; margin-top:10px;">Show this at the door</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- Event details -->
          <tr>
            <td style="padding: 20px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #2a2a2a; padding-top:20px;">
                <tr>
                  <td style="padding: 8px 0; color:#888; font-size:12px; letter-spacing:1px;">WHEN</td>
                  <td style="padding: 8px 0; color:#fff; font-size:14px; font-weight:bold; text-align:right;">${dateStr}</td>
                </tr>
                ${params.isOpenBar ? `
                <tr>
                  <td style="padding: 8px 0; color:#888; font-size:12px; letter-spacing:1px;">OPEN BAR</td>
                  <td style="padding: 8px 0; color:#DB130D; font-size:14px; font-weight:bold; text-align:right;">9:00 PM — 11:00 PM</td>
                </tr>
                ` : `
                <tr>
                  <td style="padding: 8px 0; color:#888; font-size:12px; letter-spacing:1px;">PARTY</td>
                  <td style="padding: 8px 0; color:#fff; font-size:14px; font-weight:bold; text-align:right;">${params.groupSize || 1} ${(params.groupSize || 1) === 1 ? "guest" : "guests"}${params.tableNumber ? ` · Table ${params.tableNumber}` : ""}</td>
                </tr>
                `}
                <tr>
                  <td style="padding: 8px 0; color:#888; font-size:12px; letter-spacing:1px;">WHERE</td>
                  <td style="padding: 8px 0; color:#fff; font-size:14px; font-weight:bold; text-align:right;">Tantra Aruba</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Address + map link -->
          <tr>
            <td align="center" style="padding: 20px 30px 30px;">
              <a href="https://maps.google.com/?q=Tantra+Aruba+Palm+Beach" style="color:#DB130D; text-decoration:none; font-size:12px; letter-spacing:1px;">
                📍 J.E IRAUSQUIN BLVD 348 A · PALM BEACH
              </a>
            </td>
          </tr>

          <!-- Red bottom bar -->
          <tr><td style="background:#DB130D; height:6px; font-size:0; line-height:0;">&nbsp;</td></tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px 30px; color:#666; font-size:10px; letter-spacing:1px;">
              18+ · VALID ID REQUIRED · DRINK RESPONSIBLY<br/>
              © TANTRA NIGHT CLUB
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const result = await resend.emails.send({
    from: fromAddress,
    to: params.to,
    subject,
    html,
  });

  return result;
}
