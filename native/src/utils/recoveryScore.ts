import { DataPoint } from "../types/health";

function lerp(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = Math.max(0, Math.min(1, (v - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function scoreHRV(hrv: number): number {
  if (hrv < 20) return 0;
  if (hrv < 40) return lerp(hrv, 20, 40, 0, 25);
  if (hrv < 69) return lerp(hrv, 40, 69, 25, 65);
  if (hrv < 89) return lerp(hrv, 69, 89, 72, 90);  // in-range: generous 72–90
  return clamp(lerp(hrv, 89, 130, 90, 100));          // above normal: 90–100
}

function scoreSleep(sleep: number): number {
  if (sleep > 9.5) return 88;                              // slightly too much
  if (sleep >= 7) return lerp(sleep, 7, 9.5, 85, 100);    // target zone: 7–9.5h
  if (sleep >= 5.5) return lerp(sleep, 5.5, 7, 50, 85);
  if (sleep >= 4) return lerp(sleep, 4, 5.5, 15, 50);
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

  const latestSpO2 = sorted(params.spo2 ?? [])[0];
  const latestRR = sorted(params.respiratoryRate ?? [])[0];
  const spo2Val = latestSpO2?.value ?? null;
  const rrVal = latestRR?.value ?? null;

  if (hrvVal === null && sleepVal === null && rhrVal === null) {
    return { score: 0, hrv: null, hrvDate: null, sleep: null, sleepDate: null, rhr: null, rhrDate: null, activeCalsYesterday: null, trendBonus: 0, penalty: 0, hasData: false, spo2: null, spo2Date: null, respiratoryRate: null, respiratoryRateDate: null };
  }

  const hScore = hrvVal !== null ? scoreHRV(hrvVal) : 70;
  const sScore = sleepVal !== null ? scoreSleep(sleepVal) : 70;
  const rScore = rhrVal !== null ? scoreRHR(rhrVal) : 70;

  const last7hrv = params.hrv.filter(d => d.date >= sevenAgo && d.date < today);
  const bonus = hrvVal !== null ? hrvTrendBonus(hrvVal, last7hrv) : 0;
  const penalty = trainingPenalty(calYesterday);
  const spo2Mod = spo2Val !== null ? spo2Modifier(spo2Val) : 0;
  const rrMod = rrVal !== null ? rrModifier(rrVal) : 0;

  const weighted = hScore * 0.40 + sScore * 0.35 + rScore * 0.25;
  const score = clamp(Math.round(weighted + bonus + penalty + spo2Mod + rrMod));

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
  };
}
