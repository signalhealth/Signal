import {
  initialize,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  insertRecords,
  aggregateGroupByPeriod,
  Permission,
} from "react-native-health-connect";
import { Linking } from "react-native";

const PERMISSIONS: (Permission | { accessType: "read"; recordType: "ReadHealthDataHistory" })[] = [
  { accessType: "read", recordType: "Weight" },
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "SleepSession" },
  { accessType: "read", recordType: "HeartRateVariabilityRmssd" },
  { accessType: "read", recordType: "RestingHeartRate" },
  { accessType: "read", recordType: "Nutrition" },
  { accessType: "read", recordType: "ExerciseSession" },
  { accessType: "read", recordType: "BodyFat" },
  { accessType: "read", recordType: "LeanBodyMass" },
  { accessType: "read", recordType: "ActiveCaloriesBurned" },
  { accessType: "read", recordType: "OxygenSaturation" },
  { accessType: "read", recordType: "RespiratoryRate" },
  { accessType: "read", recordType: "Hydration" },
  { accessType: "write", recordType: "Hydration" },
  { accessType: "read", recordType: "BloodPressure" },
  { accessType: "read", recordType: "ReadHealthDataHistory" },
];
import {
  DataPoint,
  ExerciseSession,
  NutritionEntry,
  HealthData,
  BloodPressurePoint,
} from "../types/health";

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function localMidnightISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function toDateStr(isoStr: string): string {
  return isoStr.slice(0, 10);
}

export async function initializeHealthConnect(): Promise<boolean> {
  try {
    const result = await initialize();
    return result;
  } catch {
    return false;
  }
}

export async function checkGrantedPermissions(): Promise<boolean> {
  try {
    const granted = await getGrantedPermissions();
    return granted.length > 0;
  } catch {
    return false;
  }
}

export async function requestHealthPermissions(): Promise<boolean> {
  try {
    const granted = await requestPermission(PERMISSIONS);
    return granted.length > 0;
  } catch {
    // Delegate not set up — fall through, caller will open HC manually
    return false;
  }
}

export function openHealthConnectPermissions(): void {
  Linking.openURL("package:com.google.android.apps.healthdata").catch(() => {
    Linking.openURL(
      "market://details?id=com.google.android.apps.healthdata"
    ).catch(() => {});
  });
}

