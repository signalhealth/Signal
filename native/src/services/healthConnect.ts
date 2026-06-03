import {
  initialize,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  Permission,
} from "react-native-health-connect";
import { Linking } from "react-native";

const PERMISSIONS: Permission[] = [
  { accessType: "read", recordType: "Weight" },
  { accessType: "read", recordType: "Steps" },
  { accessType: "read", recordType: "SleepSession" },
  { accessType: "read", recordType: "HeartRateVariabilityRmssd" },
  { accessType: "read", recordType: "RestingHeartRate" },
  { accessType: "read", recordType: "Nutrition" },
  { accessType: "read", recordType: "ExerciseSession" },
  { accessType: "read", recordType: "BodyFat" },
];
import {
  DataPoint,
  ExerciseSession,
  NutritionEntry,
  HealthData,
} from "../types/health";

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function toDateStr(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    const result = await readRecords("Steps", {
      timeRangeFilter: {
        operator: "between",
        startTime: daysAgoISO(days),
        endTime: new Date().toISOString(),
      },
    });
    // Aggregate by day
    const map = new Map<string, number>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.endTime);
      map.set(dateStr, (map.get(dateStr) || 0) + r.count);
    }
    return Array.from(map.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
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
    const map = new Map<string, number>();
    for (const r of result.records) {
      const dateStr = toDateStr(r.startTime);
      const start = new Date(r.startTime).getTime();
      const end = new Date(r.endTime).getTime();
      const hours = (end - start) / (1000 * 3600);
      // Keep longest session per day
      if (!map.has(dateStr) || hours > map.get(dateStr)!) {
        map.set(dateStr, Math.round(hours * 10) / 10);
      }
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
        startTime: daysAgoISO(days),
        endTime: new Date().toISOString(),
      },
    });
    const map = new Map<
      string,
      { cals: number; protein: number; carbs: number; fat: number }
    >();
    for (const r of result.records) {
      const dateStr = toDateStr(r.startTime);
      const existing = map.get(dateStr) || {
        cals: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      };
      existing.cals += r.energy?.inKilocalories || 0;
      existing.protein += r.protein?.inGrams || 0;
      existing.carbs += r.totalCarbohydrate?.inGrams || 0;
      existing.fat += r.totalFat?.inGrams || 0;
      map.set(dateStr, existing);
    }
    return Array.from(map.entries())
      .map(([date, v]) => ({
        date,
        cals: Math.round(v.cals),
        protein: Math.round(v.protein),
        carbs: Math.round(v.carbs),
        fat: Math.round(v.fat),
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
    return result.records
      .map((r) => ({
        date: toDateStr(r.time),
        value: Math.round(r.percentage * 10) / 10,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export async function readAllHealthData(): Promise<HealthData> {
  const [weight, steps, sleep, hrv, rhr, nutrition, exercise, bodyFat] =
    await Promise.allSettled([
      readWeight(90),
      readSteps(90),
      readSleep(90),
      readHRV(90),
      readRHR(90),
      readNutrition(90),
      readExercise(90),
      readBodyFat(90),
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
  };
}
