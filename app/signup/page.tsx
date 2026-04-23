"use client";

import { useState, useEffect } from "react";
import { isValidEmail, isValidPhone, calculateAge, formatEventDate } from "@/lib/utils";

const LOGO_WHITE = "https://i.imgur.com/xAQenGt.png";

// Real photos from tantraaruba.com
const HERO_IMG = "https://static.wixstatic.com/media/aeb35a_2d138d66732342cba37d7b0bf5cd9325~mv2.jpg/v1/fit/w_1920,h_1280,q_90,enc_avif,quality_auto/aeb35a_2d138d66732342cba37d7b0bf5cd9325~mv2.jpg";
const MOMENT_1 = "https://static.wixstatic.com/media/aeb35a_a204fe2684214c4380b318b64f1b3d80~mv2.jpg/v1/fit/w_960,h_640,q_90,enc_avif,quality_auto/aeb35a_a204fe2684214c4380b318b64f1b3d80~mv2.jpg";
const MOMENT_2 = "https://static.wixstatic.com/media/aeb35a_e6750a205c694c7f887dd26241b17cac~mv2.jpg/v1/fit/w_960,h_640,q_90,enc_avif,quality_auto/aeb35a_e6750a205c694c7f887dd26241b17cac~mv2.jpg";
const MOMENT_3 = "https://static.wixstatic.com/media/aeb35a_872ded374ecf4adea0e1574cba870374~mv2.jpg/v1/fit/w_960,h_640,q_90,enc_avif,quality_auto/aeb35a_872ded374ecf4adea0e1574cba870374~mv2.jpg";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+297 ");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [dob, setDob] = useState("");
  const [waOptIn, setWaOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    ticketCode: string;
    eventDatetime: string | null;
    emailSent: boolean;
    email: string;
  } | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  // Force dark mode on this page
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // ============== SUCCESS SCREEN ==============
  if (success) {
    return (
      <div className="min-h-screen bg-black text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={HERO_IMG} alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black" />
        </div>

        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
          <div className="max-w-xl w-full text-center">
            <img src={LOGO_WHITE} alt="Tantra" className="h-20 w-auto mx-auto mb-12 opacity-90" />

            <div className="inline-flex items-center gap-2 mb-8">
              <div className="w-12 h-px bg-tantra-red"></div>
              <span className="text-tantra-red text-xs tracking-[0.3em] font-bold">YOU'RE IN</span>
              <div className="w-12 h-px bg-tantra-red"></div>
            </div>

            <h1 className="text-5xl md:text-6xl font-black mb-4 tracking-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
              SEE YOU<br />ON THE FLOOR
            </h1>

            {success.eventDatetime && (
              <p className="text-2xl md:text-3xl font-bold text-tantra-red mt-8 mb-2 tracking-wide">
                {formatEventDate(success.eventDatetime)}
              </p>
            )}
            <p className="text-white/60 text-sm tracking-[0.2em] mb-12">
              OPEN BAR · 9:00 PM — 11:00 PM
            </p>

            <div className="border border-white/20 bg-black/40 backdrop-blur-sm px-8 py-8 mb-8">
              <div className="text-xs tracking-[0.25em] text-white/40 mb-3">YOUR PASS</div>
              <div className="text-3xl md:text-4xl font-black tracking-widest font-mono">
                {success.ticketCode}
              </div>
            </div>

            {success.emailSent ? (
              <p className="text-white/70 text-base">
                Your pass is on the way to <span className="text-white font-semibold">{success.email}</span>.<br />
                <span className="text-white/50 text-sm">Check spam if you don't see it within 5 minutes.</span>
              </p>
            ) : (
              <p className="text-yellow-400 text-base">
                Pass saved — but the email didn't go through.<br />
                <span className="text-white/50 text-sm">Screenshot your pass code <span className="font-mono text-white">{success.ticketCode}</span> and show it at the door.</span>
              </p>
            )}

            {waOptIn && (
              <p className="text-white/50 text-sm mt-6">
                📱 You'll also get a WhatsApp reminder before the event.
              </p>
            )}

            <div className="mt-12 pt-8 border-t border-white/10 text-xs tracking-[0.2em] text-white/40">
              18+ · VALID ID REQUIRED · TANTRA ARUBA
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============== MAIN PAGE ==============
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Floating top bar */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-black/80 backdrop-blur-md border-b border-white/10" : "bg-transparent"
      }`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <img src={LOGO_WHITE} alt="Tantra" className={`transition-all duration-300 ${
            scrolled ? "h-8" : "h-10"
          } w-auto opacity-90`} />
          <a
            href="#signup"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-xs tracking-[0.2em] font-bold border border-white/30 px-4 py-2 hover:bg-tantra-red hover:border-tantra-red transition-colors"
          >
            GET PASS
          </a>
        </div>
      </div>

      {/* ============ HERO ============ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={HERO_IMG} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black" />
          <div className="absolute inset-0 bg-black/30" />
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto pt-20 pb-12">
          <img
            src={LOGO_WHITE}
            alt="Tantra Night Club"
            className="h-24 md:h-28 w-auto mx-auto mb-10 opacity-95"
          />

          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-8 h-px bg-tantra-red"></div>
            <span className="text-tantra-red text-[11px] tracking-[0.4em] font-bold">COMPLIMENTARY · LIMITED</span>
            <div className="w-8 h-px bg-tantra-red"></div>
          </div>

          <h1
            className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black leading-[0.9] tracking-tight mb-6"
            style={{ fontFamily: "'Archivo Black', sans-serif" }}
          >
            FREE<br />
            <span className="text-tantra-red">OPEN BAR</span>
          </h1>

          <p className="text-lg md:text-xl text-white/80 max-w-xl mx-auto mb-2 font-medium">
            Friday & Saturday Nights at Tantra Aruba
          </p>
          <p className="text-sm md:text-base text-white/50 max-w-xl mx-auto mb-12 tracking-wide">
            9:00 PM — 11:00 PM · Reserve in 30 seconds
          </p>

          <a
            href="#signup"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="inline-block bg-tantra-red text-white text-base font-bold tracking-[0.2em] px-12 py-5 hover:bg-red-700 transition-colors shadow-2xl"
          >
            CLAIM YOUR PASS →
          </a>

          <p className="text-xs text-white/40 mt-6 tracking-wide">
            18+ only · Palm Beach, Aruba
          </p>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* ============ SOCIAL PROOF / VENUE ============ */}
      <section className="relative bg-black py-20 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-8 h-px bg-tantra-red"></div>
              <span className="text-tantra-red text-[11px] tracking-[0.4em] font-bold">THE VENUE</span>
              <div className="w-8 h-px bg-tantra-red"></div>
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
              ARUBA'S MOST ICONIC<br />NIGHTCLUB
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              State-of-the-art lighting and sound. VIP bottle service. The full Palm Beach nightlife experience — and tonight, the bar's on us.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-20">
            <div className="aspect-[4/5] overflow-hidden">
              <img src={MOMENT_1} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </div>
            <div className="aspect-[4/5] overflow-hidden">
              <img src={MOMENT_2} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </div>
            <div className="aspect-[4/5] overflow-hidden">
              <img src={MOMENT_3} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="text-tantra-red text-5xl font-black mb-3" style={{ fontFamily: "'Archivo Black', sans-serif" }}>01</div>
              <h3 className="text-xl font-bold mb-2 tracking-wide">UNLIMITED POURS</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Open bar runs 9:00 to 11:00 PM. Premium liquor included.
              </p>
            </div>
            <div className="text-center">
              <div className="text-tantra-red text-5xl font-black mb-3" style={{ fontFamily: "'Archivo Black', sans-serif" }}>02</div>
              <h3 className="text-xl font-bold mb-2 tracking-wide">SKIP THE LINE</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Show your QR pass at the door — straight to the floor.
              </p>
            </div>
            <div className="text-center">
              <div className="text-tantra-red text-5xl font-black mb-3" style={{ fontFamily: "'Archivo Black', sans-serif" }}>03</div>
              <h3 className="text-xl font-bold mb-2 tracking-wide">NO COVER</h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Completely free. Sign up takes 30 seconds. 18+ with valid ID.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ SIGNUP FORM ============ */}
      <section id="signup" className="relative bg-black py-20 md:py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={HERO_IMG} alt="" className="w-full h-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/85 to-black" />
        </div>

        <div className="relative z-10 max-w-md mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-8 h-px bg-tantra-red"></div>
              <span className="text-tantra-red text-[11px] tracking-[0.4em] font-bold">RESERVE YOUR PASS</span>
              <div className="w-8 h-px bg-tantra-red"></div>
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-3" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
              GET ON THE LIST
            </h2>
            <p className="text-white/60 text-sm">
              Pass is sent to your email instantly.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] tracking-[0.3em] text-white/50 font-bold mb-2">
                FULL NAME
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-transparent border-0 border-b border-white/30 px-0 py-3 text-white text-lg placeholder-white/30 focus:outline-none focus:border-tantra-red transition-colors"
                required
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.3em] text-white/50 font-bold mb-2">
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full bg-transparent border-0 border-b border-white/30 px-0 py-3 text-white text-lg placeholder-white/30 focus:outline-none focus:border-tantra-red transition-colors"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.3em] text-white/50 font-bold mb-2">
                PHONE NUMBER
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+297 123 4567"
                className="w-full bg-transparent border-0 border-b border-white/30 px-0 py-3 text-white text-lg placeholder-white/30 focus:outline-none focus:border-tantra-red transition-colors"
                required
                autoComplete="tel"
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.3em] text-white/50 font-bold mb-3">
                GENDER
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGender("male")}
                  className={`py-4 text-sm font-bold tracking-[0.2em] border transition-all ${
                    gender === "male"
                      ? "bg-tantra-red border-tantra-red text-white"
                      : "border-white/30 text-white/70 hover:border-white/60"
                  }`}
                >
                  MALE
                </button>
                <button
                  type="button"
                  onClick={() => setGender("female")}
                  className={`py-4 text-sm font-bold tracking-[0.2em] border transition-all ${
                    gender === "female"
                      ? "bg-tantra-red border-tantra-red text-white"
                      : "border-white/30 text-white/70 hover:border-white/60"
                  }`}
                >
                  FEMALE
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.3em] text-white/50 font-bold mb-2">
                DATE OF BIRTH
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                className="w-full bg-transparent border-0 border-b border-white/30 px-0 py-3 text-white text-lg focus:outline-none focus:border-tantra-red transition-colors"
                style={{ colorScheme: "dark" }}
                required
              />
              <p className="text-white/30 text-xs mt-2">Must be 18+ to receive the pass.</p>
            </div>

            {/* WhatsApp opt-in */}
            <label className="flex items-start gap-3 py-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={waOptIn}
                onChange={(e) => setWaOptIn(e.target.checked)}
                className="mt-1 w-5 h-5 accent-tantra-red cursor-pointer"
              />
              <span className="text-sm text-white/70 group-hover:text-white transition-colors">
                <span className="text-white font-semibold">📱 Send me WhatsApp updates</span> about Tantra events and exclusive invites. (Optional)
              </span>
            </label>

            {error && (
              <div className="bg-red-950/40 border border-red-500/40 text-red-300 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-tantra-red text-white text-sm font-bold tracking-[0.25em] py-5 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? "SENDING YOUR PASS…" : "CLAIM MY OPEN BAR PASS"}
            </button>

            <p className="text-center text-white/30 text-[10px] tracking-[0.2em] pt-4">
              BY SIGNING UP, YOU AGREE TO RECEIVE YOUR DIGITAL PASS BY EMAIL.
            </p>
          </form>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-black border-t border-white/10 py-10 px-6 text-center">
        <img src={LOGO_WHITE} alt="Tantra" className="h-8 w-auto mx-auto mb-4 opacity-60" />
        <p className="text-white/40 text-xs tracking-[0.2em] mb-2">
          J.E IRAUSQUIN BLVD 348 A · PALM BEACH · ARUBA
        </p>
        <p className="text-white/30 text-[10px] tracking-[0.2em]">
          © TANTRA NIGHT CLUB · 18+ ONLY · DRINK RESPONSIBLY
        </p>
      </footer>
    </div>
  );
}
