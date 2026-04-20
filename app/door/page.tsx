"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";
import { formatEventDate } from "@/lib/utils";

const LOGO_DARK = "https://i.imgur.com/tEFCuKr.png";
const LOGO_LIGHT = "https://i.imgur.com/tEFCuKr.png";

type TicketResult = {
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

type View = "idle" | "scanning" | "manual" | "result" | "not_found" | "error";

export default function DoorPage() {
  const { theme, toggle: toggleTheme, mounted: themeMounted } = useTheme();

  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [view, setView] = useState<View>("idle");
  const [ticket, setTicket] = useState<TicketResult | null>(null);
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
      // Cheap auth check using lookup endpoint with bogus code — expects 400 if auth ok, 401 if not
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
      // Dynamic import to avoid SSR issues
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      codeReaderRef.current = reader;

      if (!videoRef.current) return;

      // Start continuous scanning from default camera
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, err) => {
          if (result) {
            const scanned = result.getText().trim().toUpperCase();
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
      setErrorMsg(
        err.message ||
          "Could not access camera. Check browser permissions or use manual entry."
      );
      setView("error");
    }
  }

  function stopScanner() {
    try {
      if (scanControlsRef.current) {
        scanControlsRef.current.stop();
        scanControlsRef.current = null;
      }
      if (codeReaderRef.current) {
        codeReaderRef.current = null;
      }
    } catch (e) {
      // ignore
    }
  }

  async function lookupTicket(code: string) {
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/lookup-ticket?code=${encodeURIComponent(code)}`,
        {
          headers: { "x-admin-password": password },
        }
      );
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
      setTicket(data.ticket);
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
    if (!ticket) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          ticket_code: ticket.ticket_code,
          checked_in: !ticket.checked_in,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update");
        return;
      }
      setTicket({
        ...ticket,
        checked_in: data.checked_in,
        checked_in_at: data.checked_in_at,
      });
    } catch (err) {
      alert("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  function resetToIdle() {
    setTicket(null);
    setManualCode("");
    setLastScannedCode("");
    setErrorMsg("");
    setView("idle");
  }

  const logoUrl = theme === "dark" ? LOGO_DARK : LOGO_LIGHT;

  const ThemeToggle = () => (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="btn-icon w-10 h-10"
    >
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

  // Cleanup on unmount
  useEffect(() => {
    return () => stopScanner();
  }, []);

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 grain relative bg-app">
        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle />
        </div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-tantra-red opacity-[0.08] blur-[120px] rounded-full" />
        </div>

        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-card tantra-border-strong p-10 relative z-10"
        >
          <div className="flex justify-center mb-8">
            <img src={logoUrl} alt="Tantra" className="h-20 w-auto object-contain" />
          </div>

          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="accent-line"></span>
            <span className="label">DOOR / SCANNER</span>
            <span className="accent-line"></span>
          </div>

          <p className="text-muted text-sm text-center mb-7">
            Enter password to continue
          </p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="tantra-input w-full px-4 py-3.5 mb-4"
            placeholder="Password"
            autoFocus
          />

          {authError && (
            <div className="bg-tantra-red/10 border border-tantra-red text-red-500 text-sm px-4 py-3 mb-4">
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="btn-red w-full py-4 text-sm"
          >
            {authLoading ? "Checking..." : "Sign In"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen grain relative bg-app">
      <div className="h-1 bg-tantra-red w-full" />

      <div className="relative z-10 px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-6 pb-5 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Tantra" className="h-10 w-auto object-contain" />
              <div>
                <div className="label">DOOR</div>
                <div className="text-xs text-muted">Ticket scanner</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/admin"
                className="btn-outline px-4 py-2 text-xs"
                title="Go to admin dashboard"
              >
                Admin
              </a>
              <ThemeToggle />
              <button onClick={logout} className="btn-outline px-4 py-2 text-xs">
                Exit
              </button>
            </div>
          </div>

          {/* ===== IDLE VIEW ===== */}
          {view === "idle" && (
            <div className="text-center py-8">
              <div className="mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <span className="accent-line"></span>
                  <span className="label">VERIFY ENTRY</span>
                  <span className="accent-line"></span>
                </div>
                <h1 className="display-text text-4xl sm:text-5xl text-default mb-3">
                  Scan a Ticket
                </h1>
                <p className="text-muted text-sm">
                  Scan the guest's QR code, or enter the ticket number manually
                </p>
              </div>

              <div className="space-y-3 max-w-sm mx-auto">
                <button
                  onClick={startScanner}
                  className="btn-red w-full py-5 text-base flex items-center justify-center gap-3"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M9 9h6v6H9z" />
                  </svg>
                  Scan QR Code
                </button>

                <button
                  onClick={() => setView("manual")}
                  className="btn-outline w-full py-5 text-base"
                >
                  Enter Code Manually
                </button>
              </div>
            </div>
          )}

          {/* ===== SCANNING VIEW ===== */}
          {view === "scanning" && (
            <div className="text-center">
              <div className="mb-4">
                <div className="label mb-2">SCANNING…</div>
                <p className="text-muted text-xs">Point the camera at the guest's QR code</p>
              </div>

              <div className="relative w-full max-w-md mx-auto aspect-square bg-deep tantra-border-strong overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {/* Scan frame overlay */}
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
                <button
                  onClick={() => {
                    stopScanner();
                    setView("manual");
                  }}
                  className="btn-outline flex-1 py-3 text-sm"
                >
                  Manual Entry
                </button>
                <button
                  onClick={() => {
                    stopScanner();
                    resetToIdle();
                  }}
                  className="btn-outline flex-1 py-3 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ===== MANUAL ENTRY ===== */}
          {view === "manual" && (
            <form onSubmit={handleManualSubmit} className="space-y-5 max-w-sm mx-auto">
              <div className="text-center mb-4">
                <div className="label mb-3">MANUAL ENTRY</div>
                <h2 className="display-text text-3xl text-default">Enter Ticket #</h2>
              </div>

              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                className="tantra-input w-full px-4 py-5 text-center text-2xl font-mono tracking-wider"
                placeholder="TNT-XXXXXX"
                autoFocus
                autoComplete="off"
              />

              <button
                type="submit"
                disabled={actionLoading || !manualCode.trim()}
                className="btn-red w-full py-4 text-sm"
              >
                {actionLoading ? "Looking up..." : "Verify Ticket"}
              </button>

              <button
                type="button"
                onClick={resetToIdle}
                className="btn-outline w-full py-3 text-xs"
              >
                Cancel
              </button>
            </form>
          )}

          {/* ===== RESULT ===== */}
          {view === "result" && ticket && (
            <div className="space-y-4">
              {/* Status banner */}
              {ticket.checked_in ? (
                <div className="bg-yellow-500/15 border-2 border-yellow-500 p-5 text-center">
                  <div className="display-text text-2xl text-yellow-500 mb-1">
                    ⚠ ALREADY CHECKED IN
                  </div>
                  <p className="text-xs text-muted">
                    Arrived at{" "}
                    {ticket.checked_in_at
                      ? new Date(ticket.checked_in_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "earlier"}
                  </p>
                </div>
              ) : (
                <div className="bg-green-500/15 border-2 border-green-500 p-5 text-center">
                  <div className="display-text text-3xl text-green-500">
                    ✓ VALID TICKET
                  </div>
                </div>
              )}

              {/* Ticket details card */}
              <div className="bg-card tantra-border-strong p-6 sm:p-8">
                <div className="label mb-2">RESERVATION FOR</div>
                <h2 className="display-text text-3xl sm:text-4xl text-default mb-5">
                  {ticket.client_name}
                </h2>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div>
                    <div className="label mb-2">PARTY SIZE</div>
                    <div className="display-text text-4xl text-tantra-red">
                      {ticket.group_size}
                    </div>
                    <div className="text-xs text-muted">
                      {ticket.group_size === 1 ? "GUEST" : "GUESTS"}
                    </div>
                  </div>

                  {ticket.table_number ? (
                    <div>
                      <div className="label mb-2">TABLE</div>
                      <div className="display-text text-2xl text-default">
                        {ticket.table_number.toUpperCase()}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="label mb-2">TABLE</div>
                      <div className="text-muted text-sm">—</div>
                    </div>
                  )}
                </div>

                {ticket.event_datetime && (
                  <div className="mb-4 pb-4 border-b border-[var(--border)]">
                    <div className="label mb-1">EVENT</div>
                    <div className="text-sm text-default font-semibold">
                      {formatEventDate(ticket.event_datetime)}
                    </div>
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

              {/* Action buttons */}
              <div className="space-y-3">
                {!ticket.checked_in ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={actionLoading}
                    className="btn-red w-full py-5 text-lg"
                  >
                    {actionLoading
                      ? "CHECKING IN..."
                      : `CHECK IN ${ticket.group_size} ${
                          ticket.group_size === 1 ? "GUEST" : "GUESTS"
                        }`}
                  </button>
                ) : (
                  <button
                    onClick={handleCheckIn}
                    disabled={actionLoading}
                    className="btn-outline w-full py-4 text-sm"
                  >
                    {actionLoading ? "..." : "Undo Check-in"}
                  </button>
                )}

                <button
                  onClick={resetToIdle}
                  className="btn-outline w-full py-3 text-xs"
                >
                  Scan Next
                </button>
              </div>
            </div>
          )}

          {/* ===== NOT FOUND ===== */}
          {view === "not_found" && (
            <div className="space-y-5">
              <div className="bg-tantra-red/15 border-2 border-tantra-red p-8 text-center">
                <div className="display-text text-4xl text-tantra-red mb-2">
                  ✗ NOT FOUND
                </div>
                <p className="text-sm text-muted">{errorMsg}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setView("manual");
                    setManualCode("");
                  }}
                  className="btn-outline flex-1 py-4 text-sm"
                >
                  Try Again
                </button>
                <button onClick={resetToIdle} className="btn-red flex-1 py-4 text-sm">
                  New Scan
                </button>
              </div>
            </div>
          )}

          {/* ===== ERROR ===== */}
          {view === "error" && (
            <div className="space-y-5">
              <div className="bg-tantra-red/10 border border-tantra-red p-6 text-center">
                <div className="display-text text-xl text-tantra-red mb-2">
                  Camera Error
                </div>
                <p className="text-sm text-muted">{errorMsg}</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setErrorMsg("");
                    setView("manual");
                  }}
                  className="btn-red w-full py-4 text-sm"
                >
                  Enter Code Manually
                </button>
                <button onClick={resetToIdle} className="btn-outline w-full py-3 text-xs">
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
