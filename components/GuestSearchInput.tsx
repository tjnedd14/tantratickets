"use client";

import { useState, useRef, useEffect, useMemo } from "react";

type RegistrationLite = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  group_size?: number;
  event_datetime: string | null;
  created_at?: string;
};

type GuestProfile = {
  full_name: string;
  email: string;
  phone: string;
  visit_count: number;
  last_visit: string | null;
  // For displaying "preferred party size"
  most_common_group_size?: number;
};

type Props = {
  /** All known registrations (from admin's loaded registrations list) */
  registrations: RegistrationLite[];
  /** Current value in the field */
  value: string;
  /** Called when value changes (typing) */
  onChange: (v: string) => void;
  /** Called when a guest is picked — should autofill other fields */
  onSelectGuest: (guest: GuestProfile) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Aggregates registrations into unique guest profiles, then provides
 * an autocomplete dropdown matching by name / email / phone.
 *
 * Match priority:
 *   1. exact prefix on name
 *   2. partial name match
 *   3. partial email match
 *   4. partial phone match
 *
 * Ranking within results: most recent visit first, then visit count.
 */
export default function GuestSearchInput({
  registrations,
  value,
  onChange,
  onSelectGuest,
  placeholder = "Full name",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Build unique guest profiles from registrations
  const guestProfiles = useMemo<GuestProfile[]>(() => {
    const byKey = new Map<string, GuestProfile & { _groupSizes: number[] }>();
    for (const r of registrations) {
      // Dedupe key: prefer email, fall back to phone, then lowercased name
      const key = (r.email || r.phone || r.full_name || "").toLowerCase().trim();
      if (!key) continue;
      const existing = byKey.get(key);
      if (existing) {
        existing.visit_count++;
        if (r.event_datetime && (!existing.last_visit || r.event_datetime > existing.last_visit)) {
          existing.last_visit = r.event_datetime;
        }
        if (r.group_size) existing._groupSizes.push(r.group_size);
      } else {
        byKey.set(key, {
          full_name: r.full_name,
          email: r.email,
          phone: r.phone,
          visit_count: 1,
          last_visit: r.event_datetime,
          _groupSizes: r.group_size ? [r.group_size] : [],
        });
      }
    }
    // Compute most-common group size for each profile
    const profiles: GuestProfile[] = [];
    for (const p of byKey.values()) {
      const counts: Record<number, number> = {};
      for (const g of p._groupSizes) counts[g] = (counts[g] || 0) + 1;
      let bestSize: number | undefined;
      let bestCount = 0;
      for (const [size, c] of Object.entries(counts)) {
        if (c > bestCount) {
          bestCount = c;
          bestSize = Number(size);
        }
      }
      profiles.push({
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        visit_count: p.visit_count,
        last_visit: p.last_visit,
        most_common_group_size: bestSize,
      });
    }
    return profiles;
  }, [registrations]);

  // Filter & rank based on current input
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 2) return [];
    const scored: { profile: GuestProfile; score: number }[] = [];
    for (const p of guestProfiles) {
      const name = (p.full_name || "").toLowerCase();
      const email = (p.email || "").toLowerCase();
      const phone = (p.phone || "").toLowerCase();
      let score = 0;
      if (name.startsWith(q)) score = 100;
      else if (name.includes(q)) score = 60;
      else if (email.includes(q)) score = 40;
      else if (phone.includes(q)) score = 30;
      if (score === 0) continue;
      // Boost by visit count and recency
      score += Math.min(p.visit_count, 10);
      if (p.last_visit) {
        const daysAgo = (Date.now() - new Date(p.last_visit).getTime()) / 86400000;
        if (daysAgo < 30) score += 5;
        else if (daysAgo < 90) score += 2;
      }
      scored.push({ profile: p, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 8).map((s) => s.profile);
  }, [value, guestProfiles]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[highlightIdx]) {
      e.preventDefault();
      pickGuest(filtered[highlightIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function pickGuest(g: GuestProfile) {
    onSelectGuest(g);
    setOpen(false);
  }

  function formatLastVisit(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const daysAgo = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (daysAgo === 0) return "today";
    if (daysAgo === 1) return "yesterday";
    if (daysAgo < 7) return `${daysAgo}d ago`;
    if (daysAgo < 30) return `${Math.floor(daysAgo / 7)}w ago`;
    if (daysAgo < 365) return d.toLocaleDateString([], { month: "short", day: "numeric" });
    return d.toLocaleDateString([], { month: "short", year: "numeric" });
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlightIdx(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />

      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-card tantra-border-strong shadow-2xl max-h-72 overflow-y-auto">
          <div className="px-3 py-2 border-b border-[var(--border)] bg-deep">
            <span className="label text-xs">{filtered.length} REPEAT GUEST{filtered.length === 1 ? "" : "S"}</span>
          </div>
          {filtered.map((g, idx) => (
            <button
              type="button"
              key={`${g.email}|${g.phone}|${idx}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pickGuest(g);
              }}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`w-full text-left px-3 py-2.5 border-b border-[var(--border)] last:border-b-0 transition ${
                idx === highlightIdx ? "bg-tantra-red/10" : "hover:bg-surface"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-default truncate">{g.full_name}</div>
                  <div className="text-xs text-muted truncate">
                    {g.email}
                    {g.phone && <span className="ml-2 text-subtle">{g.phone}</span>}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-xs font-bold text-tantra-red">
                    {g.visit_count} {g.visit_count === 1 ? "visit" : "visits"}
                  </div>
                  {g.last_visit && (
                    <div className="text-[10px] text-subtle">last: {formatLastVisit(g.last_visit)}</div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
