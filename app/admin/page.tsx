"use client";

import { useState, useEffect } from "react";
import { isValidEmail, isValidPhone, normalizePhone } from "@/lib/utils";

const LOGO_URL = "https://i.imgur.com/tEFCuKr.png";

type Registration = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  group_size: number;
  event_name: string;
  notes: string | null;
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
  const [issuedBy, setIssuedBy] = useState("");
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issueSuccess, setIssueSuccess] = useState<{
    clientName: string;
    email: string;
    guestCount: number;
    ticketCode: string;
    notes: string | null;
    emailSent: boolean;
    emailError: string | null;
  } | null>(null);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState("");

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
        emailSent: data.email_sent,
        emailError: data.email_error,
      });

      setFullName("");
      setPhone("");
      setEmail("");
      setGroupSize(1);
      setNotes("");

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
      r.tickets.some((t) => t.ticket_code.toLowerCase().includes(s))
    );
  });

  const totalGuests = registrations.reduce((sum, r) => sum + r.group_size, 0);
  const totalCheckedIn = registrations.reduce(
    (sum, r) => sum + r.tickets.filter((t) => t.checked_in).length,
    0
  );

  // ============== LOGIN SCREEN ==============
  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 grain relative bg-tantra-bg">
        {/* Red glow background accent */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-tantra-red opacity-[0.08] blur-[120px] rounded-full" />
        </div>

        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-tantra-card tantra-border-strong rounded-none p-10 relative z-10"
        >
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={LOGO_URL} alt="Tantra" className="h-20 w-auto object-contain" />
          </div>

          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="accent-line"></span>
            <span className="label text-tantra-mutedLight">STAFF ACCESS</span>
            <span className="accent-line"></span>
          </div>

          <p className="text-tantra-muted text-sm text-center mb-7">
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
            <div className="bg-tantra-red/10 border border-tantra-red text-red-200 text-sm px-4 py-3 mb-4">
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

  // ============== MAIN DASHBOARD ==============
  return (
    <main className="min-h-screen grain relative bg-tantra-bg">
      {/* Top red accent bar */}
      <div className="h-1 bg-tantra-red w-full" />

      <div className="relative z-10 px-4 py-6 sm:py-8">
        <div className="max-w-5xl mx-auto">
          {/* Header with logo */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-tantra-border">
            <div className="flex items-center gap-4">
              <img src={LOGO_URL} alt="Tantra" className="h-12 w-auto object-contain" />
              <div className="hidden sm:block">
                <div className="label">RESERVATIONS</div>
                <div className="text-xs text-tantra-muted">Staff dashboard</div>
              </div>
            </div>
            <button onClick={logout} className="btn-outline px-5 py-2.5 text-xs">
              Sign Out
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-8 mb-8 border-b border-tantra-border">
            <button
              onClick={() => setTab("issue")}
              className={`pb-3 text-sm font-bold uppercase tracking-widest transition relative ${
                tab === "issue" ? "text-white" : "text-tantra-muted hover:text-white"
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
                tab === "list" ? "text-white" : "text-tantra-muted hover:text-white"
              }`}
            >
              Guest List
              <span className="ml-2 text-tantra-red">({registrations.length})</span>
              {tab === "list" && (
                <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-tantra-red" />
              )}
            </button>
          </div>

          {/* ===== ISSUE TAB ===== */}
          {tab === "issue" && (
            <div className="max-w-xl">
              {issueSuccess ? (
                <div className="bg-tantra-card tantra-border-strong p-7 sm:p-9">
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
                    <span className="label mx-3 text-tantra-mutedLight">CONFIRMED</span>
                    <span className="accent-line"></span>
                  </div>

                  <h2 className="display-text text-3xl text-white text-center mb-1">
                    Reservation Issued
                  </h2>
                  <p className="text-sm text-tantra-mutedLight text-center mb-6">
                    <span className="text-white font-semibold">{issueSuccess.clientName}</span>
                    <span className="mx-2 text-tantra-red">·</span>
                    {issueSuccess.guestCount}{" "}
                    {issueSuccess.guestCount === 1 ? "guest" : "guests"}
                  </p>

                  <div className="bg-tantra-black border border-tantra-red p-6 mb-5 text-center relative">
                    <div className="absolute top-0 left-0 w-2 h-2 bg-tantra-red"></div>
                    <div className="absolute top-0 right-0 w-2 h-2 bg-tantra-red"></div>
                    <div className="absolute bottom-0 left-0 w-2 h-2 bg-tantra-red"></div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 bg-tantra-red"></div>

                    <div className="label mb-3">TICKET NUMBER</div>
                    <div className="font-mono text-white text-3xl font-black tracking-wider">
                      {issueSuccess.ticketCode}
                    </div>

                    {issueSuccess.notes && (
                      <div className="mt-5 pt-5 border-t border-tantra-border">
                        <div className="label mb-2">NOTES</div>
                        <div className="text-sm text-tantra-mutedLight italic">
                          {issueSuccess.notes}
                        </div>
                      </div>
                    )}
                  </div>

                  {issueSuccess.emailSent ? (
                    <div className="bg-green-950/40 border border-green-700/50 text-green-200 text-sm px-4 py-3 mb-5 flex items-start gap-2">
                      <span className="text-green-400 font-bold">✓</span>
                      <span>
                        Email sent to <strong>{issueSuccess.email}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="bg-tantra-red/10 border border-tantra-red text-red-200 text-sm px-4 py-3 mb-5">
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
                  className="bg-tantra-card tantra-border-strong p-7 sm:p-9 space-y-5"
                >
                  <div className="mb-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="accent-line"></span>
                      <span className="label">NEW ENTRY</span>
                    </div>
                    <h2 className="display-text text-3xl text-white mb-2">
                      Add Guest
                    </h2>
                    <p className="text-sm text-tantra-muted">
                      Enter client details — they receive one ticket by email.
                      Hostess verifies at the door.
                    </p>
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
                    <div className="flex items-center gap-4 bg-tantra-black border border-tantra-border p-4">
                      <button
                        type="button"
                        onClick={() => setGroupSize(Math.max(1, groupSize - 1))}
                        className="w-12 h-12 bg-tantra-surface border border-tantra-border text-white hover:border-tantra-red hover:text-tantra-red transition text-xl font-bold"
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
                        className="w-12 h-12 bg-tantra-surface border border-tantra-border text-white hover:border-tantra-red hover:text-tantra-red transition text-xl font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label block mb-2">
                      NOTES <span className="normal-case tracking-normal text-tantra-muted/80">(tables, birthdays, VIP)</span>
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="tantra-input w-full px-4 py-3.5"
                      placeholder="e.g. 1 VIP table, birthday, promoter"
                    />
                  </div>

                  <div>
                    <label className="label block mb-2">
                      ISSUED BY <span className="normal-case tracking-normal text-tantra-muted/80">(optional)</span>
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
                    <div className="bg-tantra-red/10 border border-tantra-red text-red-200 text-sm px-4 py-3">
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

          {/* ===== LIST TAB ===== */}
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
                  placeholder="Search name, email, phone, ticket code..."
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

              <div className="bg-tantra-card tantra-border-strong overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-tantra-black border-b border-tantra-red">
                      <tr className="text-left">
                        <th className="px-4 py-4 label text-tantra-mutedLight">Client</th>
                        <th className="px-4 py-4 label text-tantra-mutedLight">Contact</th>
                        <th className="px-4 py-4 label text-tantra-mutedLight">Party</th>
                        <th className="px-4 py-4 label text-tantra-mutedLight">Ticket</th>
                        <th className="px-4 py-4 label text-tantra-mutedLight">Email</th>
                        <th className="px-4 py-4 label text-tantra-mutedLight">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-12 text-center text-tantra-muted"
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
                            className="border-t border-tantra-border hover:bg-tantra-surface/50 transition"
                          >
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-white">
                                {r.full_name}
                              </div>
                              {r.notes && (
                                <div className="text-xs text-tantra-mutedLight mt-1 italic">
                                  {r.notes}
                                </div>
                              )}
                              {r.issued_by && (
                                <div className="text-[10px] text-tantra-muted mt-0.5">
                                  by {r.issued_by}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="text-xs text-tantra-mutedLight">
                                {r.email}
                              </div>
                              <div className="text-xs text-tantra-muted font-mono">
                                {r.phone}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-block bg-tantra-red text-white px-3 py-1 font-bold text-sm">
                                {r.group_size}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              {ticket ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-white text-xs font-bold">
                                    {ticket.ticket_code}
                                  </span>
                                  {ticket.checked_in && (
                                    <span className="bg-green-600 text-white px-1.5 py-0.5 text-[9px] font-bold">
                                      IN
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-tantra-muted text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-xs">
                              {r.email_sent ? (
                                <span className="text-green-400">✓ Sent</span>
                              ) : (
                                <span className="text-tantra-red">✗ Failed</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-tantra-muted text-xs whitespace-nowrap">
                              {new Date(r.created_at).toLocaleString()}
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
        accent ? "bg-tantra-red text-white" : "bg-tantra-card tantra-border-strong text-white"
      }`}
    >
      <div
        className={`label mb-2 ${accent ? "text-white/80" : "text-tantra-mutedLight"}`}
      >
        {label}
      </div>
      <div className="display-text text-4xl sm:text-5xl leading-none">{value}</div>
      {!accent && (
        <div className="absolute top-0 right-0 w-1 h-full bg-tantra-red" />
      )}
    </div>
  );
}