async function readWeight(days = 45): Promise<DataPoint[]> {
  try {
    const result = await readRecords("Weight", {
      timeRangeFilter: {
        operator: "between",
        startTime: daysAgoISO(days),
        endTime: new Date().toISOString(),
      },
    });
    const map = new Map<string, number>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.time);
      const lbs = r.weight.inPounds;
      // Keep last entry per day
      map.set(dateStr, lbs);
    }
    return Array.from(map.entries())
      .map(([date, value]) => ({ date, value: Math.round(value * 10) / 10 }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readSteps(days = 45): Promise<DataPoint[]> {
  try {
    const results = await aggregateGroupByPeriod({
      recordType: "Steps",
      timeRangeFilter: {
        operator: "between",
        startTime: localMidnightISO(days),
        endTime: new Date().toISOString(),
      },
      timeRangeSlicer: { period: "DAYS", length: 1 },
    });
    return results
      .filter((r) => (r.result as any).COUNT_TOTAL > 0)
      .map((r) => ({
        date: toDateStr(r.startTime),
        value: (r.result as any).COUNT_TOTAL as number,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

// Asleep intervals within a session: stage data minus AWAKE/OUT_OF_BED, or
// (if no stage data) the raw start→end span as a single interval.
function sleepSessionIntervals(r: { startTime: string; endTime: string; stages?: { startTime: string; endTime: string; stage: number }[] }): { start: number; end: number }[] {
  if (r.stages && r.stages.length > 0) {
    const intervals = r.stages
      .filter(s => s.stage !== 1 /* AWAKE */ && s.stage !== 3 /* OUT_OF_BED */)
      .map(s => ({ start: new Date(s.startTime).getTime(), end: new Date(s.endTime).getTime() }));
    if (intervals.length > 0) return intervals;
  }
  return [{ start: new Date(r.startTime).getTime(), end: new Date(r.endTime).getTime() }];
}

// Merge overlapping/adjacent intervals and sum their total duration, so naps
// that overlap a main-sleep record aren't double-counted.
function mergedIntervalHours(intervals: { start: number; end: number }[]): number {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let totalMs = 0;
  let curStart = sorted[0].start;
  let curEnd = sorted[0].end;
  for (let i = 1; i < sorted.length; i++) {
    const { start, end } = sorted[i];
    if (start <= curEnd) {
      curEnd = Math.max(curEnd, end);
    } else {
      totalMs += curEnd - curStart;
      curStart = start;
      curEnd = end;
    }
  }
  totalMs += curEnd - curStart;
  return totalMs / (1000 * 3600);
}

async function readSleep(days = 45): Promise<DataPoint[]> {
  try {
    const result = await readRecords("SleepSession", {
      timeRangeFilter: {
        operator: "between",
        startTime: daysAgoISO(days),
        endTime: new Date().toISOString(),
      },
    });
    if (__DEV__) {
      const byDay = new Map<string, number>();
      for (const r of result.records) {
        const d = toDateStr(r.startTime);
        byDay.set(d, (byDay.get(d) || 0) + 1);
      }
      console.log(
        "[readSleep] records:",
        result.records.length,
        "per day:",
        Object.fromEntries(byDay)
      );
      for (const r of result.records) {
        console.log(
          "[readSleep] session",
          r.startTime,
          "->",
          r.endTime,
          "stages:",
          r.stages?.length ?? 0
        );
      }
    }
    // Sum all same-day sessions (naps + main sleep), merging any overlapping
    // intervals so overlapping minutes aren't double-counted.
    const intervalsByDay = new Map<string, { start: number; end: number }[]>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.startTime);
      const intervals = sleepSessionIntervals(r);
      if (!intervalsByDay.has(dateStr)) intervalsByDay.set(dateStr, []);
      intervalsByDay.get(dateStr)!.push(...intervals);
    }
    const map = new Map<string, number>();
    for (const [dateStr, intervals] of intervalsByDay) {
      const hours = mergedIntervalHours(intervals);
      map.set(dateStr, Math.round(hours * 10) / 10);
    }
    return Array.from(map.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readHRV(days = 45): Promise<DataPoint[]> {
  try {
    const result = await readRecords("HeartRateVariabilityRmssd", {
      timeRangeFilter: {
        operator: "between",
        startTime: daysAgoISO(days),
        endTime: new Date().toISOString(),
      },
    });
    const map = new Map<string, number>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.time);
      const ms = r.heartRateVariabilityMillis;
      if (!map.has(dateStr) || ms > map.get(dateStr)!) {
        map.set(dateStr, Math.round(ms));
      }
    }
    return Array.from(map.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readRHR(days = 45): Promise<DataPoint[]> {
  try {
    const result = await readRecords("RestingHeartRate", {
      timeRangeFilter: {
        operator: "between",
        startTime: daysAgoISO(days),
        endTime: new Date().toISOString(),
      },
    });
    const map = new Map<string, number>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.time);
      map.set(dateStr, r.beatsPerMinute);
    }
    return Array.from(map.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readNutrition(days = 45): Promise<NutritionEntry[]> {
  try {
    const result = await readRecords("Nutrition", {
      timeRangeFilter: {
        operator: "between",
        startTime: localMidnightISO(days),
        endTime: new Date().toISOString(),
      },
    });

    // Deduplicate across apps (MacroFactor + Google Health both write to HC).
    // Group by dataOrigin+startTime as a unique key, then sum per local date.
    const seen = new Set<string>();
    const map = new Map<string, {
      cals: number; protein: number; carbs: number; fat: number;
      items: Array<{ name: string; cals: number; protein: number; mealType: number }>;
    }>();

    for (const r of result.records) {
      const dedupKey = `${r.metadata?.dataOrigin ?? ""}|${r.startTime}|${r.endTime}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const d = new Date(r.startTime);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const existing = map.get(dateStr) || { cals: 0, protein: 0, carbs: 0, fat: 0, items: [] };
      const itemCals = r.energy?.inKilocalories || 0;
      const itemProtein = r.protein?.inGrams || 0;
      existing.cals += itemCals;
      existing.protein += itemProtein;
      existing.carbs += r.totalCarbohydrate?.inGrams || 0;
      existing.fat += r.totalFat?.inGrams || 0;
      if (r.name) {
        existing.items.push({
          name: r.name,
          cals: Math.round(itemCals),
          protein: Math.round(itemProtein),
          mealType: r.mealType ?? 0,
        });
      }
      map.set(dateStr, existing);
    }

    return Array.from(map.entries())
      .map(([date, v]) => ({
        date,
        cals: Math.round(v.cals),
        protein: Math.round(v.protein),
        carbs: Math.round(v.carbs),
        fat: Math.round(v.fat),
        items: v.items.length > 0 ? v.items : undefined,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readExercise(days = 45): Promise<ExerciseSession[]> {
  try {
    const result = await readRecords("ExerciseSession", {
      timeRangeFilter: {
        operator: "between",
        startTime: daysAgoISO(days),
        endTime: new Date().toISOString(),
      },
    });
    return result.records
      .map((r) => {
        const start = new Date(r.startTime).getTime();
        const end = new Date(r.endTime).getTime();
        const duration = Math.round((end - start) / 60000);
        return {
          date: toDateStr(r.startTime),
          title: r.title || `Exercise ${r.startTime.slice(0, 10)}`,
          type: r.exerciseType || 0,
          duration,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readBodyFat(days = 45): Promise<DataPoint[]> {
  try {
    const result = await readRecords("BodyFat", {
      timeRangeFilter: {
        operator: "between",
        startTime: daysAgoISO(days),
        endTime: new Date().toISOString(),
      },
    });
    const map = new Map<string, number>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.time);
      // Keep last entry per day
      map.set(dateStr, Math.round(r.percentage * 10) / 10);
    }
    return Array.from(map.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readActiveCals(days = 45): Promise<DataPoint[]> {
  try {
    const result = await readRecords("ActiveCaloriesBurned", {
      timeRangeFilter: {
        operator: "between",
        startTime: localMidnightISO(days),
        endTime: new Date().toISOString(),
      },
    });
    const map = new Map<string, number>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.startTime);
      const kcal = (r.energy?.inKilocalories) ?? 0;
      map.set(dateStr, (map.get(dateStr) ?? 0) + kcal);
    }
    return Array.from(map.entries())
      .map(([date, value]) => ({ date, value: Math.round(value) }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readLeanMass(days = 45): Promise<DataPoint[]> {
  try {
    const result = await readRecords("LeanBodyMass", {
      timeRangeFilter: {
        operator: "between",
        startTime: daysAgoISO(days),
        endTime: new Date().toISOString(),
      },
    });
    const map = new Map<string, number>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.time);
      map.set(dateStr, Math.round(r.mass.inPounds * 10) / 10);
    }
    return Array.from(map.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readSpO2(days = 45): Promise<DataPoint[]> {
  try {
    const result = await readRecords("OxygenSaturation", {
      timeRangeFilter: {
        operator: "between",
        startTime: daysAgoISO(days),
        endTime: new Date().toISOString(),
      },
    });
    const map = new Map<string, number>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.time);
      map.set(dateStr, Math.round(r.percentage * 10) / 10);
    }
    return Array.from(map.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readRespiratoryRate(days = 45): Promise<DataPoint[]> {
  try {
    const result = await readRecords("RespiratoryRate", {
      timeRangeFilter: {
        operator: "between",
        startTime: daysAgoISO(days),
        endTime: new Date().toISOString(),
      },
    });
    const map = new Map<string, number>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.time);
      map.set(dateStr, Math.round(r.rate * 10) / 10);
    }
    return Array.from(map.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readHydration(days = 45): Promise<DataPoint[]> {
  try {
    const result = await readRecords("Hydration", {
      timeRangeFilter: {
        operator: "between",
        startTime: localMidnightISO(days),
        endTime: new Date().toISOString(),
      },
    });
    const map = new Map<string, number>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.startTime);
      const oz = (r.volume as any).inFluidOuncesUs ?? 0;
      map.set(dateStr, (map.get(dateStr) ?? 0) + oz);
    }
    return Array.from(map.entries())
      .map(([date, value]) => ({ date, value: Math.round(value * 10) / 10 }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

async function readBloodPressure(days = 45): Promise<BloodPressurePoint[]> {
  try {
    const result = await readRecords("BloodPressure", {
      timeRangeFilter: {
        operator: "between",
        startTime: daysAgoISO(days),
        endTime: new Date().toISOString(),
      },
    });
    const map = new Map<string, BloodPressurePoint>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.time);
      map.set(dateStr, {
        date: dateStr,
        systolic: Math.round((r.systolic as any).inMillimetersOfMercury),
        diastolic: Math.round((r.diastolic as any).inMillimetersOfMercury),
      });
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export async function writeHydration(oz: number): Promise<void> {
  try {
    const now = new Date();
    const startTime = now.toISOString();
    const endTime = new Date(now.getTime() + 60000).toISOString();
    await insertRecords([{
      recordType: "Hydration",
      startTime,
      endTime,
      volume: { value: oz, unit: "fluidOuncesUs" },
    }]);
  } catch {
    // ignore — local state already updated
  }
}

export async function readAllHealthData(): Promise<HealthData> {
  const [weight, steps, sleep, hrv, rhr, nutrition, exercise, bodyFat, leanMass, activeCals, spo2, respiratoryRate, hydration, bloodPressure] =
    await Promise.allSettled([
      readWeight(730),
      readSteps(730),
      readSleep(730),
      readHRV(730),
      readRHR(730),
      readNutrition(730),
      readExercise(730),
      readBodyFat(730),
      readLeanMass(730),
      readActiveCals(730),
      readSpO2(730),
      readRespiratoryRate(730),
      readHydration(730),
      readBloodPressure(730),
    ]);

  return {
    weight: weight.status === "fulfilled" ? weight.value : [],
    steps: steps.status === "fulfilled" ? steps.value : [],
    sleep: sleep.status === "fulfilled" ? sleep.value : [],
    hrv: hrv.status === "fulfilled" ? hrv.value : [],
    rhr: rhr.status === "fulfilled" ? rhr.value : [],
    nutrition: nutrition.status === "fulfilled" ? nutrition.value : [],
    exercise: exercise.status === "fulfilled" ? exercise.value : [],
    bodyFat: bodyFat.status === "fulfilled" ? bodyFat.value : [],
    leanMass: leanMass.status === "fulfilled" ? leanMass.value : [],
    activeCals: activeCals.status === "fulfilled" ? activeCals.value : [],
    spo2: spo2.status === "fulfilled" ? spo2.value : [],
    respiratoryRate: respiratoryRate.status === "fulfilled" ? respiratoryRate.value : [],
    hydration: hydration.status === "fulfilled" ? hydration.value : [],
    bloodPressure: bloodPressure.status === "fulfilled" ? bloodPressure.value : [],
  };
}
