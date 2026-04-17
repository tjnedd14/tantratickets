# Tantra Ticket System

QR-based guest registration and digital ticketing for Tantra. Guests scan a QR at the door, fill in their details, receive individual PDF tickets (with QR codes), and you get a manager dashboard with CSV export.

## Flow

1. Guest scans QR at door → opens `/register`
2. Enters full name + phone
3. Picks group size (1–5)
4. If group > 1, enters each guest's name
5. App saves to Supabase and generates one PDF page per person (each with a unique QR + ticket code)
6. Guest shows PDF to hostess; hostess can check off names against the admin dashboard
7. Manager downloads CSV anytime at `/admin`

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → paste and run `supabase/schema.sql`
3. Go to Project Settings → API, copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key (keep private)

### 2. Local install

```powershell
cd tantra-tickets
npm install
```

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PASSWORD=pick-a-strong-password
NEXT_PUBLIC_EVENT_NAME=Tantra
NEXT_PUBLIC_VENUE_NAME=Tantra Aruba
```

### 4. Run locally

```powershell
npm run dev
```

Open http://localhost:3000 → redirects to `/register`.
Admin dashboard at http://localhost:3000/admin.

### 5. Deploy to Vercel

```powershell
npm install -g vercel
vercel
```

Add all env vars in the Vercel dashboard under Settings → Environment Variables.

### 6. Generate the door QR code

Once deployed (e.g., `https://tickets.tantra-aruba.com`), make a QR that points to:

```
https://tickets.tantra-aruba.com/register
```

Use any QR generator (qr-code-generator.com, or Dushify's own generator). Print it large, laminate it, stick it at the door.

## URLs

| Route                    | Purpose                              |
| ------------------------ | ------------------------------------ |
| `/register`              | Public guest registration (QR link)  |
| `/admin`                 | Manager dashboard (password-gated)   |
| `/api/register`          | POST — creates registration + tickets|
| `/api/admin/export`      | GET — JSON list or CSV download      |

## Ticket codes

Each ticket gets a unique code like `TNT-AB12CD` — easy to read aloud, easy to search. The QR payload is the same code, so if you later build a scanner (phone web app that reads QR and toggles `checked_in`), it just looks up the code in Supabase.

## Security notes

- Registration route uses the **service role key** server-side, which bypasses RLS. RLS policies in the schema are a safety net in case you ever switch to anon inserts.
- Admin password is compared server-side against `ADMIN_PASSWORD`. For something stronger later, swap for Supabase Auth + an `admins` table.
- Phone numbers are stored normalized (digits + leading `+` only) for easier deduplication and search.

## Next steps (ideas)

- **Check-in scanner**: tiny page at `/scan` that uses the device camera (via `react-qr-reader`) to scan QR → PATCH `/api/checkin` → updates `tickets.checked_in = true`.
- **SMS confirmation** via Twilio (you already have this plumbing on Dushify) — send the guest a link to their tickets page so they don't even need to download the PDF.
- **Per-event support**: add an `events` table if you want to run multiple nights (NYE, Carnival, etc.) with separate QR codes.
- **Cap total guests per night**: add a count check in `/api/register` against `registrations` filtered by today's date.

## File map

```
tantra-tickets/
├── app/
│   ├── layout.tsx              # Root layout, fonts
│   ├── globals.css             # Tailwind + Tantra theme
│   ├── page.tsx                # Redirects to /register
│   ├── register/page.tsx       # Guest registration UI (3 steps)
│   ├── admin/page.tsx          # Manager dashboard
│   └── api/
│       ├── register/route.ts   # Saves registration + tickets to Supabase
│       └── admin/export/route.ts # CSV + JSON export (password-gated)
├── components/
│   └── TicketPDF.tsx           # Client-side PDF generator w/ QR codes
├── lib/
│   ├── supabase.ts             # Client + admin Supabase clients
│   └── utils.ts                # Ticket code generator, phone validation
├── supabase/
│   └── schema.sql              # DDL — run this once in Supabase
├── .env.example
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
└── tsconfig.json
```
