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
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { isoToDateKey, formatDateKeyShort } from "@/lib/utils";

type Registration = {
  id: string;
  full_name: string;
  group_size: number;
  event_datetime: string | null;
  table_number: string | null;
  issued_by: string | null;
  created_at: string;
  tickets: {
    ticket_code: string;
    checked_in: boolean;
    checked_in_at: string | null;
  }[];
};

const RED = "#DB130D";
const RED_LIGHT = "#FF1F17";
const DARK = "#0a0a0a";
const GRAY = "#888888";

export default function AnalyticsPanel({
  registrations,
}: {
  registrations: Registration[];
}) {
  // ===== Chart 1: Reservations & Guests over time =====
  const byDate = new Map<string, { date: string; reservations: number; guests: number }>();
  for (const r of registrations) {
    const key = r.event_datetime ? isoToDateKey(r.event_datetime) : isoToDateKey(r.created_at);
    if (!key) continue;
    const existing = byDate.get(key);
    if (existing) {
      existing.reservations += 1;
      existing.guests += r.group_size;
    } else {
      byDate.set(key, { date: key, reservations: 1, guests: r.group_size });
    }
  }
  const timeSeries = Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, label: formatDateKeyShort(d.date) }));

  // ===== Chart 2: Busiest days of week =====
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
  const dayGuestCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const r of registrations) {
    const when = r.event_datetime || r.created_at;
    if (!when) continue;
    const d = new Date(when);
    if (isNaN(d.getTime())) continue;
    const dow = d.getDay();
    dayOfWeekCounts[dow] += 1;
    dayGuestCounts[dow] += r.group_size;
  }
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayOfWeekData = dayLabels.map((label, i) => ({
    day: label,
    reservations: dayOfWeekCounts[i],
    guests: dayGuestCounts[i],
  }));

  // ===== Chart 3: Table usage =====
  const tableCounts = new Map<string, number>();
  for (const r of registrations) {
    if (!r.table_number) continue;
    const key = r.table_number.trim().toUpperCase();
    tableCounts.set(key, (tableCounts.get(key) || 0) + 1);
  }
  const tableData = Array.from(tableCounts.entries())
    .map(([table, count]) => ({ table, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // top 10

  // ===== Chart 4: Peak arrival times (check-ins by hour) =====
  const hourCounts: Record<number, number> = {};
  for (const r of registrations) {
    for (const t of r.tickets) {
      if (!t.checked_in || !t.checked_in_at) continue;
      const h = new Date(t.checked_in_at).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
  }
  // Show hours 8pm to 5am (typical nightlife window)
  const nightHours = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
  const arrivalData = nightHours.map((h) => ({
    hour: formatHour(h),
    checkins: hourCounts[h] || 0,
  }));

  // ===== Chart 5: Hostess performance =====
  const hostessCounts = new Map<string, { reservations: number; guests: number }>();
  for (const r of registrations) {
    const name = r.issued_by?.trim() || "Unassigned";
    const existing = hostessCounts.get(name);
    if (existing) {
      existing.reservations += 1;
      existing.guests += r.group_size;
    } else {
      hostessCounts.set(name, { reservations: 1, guests: r.group_size });
    }
  }
  const hostessData = Array.from(hostessCounts.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.guests - a.guests);

  if (registrations.length === 0) {
    return (
      <div className="bg-card tantra-border-strong p-10 text-center">
        <div className="label mb-3">ANALYTICS</div>
        <p className="text-muted text-sm">
          No data yet. Once you have some reservations, charts will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <span className="accent-line"></span>
        <span className="label">ANALYTICS</span>
      </div>

      {/* Chart 1: Reservations & Guests over time */}
      <ChartCard title="Reservations & Guests Over Time">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke={GRAY} fontSize={11} />
            <YAxis stroke={GRAY} fontSize={11} />
            <Tooltip content={<DarkTooltip />} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Line
              type="monotone"
              dataKey="reservations"
              stroke={RED}
              strokeWidth={2}
              dot={{ fill: RED, r: 3 }}
              name="Reservations"
            />
            <Line
              type="monotone"
              dataKey="guests"
              stroke={RED_LIGHT}
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={{ fill: RED_LIGHT, r: 3 }}
              name="Guests"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 2: Day of week */}
        <ChartCard title="Busiest Days of Week">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dayOfWeekData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke={GRAY} fontSize={11} />
              <YAxis stroke={GRAY} fontSize={11} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="guests" fill={RED} name="Guests" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Chart 4: Peak arrival times */}
        <ChartCard title="Peak Arrival Times">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={arrivalData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="hour" stroke={GRAY} fontSize={11} />
              <YAxis stroke={GRAY} fontSize={11} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="checkins" fill={RED_LIGHT} name="Check-ins" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 3: Table usage */}
        <ChartCard title="Most Popular Tables">
          {tableData.length === 0 ? (
            <EmptyChart msg="No tables assigned yet." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, tableData.length * 32)}>
              <BarChart
                data={tableData}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis type="number" stroke={GRAY} fontSize={11} />
                <YAxis type="category" dataKey="table" stroke={GRAY} fontSize={11} width={80} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="count" fill={RED} name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Chart 5: Hostess performance */}
        <ChartCard title="Hostess Performance">
          {hostessData.length === 0 ? (
            <EmptyChart msg="No hostess data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, hostessData.length * 32)}>
              <BarChart
                data={hostessData}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis type="number" stroke={GRAY} fontSize={11} />
                <YAxis type="category" dataKey="name" stroke={GRAY} fontSize={11} width={80} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="guests" fill={RED_LIGHT} name="Guests Booked" />
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
      <h3 className="text-sm font-bold uppercase tracking-widest text-default mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyChart({ msg }: { msg: string }) {
  return (
    <div className="h-[180px] flex items-center justify-center text-xs text-muted">{msg}</div>
  );
}

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-deep border border-tantra-red px-3 py-2 text-xs shadow-lg">
      {label && <div className="font-bold text-default mb-1">{label}</div>}
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ color: entry.color }} className="font-semibold">
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}
