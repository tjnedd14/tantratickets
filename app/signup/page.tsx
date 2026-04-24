"use client";

import { useState } from "react";
import { useTheme } from "@/lib/theme";
import { isValidEmail, isValidPhone, calculateAge, formatEventDate } from "@/lib/utils";

const LOGO_WHITE = "https://i.imgur.com/xAQenGt.png";

export default function SignupPage() {
  const { theme, toggle: toggleTheme, mounted: themeMounted } = useTheme();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+297 ");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [dob, setDob] = useState("");
  const [location, setLocation] = useState("");
  const [waOptIn, setWaOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    ticketCode: string;
    eventDatetime: string | null;
    emailSent: boolean;
    email: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (fullName.trim().length < 2) {
      setError("Please enter your full name");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Please enter a valid phone number");
      return;
    }
    if (!gender) {
      setError("Please select your gender");
      return;
    }
    if (!dob) {
      setError("Please enter your date of birth");
      return;
    }

    const age = calculateAge(dob);
    if (age < 18) {
      setError("You must be 18 or older to sign up for the Open Bar Pass.");
      return;
    }

    if (location.trim().length < 2) {
      setError("Please enter where you're from");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/open-bar-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          gender,
          wa_opt_in: waOptIn,
          date_of_birth: dob,
          location: location.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setSuccess({
        ticketCode: data.ticket_code,
        eventDatetime: data.event_datetime,
        emailSent: data.email_sent,
        email: email.trim().toLowerCase(),
      });
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  const logoUrl = LOGO_WHITE;
  const logoFilter = theme === "dark" ? "none" : "invert(1)";

  const ThemeToggle = () => (
    <button onClick={toggleTheme} aria-label="Toggle theme" className="btn-icon w-10 h-10">
      {!themeMounted ? null : theme === "dark" ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10l1.4 1.4M3 12h2m14 0h2M5.6 18.4l1.4-1.4m10-10l1.4-1.4" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );

  // SUCCESS SCREEN
  if (success) {
    return (
      <div className="min-h-screen bg-deep text-default grain">
        <div className="max-w-md mx-auto px-6 py-12">
          <div className="flex justify-end mb-6">
            <ThemeToggle />
          </div>
          <div className="bg-card tantra-border-strong p-8 md:p-10 text-center">
            <img src={logoUrl} alt="Tantra" className="h-32 w-auto mx-auto mb-8 object-contain" style={{ filter: logoFilter }} />
            <div className="accent-line mx-auto mb-4" />
            <p className="label mb-2">YOU'RE ON THE LIST</p>
            <h1 className="display-text text-3xl md:text-4xl mb-6">OPEN BAR PASS</h1>

            <div className="bg-deep tantra-border p-6 mb-6">
              <div className="label mb-2">YOUR PASS NUMBER</div>
              <div className="font-mono text-2xl md:text-3xl font-bold tracking-widest">{success.ticketCode}</div>
            </div>

            {success.eventDatetime && (
              <div className="mb-6">
                <div className="label mb-1">VALID</div>
                <div className="text-lg font-bold text-tantra-red">{formatEventDate(success.eventDatetime)}</div>
                <div className="text-sm text-tantra-red font-bold mt-1">9:00 PM — 11:00 PM</div>
              </div>
            )}

            {success.emailSent ? (
              <p className="text-sm text-muted mb-4">
                Your pass has been sent to <span className="text-default font-semibold">{success.email}</span>. Check spam if you don't see it.
              </p>
            ) : (
              <p className="text-sm text-yellow-500 mb-4">
                Pass saved but email didn't go through. Screenshot your pass number above and show it at the door.
              </p>
            )}

            {waOptIn && (
              <p className="text-sm text-muted mb-4">
                📱 You'll also get a WhatsApp reminder before the event.
              </p>
            )}

            <div className="pt-4 border-t border-[var(--border)] text-xs text-muted tracking-wider">
              18+ · VALID ID REQUIRED · TANTRA ARUBA
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN FORM
  return (
    <div className="min-h-screen bg-deep text-default grain">
      <div className="max-w-md mx-auto px-6 py-5 md:py-12">
        <div className="flex justify-end mb-2">
          <ThemeToggle />
        </div>

        <div className="text-center mb-6">
          <img src={logoUrl} alt="Tantra" className="h-16 md:h-28 w-auto mx-auto mb-3 object-contain" style={{ filter: logoFilter }} />
          <div className="accent-line mx-auto mb-3" />
          <p className="label mb-1">COMPLIMENTARY</p>
          <h1 className="display-text text-4xl md:text-5xl mb-3">OPEN BAR PASS</h1>
          <p className="text-muted text-sm">
            Friday &amp; Saturday · <span className="text-tantra-red font-bold">9:00–11:00 PM</span>
          </p>
        </div>

        <div className="bg-card tantra-border-strong p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label block mb-2">FULL NAME</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="tantra-input w-full px-4 py-3"
                required
                autoComplete="name"
              />
            </div>

            <div>
              <label className="label block mb-2">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="tantra-input w-full px-4 py-3"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label block mb-2">PHONE NUMBER</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+297 123 4567"
                className="tantra-input w-full px-4 py-3"
                required
                autoComplete="tel"
              />
            </div>

            <div>
              <label className="label block mb-2">GENDER</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGender("male")}
                  className={`py-3 text-sm font-bold tracking-widest border transition-all ${
                    gender === "male"
                      ? "bg-tantra-red border-tantra-red text-white"
                      : "bg-transparent border-[var(--border)] text-muted hover:border-[var(--border-strong)]"
                  }`}
                >
                  MALE
                </button>
                <button
                  type="button"
                  onClick={() => setGender("female")}
                  className={`py-3 text-sm font-bold tracking-widest border transition-all ${
                    gender === "female"
                      ? "bg-tantra-red border-tantra-red text-white"
                      : "bg-transparent border-[var(--border)] text-muted hover:border-[var(--border-strong)]"
                  }`}
                >
                  FEMALE
                </button>
              </div>
            </div>

            <div>
              <label className="label block mb-2">DATE OF BIRTH</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                className="tantra-input w-full px-4 py-3"
                required
              />
              <p className="text-xs text-muted mt-1">Must be 18+ to receive the pass.</p>
            </div>

            <div>
              <label className="label block mb-2">WHERE ARE YOU FROM?</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Oranjestad, Aruba · New York, USA"
                className="tantra-input w-full px-4 py-3"
                required
                autoComplete="address-level2"
              />
              <p className="text-xs text-muted mt-1">City, Country</p>
            </div>

            {/* WhatsApp opt-in */}
            <label className="flex items-start gap-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={waOptIn}
                onChange={(e) => setWaOptIn(e.target.checked)}
                className="mt-1 w-5 h-5 accent-tantra-red cursor-pointer flex-shrink-0"
              />
              <span className="text-sm text-muted">
                <span className="text-default font-semibold">📱 Send me WhatsApp updates</span> about Tantra events and exclusive invites. (Optional)
              </span>
            </label>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-red w-full py-4 text-sm">
              {loading ? "SENDING YOUR PASS…" : "CLAIM MY OPEN BAR PASS"}
            </button>

            <p className="text-center text-xs text-muted pt-2">
              18+ only · Valid ID required at door
            </p>
          </form>
        </div>

        <p className="text-center text-xs text-muted mt-6 tracking-wider">
          TANTRA ARUBA · PALM BEACH
        </p>
      </div>
    </div>
  );
}
