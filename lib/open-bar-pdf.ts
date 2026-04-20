import jsPDF from "jspdf";
import QRCode from "qrcode";
import { formatEventDateCompact } from "./utils";

const WHITE_LOGO_URL = "https://i.imgur.com/xAQenGt.png";

type Params = {
  ticketCode: string;
  fullName: string;
  eventDatetime: string | null;
  eventName: string;
  venueName: string;
};

// Fetch image and convert to base64 data URL (for use with jsPDF addImage)
async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:image/png;base64,${base64}`;
}

export async function buildOpenBarPassPDF({
  ticketCode,
  fullName,
  eventDatetime,
  eventName,
  venueName,
}: Params): Promise<Buffer> {
  const pageW = 180;
  const pageH = 105; // a touch taller to accommodate logo

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [pageW, pageH],
  });

  const RED: [number, number, number] = [219, 19, 13];
  const BLACK: [number, number, number] = [0, 0, 0];
  const GRAY: [number, number, number] = [120, 120, 120];

  // Black background
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageW, pageH, "F");

  // Red top + bottom bars
  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW, 6, "F");
  doc.rect(0, pageH - 4, pageW, 4, "F");

  // Section: MAIN (left) | QR (right)
  const qrSectionX = pageW - 65;

  // Dashed divider
  doc.setDrawColor(255, 255, 255);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.setLineWidth(0.3);
  doc.line(qrSectionX, 12, qrSectionX, pageH - 8);
  doc.setLineDashPattern([], 0);

  // ========== MAIN SECTION ==========
  const mainX = 10;

  // White logo at top of main section
  try {
    const logoDataUrl = await fetchImageAsDataUrl(WHITE_LOGO_URL);
    doc.addImage(logoDataUrl, "PNG", mainX, 11, 18, 18);
  } catch (err) {
    console.error("Failed to load logo:", err);
    // Continue without logo
  }

  // Top label (shifted right to make room for logo)
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("COMPLIMENTARY PASS", mainX + 22, 18);

  doc.setTextColor(180, 180, 180);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(venueName, mainX + 22, 24);

  // Big title: "OPEN BAR"
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text("OPEN BAR", mainX, 46);

  // Event name subtitle
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(eventName.toUpperCase(), mainX, 53);

  // Red accent
  doc.setFillColor(...RED);
  doc.rect(mainX, 57, 30, 0.8, "F");

  // Guest name
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("ADMIT", mainX, 66);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(fullName.toUpperCase(), mainX, 74, { maxWidth: qrSectionX - mainX - 10 });

  // Date + time
  if (eventDatetime) {
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("OPEN BAR HOURS", mainX, 84);

    doc.setTextColor(...RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(formatEventDateCompact(eventDatetime), mainX, 92);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("9:30 PM — 11:30 PM", mainX, 98);
  }

  // ========== QR SECTION ==========
  const qrCenterX = qrSectionX + (pageW - qrSectionX) / 2;

  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("SCAN AT ENTRY", qrCenterX, 17, { align: "center" });

  const qrSize = 42;
  const qrX = qrCenterX - qrSize / 2;
  const qrY = 21;

  doc.setFillColor(255, 255, 255);
  doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, "F");

  const qrDataUrl = await QRCode.toDataURL(ticketCode, {
    width: 500,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // Ticket code
  doc.setTextColor(180, 180, 180);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("PASS NUMBER", qrCenterX, qrY + qrSize + 8, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text(ticketCode, qrCenterX, qrY + qrSize + 14, { align: "center" });

  // "18+" badge bottom right
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("18+ · VALID ID REQUIRED", qrCenterX, pageH - 9, { align: "center" });

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
