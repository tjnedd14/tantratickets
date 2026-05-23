# Tantra Tickets — May 2026 audit & fixes

This is a record of every change made during the deep audit. Read top-to-bottom.

## TL;DR — what to do after pulling this

1. **Run `supabase/migration_2026_fixes.sql` in Supabase SQL Editor.** It's idempotent. This widens `group_size` to 100 and ensures `is_vip` exists on both tables.
2. **Read the bottom of that migration file.** It contains the recovery SQL for the clustered May 23 reservations. Uncomment + adjust + run in transactions.
3. **Deploy as usual** (`git push` → Vercel auto-deploys). No new env vars required.
4. **For any stragglers** not caught by SQL, use the new **"⇆ MOVE TO ANOTHER DATE"** button in the Reservations tab. Filter to the wrong-date cluster, hit the button, pick the correct night, confirm.

---

## Bug #1 — VIPs "disappear" when a new VIP is added (FIXED)

### Root cause
`app/api/admin/export/route.ts` was selecting every reservation column EXCEPT `is_vip`. Whenever the dashboard called `refreshList()` (which happens automatically after issuing a new ticket, editing, deleting, etc.), every reservation came back with `is_vip` undefined, and the gold star UI flipped off. The data was never lost — Supabase still had it — but it looked deleted.

### Fix
- Added `is_vip` to the SELECT in `app/api/admin/export/route.ts`.
- Added a `VIP` column to the CSV export header & rows so it's also visible there.

The optimistic update in `toggleVip` (admin/page.tsx) was already correct (`prev.map`), so no client changes needed.

---

## Bug #2 — Reservations cluster on whatever day they were entered (FIXED)

### Root cause
`getDefaultEventDatetime()` in `lib/utils.ts` defaulted the admin issue-ticket form's date picker to **today at 9pm**. A hostess takes a reservation for next Saturday on Tuesday, doesn't touch the date field, submits — the row gets tagged `Tuesday 9pm`. Repeat for fifty bookings → fifty bookings all stacked on Tuesday.

### Fix
- Rewrote `getDefaultEventDatetime()` to return the **next Friday or Saturday at 9pm Aruba** (same algorithm the Open Bar form already used). If today is already Fri/Sat before 9pm, returns today. Otherwise skips ahead.
- Bonus: the new logic is timezone-correct via `Intl` with `timeZone: "America/Aruba"`, so it gives the right answer even if a hostess is on a laptop set to a different TZ.

### Recovery of already-clustered data
The data isn't lost — `created_at` is reliable. Two paths:

**Path A — SQL (faster, bulk).** Open `supabase/migration_2026_fixes.sql`, scroll to "RECOVERY: redistribute clustered reservations from May 23", uncomment the inspection queries first, then adjust the UPDATE statements based on which `created_at` weeks correspond to which event nights. Run each in a transaction (`begin; ... commit;`) and verify row counts before committing.

**Path B — In-app (safer, no SQL needed).** Use the new **"⇆ MOVE TO ANOTHER DATE"** button in the Reservations tab. Set the date filter to the wrong day (e.g. May 23), click the button, pick the actual event night, confirm with your password. Done.

---

## Bug #3 — Guest cap was 50, should be 100 (FIXED)

Updated everywhere:
- `app/admin/page.tsx`: form validation (2 places), the `+` step buttons (2 places), error messages.
- `app/api/issue-tickets/route.ts`: validation + error message.
- `app/api/reservations/route.ts` (PATCH/edit): validation + error message.
- `supabase/migration_2026_fixes.sql`: `check (group_size between 1 and 100)`.

The PATCH route's validation was already `>100` numerically but its error string said "1 and 50". That's now consistent.

---

## Bug #4 — Timezone bugs causing intermittent "glitches" (FIXED)

These were the source of the smaller weird-data issues you've been seeing.

### Root causes
1. **`getNextOpenBarDatetime()` used `d.setHours(21, 0, 0, 0)` then `.toISOString()`.** On a Vercel server (UTC), `setHours(21)` means 21:00 UTC = **5pm Aruba**. Open Bar signups were storing event_datetime as 5pm Aruba, not 9pm.
2. **`new Date(iso).toISOString().slice(0, 10)`** was used in multiple places to derive a date key. This converts to UTC, so a reservation stored as `2026-05-23T21:00-04:00` (Sat 9pm Aruba) became `2026-05-24T01:00Z` UTC → date key `2026-05-24`. The reservation was correctly stored for Saturday but date filters and table-conflict checks read it as Sunday.
3. **`new Date('2026-05-23T00:00:00')`** (no offset) was used to build day-range queries. On a UTC server this is `2026-05-23T00:00Z`. Reservations stored as Aruba 9–11pm landed in the next UTC day and were excluded from reminder lists.
4. **`setHours(0,0,0,0)`** for the "today" duplicate-send check on a UTC server treats "today" as UTC midnight, so reminders sent 8pm–midnight Aruba were classified as yesterday.

