import { notFound } from "next/navigation";
import { getAdminClient } from "@/lib/supabase";
import QRCode from "qrcode";
import { formatEventDate } from "@/lib/utils";

const LOGO_URL = "https://i.imgur.com/xAQenGt.png";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ ticket_code: string }>;
};

export default async function PassPage({ params }: Props) {
  const { ticket_code } = await params;
  if (!ticket_code) return notFound();

  const supabase = getAdminClient();

  // Try open_bar_signups first (most common case)
  const { data: signup } = await supabase
    .from("open_bar_signups")
    .select("full_name, ticket_code, event_datetime, checked_in")
    .eq("ticket_code", ticket_code.toUpperCase())
    .maybeSingle();

  if (!signup) return notFound();

  // Generate QR as data URL on the server
  const qrDataUrl = await QRCode.toDataURL(signup.ticket_code, {
    width: 400,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  const eventLabel = signup.event_datetime ? formatEventDate(signup.event_datetime) : "Fri & Sat · 9:00–11:00 PM";

  // Google Maps link for Tantra (Palm Beach, Aruba)
  const mapUrl = "https://maps.google.com/?q=Tantra+Night+Club+Aruba";

  return (
    <main style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#fff",
      fontFamily: '"Archivo Black", system-ui, sans-serif',
      padding: "24px 16px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 440,
        background: "#111",
        border: "2px solid #DC2626",
        boxShadow: "0 0 40px rgba(220, 38, 38, 0.3)",
        padding: 0,
        overflow: "hidden",
      }}>
        {/* Red top bar */}
        <div style={{ height: 4, background: "#DC2626" }} />

        {/* Logo + brand */}
        <div style={{ padding: "32px 24px 16px", textAlign: "center", borderBottom: "1px solid #2a2a2a" }}>
          <img
            src={LOGO_URL}
            alt="Tantra"
            style={{ height: 80, width: "auto", margin: "0 auto 16px", display: "block" }}
          />
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#888", marginBottom: 4 }}>OPEN BAR PASS</div>
          <div style={{ fontSize: 13, color: "#DC2626", letterSpacing: 2 }}>{eventLabel}</div>
        </div>

        {/* Status banner if checked in */}
        {signup.checked_in && (
          <div style={{
            background: "#16a34a",
            color: "#fff",
            padding: "12px 16px",
            textAlign: "center",
            fontSize: 13,
            letterSpacing: 2,
            fontWeight: "bold",
          }}>
            ✓ ALREADY CHECKED IN
          </div>
        )}

        {/* Guest name */}
        <div style={{ padding: "24px 24px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#888", marginBottom: 8 }}>GUEST</div>
          <div style={{ fontSize: 22, fontWeight: "bold", color: "#fff" }}>{signup.full_name}</div>
        </div>

        {/* QR code */}
        <div style={{ padding: "16px 24px", textAlign: "center" }}>
          <div style={{
            background: "#fff",
            padding: 16,
            display: "inline-block",
            lineHeight: 0,
          }}>
            <img src={qrDataUrl} alt="Pass QR Code" style={{ width: 240, height: 240, display: "block" }} />
          </div>
        </div>

        {/* Pass code */}
        <div style={{ padding: "0 24px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#888", marginBottom: 8 }}>PASS CODE</div>
          <div style={{
            fontFamily: '"Courier New", monospace',
            fontSize: 24,
            fontWeight: "bold",
            color: "#fff",
            letterSpacing: 3,
          }}>
            {signup.ticket_code}
          </div>
        </div>

        {/* Info section */}
        <div style={{
          background: "#0a0a0a",
          borderTop: "1px solid #2a2a2a",
          padding: "20px 24px",
          textAlign: "center",
          fontSize: 13,
          color: "#aaa",
          lineHeight: 1.6,
        }}>
          <div style={{ marginBottom: 12 }}>
            <strong style={{ color: "#fff" }}>Show this QR at the door.</strong>
          </div>
          <div style={{ marginBottom: 12, fontSize: 12 }}>
            Open Bar runs Friday & Saturday<br />
            9:00 – 11:00 PM
          </div>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              marginTop: 8,
              padding: "10px 20px",
              background: "transparent",
              border: "1px solid #DC2626",
              color: "#DC2626",
              textDecoration: "none",
              fontSize: 12,
              letterSpacing: 2,
              fontWeight: "bold",
            }}
          >
            📍 GET DIRECTIONS
          </a>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px",
          fontSize: 10,
          color: "#666",
          textAlign: "center",
          borderTop: "1px solid #2a2a2a",
          letterSpacing: 1.5,
        }}>
          18+ · VALID ID REQUIRED · DRINK RESPONSIBLY<br />
          © TANTRA NIGHT CLUB
        </div>
      </div>

      <div style={{
        marginTop: 24,
        fontSize: 11,
        color: "#555",
        textAlign: "center",
        maxWidth: 440,
      }}>
        Save this page · Add to home screen for quick access
      </div>
    </main>
  );
}
