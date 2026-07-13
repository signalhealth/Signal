import { HealthData, AppState, UserProfile, LabResult } from "../types/health";

function lerp(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = Math.max(0, Math.min(1, (v - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function nDaysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function avg30(data: { date: string; value: number }[]): number | null {
  const cutoff = nDaysAgoStr(30);
  const recent = data.filter((d) => d.date >= cutoff && d.value > 0);
  if (!recent.length) return null;
  return recent.reduce((s, d) => s + d.value, 0) / recent.length;
}

function latestLabsByName(labs: LabResult[]): Map<string, LabResult> {
  const map = new Map<string, LabResult>();
  const sorted = [...labs].sort((a, b) => b.date.localeCompare(a.date));
  for (const lab of sorted) {
    const key = lab.name.toLowerCase().trim();
    if (!map.has(key)) map.set(key, lab);
  }
  return map;
}

function labScore(lab: LabResult): number {
  if (lab.status === "green") return 90;
  if (lab.status === "amber") return 60;
  return 25;
}

function weightedAvg(items: Array<{ score: number; weight: number }>): number | null {
  if (!items.length) return null;
  const totalW = items.reduce((s, i) => s + i.weight, 0);
  return items.reduce((s, i) => s + i.score * i.weight, 0) / totalW;
}

const CARDIO_MARKERS = new Set([
  "apob", "ldl", "ldl cholesterol", "hdl", "hdl cholesterol",
  "lp(a)", "lipoprotein(a)", "triglycerides", "hscrp", "crp", "homocysteine",
  "cac score", "cac", "cac (calcium score)",
]);
const CAC_MARKERS = new Set(["cac score", "cac", "cac (calcium score)"]);

const METABOLIC_MARKERS = new Set([
  "hba1c", "hemoglobin a1c", "fasting glucose", "glucose", "fasting blood sugar",
  "insulin", "homa-ir", "alt", "ast", "ferritin", "uric acid",
]);

const HORMONAL_MARKERS = new Set([
  "testosterone", "free testosterone", "total testosterone",
  "estradiol", "estrogen",
  "vitamin d", "vitamin d3", "25-oh vitamin d", "25(oh)d",
  "tsh", "free t3", "t3", "free t4", "t4",
  "cortisol", "dhea", "dhea-s",
  "hematocrit", "sodium", "potassium", "magnesium",
]);

function scoreCardiovascular(
  labsByName: Map<string, LabResult>,
  bpData: { date: string; systolic: number; diastolic: number }[]
): number | null {
  const items: Array<{ score: number; weight: number }> = [];

  for (const [key, lab] of labsByName) {
    if (!CARDIO_MARKERS.has(key)) continue;
    items.push({ score: labScore(lab), weight: CAC_MARKERS.has(key) ? 2 : 1 });
  }

  if (bpData.length > 0) {
    const sorted = [...bpData].sort((a, b) => a.date.localeCompare(b.date));
    const { systolic: s, diastolic: d } = sorted[sorted.length - 1];
    let bpScore: number;
    if (s < 120 && d < 80) bpScore = 90;
    else if (s < 130 && d < 80) bpScore = 75;
    else if (s < 140 || d < 90) bpScore = 55;
    else bpScore = 25;
    items.push({ score: bpScore, weight: 1.5 });
  }

  return weightedAvg(items);
}

function scoreMetabolic(labsByName: Map<string, LabResult>): number | null {
  const items: Array<{ score: number; weight: number }> = [];
  for (const [key, lab] of labsByName) {
    if (!METABOLIC_MARKERS.has(key)) continue;
    const w = key === "hba1c" || key === "hemoglobin a1c" ? 2 : 1;
    items.push({ score: labScore(lab), weight: w });
  }
  return weightedAvg(items);
}

function scoreFitness(hrv: number | null, rhr: number | null, steps: number | null): number | null {
  const items: Array<{ score: number; weight: number }> = [];

  if (hrv !== null) {
    let s: number;
    if (hrv >= 70) s = 95;
    else if (hrv >= 50) s = lerp(hrv, 50, 70, 80, 95);
    else if (hrv >= 35) s = lerp(hrv, 35, 50, 65, 80);
    else s = clamp(lerp(hrv, 0, 35, 20, 65));
    items.push({ score: s, weight: 2 });
  }

  if (rhr !== null) {
    let s: number;
    if (rhr < 50) s = 95;
    else if (rhr < 60) s = lerp(rhr, 50, 60, 88, 95);
    else if (rhr < 70) s = lerp(rhr, 60, 70, 65, 88);
    else s = clamp(lerp(rhr, 70, 90, 30, 65));
    items.push({ score: s, weight: 1.5 });
  }

  if (steps !== null) {
    let s: number;
    if (steps >= 10000) s = 95;
    else if (steps >= 7500) s = lerp(steps, 7500, 10000, 80, 95);
    else if (steps >= 5000) s = lerp(steps, 5000, 7500, 60, 80);
    else s = clamp(lerp(steps, 0, 5000, 20, 60));
    items.push({ score: s, weight: 1 });
  }

  return weightedAvg(items);
}

function scoreHormonal(labsByName: Map<string, LabResult>): number | null {
  const items: Array<{ score: number; weight: number }> = [];
  for (const [key, lab] of labsByName) {
    if (!HORMONAL_MARKERS.has(key)) continue;
    const isHighPriority =
      key.includes("testosterone") || key === "vitamin d" || key === "vitamin d3" ||
      key === "25-oh vitamin d" || key === "25(oh)d";
    items.push({ score: labScore(lab), weight: isHighPriority ? 1.5 : 1 });
  }
  return weightedAvg(items);
}

function scoreBodyComp(
  dexa: { date: string; bodyFat: number }[],
  bodyFatData: { date: string; value: number }[],
  weightData: { date: string; value: number }[],
  targetWeight: string
): number | null {
  const items: Array<{ score: number; weight: number }> = [];

  let bf: number | null = null;
  if (dexa.length > 0) {
    const sorted = [...dexa].sort((a, b) => a.date.localeCompare(b.date));
    bf = sorted[sorted.length - 1].bodyFat;
  } else {
    bf = avg30(bodyFatData);
  }

  if (bf !== null && bf > 0) {
    let bfScore: number;
    if (bf < 8) bfScore = 80;
    else if (bf < 15) bfScore = clamp(lerp(bf, 8, 15, 85, 98));
    else if (bf < 20) bfScore = lerp(bf, 15, 20, 85, 75);
    else if (bf < 25) bfScore = lerp(bf, 20, 25, 75, 58);
    else if (bf < 30) bfScore = lerp(bf, 25, 30, 58, 40);
    else bfScore = clamp(lerp(bf, 30, 45, 40, 15));
    items.push({ score: bfScore, weight: 2 });
  }

  const cutoff = nDaysAgoStr(30);
  const recentWeight = weightData
    .filter((d) => d.date >= cutoff && d.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (recentWeight.length >= 5) {
    const trend = recentWeight[recentWeight.length - 1].value - recentWeight[0].value;
    const target = parseFloat(targetWeight);
    let trendScore: number;
    if (!isNaN(target)) {
      const current = recentWeight[recentWeight.length - 1].value;
      const movingToTarget = target < current ? trend < 0 : trend > 0;
      trendScore = Math.abs(trend) < 0.5 ? 82 : movingToTarget ? 85 : 60;
    } else {
      trendScore = Math.abs(trend) < 0.5 ? 82 : trend < 0 ? 78 : 70;
    }
    items.push({ score: trendScore, weight: 1 });
  }

  return weightedAvg(items);
}

function scoreSleepRecovery(sleep: number | null, spo2: number | null): number | null {
  const items: Array<{ score: number; weight: number }> = [];

  if (sleep !== null) {
    let s: number;
    if (sleep >= 7 && sleep <= 9) s = 95;
    else if (sleep >= 6.5) s = 75;
    else if (sleep >= 6) s = 55;
    else s = 30;
    items.push({ score: s, weight: 2 });
  }

  if (spo2 !== null) {
    let s: number;
    if (spo2 >= 97) s = 95;
    else if (spo2 >= 95) s = 80;
    else if (spo2 >= 93) s = 55;
    else s = 25;
    items.push({ score: s, weight: 1 });
  }

  return weightedAvg(items);
}

export interface WellnessBreakdown {
  score: number;
  completeness: number;
  categories: {
    cardiovascular: number | null;
    metabolic: number | null;
    fitness: number | null;
    hormonal: number | null;
    bodyComp: number | null;
    sleepRecovery: number | null;
  };
}

const WEIGHTS = {
  cardiovascular: 0.25,
  metabolic: 0.20,
  fitness: 0.20,
  hormonal: 0.15,
  bodyComp: 0.10,
  sleepRecovery: 0.10,
} as const;

export function calcWellnessScore(params: {
  healthData: HealthData;
  appState: AppState;
  userProfile: UserProfile;
}): WellnessBreakdown {
  const { healthData, appState, userProfile } = params;
  const labsByName = latestLabsByName(appState.labs);

  const categories = {
    cardiovascular: scoreCardiovascular(labsByName, healthData.bloodPressure),
    metabolic: scoreMetabolic(labsByName),
    fitness: scoreFitness(avg30(healthData.hrv), avg30(healthData.rhr), avg30(healthData.steps)),
    hormonal: scoreHormonal(labsByName),
    bodyComp: scoreBodyComp(appState.dexa, healthData.bodyFat, healthData.weight, userProfile.targetWeight),
    sleepRecovery: scoreSleepRecovery(avg30(healthData.sleep), avg30(healthData.spo2)),
  };

  let totalWeight = 0;
  let weightedSum = 0;
  let presentCount = 0;
  const totalCount = Object.keys(WEIGHTS).length;

  for (const key of Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>) {
    const s = categories[key];
    if (s !== null) {
      totalWeight += WEIGHTS[key];
      weightedSum += s * WEIGHTS[key];
      presentCount++;
    }
  }

  return {
    score: totalWeight > 0 ? clamp(Math.round(weightedSum / totalWeight)) : 0,
    completeness: presentCount / totalCount,
    categories,
  };
}
