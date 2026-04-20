import jsPDF from "jspdf";
import QRCode from "qrcode";
import { formatEventDateCompact, formatEventTime } from "./utils";

type Params = {
  ticketCode: string;
  clientName: string;
  guestCount: number;
  notes: string | null;
  tableNumber: string | null;
  eventDatetime: string | null;
  eventName: string;
  venueName: string;
};

export async function buildTicketPDF({
  ticketCode,
  clientName,
  guestCount,
  notes,
  tableNumber,
  eventDatetime,
  eventName,
  venueName,
}: Params): Promise<Buffer> {
  // Wider page to fit QR section cleanly on the right
  const pageW = 230;
  const pageH = 95;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [pageW, pageH],
  });

  const RED: [number, number, number] = [219, 19, 13];
  const BLACK: [number, number, number] = [0, 0, 0];
  const GRAY: [number, number, number] = [120, 120, 120];

  // White bg
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  // Red top & bottom bars
  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW, 5, "F");
  doc.rect(0, pageH - 3, pageW, 3, "F");

  // Main outer border
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.4);
  doc.rect(4, 8, pageW - 8, pageH - 14);

  // Divide page into 3 sections: MAIN | QR | STUB
  // Main: 0 to ~pageW-95
  // QR section: pageW-95 to pageW-50
  // Stub: pageW-50 to pageW
  const qrSectionX = pageW - 95;
  const stubX = pageW - 50;

  // Vertical dividers (dashed)
  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.2);
  doc.line(qrSectionX, 10, qrSectionX, pageH - 5);
  doc.line(stubX, 10, stubX, pageH - 5);
  doc.setLineDashPattern([], 0);

  // ============ MAIN SECTION ============
  const mainX = 10;
  const mainRight = qrSectionX - 6;
  const mainWidth = mainRight - mainX;

  // Header row
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("GUEST LIST ENTRY", mainX, 15);

  if (eventDatetime) {
    doc.setTextColor(...RED);
    doc.setFontSize(7);
    doc.text("EVENT DATE", mainRight, 15, { align: "right" });
  }

  // Event name
  const eventNameMaxWidth = eventDatetime ? mainWidth - 50 : mainWidth;
  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(eventName.toUpperCase(), mainX, 25, { maxWidth: eventNameMaxWidth });

  // Venue
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(venueName, mainX, 31);

  // Date right
  if (eventDatetime) {
    doc.setTextColor(...BLACK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(formatEventDateCompact(eventDatetime), mainRight, 24, { align: "right" });

    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(formatEventTime(eventDatetime), mainRight, 30, { align: "right" });
  }

  // Red accent
  doc.setFillColor(...RED);
  doc.rect(mainX, 35, 25, 1, "F");

  // Content: two columns
  const col1X = mainX;
  const col2X = mainX + mainWidth / 2 + 2;
  const col1Width = mainWidth / 2 - 6;
  const col2Width = mainRight - col2X;
  const contentY = 44;

  // Column 1: Reservation
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("RESERVATION FOR", col1X, contentY);

  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(clientName.toUpperCase(), col1X, contentY + 7, { maxWidth: col1Width });

  doc.setTextColor(...GRAY);
  doc.setFontSize(7);
  doc.text("PARTY SIZE", col1X, contentY + 17);

  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`${guestCount} ${guestCount === 1 ? "GUEST" : "GUESTS"}`, col1X, contentY + 26);

  // Column 2: Table + Notes
  if (tableNumber || (notes && notes.trim())) {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(col2X - 3, contentY - 2, col2X - 3, pageH - 8);

    let col2Y = contentY;

    if (tableNumber) {
      doc.setTextColor(...RED);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("TABLE", col2X, col2Y);

      doc.setTextColor(...BLACK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text(tableNumber.toUpperCase(), col2X, col2Y + 10, { maxWidth: col2Width });
      col2Y += 20;
    }

    if (notes && notes.trim()) {
      doc.setTextColor(...GRAY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("NOTES", col2X, col2Y);

      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      const notesText = notes.length > 60 ? notes.substring(0, 57) + "…" : notes;
      doc.text(notesText, col2X, col2Y + 6, { maxWidth: col2Width });
    }
  }

  // ============ QR SECTION ============
  const qrCenterX = qrSectionX + (stubX - qrSectionX) / 2;

  // Label
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("SCAN AT ENTRY", qrCenterX, 15, { align: "center" });

  // Generate QR code
  const qrDataUrl = await QRCode.toDataURL(ticketCode, {
    width: 500,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });

  // QR size: ~40mm, centered in the section
  const qrSize = 42;
  const qrX = qrCenterX - qrSize / 2;
  const qrY = 20;
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // Ticket code under QR
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("TICKET NO.", qrCenterX, qrY + qrSize + 5, { align: "center" });

  doc.setTextColor(...BLACK);
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text(ticketCode, qrCenterX, qrY + qrSize + 11, { align: "center" });

  // Small note below
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("Show this to the hostess", qrCenterX, pageH - 8, { align: "center" });

  // ============ STUB SECTION ============
  const stubCenterX = stubX + (pageW - stubX) / 2;
  const stubRight = pageW - 8;
  const stubLeft = stubX + 6;

  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("ADMITS", stubCenterX, 20, { align: "center" });

  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(48);
  doc.text(`${guestCount}`, stubCenterX, 48, { align: "center" });

  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text(guestCount === 1 ? "GUEST" : "GUESTS", stubCenterX, 54, { align: "center" });

  // Divider
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.2);
  doc.line(stubLeft, 58, stubRight, 58);

  let bottomY = 65;

  if (tableNumber) {
    doc.setTextColor(...GRAY);
    doc.setFontSize(6);
    doc.text("TABLE", stubCenterX, bottomY, { align: "center" });

    doc.setTextColor(...BLACK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const tableStr = tableNumber.length > 10 ? tableNumber.substring(0, 9) + "…" : tableNumber;
    doc.text(tableStr.toUpperCase(), stubCenterX, bottomY + 5, { align: "center" });
    bottomY += 12;
  }

  if (eventDatetime) {
    doc.setTextColor(...RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(formatEventDateCompact(eventDatetime), stubCenterX, pageH - 9, { align: "center" });
  } else if (!tableNumber) {
    doc.setTextColor(...BLACK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const evtStr = eventName.length > 14 ? eventName.substring(0, 13) + "…" : eventName;
    doc.text(evtStr.toUpperCase(), stubCenterX, pageH - 9, { align: "center" });
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
