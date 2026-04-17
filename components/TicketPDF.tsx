"use client";

import jsPDF from "jspdf";

type Props = {
  ticketCode: string;
  clientName: string;
  guestCount: number;
  notes: string | null;
  eventName: string;
  venueName: string;
};

// Client-side version for optional in-browser download (mirrors lib/pdf.ts)
export async function generateTicketPDF({
  ticketCode,
  clientName,
  guestCount,
  notes,
  eventName,
  venueName,
}: Props) {
  const pageW = 180;
  const pageH = 80;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [pageW, pageH],
  });

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(3, 3, pageW - 6, pageH - 6);

  const stubX = pageW - 50;
  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.2);
  doc.line(stubX, 5, stubX, pageH - 5);
  doc.setLineDashPattern([], 0);

  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("GUEST LIST ENTRY", 10, 12);

  doc.setTextColor(0, 0, 0);
  doc.setFont("times", "bold");
  doc.setFontSize(30);
  doc.text(eventName.toUpperCase(), 10, 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(venueName, 10, 33);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(10, 38, stubX - 8, 38);

  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("RESERVATION FOR", 10, 44);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(clientName.toUpperCase(), 10, 51, { maxWidth: stubX - 18 });

  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("PARTY SIZE", 10, 60);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`${guestCount} ${guestCount === 1 ? "GUEST" : "GUESTS"}`, 10, 68);

  if (notes && notes.trim()) {
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    const notesText = notes.length > 60 ? notes.substring(0, 57) + "…" : notes;
    doc.text(notesText, 10, 74, { maxWidth: stubX - 18 });
  }

  const stubCenterX = stubX + (pageW - stubX) / 2;

  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("TICKET NO.", stubCenterX, 14, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFont("courier", "bold");
  doc.setFontSize(13);
  doc.text(ticketCode, stubCenterX, 22, { align: "center" });

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(stubX + 6, 28, pageW - 8, 28);

  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("ADMITS", stubCenterX, 38, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFont("times", "bold");
  doc.setFontSize(36);
  doc.text(`${guestCount}`, stubCenterX, 58, { align: "center" });

  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(guestCount === 1 ? "GUEST" : "GUESTS", stubCenterX, 66, { align: "center" });

  doc.setTextColor(100, 100, 100);
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.text(eventName.toUpperCase(), stubCenterX, pageH - 8, { align: "center" });

  const filename = `${eventName}-ticket-${clientName.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
