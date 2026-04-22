"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";
import { formatEventDate } from "@/lib/utils";

const LOGO_WHITE = "https://i.imgur.com/xAQenGt.png";

type ReservationTicket = {
  ticket_code: string;
  checked_in: boolean;
  checked_in_at: string | null;
  client_name: string;
  phone: string;
  email: string;
  group_size: number;
  event_datetime: string | null;
  notes: string | null;
  table_number: string | null;
  issued_by: string | null;
};

type OpenBarTicket = {
  ticket_code: string;
  checked_in: boolean;
  checked_in_at: string | null;
  full_name: string;
  email: string;
  date_of_birth: string;
  event_datetime: string | null;
};

type LookupResult =
  | { found: false }
  | { found: true; ticket_type: "reservation"; ticket: ReservationTicket }
  | { found: true; ticket_type: "open_bar"; ticket: OpenBarTicket };

type View = "idle" | "scanning" | "manual" | "result" | "not_found" | "error";

export default function DoorPage() {
  const { theme, toggle: toggleTheme, mounted: themeMounted } = useTheme();

  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [view, setView] = useState<View>("idle");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<any>(null);
  const scanControlsRef = useRef<any>(null);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? sessionStorage.getItem("tantra_admin_pw") : null;
    if (saved) {
      setPassword(saved);
      checkAuth(saved);
    }
  }, []);

  async function checkAuth(pw: string) {
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/lookup-ticket?code=AUTH", {
        headers: { "x-admin-password": pw },
      });
      if (res.status === 401) {
        setAuthError("Incorrect password");
        sessionStorage.removeItem("tantra_admin_pw");
        setAuthed(false);
        return;
      }
      setAuthed(true);
      sessionStorage.setItem("tantra_admin_pw", pw);
    } catch (err: any) {
      setAuthError(err.message || "Failed to sign in");
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    checkAuth(password);
  }

  function logout() {
    stopScanner();
    sessionStorage.removeItem("tantra_admin_pw");
    setAuthed(false);
    setPassword("");
  }

  async function startScanner() {
    setView("scanning");
    setErrorMsg("");

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      codeReaderRef.current = reader;

      if (!videoRef.current) return;

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (scanResult) => {
          if (scanResult) {
            const scanned = scanResult.getText().trim().toUpperCase();
            if (scanned && scanned !== lastScannedCode) {
              setLastScannedCode(scanned);
              stopScanner();
              lookupTicket(scanned);
            }
          }
        }
      );
      scanControlsRef.current = controls;
    } catch (err: any) {
      console.error("Scanner error:", err);
      setErrorMsg(err.message || "Could not access camera. Check browser permissions or use manual entry.");
      setView("error");
    }
  }

  function stopScanner() {
    try {
      if (scanControlsRef.current) {
        scanControlsRef.current.stop();
        scanControlsRef.current = null;
      }
      if (codeReaderRef.current) codeReaderRef.current = null;
    } catch (e) { /* ignore */ }
  }

  async function lookupTicket(code: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/lookup-ticket?code=${encodeURIComponent(code)}`, {
        headers: { "x-admin-password": password },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Lookup failed");
        setView("error");
        return;
      }
      if (!data.found) {
        setErrorMsg(`Ticket code "${code}" not found`);
        setView("not_found");
        return;
      }
      setResult(data);
      setView("result");
    } catch (err: any) {
      setErrorMsg(err.message || "Network error");
      setView("error");
    } finally {
      setActionLoading(false);
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    lookupTicket(code);
  }

  async function handleCheckIn() {
    if (!result || !result.found) return;
    setActionLoading(true);

    // Choose the right endpoint based on ticket type
    const endpoint =
      result.ticket_type === "open_bar" ? "/api/open-bar-list" : "/api/check-in";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          ticket_code: result.ticket.ticket_code,
          checked_in: !result.ticket.checked_in,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update");
        return;
      }
      // Update local state
      setResult({
        ...result,
        ticket: {
          ...result.ticket,
          checked_in: data.checked_in,
          checked_in_at: data.checked_in_at,
        },
      } as LookupResult);
    } catch (err) {
      alert("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  function resetToIdle() {
    setResult(null);
    setManualCode("");
    setLastScannedCode("");
    setErrorMsg("");
    setView("idle");
  }

  const logoUrl = LOGO_WHITE; const logoFilter = theme === "dark" ? "none" : "invert(1)";

  const ThemeToggle = () => (
    <button onClick={toggleTheme} aria-label="Toggle theme" className="btn-icon w-10 h-10">
      {!themeMounted ? null : theme === "dark" ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10l1.4 1.4M3 12h2m14 0h2M5.6 18.4l1.4-1.4m10-10l1.4-1.4" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );

  useEffect(() => () => stopScanner(), []);

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 grain relative bg-app">
        <div className="absolute top-4 right-4 z-20"><ThemeToggle /></div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-tantra-red opacity-[0.08] blur-[120px] rounded-full" />
        </div>
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-card tantra-border-strong p-10 relative z-10">
          <div className="flex justify-center mb-8">
            <img src={logoUrl} alt="Tantra" className="h-20 w-auto object-contain" style={{ filter: logoFilter }} />
          </div>
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="accent-line"></span>
            <span className="label">DOOR / SCANNER</span>
            <span className="accent-line"></span>
          </div>
          <p className="text-muted text-sm text-center mb-7">Enter password to continue</p>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="tantra-input w-full px-4 py-3.5 mb-4" placeholder="Password" autoFocus />
          {authError && <div className="bg-tantra-red/10 border border-tantra-red text-red-500 text-sm px-4 py-3 mb-4">{authError}</div>}
          <button type="submit" disabled={authLoading} className="btn-red w-full py-4 text-sm">{authLoading ? "Checking..." : "Sign In"}</button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen grain relative bg-app">
      <div className="h-1 bg-tantra-red w-full" />

      <div className="relative z-10 px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-6 pb-5 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Tantra" className="h-10 w-auto object-contain" style={{ filter: logoFilter }} />
              <div>
                <div className="label">DOOR</div>
                <div className="text-xs text-muted">Ticket scanner</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href="/admin" className="btn-outline px-4 py-2 text-xs">Admin</a>
              <ThemeToggle />
              <button onClick={logout} className="btn-outline px-4 py-2 text-xs">Exit</button>
            </div>
          </div>

          {view === "idle" && (
            <div className="text-center py-8">
              <div className="mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <span className="accent-line"></span>
                  <span className="label">VERIFY ENTRY</span>
                  <span className="accent-line"></span>
                </div>
                <h1 className="display-text text-4xl sm:text-5xl text-default mb-3">Scan a Ticket</h1>
                <p className="text-muted text-sm">Scan the guest's QR code, or enter the ticket number manually</p>
              </div>
              <div className="space-y-3 max-w-sm mx-auto">
                <button onClick={startScanner} className="btn-red w-full py-5 text-base flex items-center justify-center gap-3">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M9 9h6v6H9z" />
                  </svg>
                  Scan QR Code
                </button>
                <button onClick={() => setView("manual")} className="btn-outline w-full py-5 text-base">Enter Code Manually</button>
              </div>
            </div>
          )}

          {view === "scanning" && (
            <div className="text-center">
              <div className="mb-4">
                <div className="label mb-2">SCANNING…</div>
                <p className="text-muted text-xs">Point the camera at the guest's QR code</p>
              </div>
              <div className="relative w-full max-w-md mx-auto aspect-square bg-deep tantra-border-strong overflow-hidden">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-2/3 h-2/3 border-2 border-tantra-red relative">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-tantra-red"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-tantra-red"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-tantra-red"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-tantra-red"></div>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex gap-3 max-w-md mx-auto">
                <button onClick={() => { stopScanner(); setView("manual"); }} className="btn-outline flex-1 py-3 text-sm">Manual Entry</button>
                <button onClick={() => { stopScanner(); resetToIdle(); }} className="btn-outline flex-1 py-3 text-sm">Cancel</button>
              </div>
            </div>
          )}

          {view === "manual" && (
            <form onSubmit={handleManualSubmit} className="space-y-5 max-w-sm mx-auto">
              <div className="text-center mb-4">
                <div className="label mb-3">MANUAL ENTRY</div>
                <h2 className="display-text text-3xl text-default">Enter Ticket #</h2>
                <p className="text-xs text-muted mt-2">TNT-XXXXXX (reservation) or OBP-XXXXXX (open bar)</p>
              </div>
              <input type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())} className="tantra-input w-full px-4 py-5 text-center text-2xl font-mono tracking-wider" placeholder="TNT-XXXXXX" autoFocus autoComplete="off" />
              <button type="submit" disabled={actionLoading || !manualCode.trim()} className="btn-red w-full py-4 text-sm">
                {actionLoading ? "Looking up..." : "Verify Ticket"}
              </button>
              <button type="button" onClick={resetToIdle} className="btn-outline w-full py-3 text-xs">Cancel</button>
            </form>
          )}

          {view === "result" && result?.found && result.ticket_type === "reservation" && (
            <ReservationResult ticket={result.ticket} loading={actionLoading} onCheckIn={handleCheckIn} onReset={resetToIdle} />
          )}
          {view === "result" && result?.found && result.ticket_type === "open_bar" && (
            <OpenBarResult ticket={result.ticket} loading={actionLoading} onCheckIn={handleCheckIn} onReset={resetToIdle} />
          )}

          {view === "not_found" && (
            <div className="space-y-5">
              <div className="bg-tantra-red/15 border-2 border-tantra-red p-8 text-center">
                <div className="display-text text-4xl text-tantra-red mb-2">✗ NOT FOUND</div>
                <p className="text-sm text-muted">{errorMsg}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setView("manual"); setManualCode(""); }} className="btn-outline flex-1 py-4 text-sm">Try Again</button>
                <button onClick={resetToIdle} className="btn-red flex-1 py-4 text-sm">New Scan</button>
              </div>
            </div>
          )}

          {view === "error" && (
            <div className="space-y-5">
              <div className="bg-tantra-red/10 border border-tantra-red p-6 text-center">
                <div className="display-text text-xl text-tantra-red mb-2">Camera Error</div>
                <p className="text-sm text-muted">{errorMsg}</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => { setErrorMsg(""); setView("manual"); }} className="btn-red w-full py-4 text-sm">Enter Code Manually</button>
                <button onClick={resetToIdle} className="btn-outline w-full py-3 text-xs">Back</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function ReservationResult({
  ticket, loading, onCheckIn, onReset,
}: {
  ticket: ReservationTicket; loading: boolean;
  onCheckIn: () => void; onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      {ticket.checked_in ? (
        <div className="bg-yellow-500/15 border-2 border-yellow-500 p-5 text-center">
          <div className="display-text text-2xl text-yellow-500 mb-1">⚠ ALREADY CHECKED IN</div>
          <p className="text-xs text-muted">
            Arrived at {ticket.checked_in_at ? new Date(ticket.checked_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "earlier"}
          </p>
        </div>
      ) : (
        <div className="bg-green-500/15 border-2 border-green-500 p-5 text-center">
          <div className="display-text text-3xl text-green-500">✓ VALID TICKET</div>
          <div className="text-xs text-muted mt-1 uppercase tracking-wider">Reservation</div>
        </div>
      )}

      <div className="bg-card tantra-border-strong p-6 sm:p-8">
        <div className="label mb-2">RESERVATION FOR</div>
        <h2 className="display-text text-3xl sm:text-4xl text-default mb-5">{ticket.client_name}</h2>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="label mb-2">PARTY SIZE</div>
            <div className="display-text text-4xl text-tantra-red">{ticket.group_size}</div>
            <div className="text-xs text-muted">{ticket.group_size === 1 ? "GUEST" : "GUESTS"}</div>
          </div>
          {ticket.table_number ? (
            <div>
              <div className="label mb-2">TABLE</div>
              <div className="display-text text-2xl text-default">{ticket.table_number.toUpperCase()}</div>
            </div>
          ) : (
            <div><div className="label mb-2">TABLE</div><div className="text-muted text-sm">—</div></div>
          )}
        </div>

        {ticket.event_datetime && (
          <div className="mb-4 pb-4 border-b border-[var(--border)]">
            <div className="label mb-1">EVENT</div>
            <div className="text-sm text-default font-semibold">{formatEventDate(ticket.event_datetime)}</div>
          </div>
        )}

        {ticket.notes && (
          <div className="mb-4 pb-4 border-b border-[var(--border)]">
            <div className="label mb-1">NOTES</div>
            <div className="text-sm text-default italic">{ticket.notes}</div>
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-muted pt-2">
          <span className="font-mono font-bold">{ticket.ticket_code}</span>
          {ticket.issued_by && <span>by {ticket.issued_by}</span>}
        </div>
      </div>

      <div className="space-y-3">
        {!ticket.checked_in ? (
          <button onClick={onCheckIn} disabled={loading} className="btn-red w-full py-5 text-lg">
            {loading ? "CHECKING IN..." : `CHECK IN ${ticket.group_size} ${ticket.group_size === 1 ? "GUEST" : "GUESTS"}`}
          </button>
        ) : (
          <button onClick={onCheckIn} disabled={loading} className="btn-outline w-full py-4 text-sm">
            {loading ? "..." : "Undo Check-in"}
          </button>
        )}
        <button onClick={onReset} className="btn-outline w-full py-3 text-xs">Scan Next</button>
      </div>
    </div>
  );
}

function OpenBarResult({
  ticket, loading, onCheckIn, onReset,
}: {
  ticket: OpenBarTicket; loading: boolean;
  onCheckIn: () => void; onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      {ticket.checked_in ? (
        <div className="bg-yellow-500/15 border-2 border-yellow-500 p-5 text-center">
          <div className="display-text text-2xl text-yellow-500 mb-1">⚠ ALREADY USED</div>
          <p className="text-xs text-muted">
            Checked in at {ticket.checked_in_at ? new Date(ticket.checked_in_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "earlier"}
          </p>
        </div>
      ) : (
        <div className="bg-green-500/15 border-2 border-green-500 p-5 text-center">
          <div className="display-text text-3xl text-green-500">✓ VALID PASS</div>
          <div className="text-xs text-muted mt-1 uppercase tracking-wider">Open Bar Pass</div>
        </div>
      )}

      <div className="bg-card tantra-border-strong p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="bg-tantra-red text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">OPEN BAR</div>
        </div>
        <h2 className="display-text text-3xl sm:text-4xl text-default mb-5">{ticket.full_name}</h2>

        {ticket.event_datetime && (
          <div className="mb-4 pb-4 border-b border-[var(--border)]">
            <div className="label mb-1">VALID FOR</div>
            <div className="text-sm text-default font-semibold">{formatEventDate(ticket.event_datetime)}</div>
            <div className="text-xs text-tantra-red font-bold mt-1">9:00 PM — 11:00 PM</div>
          </div>
        )}

        <div className="mb-4 pb-4 border-b border-[var(--border)]">
          <div className="label mb-1">DATE OF BIRTH</div>
          <div className="text-sm text-default">{new Date(ticket.date_of_birth).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
          <div className="text-[10px] text-tantra-red font-bold uppercase tracking-widest mt-1">Check ID to verify</div>
        </div>

        <div className="flex justify-between items-center text-xs text-muted pt-2">
          <span className="font-mono font-bold">{ticket.ticket_code}</span>
          <span>{ticket.email}</span>
        </div>
      </div>

      <div className="space-y-3">
        {!ticket.checked_in ? (
          <button onClick={onCheckIn} disabled={loading} className="btn-red w-full py-5 text-lg">
            {loading ? "CHECKING IN..." : "REDEEM OPEN BAR PASS"}
          </button>
        ) : (
          <button onClick={onCheckIn} disabled={loading} className="btn-outline w-full py-4 text-sm">
            {loading ? "..." : "Undo Check-in"}
          </button>
        )}
        <button onClick={onReset} className="btn-outline w-full py-3 text-xs">Scan Next</button>
      </div>
    </div>
  );
}
