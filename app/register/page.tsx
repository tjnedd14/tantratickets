"use client";

import { useState } from "react";
import { isValidPhone, normalizePhone } from "@/lib/utils";
import { generateTicketsPDF } from "@/components/TicketPDF";

type Ticket = {
  ticket_code: string;
  guest_name: string;
  phone: string;
  person_number: number;
};

type Step = "form" | "guests" | "success";

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // form data
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [groupSize, setGroupSize] = useState(1);
  const [guestNames, setGuestNames] = useState<string[]>([]);

  // result
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Tantra";
  const venueName = process.env.NEXT_PUBLIC_VENUE_NAME || "Tantra Aruba";

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("Please enter your full name");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Please enter a valid phone number");
      return;
    }
    if (groupSize < 1 || groupSize > 5) {
      setError("Group size must be between 1 and 5");
      return;
    }

    // If group size > 1, collect additional guest names
    if (groupSize > 1) {
      // pre-fill first guest with primary name
      const initial = Array(groupSize).fill("");
      initial[0] = fullName.trim();
      setGuestNames(initial);
      setStep("guests");
    } else {
      // just the primary person — submit directly
      submitRegistration([fullName.trim()]);
    }
  }

  function handleGuestsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmed = guestNames.map((n) => n.trim());
    if (trimmed.some((n) => n.length < 2)) {
      setError("Please enter each guest's full name");
      return;
    }
    submitRegistration(trimmed);
  }

  async function submitRegistration(names: string[]) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: normalizePhone(phone),
          group_size: groupSize,
          guest_names: names,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setTickets(data.tickets);
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPDF() {
    try {
      await generateTicketsPDF({
        tickets,
        eventName,
        venueName,
        primaryName: fullName.trim(),
      });
    } catch (err) {
      console.error(err);
      setError("Couldn't generate PDF. Please try again.");
    }
  }

  function handleReset() {
    setStep("form");
    setFullName("");
    setPhone("");
    setGroupSize(1);
    setGuestNames([]);
    setTickets([]);
    setError("");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl gold-text mb-2">{eventName}</h1>
          <p className="text-tantra-muted text-sm tracking-widest uppercase">
            Guest Registration
          </p>
        </div>

        {/* Card */}
        <div className="bg-tantra-card gold-border rounded-2xl p-6 sm:p-8 shadow-2xl">
          {step === "form" && (
            <form onSubmit={handleStep1Submit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-tantra-muted mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-tantra-bg border border-tantra-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-tantra-gold transition"
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-tantra-muted mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-tantra-bg border border-tantra-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-tantra-gold transition"
                  placeholder="+297 123 4567"
                  autoComplete="tel"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-tantra-muted mb-2">
                  How many people? (including you)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setGroupSize(n)}
                      className={`py-3 rounded-lg font-semibold transition ${
                        groupSize === n
                          ? "btn-gold"
                          : "bg-tantra-bg border border-tantra-border text-white hover:border-tantra-gold"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-tantra-muted mt-2">Maximum 5 per registration</p>
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-500/50 text-red-200 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-gold w-full py-4 rounded-lg text-base">
                {groupSize === 1 ? "Get My Ticket" : "Continue"}
              </button>
            </form>
          )}

          {step === "guests" && (
            <form onSubmit={handleGuestsSubmit} className="space-y-5">
              <div>
                <h2 className="font-display text-2xl text-white mb-1">Guest Names</h2>
                <p className="text-sm text-tantra-muted">
                  Enter the full name of each person in your group
                </p>
              </div>

              {guestNames.map((name, idx) => (
                <div key={idx}>
                  <label className="block text-sm font-medium text-tantra-muted mb-2">
                    Guest {idx + 1} {idx === 0 && "(You)"}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      const next = [...guestNames];
                      next[idx] = e.target.value;
                      setGuestNames(next);
                    }}
                    className="w-full bg-tantra-bg border border-tantra-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-tantra-gold transition"
                    placeholder="Full name"
                  />
                </div>
              ))}

              {error && (
                <div className="bg-red-900/30 border border-red-500/50 text-red-200 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  disabled={loading}
                  className="flex-1 py-4 rounded-lg border border-tantra-border text-white hover:border-tantra-gold transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gold flex-1 py-4 rounded-lg"
                >
                  {loading ? "Generating..." : `Get ${groupSize} Tickets`}
                </button>
              </div>
            </form>
          )}

          {step === "success" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-tantra-gold/20 mb-4">
                  <svg
                    className="w-8 h-8 text-tantra-gold"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-display text-3xl gold-text mb-2">You're In</h2>
                <p className="text-tantra-muted text-sm">
                  {tickets.length} ticket{tickets.length > 1 ? "s" : ""} generated for{" "}
                  <span className="text-white">{fullName}</span>
                </p>
              </div>

              <div className="space-y-2 bg-tantra-bg rounded-lg p-4 border border-tantra-border">
                {tickets.map((t) => (
                  <div
                    key={t.ticket_code}
                    className="flex justify-between items-center text-sm py-2 border-b border-tantra-border last:border-0"
                  >
                    <span className="text-white">{t.guest_name}</span>
                    <span className="font-mono text-tantra-gold text-xs">{t.ticket_code}</span>
                  </div>
                ))}
              </div>

              <button onClick={handleDownloadPDF} className="btn-gold w-full py-4 rounded-lg">
                Download Tickets (PDF)
              </button>

              <p className="text-xs text-tantra-muted text-center">
                Show your PDF or ticket codes to the hostess at the door
              </p>

              <button
                onClick={handleReset}
                className="w-full text-sm text-tantra-muted hover:text-white transition"
              >
                Register another group
              </button>

              {error && (
                <div className="bg-red-900/30 border border-red-500/50 text-red-200 text-sm rounded-lg px-4 py-3">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-tantra-muted mt-6">
          {venueName} · Aruba
        </p>
      </div>
    </main>
  );
}
