import jsPDF from "jspdf";
import { formatEventDate, formatEventDateCompact, formatEventTime } from "./utils";

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

export function buildTicketPDF({
  ticketCode,
  clientName,
  guestCount,
  notes,
  tableNumber,
  eventDatetime,
  eventName,
  venueName,
}: Params): Buffer {
  const pageW = 180;
  const pageH = 80;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [pageW, pageH],
  });

  const RED: [number, number, number] = [219, 19, 13];

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW, 6, "F");
  doc.setFillColor(...RED);
  doc.rect(0, pageH - 3, pageW, 3, "F");

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(4, 9, pageW - 8, pageH - 15);

  const stubX = pageW - 50;
  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.2);
  doc.line(stubX, 11, stubX, pageH - 5);
  doc.setLineDashPattern([], 0);

  // ===== MAIN SECTION =====

  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("GUEST LIST ENTRY", 10, 17);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(eventName.toUpperCase(), 10, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(venueName, 10, 36);

  // Date/time on top right of main
  if (eventDatetime) {
    doc.setTextColor(...RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("EVENT DATE", stubX - 8, 17, { align: "right" });

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(formatEventDateCompact(eventDatetime), stubX - 8, 25, { align: "right" });

    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(formatEventTime(eventDatetime), stubX - 8, 31, { align: "right" });
  }

  doc.setFillColor(...RED);
  doc.rect(10, 39, 25, 1, "F");

  // Reservation for + party size
  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("RESERVATION FOR", 10, 47);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(clientName.toUpperCase(), 10, 54, { maxWidth: 70 });

  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("PARTY SIZE", 10, 62);

  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`${guestCount} ${guestCount === 1 ? "GUEST" : "GUESTS"}`, 10, 70);

  // Table on the right side of main
  if (tableNumber) {
    const tableX = 90;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(tableX - 4, 44, tableX - 4, pageH - 8);

    doc.setTextColor(...RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("TABLE", tableX, 47);

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(tableNumber.toUpperCase(), tableX, 59, { maxWidth: stubX - tableX - 4 });

    if (notes && notes.trim()) {
      doc.setTextColor(140, 140, 140);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.text("NOTES", tableX, 66);
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      const notesText = notes.length > 40 ? notes.substring(0, 38) + "…" : notes;
      doc.text(notesText, tableX, 70, { maxWidth: stubX - tableX - 4 });
    }
  } else if (notes && notes.trim()) {
    doc.setTextColor(140, 140, 140);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text("NOTES", 75, 62);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    const notesText = notes.length > 50 ? notes.substring(0, 48) + "…" : notes;
    doc.text(notesText, 75, 69, { maxWidth: stubX - 80 });
  }

  // ===== STUB SECTION =====

  const stubCenterX = stubX + (pageW - stubX) / 2;

  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("TICKET NO.", stubCenterX, 17, { align: "center" });

  doc.setTextColor(...RED);
  doc.setFont("courier", "bold");
  doc.setFontSize(11);
  doc.text(ticketCode, stubCenterX, 23, { align: "center" });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(stubX + 6, 27, pageW - 8, 27);

  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("ADMITS", stubCenterX, 35, { align: "center" });

  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text(`${guestCount}`, stubCenterX, 53, { align: "center" });

  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text(guestCount === 1 ? "GUEST" : "GUESTS", stubCenterX, 59, { align: "center" });

  // Table or event name at bottom of stub
  if (tableNumber) {
    doc.setTextColor(140, 140, 140);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text("TABLE", stubCenterX, 65, { align: "center" });
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(tableNumber.toUpperCase(), stubCenterX, 70, { align: "center" });
  }

  // Date at very bottom of stub
  if (eventDatetime) {
    doc.setTextColor(...RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(formatEventDateCompact(eventDatetime), stubCenterX, pageH - 9, { align: "center" });
  } else {
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(eventName.toUpperCase(), stubCenterX, pageH - 9, { align: "center" });
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
