import jsPDF from "jspdf";

type Params = {
  ticketCode: string;
  clientName: string;
  guestCount: number;
  notes: string | null;
  eventName: string;
  venueName: string;
};

export function buildTicketPDF({
  ticketCode,
  clientName,
  guestCount,
  notes,
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

  // Brand red: RGB 219, 19, 13
  const RED: [number, number, number] = [219, 19, 13];

  // White background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  // Red top bar — brand signature
  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW, 6, "F");

  // Red bottom bar
  doc.setFillColor(...RED);
  doc.rect(0, pageH - 3, pageW, 3, "F");

  // Black border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(4, 9, pageW - 8, pageH - 15);

  // Perforation line
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

  // Event name — big black
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text(eventName.toUpperCase(), 10, 31);

  // Venue
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(venueName, 10, 37);

  // Red accent line under header
  doc.setFillColor(...RED);
  doc.rect(10, 40, 25, 1, "F");

  // Client name
  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("RESERVATION FOR", 10, 48);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(clientName.toUpperCase(), 10, 55, { maxWidth: stubX - 18 });

  // Party size
  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("PARTY SIZE", 10, 63);

  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`${guestCount} ${guestCount === 1 ? "GUEST" : "GUESTS"}`, 10, 71);

  // Notes
  if (notes && notes.trim()) {
    doc.setTextColor(90, 90, 90);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    const notesText = notes.length > 55 ? notes.substring(0, 52) + "…" : notes;
    doc.text(notesText, 50, 71, { maxWidth: stubX - 58 });
  }

  // ===== STUB SECTION =====

  const stubCenterX = stubX + (pageW - stubX) / 2;

  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("TICKET NO.", stubCenterX, 17, { align: "center" });

  doc.setTextColor(...RED);
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text(ticketCode, stubCenterX, 24, { align: "center" });

  // Divider
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(stubX + 6, 29, pageW - 8, 29);

  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("ADMITS", stubCenterX, 38, { align: "center" });

  // Huge guest count in red
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(40);
  doc.text(`${guestCount}`, stubCenterX, 60, { align: "center" });

  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text(guestCount === 1 ? "GUEST" : "GUESTS", stubCenterX, 66, { align: "center" });

  // Event name at bottom of stub
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(eventName.toUpperCase(), stubCenterX, pageH - 9, { align: "center" });

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
