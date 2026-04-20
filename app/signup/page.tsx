"use client";

import { useState } from "react";
import { useTheme } from "@/lib/theme";
import { isValidEmail, calculateAge, formatEventDate } from "@/lib/utils";

const LOGO_WHITE = "https://i.imgur.com/xAQenGt.png";

export default function SignupPage() {
  const { theme, toggle: toggleTheme, mounted: themeMounted } = useTheme();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
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
    if (!dob) {
      setError("Please enter your date of birth");
      return;
    }

    const age = calculateAge(dob);
    if (age < 18) {
      setError("You must be 18 or older to sign up for the Open Bar Pass.");
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
          date_of_birth: dob,
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

  return (
    <main className="min-h-screen grain relative bg-app">
      <div className="h-1 bg-tantra-red w-full" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-tantra-red opacity-[0.06] blur-[140px] rounded-full" />
      </div>

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 px-4 py-8 sm:py-16">
        <div className="max-w-md mx-auto">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={logoUrl} alt="Tantra" className="h-20 w-auto object-contain" style={{ filter: logoFilter }} />
          </div>

          {success ? (
            // ========== Success state ==========
            <div className="bg-card tantra-border-strong p-8">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-tantra-red/20 mb-5 mx-auto border-2 border-tantra-red animate-pulse-red">
                <svg className="w-8 h-8 text-tantra-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="text-center mb-2">
                <span className="accent-line"></span>
                <span className="label mx-3">YOU'RE IN</span>
                <span className="accent-line"></span>
              </div>
              <h1 className="display-text text-3xl text-default text-center mb-2">Open Bar Pass</h1>
              <p className="text-sm text-muted text-center mb-6">Your free pass is confirmed</p>

              <div className="bg-deep border border-tantra-red p-6 mb-5 text-center relative">
                <div className="absolute top-0 left-0 w-2 h-2 bg-tantra-red"></div>
                <div className="absolute top-0 right-0 w-2 h-2 bg-tantra-red"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 bg-tantra-red"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 bg-tantra-red"></div>

                {success.eventDatetime && (
                  <div className="mb-4 pb-4 border-b border-[var(--border)]">
                    <div className="label mb-2">VALID</div>
                    <div className="display-text text-default text-lg">
                      {formatEventDate(success.eventDatetime)}
                    </div>
                    <div className="text-sm text-tantra-red font-bold mt-1">9:30 PM — 11:30 PM</div>
                  </div>
                )}

                <div className="label mb-3">PASS NUMBER</div>
                <div className="font-mono text-default text-2xl font-black tracking-wider">
                  {success.ticketCode}
                </div>
              </div>

              {success.emailSent ? (
                <div className="bg-green-500/10 border border-green-500/40 text-green-600 dark:text-green-200 text-sm px-4 py-3 mb-5">
                  ✓ Your pass has been emailed to <strong>{success.email}</strong>. Check your inbox (and spam folder).
                </div>
              ) : (
                <div className="bg-tantra-red/10 border border-tantra-red text-red-600 dark:text-red-200 text-sm px-4 py-3 mb-5">
                  ⚠ Saved, but the confirmation email didn't go through. Please screenshot this page and show your pass number at the door.
                </div>
              )}

              <div className="text-xs text-muted text-center space-y-1">
                <p>• <strong>18+ only</strong> — valid ID required</p>
                <p>• One pass per person, non-transferable</p>
                <p>• Show your QR at entry (phone or printed)</p>
              </div>
            </div>
          ) : (
            // ========== Signup form ==========
            <div className="bg-card tantra-border-strong p-8">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="accent-line"></span>
                  <span className="label">COMPLIMENTARY</span>
                  <span className="accent-line"></span>
                </div>
                <h1 className="display-text text-4xl text-default mb-2">Open Bar Pass</h1>
                <p className="text-sm text-muted">
                  Sign up for a free Open Bar Pass
                  <br />
                  <span className="text-tantra-red font-bold">Friday & Saturday · 9:30–11:30 PM</span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label block mb-2">FULL NAME</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="tantra-input w-full px-4 py-3.5"
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div>
                  <label className="label block mb-2">EMAIL</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="tantra-input w-full px-4 py-3.5"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="label block mb-2">DATE OF BIRTH</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="tantra-input w-full px-4 py-3.5"
                    max={new Date().toISOString().split("T")[0]}
                    required
                  />
                  <p className="text-[11px] text-subtle mt-2">Must be 18 or older to receive the pass</p>
                </div>

                {error && (
                  <div className="bg-tantra-red/10 border border-tantra-red text-red-600 dark:text-red-200 text-sm px-4 py-3">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-red w-full py-4 text-sm"
                >
                  {loading ? "Getting your pass..." : "Get Free Open Bar Pass"}
                </button>

                <p className="text-[11px] text-subtle text-center leading-relaxed">
                  By signing up you confirm you are 18 or older. Your pass will be emailed to you and is valid for one visit only.
                </p>
              </form>
            </div>
          )}

          <p className="text-center text-xs text-subtle mt-6">
            Tantra Night Club · Aruba
          </p>
        </div>
      </div>
    </main>
  );
}