### Fix
Rewrote `lib/utils.ts` with a single Aruba-aware module. Key new exports:

- `nowInAruba()` — current moment as Aruba wall-clock parts (year/month/day/weekday/hour/min) regardless of host TZ.
- `arubaPartsFromDate(d)` — same for any Date.
- `isoToArubaDateKey(iso)` — converts any timestamptz to a `YYYY-MM-DD` key in Aruba calendar terms.
- `arubaDayBoundsISO(key)` — given a YYYY-MM-DD key, returns `{ startISO, endISO }` half-open bounds in proper `-04:00` form. Use these in Supabase `.gte()` / `.lt()` queries instead of building Date ranges with `setHours`.
- `getTodayKey()`, `getTomorrowKey()`, `getTonightKey()` — all Aruba-correct.
- `localToArubaIso(local)` — datetime-local input string → `YYYY-MM-DDTHH:MM:SS-04:00`.
- `arubaIsoToLocal(iso)` — inverse, for populating datetime-local inputs from stored timestamptz values.
- `formatEventDate`, `formatEventDateCompact`, `formatEventTime` — all now use `timeZone: "America/Aruba"`.

Routes updated to use the new helpers:
- `app/admin/page.tsx` — date filter, edit modal init, IssueTab same-day table-conflict detection.
- `app/api/send-reminders/preview/route.ts` — day-bounded queries.
- `app/api/send-reminders/route.ts` — duplicate-send check + log date.
- `app/api/auto-pass-blast/route.ts` — log date.
- `app/api/issue-open-bar-pass/route.ts` — per-day duplicate-email check.
- `app/api/whatsapp/reminder/route.ts` (cron) — "today's events" query.

In `admin/page.tsx` the local helpers (`nextFriOrSat`, `thisFriday`, etc.) were rewritten to return Aruba date-key strings (`nextFriOrSatKey`, `thisFridayKey`, …) instead of host-local `Date` objects. `formatDtAt9pm(d)` → `keyAt9pm(key)`. `isFriOrSat` and `getDayName` now anchor to `T12:00:00-04:00` so they never cross a day boundary in a foreign TZ.

---

## New feature — "Move to another date" bulk action

- **New API route:** `POST /api/reassign-event-date`
  - Body: `{ ids: string[], new_event_datetime: ISO, confirm_password: string }`
  - Requires admin auth header + password re-confirmation.
  - Caps at 500 IDs per call.
- **New modal:** `ReassignDateModal` in `app/admin/page.tsx`. Opens from the new blue "⇆ MOVE TO ANOTHER DATE" button next to "RESET CHECK-INS" in the Reservations tab toolbar. Pre-selects every reservation in the current filter, lets you uncheck individuals, pick the target date (with quick-pick buttons for this Fri / this Sat / next Fri / next Sat), confirm with password, and ship.

Tickets, guest names, table assignments, check-in status all stay as they are. Only `registrations.event_datetime` is updated.

---

## Dead code removed

- **`app/api/register/route.ts`** — never called. The public root redirected straight to `/admin`, so this route had no client. Gone.
- **`supabase/schema.sql`** — the v1 schema with `group_size between 1 and 5`. Outdated and misleading. Use `schema_v2.sql` + the migrations.
- **Commented WhatsApp block** in `app/api/open-bar-signup/route.ts` — moved the comment to a single sentence noting that the WhatsApp blast lives in `/api/whatsapp/broadcast` once the Meta-approved template is ready. The `wa_opt_in` field is still captured for future use.

---

## Other small things

- **Root redirect:** `/` now goes to `/signup` (the public Open Bar form) instead of `/admin` (which requires a password). Staff bookmark `/admin` and `/door` directly.
- **Door scanner page (`app/door/page.tsx`):** no changes. It uses `formatEventDate` which is now Aruba-correct, so it shows event times correctly for free.
- **Floor plan picker components:** no changes needed. They were already correct.

---

## Files changed

```
modified:   app/admin/page.tsx
modified:   app/api/admin/export/route.ts
modified:   app/api/auto-pass-blast/route.ts
modified:   app/api/issue-open-bar-pass/route.ts
modified:   app/api/issue-tickets/route.ts
modified:   app/api/open-bar-signup/route.ts
modified:   app/api/reservations/route.ts
modified:   app/api/send-reminders/route.ts
modified:   app/api/send-reminders/preview/route.ts
modified:   app/api/whatsapp/reminder/route.ts
modified:   app/page.tsx
modified:   lib/utils.ts

new file:   app/api/reassign-event-date/route.ts
new file:   supabase/migration_2026_fixes.sql
new file:   CHANGES.md

deleted:    app/api/register/route.ts
deleted:    supabase/schema.sql
```

## Verification

Built clean: `npx next build` → "✓ Compiled successfully" with 26 routes, zero TypeScript errors. Type-check standalone (`npx tsc --noEmit`) also clean.
