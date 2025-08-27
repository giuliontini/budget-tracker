// src/utils/periods.ts
export type PeriodMode = 'calendar' | 'amex' | 'bofa';

export type Period = {
  mode: PeriodMode;
  start: Date;          // inclusive
  endExclusive: Date;   // exclusive
  label: string;        // e.g., "Aug 16 – Sep 15" or "August 2025"
  settingsKey: string;  // YYYY-MM (for /api/settings?month=)
};

export const cycles = {
  amex: { startDay: 16 }, // ends on the 15th -> endExclusive is next month 16
  bofa: { startDay: 27 }, // ends on the 26th -> endExclusive is next month 27
} as const;

const pad2 = (n: number) => String(n).padStart(2, '0');
const yyyymm = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

function monthStart(y: number, m: number) {
  return new Date(y, m, 1, 0, 0, 0, 0);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate(), 0, 0, 0, 0);
}
function formatRangeLabel(start: Date, endExclusive: Date) {
  const endInclusive = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000);
  const s = start.toLocaleString('default', { month: 'short', day: 'numeric' });
  const e = endInclusive.toLocaleString('default', { month: 'short', day: 'numeric' });
  // If years differ, add years explicitly for clarity
  const yearsDiffer = start.getFullYear() !== endInclusive.getFullYear();
  const sY = yearsDiffer ? ` ${start.getFullYear()}` : '';
  const eY = ` ${endInclusive.getFullYear()}`;
  return `${s}${sY} – ${e}${eY}`;
}

export function resolvePeriod(mode: PeriodMode, offset: number, today = new Date()): Period {
  if (mode === 'calendar') {
    const base = monthStart(today.getFullYear(), today.getMonth() + offset);
    const endExclusive = monthStart(base.getFullYear(), base.getMonth() + 1);
    return {
      mode,
      start: base,
      endExclusive,
      label: base.toLocaleString('default', { month: 'long', year: 'numeric' }),
      settingsKey: yyyymm(base),
    };
  }

  // cycle modes (amex/bofa): define by startDay; endExclusive is next month same startDay
  const def = cycles[mode as keyof typeof cycles] ?? cycles.amex;
  const anchorStartThisMonth = new Date(today.getFullYear(), today.getMonth(), def.startDay);
  const isInCurrentCycle = today >= anchorStartThisMonth;
  const currentStart = isInCurrentCycle
    ? anchorStartThisMonth
    : new Date(today.getFullYear(), today.getMonth() - 1, def.startDay);

  const start = addMonths(currentStart, offset);
  const endExclusive = addMonths(start, 1); // same day next month
  const label = formatRangeLabel(start, endExclusive);
  const endInclusive = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000);
  return {
    mode,
    start,
    endExclusive,
    label,
    settingsKey: yyyymm(start), // use cycle end month for settings
  };
}

function toYMDUTC(dLike: string | Date) {
  const d = dLike instanceof Date ? dLike : new Date(dLike)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}` // YYYY-MM-DD in UTC
}

// Inclusive start, exclusive end using date-only (UTC) comparisons
export function withinPeriod(dLike: string | Date, p: Period) {
  const ymd = toYMDUTC(dLike)
  const startYMD = toYMDUTC(p.start)
  const endYMD = toYMDUTC(p.endExclusive) // first day of next period
  return ymd >= startYMD && ymd < endYMD
}


export function lastNPeriods(mode: PeriodMode, currentOffset: number, n: number, today = new Date()): Period[] {
  // Return periods from oldest -> newest
  return Array.from({ length: n }).map((_, i) => {
    const offset = currentOffset - (n - 1 - i);
    return resolvePeriod(mode, offset, today);
  });
}
