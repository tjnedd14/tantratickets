"use client";

import { useState, useEffect } from "react";
import {
  isValidEmail,
  isValidPhone,
  normalizePhone,
  formatEventDate,
  getDefaultEventDatetime,
} from "@/lib/utils";
import { useTheme } from "@/lib/theme";

// Logos: dark mode uses original (red on dark), light mode uses inverted/dark version
// User mentioned wanting a white logo — placeholder for now uses a CSS filter swap.
// If user provides a white logo URL, swap LOGO_DARK below.
const LOGO_DARK = "https://i.imgur.com/tEFCuKr.png"; // shown in dark mode (logo IS the brand red on dark)
const LOGO_LIGHT = "https://i.imgur.com/tEFCuKr.png"; // shown in light mode (red on white works fine)

type Registration = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  group_size: number;
  event_name: string;
  event_datetime: string | null;
  notes: string | null;
  table_number: string | null;
  issued_by: string | null;
  email_sent: boolean;
  email_sent_at: string | null;
  created_at: string;
  tickets: {
    ticket_code: string;
    guest_name: string;
    checked_in: boolean;
    person_number: number;
  }[];
};

type Tab = "issue" | "list";

export default function AdminPage() {
  const { theme, toggle: toggleTheme, mounted: themeMounted } = useTheme();

  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState<Tab>("issue");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [groupSize, setGroupSize] = useState(1);
  const [notes, setNotes] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [eventDatetime, setEventDatetime] = useState("");
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issueSuccess, setIssueSuccess] = useState<{
    clientName: string;
    email: string;
    guestCount: number;
    ticketCode: string;
    notes: string | null;
    tableNumber: string | null;
    eventDatetime: string | null;
    emailSent: boolean;
    emailError: string | null;
  } | null>(null);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Initialize default datetime
  useEffect(() => {
    if (!eventDatetime) setEventDatetime(getDefaultEventDatetime());
  }, []);

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
      const res = await fetch("/api/admin/export?list=1", {
        headers: { "x-admin-password": pw },
      });
      if (res.status === 401) {
        setAuthError("Incorrect password");
        sessionStorage.removeItem("tantra_admin_pw");
        setAuthed(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRegistrations(data.registrations || []);
      setAuthed(true);
      sessionStorage.setItem("tantra_admin_pw", pw);

      const savedHost = sessionStorage.getItem("tantra_hostess_name");
      if (savedHost) setIssuedBy(savedHost);
    } catch (err: any) {
      setAuthError(err.message || "Failed to load");
    } finally {
      setAuthLoading(false);
    }
  }

  async function refreshList() {
    setListLoading(true);
    try {
      const res = await fetch("/api/admin/export?list=1", {
        headers: { "x-admin-password": password },
      });
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.registrations || []);
      }
    } finally {
      setListLoading(false);
    }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    checkAuth(password);
  }

  function logout() {
    sessionStorage.removeItem("tantra_admin_pw");
    setAuthed(false);
    setPassword("");
    setRegistrations([]);
  }

  function downloadCSV() {
    window.location.href = `/api/admin/export?format=csv&pw=${encodeURIComponent(password)}`;
  }

  async function handleIssueSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIssueError("");
    setIssueSuccess(null);

    if (fullName.trim().length < 2) {
      setIssueError("Please enter the client's full name");
      return;
    }
    if (!isValidEmail(email)) {
      setIssueError("Please enter a valid email address");
      return;
    }
    if (!isValidPhone(phone)) {
      setIssueError("Please enter a valid phone number");
      return;
    }
    if (groupSize < 1 || groupSize > 50) {
      setIssueError("Party size must be between 1 and 50");
      return;
    }

    setIssueLoading(true);
    try {
      const res = await fetch("/api/issue-tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: normalizePhone(phone),
          email: email.trim().toLowerCase(),
          group_size: groupSize,
          notes: notes.trim() || null,
          table_number: tableNumber.trim() || null,
          event_datetime: eventDatetime || null,
          issued_by: issuedBy.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      if (issuedBy.trim()) {
        sessionStorage.setItem("tantra_hostess_name", issuedBy.trim());
      }

      setIssueSuccess({
        clientName: data.client_name,
        email: data.email,
        guestCount: data.guest_count,
        ticketCode: data.ticket_code,
        notes: data.notes,
        tableNumber: data.table_number,
        eventDatetime: data.event_datetime,
        emailSent: data.email_sent,
        emailError: data.email_error,
      });

      setFullName("");
      setPhone("");
      setEmail("");
      setGroupSize(1);
      setNotes("");
      setTableNumber("");
      // Keep eventDatetime — same date for the night

      refreshList();
    } catch (err: any) {
      setIssueError(err.message || "Failed to issue ticket");
    } finally {
      setIssueLoading(false);
    }
  }

  const filtered = registrations.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      r.full_name.toLowerCase().includes(s) ||
      r.phone.includes(s) ||
      r.email.toLowerCase().includes(s) ||
      (r.table_number || "").toLowerCase().includes(s) ||
      r.tickets.some((t) => t.ticket_code.toLowerCase().includes(s))
    );
  });

  const totalGuests = registrations.reduce((sum, r) => sum + r.group_size, 0);
  const totalCheckedIn = registrations.reduce(
    (sum, r) => sum + r.tickets.filter((t) => t.checked_in).length,
    0
  );

  // Show light logo in light mode, original in dark mode
  const logoUrl = theme === "dark" ? LOGO_DARK : LOGO_LIGHT;

  // Theme toggle component
  const ThemeToggle = () => (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="btn-icon w-10 h-10"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {!themeMounted ? null : theme === "dark" ? (
        // Sun icon
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10l1.4 1.4M3 12h2m14 0h2M5.6 18.4l1.4-1.4m10-10l1.4-1.4" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ) : (
        // Moon icon
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );

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
          className="w-full max-w-sm bg-card tantra-border-strong rounded-none p-10 relative z-10"
        >
          <div className="flex justify-center mb-8">
            <img src={logoUrl} alt="Tantra" className="h-20 w-auto object-contain" />
          </div>

          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="accent-line"></span>
            <span className="label">STAFF ACCESS</span>
            <span className="accent-line"></span>
          </div>

          <p className="text-muted text-sm text-center mb-7">
            Enter password to continue
          </p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="tantra-input w-full rounded-none px-4 py-3.5 mb-4"
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
            className="btn-red w-full py-4 text-sm rounded-none"
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

      <div className="relative z-10 px-4 py-6 sm:py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-[var(--border)]">
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="Tantra" className="h-12 w-auto object-contain" />
              <div className="hidden sm:block">
                <div className="label">RESERVATIONS</div>
                <div className="text-xs text-muted">Staff dashboard</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button onClick={logout} className="btn-outline px-5 py-2.5 text-xs">
                Sign Out
              </button>
            </div>
          </div>

          <div className="flex gap-8 mb-8 border-b border-[var(--border)]">
            <button
              onClick={() => setTab("issue")}
              className={`pb-3 text-sm font-bold uppercase tracking-widest transition relative ${
                tab === "issue" ? "text-default" : "text-muted hover:text-default"
              }`}
            >
              New Reservation
              {tab === "issue" && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-tantra-red" />
              )}
            </button>
            <button
              onClick={() => setTab("list")}
              className={`pb-3 text-sm font-bold uppercase tracking-widest transition relative ${
                tab === "list" ? "text-default" : "text-muted hover:text-default"
              }`}
            >
              Guest List
              <span className="ml-2 text-tantra-red">({registrations.length})</span>
              {tab === "list" && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-tantra-red" />
              )}
            </button>
          </div>

          {tab === "issue" && (
            <div className="max-w-xl">
              {issueSuccess ? (
                <div className="bg-card tantra-border-strong p-7 sm:p-9">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-tantra-red/20 mb-5 mx-auto border-2 border-tantra-red animate-pulse-red">
                    <svg
                      className="w-8 h-8 text-tantra-red"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  <div className="text-center mb-2">
                    <span className="accent-line"></span>
                    <span className="label mx-3">CONFIRMED</span>
                    <span className="accent-line"></span>
                  </div>

                  <h2 className="display-text text-3xl text-default text-center mb-1">
                    Reservation Issued
                  </h2>
                  <p className="text-sm text-muted text-center mb-6">
                    <span className="text-default font-semibold">{issueSuccess.clientName}</span>
                    <span className="mx-2 text-tantra-red">·</span>
                    {issueSuccess.guestCount}{" "}
                    {issueSuccess.guestCount === 1 ? "guest" : "guests"}
                    {issueSuccess.tableNumber && (
                      <>
                        <span className="mx-2 text-tantra-red">·</span>
                        Table {issueSuccess.tableNumber}
                      </>
                    )}
                  </p>

                  <div className="bg-deep border border-tantra-red p-6 mb-5 text-center relative">
                    <div className="absolute top-0 left-0 w-2 h-2 bg-tantra-red"></div>
                    <div className="absolute top-0 right-0 w-2 h-2 bg-tantra-red"></div>
                    <div className="absolute bottom-0 left-0 w-2 h-2 bg-tantra-red"></div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 bg-tantra-red"></div>

                    {issueSuccess.eventDatetime && (
                      <div className="mb-4 pb-4 border-b border-[var(--border)]">
                        <div className="label mb-2">EVENT DATE</div>
                        <div className="display-text text-default text-lg">
                          {formatEventDate(issueSuccess.eventDatetime)}
                        </div>
                      </div>
                    )}

                    <div className="label mb-3">TICKET NUMBER</div>
                    <div className="font-mono text-default text-3xl font-black tracking-wider">
                      {issueSuccess.ticketCode}
                    </div>

                    {issueSuccess.tableNumber && (
                      <div className="mt-5 pt-5 border-t border-[var(--border)]">
                        <div className="label mb-2">TABLE</div>
                        <div className="display-text text-tantra-red text-2xl">
                          {issueSuccess.tableNumber.toUpperCase()}
                        </div>
                      </div>
                    )}

                    {issueSuccess.notes && (
                      <div className="mt-5 pt-5 border-t border-[var(--border)]">
                        <div className="label mb-2">NOTES</div>
                        <div className="text-sm text-muted italic">
                          {issueSuccess.notes}
                        </div>
                      </div>
                    )}
                  </div>

                  {issueSuccess.emailSent ? (
                    <div className="bg-green-500/10 border border-green-500/40 text-green-600 dark:text-green-200 text-sm px-4 py-3 mb-5 flex items-start gap-2">
                      <span className="font-bold">✓</span>
                      <span>
                        Email sent to <strong>{issueSuccess.email}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="bg-tantra-red/10 border border-tantra-red text-red-600 dark:text-red-200 text-sm px-4 py-3 mb-5">
                      ⚠ Saved but email failed: {issueSuccess.emailError}
                    </div>
                  )}

                  <button
                    onClick={() => setIssueSuccess(null)}
                    className="btn-red w-full py-4 text-sm"
                  >
                    New Reservation
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleIssueSubmit}
                  className="bg-card tantra-border-strong p-7 sm:p-9 space-y-5"
                >
                  <div className="mb-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="accent-line"></span>
                      <span className="label">NEW ENTRY</span>
                    </div>
                    <h2 className="display-text text-3xl text-default mb-2">Add Guest</h2>
                    <p className="text-sm text-muted">
                      Enter client details — they receive one ticket by email.
                    </p>
                  </div>

                  <div>
                    <label className="label block mb-2">EVENT DATE & TIME</label>
                    <input
                      type="datetime-local"
                      value={eventDatetime}
                      onChange={(e) => setEventDatetime(e.target.value)}
                      className="tantra-input w-full px-4 py-3.5"
                    />
                  </div>

                  <div>
                    <label className="label block mb-2">CLIENT NAME</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="tantra-input w-full px-4 py-3.5"
                      placeholder="Full name"
                    />
                  </div>

                  <div>
                    <label className="label block mb-2">EMAIL</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="tantra-input w-full px-4 py-3.5"
                      placeholder="client@example.com"
                    />
                  </div>

                  <div>
                    <label className="label block mb-2">PHONE</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="tantra-input w-full px-4 py-3.5"
                      placeholder="+297 123 4567"
                    />
                  </div>

                  <div>
                    <label className="label block mb-3">PARTY SIZE</label>
                    <div className="flex items-center gap-4 bg-deep tantra-border p-4">
                      <button
                        type="button"
                        onClick={() => setGroupSize(Math.max(1, groupSize - 1))}
                        className="w-12 h-12 bg-surface tantra-border text-default hover:border-tantra-red hover:text-tantra-red transition text-xl font-bold"
                      >
                        −
                      </button>
                      <div className="flex-1 text-center">
                        <div className="display-text text-5xl text-tantra-red leading-none">
                          {groupSize}
                        </div>
                        <div className="label mt-2">
                          {groupSize === 1 ? "GUEST" : "GUESTS"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGroupSize(Math.min(50, groupSize + 1))}
                        className="w-12 h-12 bg-surface tantra-border text-default hover:border-tantra-red hover:text-tantra-red transition text-xl font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label block mb-2">
                      TABLE <span className="normal-case tracking-normal text-subtle">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      className="tantra-input w-full px-4 py-3.5"
                      placeholder="e.g. 12, VIP-3, Booth A"
                    />
                  </div>

                  <div>
                    <label className="label block mb-2">
                      NOTES <span className="normal-case tracking-normal text-subtle">(birthdays, special requests)</span>
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="tantra-input w-full px-4 py-3.5"
                      placeholder="e.g. Birthday celebration, bottle service"
                    />
                  </div>

                  <div>
                    <label className="label block mb-2">
                      ISSUED BY <span className="normal-case tracking-normal text-subtle">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={issuedBy}
                      onChange={(e) => setIssuedBy(e.target.value)}
                      className="tantra-input w-full px-4 py-3.5"
                      placeholder="Hostess name"
                    />
                  </div>

                  {issueError && (
                    <div className="bg-tantra-red/10 border border-tantra-red text-red-600 dark:text-red-200 text-sm px-4 py-3">
                      {issueError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={issueLoading}
                    className="btn-red w-full py-4 text-sm"
                  >
                    {issueLoading ? "Sending..." : "Issue Ticket & Send Email"}
                  </button>
                </form>
              )}
            </div>
          )}

          {tab === "list" && (
            <div>
              <div className="grid grid-cols-3 gap-3 sm:gap-5 mb-6">
                <StatCard label="RESERVATIONS" value={registrations.length} />
                <StatCard label="TOTAL GUESTS" value={totalGuests} accent />
                <StatCard label="CHECKED IN" value={totalCheckedIn} />
              </div>

              <div className="flex flex-wrap gap-3 mb-5">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, phone, ticket, table..."
                  className="tantra-input flex-1 min-w-[200px] px-4 py-3"
                />
                <button
                  onClick={refreshList}
                  disabled={listLoading}
                  className="btn-outline px-5 py-3 text-xs"
                >
                  {listLoading ? "..." : "Refresh"}
                </button>
                <button onClick={downloadCSV} className="btn-red px-5 py-3 text-xs">
                  Export CSV
                </button>
              </div>

              <div className="bg-card tantra-border-strong overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-deep border-b border-tantra-red">
                      <tr className="text-left">
                        <th className="px-4 py-4 label">Client</th>
                        <th className="px-4 py-4 label">Contact</th>
                        <th className="px-4 py-4 label">Event</th>
                        <th className="px-4 py-4 label">Party</th>
                        <th className="px-4 py-4 label">Table</th>
                        <th className="px-4 py-4 label">Ticket</th>
                        <th className="px-4 py-4 label">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-12 text-center text-muted"
                          >
                            {registrations.length === 0
                              ? "No reservations yet."
                              : "No matches."}
                          </td>
                        </tr>
                      )}
                      {filtered.map((r) => {
                        const ticket = r.tickets[0];
                        return (
                          <tr
                            key={r.id}
                            className="border-t border-[var(--border)] hover:bg-surface transition"
                          >
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-default">
                                {r.full_name}
                              </div>
                              {r.notes && (
                                <div className="text-xs text-muted mt-1 italic">
                                  {r.notes}
                                </div>
                              )}
                              {r.issued_by && (
                                <div className="text-[10px] text-subtle mt-0.5">
                                  by {r.issued_by}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="text-xs text-muted">{r.email}</div>
                              <div className="text-xs text-subtle font-mono">
                                {r.phone}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                              {r.event_datetime ? (
                                <span className="text-default font-semibold">
                                  {formatEventDate(r.event_datetime)}
                                </span>
                              ) : (
                                <span className="text-subtle">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-block bg-tantra-red text-white px-3 py-1 font-bold text-sm">
                                {r.group_size}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              {r.table_number ? (
                                <span className="inline-block bg-surface border border-tantra-red text-tantra-red px-2.5 py-1 font-bold text-xs uppercase">
                                  {r.table_number}
                                </span>
                              ) : (
                                <span className="text-subtle text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              {ticket ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-default text-xs font-bold">
                                    {ticket.ticket_code}
                                  </span>
                                  {ticket.checked_in && (
                                    <span className="bg-green-600 text-white px-1.5 py-0.5 text-[9px] font-bold">
                                      IN
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-subtle text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-xs">
                              {r.email_sent ? (
                                <span className="text-green-500">✓</span>
                              ) : (
                                <span className="text-tantra-red">✗</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`p-5 sm:p-6 relative overflow-hidden ${
        accent ? "bg-tantra-red text-white" : "bg-card tantra-border-strong text-default"
      }`}
    >
      <div className={`label mb-2 ${accent ? "text-white/80" : ""}`}>{label}</div>
      <div className="display-text text-4xl sm:text-5xl leading-none">{value}</div>
      {!accent && <div className="absolute top-0 right-0 w-1 h-full bg-tantra-red" />}
    </div>
  );
}
