import { DataPoint } from "../types/health";

function lerp(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = Math.max(0, Math.min(1, (v - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  return dateStr(new Date());
}

function nDaysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateStr(d);
}

// Minimum data points required to trust a personal baseline
const MIN_BASELINE_POINTS = 5;

function computeStats(data: DataPoint[], today: string, days = 30): { mean: number; sd: number } | null {
  const cutoff = nDaysAgoStr(days);
  const slice = data.filter(d => d.date < today && d.date >= cutoff && d.value > 0);
  if (slice.length < MIN_BASELINE_POINTS) return null;
  const mean = slice.reduce((s, d) => s + d.value, 0) / slice.length;
  const variance = slice.reduce((s, d) => s + (d.value - mean) ** 2, 0) / slice.length;
  return { mean, sd: Math.sqrt(variance) };
}

// Personalized "normal range" for a metric, derived from the user's own recent
// history (mean ± 1 SD over the trailing window) rather than a fixed global band —
// mirrors how Coros computes its adaptive HRV normal range from the last 30 nights.
export function computeNormalRange(
  data: DataPoint[],
  today: string,
  days = 30,
  decimals = 0
): { low: number; high: number } | null {
  const stats = computeStats(data, today, days);
  if (!stats) return null;
  const mult = 10 ** decimals;
  const round = (v: number) => Math.round(v * mult) / mult;
  return {
    low: Math.max(0, round(stats.mean - stats.sd)),
    high: round(stats.mean + stats.sd),
  };
}

// Score based on standard deviations from personal baseline (z-score), not raw
// % deviation — a metric with naturally wide night-to-night swings (HRV often
// has a 30-40% coefficient of variation) shouldn't be judged on the same %
// scale as a tight one (RHR). z=-1 (the low edge of the "normal range" shown
// elsewhere in the app) should still read as a normal, unremarkable night.
// z > 0 = better than baseline (higher HRV, more sleep, lower RHR).
// At baseline (z=0) → 78, comfortably inside the Go Hard zone — a typical
// night for you should read as "normal," not as a reason to ease off.
function deviationScore(z: number): number {
  if (z >= 2.0)  return 100;
  if (z >= 1.0)  return lerp(z, 1.0, 2.0, 92, 100);
  if (z >= 0.0)  return lerp(z, 0.0, 1.0, 78, 92);
  if (z >= -1.0) return lerp(z, -1.0, 0.0, 62, 78);
  if (z >= -2.0) return lerp(z, -2.0, -1.0, 30, 62);
  return lerp(z, -3.0, -2.0, 10, 30);
}

// ── Absolute fallbacks (used when < MIN_BASELINE_POINTS of history) ──

function scoreHRV_abs(hrv: number): number {
  if (hrv < 20) return 0;
  if (hrv < 40) return lerp(hrv, 20, 40, 0, 25);
  if (hrv < 69) return lerp(hrv, 40, 69, 25, 65);
  if (hrv < 89) return lerp(hrv, 69, 89, 72, 90);
  return clamp(lerp(hrv, 89, 130, 90, 100));
}

function scoreSleep_abs(sleep: number): number {
  if (sleep > 9.5) return 88;
  if (sleep >= 7) return lerp(sleep, 7, 9.5, 85, 100);
  if (sleep >= 5.5) return lerp(sleep, 5.5, 7, 50, 85);
  if (sleep >= 4) return lerp(sleep, 4, 5.5, 15, 50);
  return lerp(sleep, 0, 4, 0, 15);
}

function scoreRHR_abs(rhr: number): number {
  if (rhr < 45) return 100;
  if (rhr < 55) return lerp(rhr, 45, 55, 100, 88);
  if (rhr < 60) return lerp(rhr, 55, 60, 88, 75);
  if (rhr < 65) return lerp(rhr, 60, 65, 75, 60);
  if (rhr < 75) return lerp(rhr, 65, 75, 60, 35);
  if (rhr < 85) return lerp(rhr, 75, 85, 35, 10);
  return 0;
}

// ── Personalized scoring (baseline-relative, z-score) ──

type Stats = { mean: number; sd: number } | null;

function scoreHRV(hrv: number, stats: Stats): number {
  if (hrv < 10) return 5; // absolute physiological floor
  if (!stats || stats.sd <= 0) return scoreHRV_abs(hrv);
  return deviationScore((hrv - stats.mean) / stats.sd);
}

function scoreSleep(sleep: number, stats: Stats): number {
  if (sleep < 2) return 5; // absolute physiological floor
  if (!stats || stats.sd <= 0) return scoreSleep_abs(sleep);
  // Cap upside at +1.5 SD — sleeping far above baseline likely means illness, not peak recovery
  const z = Math.min((sleep - stats.mean) / stats.sd, 1.5);
  return deviationScore(z);
}

function scoreRHR(rhr: number, stats: Stats): number {
  if (rhr > 95) return 10; // absolute physiological floor
  if (!stats || stats.sd <= 0) return scoreRHR_abs(rhr);
  // RHR: lower is better, so invert the z
  return deviationScore((stats.mean - rhr) / stats.sd);
}

function trainingPenalty(cals: number): number {
  if (cals > 500) return -15;
  if (cals > 300) return -8;
  if (cals > 150) return -4;
  return 0;
}

function hrvTrendBonus(today: number, last7: DataPoint[]): number {
  if (last7.length < 3) return 0;
  const avg = last7.reduce((s, d) => s + d.value, 0) / last7.length;
  const pct = (today - avg) / avg;
  if (pct > 0.1) return 5;
  if (pct < -0.1) return -5;
  return 0;
}

function spo2Modifier(spo2: number): number {
  if (spo2 >= 95) return 0;
  if (spo2 >= 93) return -2;
  return -5;
}

function rrModifier(rr: number): number {
  if (rr <= 16) return 1;
  if (rr <= 20) return 0;
  if (rr <= 25) return -2;
  return -4;
}

// A real RHR drifts a bpm or two day to day. The exact same value N days running
// (with fresh dates, so it's not just a stale "no new sync") points to a frozen
// device/sync glitch rather than an actual reading — treat it as unreliable.
const FROZEN_RUN = 3;
function isFrozenSeries(data: DataPoint[]): boolean {
  const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
  if (sorted.length < FROZEN_RUN) return false;
  const v = sorted[0].value;
  return sorted.slice(0, FROZEN_RUN).every(d => d.value === v);
}

export interface RecoveryBreakdown {
  score: number;
  hrv: number | null;
  hrvDate: string | null;
  sleep: number | null;
  sleepDate: string | null;
  rhr: number | null;
  rhrDate: string | null;
  activeCalsYesterday: number | null;
  trendBonus: number;
  penalty: number;
  hasData: boolean;
  spo2: number | null;
  spo2Date: string | null;
  respiratoryRate: number | null;
  respiratoryRateDate: string | null;
  hrvBaseline: number | null;
  sleepBaseline: number | null;
  rhrBaseline: number | null;
  rhrFrozen: boolean;
}

export function calcRecoveryScore(params: {
  hrv: DataPoint[];
  rhr: DataPoint[];
  sleep: DataPoint[];
  activeCals: DataPoint[];
  spo2?: DataPoint[];
  respiratoryRate?: DataPoint[];
}): RecoveryBreakdown {
  const today = todayStr();
  const yesterday = dateStr((() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })());
  const sevenAgo = nDaysAgoStr(7);

  const sorted = (arr: DataPoint[]) => [...arr].sort((a, b) => b.date.localeCompare(a.date));

  const latestHRV   = sorted(params.hrv)[0];
  const latestSleep = sorted(params.sleep)[0];
  const latestRHR   = sorted(params.rhr)[0];

  const hrvVal   = latestHRV?.value   ?? null;
  const sleepVal = latestSleep?.value ?? null;
  const rhrVal   = latestRHR?.value   ?? null;

  const hrvStats   = computeStats(params.hrv,   today, 30);
  const sleepStats = computeStats(params.sleep, today, 30);
  const rhrStats   = computeStats(params.rhr,   today, 30);
  const hrvBaseline   = hrvStats?.mean   ?? null;
  const sleepBaseline = sleepStats?.mean ?? null;
  const rhrBaseline   = rhrStats?.mean   ?? null;

  const calYesterday = params.activeCals.find(d => d.date === yesterday)?.value
    ?? params.activeCals.find(d => d.date === today)?.value
    ?? 0;

  const latestSpO2 = sorted(params.spo2 ?? [])[0];
  const latestRR   = sorted(params.respiratoryRate ?? [])[0];
  const spo2Val    = latestSpO2?.value ?? null;
  const rrVal      = latestRR?.value   ?? null;

  if (hrvVal === null && sleepVal === null && rhrVal === null) {
    return {
      score: 0, hrv: null, hrvDate: null, sleep: null, sleepDate: null,
      rhr: null, rhrDate: null, activeCalsYesterday: null,
      trendBonus: 0, penalty: 0, hasData: false,
      spo2: null, spo2Date: null, respiratoryRate: null, respiratoryRateDate: null,
      hrvBaseline: null, sleepBaseline: null, rhrBaseline: null,
      rhrFrozen: false,
    };
  }

  const rhrFrozen = isFrozenSeries(params.rhr);

  const hScore = hrvVal   !== null ? scoreHRV(hrvVal,     hrvStats)   : 70;
  const sScore = sleepVal !== null ? scoreSleep(sleepVal, sleepStats) : 70;
  const rScore = rhrVal   !== null && !rhrFrozen ? scoreRHR(rhrVal, rhrStats) : 70;

  // Once a personalized 30-day baseline exists, scoreHRV's deviation curve already
  // captures today-vs-recent-trend more precisely than this flat ±5 cliff — applying
  // both double-counts the same dip. Only use the trend cliff as a fallback signal
  // before there's enough history for a baseline.
  const last7hrv = params.hrv.filter(d => d.date >= sevenAgo && d.date < today);
  const bonus    = hrvVal !== null && hrvBaseline === null ? hrvTrendBonus(hrvVal, last7hrv) : 0;
  const penalty  = trainingPenalty(calYesterday);
  const spo2Mod  = spo2Val !== null ? spo2Modifier(spo2Val) : 0;
  const rrMod    = rrVal   !== null ? rrModifier(rrVal)     : 0;

  const weighted = hScore * 0.40 + sScore * 0.35 + rScore * 0.25;
  const score    = clamp(Math.round(weighted + bonus + penalty + spo2Mod + rrMod));

  return {
    score,
    hrv: hrvVal,
    hrvDate: latestHRV?.date ?? null,
    sleep: sleepVal,
    sleepDate: latestSleep?.date ?? null,
    rhr: rhrVal,
    rhrDate: latestRHR?.date ?? null,
    activeCalsYesterday: calYesterday > 0 ? calYesterday : null,
    trendBonus: bonus,
    penalty,
    hasData: true,
    spo2: spo2Val,
    spo2Date: latestSpO2?.date ?? null,
    respiratoryRate: rrVal,
    respiratoryRateDate: latestRR?.date ?? null,
    hrvBaseline,
    sleepBaseline,
    rhrBaseline,
    rhrFrozen,
  };
}
