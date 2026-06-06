import { DataPoint } from "../types/health";

function lerp(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = Math.max(0, Math.min(1, (v - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function scoreHRV(hrv: number): number {
  if (hrv < 40) return lerp(hrv, 0, 40, 0, 30);
  if (hrv < 69) return lerp(hrv, 40, 69, 30, 60);
  if (hrv < 89) return lerp(hrv, 69, 89, 60, 85);
  return clamp(lerp(hrv, 89, 130, 85, 100));
}

function scoreSleep(sleep: number): number {
  if (sleep > 9) return 88;
  if (sleep >= 7.5) return lerp(sleep, 7.5, 9, 90, 100);
  if (sleep >= 6) return lerp(sleep, 6, 7.5, 55, 90);
  if (sleep >= 4) return lerp(sleep, 4, 6, 15, 55);
  return lerp(sleep, 0, 4, 0, 15);
}

function scoreRHR(rhr: number): number {
  if (rhr < 45) return 100;
  if (rhr < 55) return lerp(rhr, 45, 55, 100, 88);
  if (rhr < 60) return lerp(rhr, 55, 60, 88, 75);
  if (rhr < 65) return lerp(rhr, 60, 65, 75, 60);
  if (rhr < 75) return lerp(rhr, 65, 75, 60, 35);
  if (rhr < 85) return lerp(rhr, 75, 85, 35, 10);
  return 0;
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

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface RecoveryBreakdown {
  score: number;
  hrv: number | null;
  sleep: number | null;
  rhr: number | null;
  activeCalsYesterday: number | null;
  trendBonus: number;
  penalty: number;
  hasData: boolean;
}

export function calcRecoveryScore(params: {
  hrv: DataPoint[];
  rhr: DataPoint[];
  sleep: DataPoint[];
  activeCals: DataPoint[];
}): RecoveryBreakdown {
  const today = todayStr();
  const yesterday = dateStr((() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })());
  const sevenAgo = dateStr((() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; })());

  const sorted = (arr: DataPoint[]) => [...arr].sort((a, b) => b.date.localeCompare(a.date));

  const latestHRV = sorted(params.hrv)[0];
  const latestSleep = sorted(params.sleep)[0];
  const latestRHR = sorted(params.rhr)[0];

  const hrvVal = latestHRV?.value ?? null;
  const sleepVal = latestSleep?.value ?? null;
  const rhrVal = latestRHR?.value ?? null;

  // Yesterday's active calories (fall back to today if yesterday not yet synced)
  const calYesterday = params.activeCals.find(d => d.date === yesterday)?.value
    ?? params.activeCals.find(d => d.date === today)?.value
    ?? 0;

  if (hrvVal === null && sleepVal === null && rhrVal === null) {
    return { score: 0, hrv: null, sleep: null, rhr: null, activeCalsYesterday: null, trendBonus: 0, penalty: 0, hasData: false };
  }

  const hScore = hrvVal !== null ? scoreHRV(hrvVal) : 70;
  const sScore = sleepVal !== null ? scoreSleep(sleepVal) : 70;
  const rScore = rhrVal !== null ? scoreRHR(rhrVal) : 70;

  const last7hrv = params.hrv.filter(d => d.date >= sevenAgo && d.date < today);
  const bonus = hrvVal !== null ? hrvTrendBonus(hrvVal, last7hrv) : 0;
  const penalty = trainingPenalty(calYesterday);

  const weighted = hScore * 0.40 + sScore * 0.35 + rScore * 0.25;
  const score = clamp(Math.round(weighted + bonus + penalty));

  return {
    score,
    hrv: hrvVal,
    sleep: sleepVal,
    rhr: rhrVal,
    activeCalsYesterday: calYesterday > 0 ? calYesterday : null,
    trendBonus: bonus,
    penalty,
    hasData: true,
  };
}
