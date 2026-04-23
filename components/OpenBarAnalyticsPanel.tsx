"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { isoToDateKey, formatDateKeyShort } from "@/lib/utils";

type OpenBarSignup = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  gender: "male" | "female" | null;
  wa_opt_in: boolean;
  date_of_birth: string;
  ticket_code: string;
  event_datetime: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  email_sent: boolean;
  created_at: string;
};

const RED = "#DB130D";
const RED_LIGHT = "#FF1F17";
const BLUE = "#3b82f6";
const PINK = "#ec4899";
const GRAY = "#888888";

function calculateAge(dob: string): number {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export default function OpenBarAnalyticsPanel({
  signups,
}: {
  signups: OpenBarSignup[];
}) {
  // ===== Signups over time (by event date) =====
  const byEventDate = new Map<string, { date: string; signups: number; redeemed: number }>();
  for (const s of signups) {
    const key = s.event_datetime ? isoToDateKey(s.event_datetime) : isoToDateKey(s.created_at);
    if (!key) continue;
    const existing = byEventDate.get(key);
    if (existing) {
      existing.signups += 1;
      if (s.checked_in) existing.redeemed += 1;
    } else {
      byEventDate.set(key, { date: key, signups: 1, redeemed: s.checked_in ? 1 : 0 });
    }
  }
  const timeSeries = Array.from(byEventDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, label: formatDateKeyShort(d.date) }));

  // ===== Gender split pie =====
  const maleCount = signups.filter((s) => s.gender === "male").length;
  const femaleCount = signups.filter((s) => s.gender === "female").length;
  const unsetCount = signups.length - maleCount - femaleCount;
  const genderData = [
    { name: "Male", value: maleCount, color: BLUE },
    { name: "Female", value: femaleCount, color: PINK },
  ].filter((g) => g.value > 0);

  // ===== Age distribution =====
  const ageBuckets = {
    "18-21": 0,
    "22-25": 0,
    "26-30": 0,
    "31-40": 0,
    "41+": 0,
  };
  for (const s of signups) {
    const age = calculateAge(s.date_of_birth);
    if (age >= 18 && age <= 21) ageBuckets["18-21"] += 1;
    else if (age <= 25) ageBuckets["22-25"] += 1;
    else if (age <= 30) ageBuckets["26-30"] += 1;
    else if (age <= 40) ageBuckets["31-40"] += 1;
    else if (age > 40) ageBuckets["41+"] += 1;
  }
  const ageData = Object.entries(ageBuckets).map(([range, count]) => ({ range, count }));

  // ===== Signup velocity (by created_at day of week) =====
  const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const s of signups) {
    const d = new Date(s.created_at);
    if (!isNaN(d.getTime())) dowCounts[d.getDay()] += 1;
  }
  const dowData = dowLabels.map((day, i) => ({ day, signups: dowCounts[i] }));

  // ===== Funnel: signups → email sent → checked in =====
  const totalSignups = signups.length;
  const emailSentCount = signups.filter((s) => s.email_sent).length;
  const checkedInCount = signups.filter((s) => s.checked_in).length;
  const waOptInCount = signups.filter((s) => s.wa_opt_in).length;
  const funnelData = [
    { stage: "Signed Up", count: totalSignups },
    { stage: "Email Sent", count: emailSentCount },
    { stage: "Showed Up", count: checkedInCount },
  ];

  // ===== Redemption rate by event night =====
  const redemptionData = timeSeries.map((d) => ({
    label: d.label,
    rate: d.signups > 0 ? Math.round((d.redeemed / d.signups) * 100) : 0,
    signups: d.signups,
    redeemed: d.redeemed,
  }));

  return (
    <div className="space-y-5 mt-6">
      <div className="flex items-center gap-3">
        <span className="accent-line"></span>
        <span className="label">OPEN BAR ANALYTICS</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Signups over time */}
        <ChartCard title="Signups & Redemptions Over Time">
          {timeSeries.length === 0 ? (
            <EmptyChart msg="No signups yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeSeries} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke={GRAY} fontSize={11} />
                <YAxis stroke={GRAY} fontSize={11} allowDecimals={false} />
                <Tooltip content={<DarkTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="signups" stroke={RED} strokeWidth={2} name="Signed Up" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="redeemed" stroke="#22c55e" strokeWidth={2} name="Redeemed" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Gender split */}
        <ChartCard title="Gender Split">
          {genderData.length === 0 ? (
            <EmptyChart msg="No gender data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill={RED}
                  dataKey="value"
                >
                  {genderData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<DarkTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {unsetCount > 0 && (
            <p className="text-xs text-subtle mt-2">
              {unsetCount} legacy signup{unsetCount === 1 ? "" : "s"} without gender data
            </p>
          )}
        </ChartCard>

        {/* Age distribution */}
        <ChartCard title="Age Distribution">
          {signups.length === 0 ? (
            <EmptyChart msg="No signups yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ageData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="range" stroke={GRAY} fontSize={11} />
                <YAxis stroke={GRAY} fontSize={11} allowDecimals={false} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" fill={RED_LIGHT} name="Guests" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Signup day of week (when people fill out the form) */}
        <ChartCard title="When People Sign Up (Day of Week)">
          {signups.length === 0 ? (
            <EmptyChart msg="No signups yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dowData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke={GRAY} fontSize={11} />
                <YAxis stroke={GRAY} fontSize={11} allowDecimals={false} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="signups" fill={RED} name="Signups" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Funnel */}
        <ChartCard title="Conversion Funnel">
          {signups.length === 0 ? (
            <EmptyChart msg="No signups yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis type="number" stroke={GRAY} fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="stage" stroke={GRAY} fontSize={11} width={80} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" fill={RED_LIGHT} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {totalSignups > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Email delivery rate:</span>
                <span className="text-default font-bold">{Math.round((emailSentCount / totalSignups) * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Show-up rate:</span>
                <span className="text-default font-bold">{Math.round((checkedInCount / totalSignups) * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">WhatsApp opt-in rate:</span>
                <span className="text-default font-bold">{Math.round((waOptInCount / totalSignups) * 100)}%</span>
              </div>
            </div>
          )}
        </ChartCard>

        {/* Redemption rate by night */}
        <ChartCard title="Show-Up Rate By Event Night">
          {redemptionData.length === 0 ? (
            <EmptyChart msg="No event data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={redemptionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke={GRAY} fontSize={11} />
                <YAxis stroke={GRAY} fontSize={11} unit="%" domain={[0, 100]} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="rate" fill="#22c55e" name="Show-up %" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card tantra-border-strong p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1 h-full bg-tantra-red" />
      <h3 className="text-sm font-bold uppercase tracking-widest text-default mb-4">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart({ msg }: { msg: string }) {
  return <div className="h-[180px] flex items-center justify-center text-xs text-muted">{msg}</div>;
}

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-deep border border-tantra-red px-3 py-2 text-xs shadow-lg">
      {label && <div className="font-bold text-default mb-1">{label}</div>}
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ color: entry.color || entry.payload?.color || "#fff" }} className="font-semibold">
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  );
}
