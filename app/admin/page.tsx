"use client";

import { useState, useEffect, useMemo } from "react";
import {
  isValidEmail,
  isValidPhone,
  normalizePhone,
  formatEventDate,
  getDefaultEventDatetime,
  isoToDateKey,
  getTodayKey,
  getTomorrowKey,
  getTonightKey,
  formatDateKey,
  toDatetimeLocal,
} from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import AnalyticsPanel from "@/components/AnalyticsPanel";

const LOGO_DARK = "https://i.imgur.com/tEFCuKr.png";
const LOGO_LIGHT = "https://i.imgur.com/tEFCuKr.png";

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
    checked_in_at: string | null;
    person_number: number;
  }[];
};

type OpenBarSignup = {
  id: string;
  full_name: string;
  email: string;
  date_of_birth: string;
  ticket_code: string;
  event_datetime: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  email_sent: boolean;
  created_at: string;
};

type Tab = "issue" | "list" | "openbar";
type CheckInFilter = "all" | "pending" | "checked_in";
type DateFilterMode = "specific" | "all" | "upcoming";

export default function AdminPage() {
  const { theme, toggle: toggleTheme, mounted: themeMounted } = useTheme();

  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState<Tab>("issue");

  // Issue form
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
    clientName: string; email: string; guestCount: number; ticketCode: string;
    notes: string | null; tableNumber: string | null; eventDatetime: string | null;
    emailSent: boolean; emailError: string | null;
  } | null>(null);

  // Reservations list
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CheckInFilter>("all");
  const [dateMode, setDateMode] = useState<DateFilterMode>("specific");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayKey());
  const [checkingIn, setCheckingIn] = useState<Record<string, boolean>>({});

  // Open Bar
  const [openBarSignups, setOpenBarSignups] = useState<OpenBarSignup[]>([]);
  const [openBarLoading, setOpenBarLoading] = useState(false);
  const [openBarSearch, setOpenBarSearch] = useState("");
  const [openBarFilter, setOpenBarFilter] = useState<CheckInFilter>("all");
  const [openBarCheckingIn, setOpenBarCheckingIn] = useState<Record<string, boolean>>({});

  // Modals
  const [editingReservation, setEditingReservation] = useState<Registration | null>(null);
  const [deletingReservation, setDeletingReservation] = useState<Registration | null>(null);
  const [deletingOpenBar, setDeletingOpenBar] = useState<OpenBarSignup | null>(null);

  useEffect(() => {
    if (!eventDatetime) setEventDatetime(getDefaultEventDatetime());
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? sessionStorage.getItem("tantra_admin_pw") : null;
    if (saved) {
      setPassword(saved);
      checkAuth(saved);
    }
  }, []);

  async function checkAuth(pw: string) {
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/admin/export?list=1", { headers: { "x-admin-password": pw } });
      if (res.status === 401) {
        setAuthError("Incorrect password");
        sessionStorage.removeItem("tantra_admin_pw");
        setAuthed(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRegistrations(data.registrations || []);
      await loadOpenBar(pw);
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

  async function loadOpenBar(pw?: string) {
    const useP = pw || password;
    setOpenBarLoading(true);
    try {
      const res = await fetch("/api/open-bar-list", { headers: { "x-admin-password": useP } });
      if (res.ok) {
        const data = await res.json();
        setOpenBarSignups(data.signups || []);
      }
    } finally {
      setOpenBarLoading(false);
    }
  }

  async function refreshList() {
    setListLoading(true);
    try {
      const res = await fetch("/api/admin/export?list=1", { headers: { "x-admin-password": password } });
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
    setOpenBarSignups([]);
  }

  function downloadCSV() {
    window.location.href = `/api/admin/export?format=csv&pw=${encodeURIComponent(password)}`;
  }

  async function toggleCheckIn(ticketCode: string, currentStatus: boolean) {
    const next = !currentStatus;
    setRegistrations((prev) =>
      prev.map((r) => ({
        ...r,
        tickets: r.tickets.map((t) =>
          t.ticket_code === ticketCode
            ? { ...t, checked_in: next, checked_in_at: next ? new Date().toISOString() : null }
            : t
        ),
      }))
    );
    setCheckingIn((m) => ({ ...m, [ticketCode]: true }));

    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ ticket_code: ticketCode, checked_in: next }),
      });
      if (!res.ok) {
        setRegistrations((prev) =>
          prev.map((r) => ({
            ...r,
            tickets: r.tickets.map((t) =>
              t.ticket_code === ticketCode
                ? { ...t, checked_in: currentStatus, checked_in_at: currentStatus ? t.checked_in_at : null }
                : t
            ),
          }))
        );
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to update check-in");
      }
    } catch (err) {
      alert("Network error updating check-in");
    } finally {
      setCheckingIn((m) => {
        const next = { ...m };
        delete next[ticketCode];
        return next;
      });
    }
  }

  async function toggleOpenBarCheckIn(ticketCode: string, currentStatus: boolean) {
    const next = !currentStatus;
    setOpenBarSignups((prev) =>
      prev.map((s) =>
        s.ticket_code === ticketCode
          ? { ...s, checked_in: next, checked_in_at: next ? new Date().toISOString() : null }
          : s
      )
    );
    setOpenBarCheckingIn((m) => ({ ...m, [ticketCode]: true }));

    try {
      const res = await fetch("/api/open-bar-list", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ ticket_code: ticketCode, checked_in: next }),
      });
      if (!res.ok) {
        setOpenBarSignups((prev) =>
          prev.map((s) =>
            s.ticket_code === ticketCode
              ? { ...s, checked_in: currentStatus, checked_in_at: currentStatus ? s.checked_in_at : null }
              : s
          )
        );
        alert("Failed to update check-in");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setOpenBarCheckingIn((m) => {
        const next = { ...m };
        delete next[ticketCode];
        return next;
      });
    }
  }

  async function handleIssueSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIssueError("");
    setIssueSuccess(null);

    if (fullName.trim().length < 2) { setIssueError("Please enter the client's full name"); return; }
    if (!isValidEmail(email)) { setIssueError("Please enter a valid email address"); return; }
    if (!isValidPhone(phone)) { setIssueError("Please enter a valid phone number"); return; }
    if (groupSize < 1 || groupSize > 50) { setIssueError("Party size must be between 1 and 50"); return; }

    setIssueLoading(true);
    try {
      const res = await fetch("/api/issue-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
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

      if (issuedBy.trim()) sessionStorage.setItem("tantra_hostess_name", issuedBy.trim());

      setIssueSuccess({
        clientName: data.client_name, email: data.email, guestCount: data.guest_count,
        ticketCode: data.ticket_code, notes: data.notes, tableNumber: data.table_number,
        eventDatetime: data.event_datetime, emailSent: data.email_sent, emailError: data.email_error,
      });

      setFullName(""); setPhone(""); setEmail(""); setGroupSize(1); setNotes(""); setTableNumber("");
      refreshList();
    } catch (err: any) {
      setIssueError(err.message || "Failed to issue ticket");
    } finally {
      setIssueLoading(false);
    }
  }

  // ====== Filter reservations ======
  const { availableDates, dateFilteredRegs } = useMemo(() => {
    const dateSet = new Set<string>();
    for (const r of registrations) {
      if (r.event_datetime) {
        const k = isoToDateKey(r.event_datetime);
        if (k) dateSet.add(k);
      }
    }
    const availableDates = Array.from(dateSet).sort().reverse();

    let filtered = registrations;
    if (dateMode === "specific" && selectedDate) {
      filtered = registrations.filter((r) => r.event_datetime && isoToDateKey(r.event_datetime) === selectedDate);
    } else if (dateMode === "upcoming") {
      const today = getTodayKey();
      filtered = registrations.filter((r) => r.event_datetime && isoToDateKey(r.event_datetime) >= today);
    }
    return { availableDates, dateFilteredRegs: filtered };
  }, [registrations, dateMode, selectedDate]);

  const searchAndStatusFiltered = dateFilteredRegs.filter((r) => {
    const ticket = r.tickets[0];
    if (filter === "pending" && ticket?.checked_in) return false;
    if (filter === "checked_in" && !ticket?.checked_in) return false;
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

  // ====== Filter open bar ======
  const openBarFiltered = openBarSignups.filter((s) => {
    if (openBarFilter === "pending" && s.checked_in) return false;
    if (openBarFilter === "checked_in" && !s.checked_in) return false;
    if (!openBarSearch.trim()) return true;
    const q = openBarSearch.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.ticket_code.toLowerCase().includes(q)
    );
  });

  const totalReservations = dateFilteredRegs.length;
  const totalGuests = dateFilteredRegs.reduce((sum, r) => sum + r.group_size, 0);
  const totalCheckedIn = dateFilteredRegs.reduce((sum, r) => sum + (r.tickets[0]?.checked_in ? r.group_size : 0), 0);
  const pendingGuests = totalGuests - totalCheckedIn;

  const obTotal = openBarSignups.length;
  const obCheckedIn = openBarSignups.filter((s) => s.checked_in).length;
  const obPending = obTotal - obCheckedIn;

  const logoUrl = theme === "dark" ? LOGO_DARK : LOGO_LIGHT;

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

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 grain relative bg-app">
        <div className="absolute top-4 right-4 z-20"><ThemeToggle /></div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-tantra-red opacity-[0.08] blur-[120px] rounded-full" />
        </div>
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-card tantra-border-strong p-10 relative z-10">
          <div className="flex justify-center mb-8"><img src={logoUrl} alt="Tantra" className="h-20 w-auto object-contain" /></div>
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="accent-line"></span><span className="label">STAFF ACCESS</span><span className="accent-line"></span>
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

      <div className="relative z-10 px-4 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-[var(--border)]">
            <div className="flex items-center gap-4">
              <img src={logoUrl} alt="Tantra" className="h-12 w-auto object-contain" />
              <div className="hidden sm:block">
                <div className="label">RESERVATIONS</div>
                <div className="text-xs text-muted">Staff dashboard</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href="/door" className="btn-outline px-5 py-2.5 text-xs flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M9 9h6v6H9z" />
                </svg>
                Door
              </a>
              <ThemeToggle />
              <button onClick={logout} className="btn-outline px-5 py-2.5 text-xs">Sign Out</button>
            </div>
          </div>

          <div className="flex gap-8 mb-8 border-b border-[var(--border)] overflow-x-auto">
            <TabButton active={tab === "issue"} onClick={() => setTab("issue")}>New Reservation</TabButton>
            <TabButton active={tab === "list"} onClick={() => setTab("list")}>
              Guest List<span className="ml-2 text-tantra-red">({registrations.length})</span>
            </TabButton>
            <TabButton active={tab === "openbar"} onClick={() => setTab("openbar")}>
              Open Bar<span className="ml-2 text-tantra-red">({openBarSignups.length})</span>
            </TabButton>
          </div>

          {tab === "issue" && (
            <IssueTab
              issueSuccess={issueSuccess} setIssueSuccess={setIssueSuccess}
              fullName={fullName} setFullName={setFullName}
              email={email} setEmail={setEmail}
              phone={phone} setPhone={setPhone}
              groupSize={groupSize} setGroupSize={setGroupSize}
              tableNumber={tableNumber} setTableNumber={setTableNumber}
              notes={notes} setNotes={setNotes}
              issuedBy={issuedBy} setIssuedBy={setIssuedBy}
              eventDatetime={eventDatetime} setEventDatetime={setEventDatetime}
              issueError={issueError} issueLoading={issueLoading}
              onSubmit={handleIssueSubmit}
            />
          )}

          {tab === "list" && (
            <div className="space-y-6">
              <DateFilterBar mode={dateMode} setMode={setDateMode} selectedDate={selectedDate} setSelectedDate={setSelectedDate} availableDates={availableDates} />
              <div className="grid grid-cols-3 gap-3 sm:gap-5">
                <StatCard label="RESERVATIONS" value={totalReservations} />
                <StatCard label="CHECKED IN" value={totalCheckedIn} suffix={`of ${totalGuests}`} accent />
                <StatCard label="PENDING" value={pendingGuests} />
              </div>
              <div className="flex flex-wrap gap-3">
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, ticket, table..." className="tantra-input flex-1 min-w-[200px] px-4 py-3" />
                <button onClick={refreshList} disabled={listLoading} className="btn-outline px-5 py-3 text-xs">{listLoading ? "..." : "Refresh"}</button>
                <button onClick={downloadCSV} className="btn-red px-5 py-3 text-xs">Export CSV</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <FilterPill active={filter === "all"} onClick={() => setFilter("all")} label={`All (${dateFilteredRegs.length})`} />
                <FilterPill active={filter === "pending"} onClick={() => setFilter("pending")} label={`Pending (${dateFilteredRegs.filter((r) => !r.tickets[0]?.checked_in).length})`} />
                <FilterPill active={filter === "checked_in"} onClick={() => setFilter("checked_in")} label={`Checked In (${dateFilteredRegs.filter((r) => r.tickets[0]?.checked_in).length})`} />
              </div>
              <GuestTable
                registrations={searchAndStatusFiltered}
                totalRegistrations={registrations.length}
                checkingIn={checkingIn}
                onToggleCheckIn={toggleCheckIn}
                onEdit={(r) => setEditingReservation(r)}
                onDelete={(r) => setDeletingReservation(r)}
              />
              <div className="pt-6 border-t border-[var(--border)]">
                <AnalyticsPanel registrations={registrations} />
              </div>
            </div>
          )}

          {tab === "openbar" && (
            <div className="space-y-6">
              <div className="bg-card tantra-border-strong p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="accent-line"></span>
                  <span className="label">OPEN BAR PASS SIGNUPS</span>
                </div>
                <p className="text-sm text-muted">
                  Public signups via <a href="/signup" target="_blank" className="text-tantra-red underline">/signup</a> — free Open Bar Pass valid Fri & Sat, 9:30–11:30 PM.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:gap-5">
                <StatCard label="TOTAL SIGNUPS" value={obTotal} />
                <StatCard label="REDEEMED" value={obCheckedIn} accent />
                <StatCard label="PENDING" value={obPending} />
              </div>

              <div className="flex flex-wrap gap-3">
                <input type="text" value={openBarSearch} onChange={(e) => setOpenBarSearch(e.target.value)} placeholder="Search name, email, pass number..." className="tantra-input flex-1 min-w-[200px] px-4 py-3" />
                <button onClick={() => loadOpenBar()} disabled={openBarLoading} className="btn-outline px-5 py-3 text-xs">
                  {openBarLoading ? "..." : "Refresh"}
                </button>
              </div>

              <div className="flex gap-2 flex-wrap">
                <FilterPill active={openBarFilter === "all"} onClick={() => setOpenBarFilter("all")} label={`All (${openBarSignups.length})`} />
                <FilterPill active={openBarFilter === "pending"} onClick={() => setOpenBarFilter("pending")} label={`Pending (${openBarSignups.filter((s) => !s.checked_in).length})`} />
                <FilterPill active={openBarFilter === "checked_in"} onClick={() => setOpenBarFilter("checked_in")} label={`Redeemed (${openBarSignups.filter((s) => s.checked_in).length})`} />
              </div>

              <OpenBarTable
                signups={openBarFiltered}
                totalSignups={openBarSignups.length}
                checkingIn={openBarCheckingIn}
                onToggleCheckIn={toggleOpenBarCheckIn}
                onDelete={(s) => setDeletingOpenBar(s)}
              />
            </div>
          )}
        </div>
      </div>

      {editingReservation && (
        <EditModal
          reservation={editingReservation}
          onClose={() => setEditingReservation(null)}
          onSaved={() => { setEditingReservation(null); refreshList(); }}
          password={password}
        />
      )}
      {deletingReservation && (
        <DeleteReservationModal
          reservation={deletingReservation}
          onClose={() => setDeletingReservation(null)}
          onDeleted={() => { setDeletingReservation(null); refreshList(); }}
          password={password}
        />
      )}
      {deletingOpenBar && (
        <DeleteOpenBarModal
          signup={deletingOpenBar}
          onClose={() => setDeletingOpenBar(null)}
          onDeleted={() => { setDeletingOpenBar(null); loadOpenBar(); }}
          password={password}
        />
      )}
    </main>
  );
}

