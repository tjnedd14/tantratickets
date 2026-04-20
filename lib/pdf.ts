import jsPDF from "jspdf";
import QRCode from "qrcode";
import { formatEventDateCompact, formatEventTime } from "./utils";
import zlib from "zlib";

const WHITE_LOGO_URL = "https://i.imgur.com/xAQenGt.png";

// ---- PNG color inversion (so a white logo becomes black for white-bg tickets) ----

const crcTable: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): Buffer {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  const out = Buffer.alloc(4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return out;
}

// Inverts RGB channels of a PNG, preserving alpha. Falls back to original on error.
function invertPngColors(buffer: Buffer): Buffer {
  // PNG signature
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50) {
    throw new Error("Not a PNG");
  }

  let offset = 8;
  const idatChunks: Buffer[] = [];
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const outChunks: Buffer[] = [buffer.slice(0, 8)];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString("ascii");
    const data = buffer.slice(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      outChunks.push(buffer.slice(offset, offset + 12 + length));
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    } else {
      outChunks.push(buffer.slice(offset, offset + 12 + length));
    }
    offset += 12 + length;
  }

  if (bitDepth !== 8) throw new Error(`Unsupported bit depth: ${bitDepth}`);
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : -1;
  if (bytesPerPixel < 0) throw new Error(`Unsupported color type: ${colorType}`);

  const scanlineLength = width * bytesPerPixel + 1;
  const compressed = Buffer.concat(idatChunks);
  const decompressed = zlib.inflateSync(compressed);

  for (let y = 0; y < height; y++) {
    const lineStart = y * scanlineLength;
    for (let x = 0; x < width; x++) {
      const px = lineStart + 1 + x * bytesPerPixel;
      decompressed[px] = 255 - decompressed[px];
      decompressed[px + 1] = 255 - decompressed[px + 1];
      decompressed[px + 2] = 255 - decompressed[px + 2];
    }
  }

  const recompressed = zlib.deflateSync(decompressed);

  const idatLen = Buffer.alloc(4);
  idatLen.writeUInt32BE(recompressed.length, 0);
  const idatType = Buffer.from("IDAT", "ascii");
  outChunks.push(idatLen, idatType, recompressed, crc32(Buffer.concat([idatType, recompressed])));

  const iendLen = Buffer.alloc(4);
  const iendType = Buffer.from("IEND", "ascii");
  outChunks.push(iendLen, iendType, crc32(iendType));

  return Buffer.concat(outChunks);
}

async function fetchBlackLogo(): Promise<string | null> {
  try {
    const res = await fetch(WHITE_LOGO_URL);
    const raw = Buffer.from(await res.arrayBuffer());
    const inverted = invertPngColors(raw);
    return `data:image/png;base64,${inverted.toString("base64")}`;
  } catch (err) {
    console.error("Logo fetch/invert failed:", err);
    return null;
  }
}

// ---- End logo helper ----

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

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW, 5, "F");
  doc.rect(0, pageH - 3, pageW, 3, "F");

  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.4);
  doc.rect(4, 8, pageW - 8, pageH - 14);

  const qrSectionX = pageW - 95;
  const stubX = pageW - 50;

  doc.setLineDashPattern([1, 1], 0);
  doc.setLineWidth(0.2);
  doc.line(qrSectionX, 10, qrSectionX, pageH - 5);
  doc.line(stubX, 10, stubX, pageH - 5);
  doc.setLineDashPattern([], 0);

  const mainX = 10;
  const mainRight = qrSectionX - 6;
  const mainWidth = mainRight - mainX;

  // Black logo at the top left of the main section
  const blackLogo = await fetchBlackLogo();
  if (blackLogo) {
    doc.addImage(blackLogo, "PNG", mainX, 11, 14, 14);
  }

  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("GUEST LIST ENTRY", mainX + 18, 16);

  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(venueName, mainX + 18, 22);

  if (eventDatetime) {
    doc.setTextColor(...RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("EVENT DATE", mainRight, 15, { align: "right" });

    doc.setTextColor(...BLACK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(formatEventDateCompact(eventDatetime), mainRight, 24, { align: "right" });

    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(formatEventTime(eventDatetime), mainRight, 30, { align: "right" });
  }

  const eventNameMaxWidth = eventDatetime ? mainWidth - 50 : mainWidth;
  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(eventName.toUpperCase(), mainX, 36, { maxWidth: eventNameMaxWidth });

  doc.setFillColor(...RED);
  doc.rect(mainX, 40, 25, 1, "F");

  const col1X = mainX;
  const col2X = mainX + mainWidth / 2 + 2;
  const col1Width = mainWidth / 2 - 6;
  const col2Width = mainRight - col2X;
  const contentY = 49;

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

  // QR section
  const qrCenterX = qrSectionX + (stubX - qrSectionX) / 2;

  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("SCAN AT ENTRY", qrCenterX, 15, { align: "center" });

  const qrDataUrl = await QRCode.toDataURL(ticketCode, {
    width: 500,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });

  const qrSize = 42;
  const qrX = qrCenterX - qrSize / 2;
  const qrY = 20;
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.text("TICKET NO.", qrCenterX, qrY + qrSize + 5, { align: "center" });

  doc.setTextColor(...BLACK);
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text(ticketCode, qrCenterX, qrY + qrSize + 11, { align: "center" });

  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("Show this to the hostess", qrCenterX, pageH - 8, { align: "center" });

  // Stub
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