// ======= Sub-components =======

function TabButton({ active, onClick, children }: any) {
  return (
    <button onClick={onClick} className={`pb-3 text-sm font-bold uppercase tracking-widest transition relative whitespace-nowrap ${active ? "text-default" : "text-muted hover:text-default"}`}>
      {children}
      {active && <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-tantra-red" />}
    </button>
  );
}

function DateFilterBar({ mode, setMode, selectedDate, setSelectedDate, availableDates }: any) {
  function handleQuickPick(key: "tonight" | "today" | "tomorrow" | "upcoming" | "all") {
    if (key === "all") { setMode("all"); return; }
    if (key === "upcoming") { setMode("upcoming"); return; }
    setMode("specific");
    if (key === "today") setSelectedDate(getTodayKey());
    else if (key === "tomorrow") setSelectedDate(getTomorrowKey());
    else if (key === "tonight") setSelectedDate(getTonightKey());
  }
  const todayKey = getTodayKey();
  const tomorrowKey = getTomorrowKey();
  const tonightKey = getTonightKey();

  return (
    <div className="bg-card tantra-border-strong p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="label mr-2">SHOWING</div>
        <QuickBtn active={mode === "specific" && selectedDate === todayKey} onClick={() => handleQuickPick("today")} label="Today" />
        <QuickBtn active={mode === "specific" && selectedDate === tonightKey && tonightKey !== todayKey} onClick={() => handleQuickPick("tonight")} label="Tonight" />
        <QuickBtn active={mode === "specific" && selectedDate === tomorrowKey} onClick={() => handleQuickPick("tomorrow")} label="Tomorrow" />
        <QuickBtn active={mode === "upcoming"} onClick={() => handleQuickPick("upcoming")} label="Upcoming" />
        <QuickBtn active={mode === "all"} onClick={() => handleQuickPick("all")} label="All Time" />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
        <div className="label">PICK A DATE</div>
        <input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setMode("specific"); }} className="tantra-input px-3 py-2 text-sm" />
        {availableDates.length > 0 && (
          <select value={mode === "specific" ? selectedDate : ""} onChange={(e) => { if (e.target.value) { setSelectedDate(e.target.value); setMode("specific"); } }} className="tantra-input px-3 py-2 text-sm">
            <option value="">— Jump to event night —</option>
            {availableDates.map((d: string) => <option key={d} value={d}>{formatDateKey(d)}</option>)}
          </select>
        )}
        {mode === "specific" && <div className="text-sm text-muted">Viewing: <span className="text-default font-semibold">{formatDateKey(selectedDate)}</span></div>}
        {mode === "upcoming" && <div className="text-sm text-muted">Viewing: <span className="text-default font-semibold">All upcoming</span></div>}
        {mode === "all" && <div className="text-sm text-muted">Viewing: <span className="text-default font-semibold">All reservations</span></div>}
      </div>
    </div>
  );
}

function QuickBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition border ${active ? "bg-tantra-red text-white border-tantra-red" : "bg-transparent text-muted border-[var(--border)] hover:border-tantra-red hover:text-default"}`}>
      {label}
    </button>
  );
}

function StatCard({ label, value, suffix, accent = false }: { label: string; value: number; suffix?: string; accent?: boolean }) {
  return (
    <div className={`p-5 sm:p-6 relative overflow-hidden ${accent ? "bg-tantra-red text-white" : "bg-card tantra-border-strong text-default"}`}>
      <div className={`label mb-2 ${accent ? "text-white/80" : ""}`}>{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="display-text text-4xl sm:text-5xl leading-none">{value}</div>
        {suffix && <div className={`text-xs font-semibold ${accent ? "text-white/70" : "text-muted"}`}>{suffix}</div>}
      </div>
      {!accent && <div className="absolute top-0 right-0 w-1 h-full bg-tantra-red" />}
    </div>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition border ${active ? "bg-tantra-red text-white border-tantra-red" : "bg-card text-muted border-[var(--border)] hover:border-tantra-red hover:text-default"}`}>
      {label}
    </button>
  );
}

function GuestTable({ registrations, totalRegistrations, checkingIn, onToggleCheckIn, onEdit, onDelete }: any) {
  return (
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
              <th className="px-4 py-4 label text-center">Check-in</th>
              <th className="px-4 py-4 label text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {registrations.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">
                {totalRegistrations === 0 ? "No reservations yet." : "No reservations match these filters."}
              </td></tr>
            )}
            {registrations.map((r: Registration) => {
              const ticket = r.tickets[0];
              const isCheckedIn = ticket?.checked_in ?? false;
              const isLoading = ticket ? checkingIn[ticket.ticket_code] : false;
              return (
                <tr key={r.id} className={`border-t border-[var(--border)] hover:bg-surface transition ${isCheckedIn ? "opacity-70" : ""}`}>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-default">{r.full_name}</div>
                    {r.notes && <div className="text-xs text-muted mt-1 italic">{r.notes}</div>}
                    {r.issued_by && <div className="text-[10px] text-subtle mt-0.5">by {r.issued_by}</div>}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-xs text-muted">{r.email}</div>
                    <div className="text-xs text-subtle font-mono">{r.phone}</div>
                  </td>
                  <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                    {r.event_datetime ? <span className="text-default font-semibold">{formatEventDate(r.event_datetime)}</span> : <span className="text-subtle">—</span>}
                  </td>
                  <td className="px-4 py-3.5"><span className="inline-block bg-tantra-red text-white px-3 py-1 font-bold text-sm">{r.group_size}</span></td>
                  <td className="px-4 py-3.5">
                    {r.table_number ? <span className="inline-block bg-surface border border-tantra-red text-tantra-red px-2.5 py-1 font-bold text-xs uppercase">{r.table_number}</span> : <span className="text-subtle text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    {ticket ? <span className="font-mono text-default text-xs font-bold">{ticket.ticket_code}</span> : <span className="text-subtle text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {ticket ? <CheckInButton checkedIn={isCheckedIn} loading={isLoading} checkedInAt={ticket.checked_in_at} onClick={() => onToggleCheckIn(ticket.ticket_code, isCheckedIn)} /> : <span className="text-subtle text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => onEdit(r)} className="btn-icon w-8 h-8 flex items-center justify-center" title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => onDelete(r)} className="w-8 h-8 flex items-center justify-center bg-transparent border border-[var(--border)] text-muted hover:border-tantra-red hover:text-tantra-red transition" title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpenBarTable({ signups, totalSignups, checkingIn, onToggleCheckIn, onDelete }: {
  signups: OpenBarSignup[]; totalSignups: number;
  checkingIn: Record<string, boolean>;
  onToggleCheckIn: (code: string, current: boolean) => void;
  onDelete: (s: OpenBarSignup) => void;
}) {
  return (
    <div className="bg-card tantra-border-strong overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-deep border-b border-tantra-red">
            <tr className="text-left">
              <th className="px-4 py-4 label">Guest</th>
              <th className="px-4 py-4 label">Email</th>
              <th className="px-4 py-4 label">Age</th>
              <th className="px-4 py-4 label">Event Night</th>
              <th className="px-4 py-4 label">Pass</th>
              <th className="px-4 py-4 label">Signed Up</th>
              <th className="px-4 py-4 label text-center">Status</th>
              <th className="px-4 py-4 label text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {signups.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted">
                {totalSignups === 0 ? "No Open Bar signups yet. Share /signup to start." : "No signups match these filters."}
              </td></tr>
            )}
            {signups.map((s) => {
              const age = calculateAgeYears(s.date_of_birth);
              const isLoading = checkingIn[s.ticket_code];
              return (
                <tr key={s.id} className={`border-t border-[var(--border)] hover:bg-surface transition ${s.checked_in ? "opacity-70" : ""}`}>
                  <td className="px-4 py-3.5"><div className="font-semibold text-default">{s.full_name}</div></td>
                  <td className="px-4 py-3.5"><div className="text-xs text-muted">{s.email}</div></td>
                  <td className="px-4 py-3.5"><div className="text-xs text-default font-bold">{age}</div></td>
                  <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                    {s.event_datetime ? <span className="text-default font-semibold">{formatEventDate(s.event_datetime)}</span> : <span className="text-subtle">—</span>}
                  </td>
                  <td className="px-4 py-3.5"><span className="font-mono text-default text-xs font-bold">{s.ticket_code}</span></td>
                  <td className="px-4 py-3.5 text-xs text-muted">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3.5 text-center">
                    <CheckInButton
                      checkedIn={s.checked_in}
                      loading={isLoading}
                      checkedInAt={s.checked_in_at}
                      onClick={() => onToggleCheckIn(s.ticket_code, s.checked_in)}
                    />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button onClick={() => onDelete(s)} className="w-8 h-8 flex items-center justify-center bg-transparent border border-[var(--border)] text-muted hover:border-tantra-red hover:text-tantra-red transition" title="Delete">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function calculateAgeYears(dob: string): number {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function CheckInButton({ checkedIn, loading, checkedInAt, onClick }: { checkedIn: boolean; loading: boolean; checkedInAt: string | null; onClick: () => void }) {
  if (checkedIn) {
    return (
      <button onClick={onClick} disabled={loading} className="inline-flex flex-col items-center gap-0.5 px-3 py-2 bg-green-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-green-700 transition disabled:opacity-50" title="Click to undo check-in">
        <span className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          IN
        </span>
        {checkedInAt && <span className="text-[9px] opacity-80">{new Date(checkedInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
      </button>
    );
  }
  return (
    <button onClick={onClick} disabled={loading} className="inline-flex items-center gap-1 px-3 py-2 bg-transparent border-2 border-[var(--border-strong)] text-muted text-xs font-bold uppercase tracking-wider hover:border-tantra-red hover:text-tantra-red transition disabled:opacity-50">
      {loading ? "..." : "CHECK IN"}
    </button>
  );
}

// ============ EDIT MODAL ============

function EditModal({ reservation, onClose, onSaved, password }: any) {
  const [fullName, setFullName] = useState(reservation.full_name);
  const [email, setEmail] = useState(reservation.email);
  const [phone, setPhone] = useState(reservation.phone);
  const [groupSize, setGroupSize] = useState(reservation.group_size);
  const [tableNumber, setTableNumber] = useState(reservation.table_number || "");
  const [notes, setNotes] = useState(reservation.notes || "");
  const [issuedBy, setIssuedBy] = useState(reservation.issued_by || "");
  const [eventDatetime, setEventDatetime] = useState(
    reservation.event_datetime ? toDatetimeLocal(new Date(reservation.event_datetime)) : ""
  );
  const [sendEmail, setSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (fullName.trim().length < 2) { setError("Invalid client name"); return; }
    if (!isValidEmail(email)) { setError("Invalid email"); return; }
    if (!isValidPhone(phone)) { setError("Invalid phone"); return; }
    if (groupSize < 1 || groupSize > 50) { setError("Party size must be 1-50"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({
          id: reservation.id,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: normalizePhone(phone),
          group_size: groupSize,
          table_number: tableNumber.trim() || null,
          notes: notes.trim() || null,
          issued_by: issuedBy.trim() || null,
          event_datetime: eventDatetime || null,
          send_email: sendEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      if (sendEmail && !data.email_sent) {
        alert(`Reservation updated, but email failed: ${data.email_error || "unknown error"}`);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-7 space-y-4">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <span className="accent-line"></span><span className="label">EDIT RESERVATION</span>
          </div>
          <h2 className="display-text text-2xl text-default mb-1">{reservation.full_name}</h2>
          <p className="text-xs text-muted font-mono">{reservation.tickets[0]?.ticket_code}</p>
        </div>
        <div><label className="label block mb-2">EVENT DATE & TIME</label>
          <input type="datetime-local" value={eventDatetime} onChange={(e) => setEventDatetime(e.target.value)} className="tantra-input w-full px-4 py-3" /></div>
        <div><label className="label block mb-2">CLIENT NAME</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="tantra-input w-full px-4 py-3" /></div>
        <div><label className="label block mb-2">EMAIL</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="tantra-input w-full px-4 py-3" /></div>
        <div><label className="label block mb-2">PHONE</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="tantra-input w-full px-4 py-3" /></div>
        <div>
          <label className="label block mb-2">PARTY SIZE</label>
          <div className="flex items-center gap-3 bg-deep tantra-border p-3">
            <button type="button" onClick={() => setGroupSize(Math.max(1, groupSize - 1))} className="w-10 h-10 bg-surface tantra-border text-default hover:border-tantra-red hover:text-tantra-red transition text-lg font-bold">−</button>
            <div className="flex-1 text-center">
              <div className="display-text text-3xl text-tantra-red leading-none">{groupSize}</div>
              <div className="label mt-1">{groupSize === 1 ? "GUEST" : "GUESTS"}</div>
            </div>
            <button type="button" onClick={() => setGroupSize(Math.min(50, groupSize + 1))} className="w-10 h-10 bg-surface tantra-border text-default hover:border-tantra-red hover:text-tantra-red transition text-lg font-bold">+</button>
          </div>
        </div>
        <div><label className="label block mb-2">TABLE</label>
          <input type="text" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} className="tantra-input w-full px-4 py-3" /></div>
        <div><label className="label block mb-2">NOTES</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="tantra-input w-full px-4 py-3" /></div>
        <div><label className="label block mb-2">ISSUED BY</label>
          <input type="text" value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} className="tantra-input w-full px-4 py-3" /></div>
        <label className="flex items-center gap-3 cursor-pointer bg-surface tantra-border p-3 hover:border-tantra-red transition">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="w-4 h-4 accent-tantra-red" />
          <div className="flex-1">
            <div className="text-sm font-bold text-default">Send updated ticket</div>
            <div className="text-xs text-muted">Re-sends the ticket email with the new details and PDF</div>
          </div>
        </label>
        {error && <div className="bg-tantra-red/10 border border-tantra-red text-red-600 dark:text-red-200 text-sm px-4 py-3">{error}</div>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-outline flex-1 py-3 text-xs" disabled={saving}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-red flex-1 py-3 text-xs">{saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteReservationModal({ reservation, onClose, onDeleted, password }: any) {
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setError("");
    if (!confirmPassword) { setError("Please re-enter your password to confirm"); return; }
    setDeleting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ id: reservation.id, confirm_password: confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      onDeleted();
    } catch (err: any) {
      setError(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-7 space-y-5">
        <div>
          <div className="flex items-center gap-3 mb-3"><span className="accent-line"></span><span className="label text-tantra-red">DELETE RESERVATION</span></div>
          <h2 className="display-text text-2xl text-default mb-2">Are you sure?</h2>
          <p className="text-sm text-muted">
            This will permanently delete the reservation and ticket for <span className="text-default font-bold">{reservation.full_name}</span>
            {reservation.event_datetime && <> on <span className="text-default font-bold">{formatEventDate(reservation.event_datetime)}</span></>}. This cannot be undone.
          </p>
        </div>
        <div className="bg-deep tantra-border p-4">
          <div className="label mb-2">RESERVATION DETAILS</div>
          <div className="text-sm text-default space-y-1">
            <div><span className="text-muted">Client:</span> {reservation.full_name}</div>
            <div><span className="text-muted">Party:</span> {reservation.group_size} {reservation.group_size === 1 ? "guest" : "guests"}</div>
            {reservation.table_number && <div><span className="text-muted">Table:</span> {reservation.table_number}</div>}
            <div><span className="text-muted">Ticket:</span> <span className="font-mono">{reservation.tickets[0]?.ticket_code}</span></div>
          </div>
        </div>
        <div>
          <label className="label block mb-2 text-tantra-red">RE-ENTER YOUR PASSWORD TO CONFIRM</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="tantra-input w-full px-4 py-3" placeholder="Password" autoFocus />
        </div>
        {error && <div className="bg-tantra-red/10 border border-tantra-red text-red-600 dark:text-red-200 text-sm px-4 py-3">{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-outline flex-1 py-3 text-xs" disabled={deleting}>Cancel</button>
          <button onClick={handleDelete} disabled={deleting || !confirmPassword} className="flex-1 py-3 text-xs bg-tantra-red text-white font-bold uppercase tracking-widest border border-tantra-red hover:bg-red-700 transition disabled:opacity-50">
            {deleting ? "Deleting..." : "Delete Forever"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteOpenBarModal({ signup, onClose, onDeleted, password }: any) {
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setError("");
    if (!confirmPassword) { setError("Please re-enter your password to confirm"); return; }
    setDeleting(true);
    try {
      const res = await fetch("/api/open-bar-list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "x-admin-password": password },
        body: JSON.stringify({ id: signup.id, confirm_password: confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      onDeleted();
    } catch (err: any) {
      setError(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-7 space-y-5">
        <div>
          <div className="flex items-center gap-3 mb-3"><span className="accent-line"></span><span className="label text-tantra-red">DELETE OPEN BAR SIGNUP</span></div>
          <h2 className="display-text text-2xl text-default mb-2">Are you sure?</h2>
          <p className="text-sm text-muted">
            This will permanently delete <span className="text-default font-bold">{signup.full_name}'s</span> Open Bar Pass. They'll need to sign up again to get a new one.
          </p>
        </div>
        <div className="bg-deep tantra-border p-4">
          <div className="label mb-2">SIGNUP DETAILS</div>
          <div className="text-sm text-default space-y-1">
            <div><span className="text-muted">Name:</span> {signup.full_name}</div>
            <div><span className="text-muted">Email:</span> {signup.email}</div>
            <div><span className="text-muted">Pass:</span> <span className="font-mono">{signup.ticket_code}</span></div>
          </div>
        </div>
        <div>
          <label className="label block mb-2 text-tantra-red">RE-ENTER YOUR PASSWORD TO CONFIRM</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="tantra-input w-full px-4 py-3" placeholder="Password" autoFocus />
        </div>
        {error && <div className="bg-tantra-red/10 border border-tantra-red text-red-600 dark:text-red-200 text-sm px-4 py-3">{error}</div>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-outline flex-1 py-3 text-xs" disabled={deleting}>Cancel</button>
          <button onClick={handleDelete} disabled={deleting || !confirmPassword} className="flex-1 py-3 text-xs bg-tantra-red text-white font-bold uppercase tracking-widest border border-tantra-red hover:bg-red-700 transition disabled:opacity-50">
            {deleting ? "Deleting..." : "Delete Forever"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-card tantra-border-strong max-w-lg w-full my-8 z-10" onClick={(e) => e.stopPropagation()}>
        <div className="h-1 bg-tantra-red w-full" />
        <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-muted hover:text-tantra-red transition" aria-label="Close">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}

function IssueTab(props: any) {
  const { issueSuccess, setIssueSuccess, fullName, setFullName, email, setEmail, phone, setPhone, groupSize, setGroupSize, tableNumber, setTableNumber, notes, setNotes, issuedBy, setIssuedBy, eventDatetime, setEventDatetime, issueError, issueLoading, onSubmit } = props;

  return (
    <div className="max-w-xl">
      {issueSuccess ? (
        <div className="bg-card tantra-border-strong p-7 sm:p-9">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-tantra-red/20 mb-5 mx-auto border-2 border-tantra-red animate-pulse-red">
            <svg className="w-8 h-8 text-tantra-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center mb-2">
            <span className="accent-line"></span><span className="label mx-3">CONFIRMED</span><span className="accent-line"></span>
          </div>
          <h2 className="display-text text-3xl text-default text-center mb-1">Reservation Issued</h2>
          <p className="text-sm text-muted text-center mb-6">
            <span className="text-default font-semibold">{issueSuccess.clientName}</span>
            <span className="mx-2 text-tantra-red">·</span>
            {issueSuccess.guestCount} {issueSuccess.guestCount === 1 ? "guest" : "guests"}
            {issueSuccess.tableNumber && <><span className="mx-2 text-tantra-red">·</span>Table {issueSuccess.tableNumber}</>}
          </p>

          <div className="bg-deep border border-tantra-red p-6 mb-5 text-center relative">
            <div className="absolute top-0 left-0 w-2 h-2 bg-tantra-red"></div>
            <div className="absolute top-0 right-0 w-2 h-2 bg-tantra-red"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 bg-tantra-red"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-tantra-red"></div>
            {issueSuccess.eventDatetime && (
              <div className="mb-4 pb-4 border-b border-[var(--border)]">
                <div className="label mb-2">EVENT DATE</div>
                <div className="display-text text-default text-lg">{formatEventDate(issueSuccess.eventDatetime)}</div>
              </div>
            )}
            <div className="label mb-3">TICKET NUMBER</div>
            <div className="font-mono text-default text-3xl font-black tracking-wider">{issueSuccess.ticketCode}</div>
            {issueSuccess.tableNumber && (
              <div className="mt-5 pt-5 border-t border-[var(--border)]">
                <div className="label mb-2">TABLE</div>
                <div className="display-text text-tantra-red text-2xl">{issueSuccess.tableNumber.toUpperCase()}</div>
              </div>
            )}
            {issueSuccess.notes && (
              <div className="mt-5 pt-5 border-t border-[var(--border)]">
                <div className="label mb-2">NOTES</div>
                <div className="text-sm text-muted italic">{issueSuccess.notes}</div>
              </div>
            )}
          </div>

          {issueSuccess.emailSent ? (
            <div className="bg-green-500/10 border border-green-500/40 text-green-600 dark:text-green-200 text-sm px-4 py-3 mb-5 flex items-start gap-2">
              <span className="font-bold">✓</span><span>Email sent to <strong>{issueSuccess.email}</strong></span>
            </div>
          ) : (
            <div className="bg-tantra-red/10 border border-tantra-red text-red-600 dark:text-red-200 text-sm px-4 py-3 mb-5">
              ⚠ Saved but email failed: {issueSuccess.emailError}
            </div>
          )}

          <button onClick={() => setIssueSuccess(null)} className="btn-red w-full py-4 text-sm">New Reservation</button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="bg-card tantra-border-strong p-7 sm:p-9 space-y-5">
          <div className="mb-1">
            <div className="flex items-center gap-3 mb-3"><span className="accent-line"></span><span className="label">NEW ENTRY</span></div>
            <h2 className="display-text text-3xl text-default mb-2">Add Guest</h2>
            <p className="text-sm text-muted">Enter client details — they receive one ticket by email.</p>
          </div>
          <div><label className="label block mb-2">EVENT DATE & TIME</label>
            <input type="datetime-local" value={eventDatetime} onChange={(e) => setEventDatetime(e.target.value)} className="tantra-input w-full px-4 py-3.5" /></div>
          <div><label className="label block mb-2">CLIENT NAME</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="tantra-input w-full px-4 py-3.5" placeholder="Full name" /></div>
          <div><label className="label block mb-2">EMAIL</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="tantra-input w-full px-4 py-3.5" placeholder="client@example.com" /></div>
          <div><label className="label block mb-2">PHONE</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="tantra-input w-full px-4 py-3.5" placeholder="+297 123 4567" /></div>
          <div>
            <label className="label block mb-3">PARTY SIZE</label>
            <div className="flex items-center gap-4 bg-deep tantra-border p-4">
              <button type="button" onClick={() => setGroupSize(Math.max(1, groupSize - 1))} className="w-12 h-12 bg-surface tantra-border text-default hover:border-tantra-red hover:text-tantra-red transition text-xl font-bold">−</button>
              <div className="flex-1 text-center">
                <div className="display-text text-5xl text-tantra-red leading-none">{groupSize}</div>
                <div className="label mt-2">{groupSize === 1 ? "GUEST" : "GUESTS"}</div>
              </div>
              <button type="button" onClick={() => setGroupSize(Math.min(50, groupSize + 1))} className="w-12 h-12 bg-surface tantra-border text-default hover:border-tantra-red hover:text-tantra-red transition text-xl font-bold">+</button>
            </div>
          </div>
          <div><label className="label block mb-2">TABLE <span className="normal-case tracking-normal text-subtle">(optional)</span></label>
            <input type="text" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} className="tantra-input w-full px-4 py-3.5" placeholder="e.g. 12, VIP-3, Booth A" /></div>
          <div><label className="label block mb-2">NOTES <span className="normal-case tracking-normal text-subtle">(birthdays, special requests)</span></label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="tantra-input w-full px-4 py-3.5" placeholder="e.g. Birthday celebration, bottle service" /></div>
          <div><label className="label block mb-2">ISSUED BY <span className="normal-case tracking-normal text-subtle">(optional)</span></label>
            <input type="text" value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} className="tantra-input w-full px-4 py-3.5" placeholder="Hostess name" /></div>
          {issueError && <div className="bg-tantra-red/10 border border-tantra-red text-red-600 dark:text-red-200 text-sm px-4 py-3">{issueError}</div>}
          <button type="submit" disabled={issueLoading} className="btn-red w-full py-4 text-sm">{issueLoading ? "Sending..." : "Issue Ticket & Send Email"}</button>
        </form>
      )}
    </div>
  );
}
