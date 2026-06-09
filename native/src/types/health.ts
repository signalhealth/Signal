export interface UserProfile {
  name: string;
  goal: string;
  targetWeight: string;
  targetBodyFat: string;
  targetDate: string;
  startingWeight: string;
  startingDate: string;
  onTRT: boolean;
  trtStartDate: string;
  trainingDaysPerWeek: string;
  trainingProgram: string;
  additionalContext: string;
  calorieTarget: string;
  proteinTarget: string;
  carbTarget: string;
  fatTarget: string;
  waterGoalOz: string;
}

export const DEFAULT_PROFILE: UserProfile = {
  name: "",
  goal: "",
  targetWeight: "",
  targetBodyFat: "",
  targetDate: "",
  startingWeight: "",
  startingDate: "",
  onTRT: false,
  trtStartDate: "",
  trainingDaysPerWeek: "",
  trainingProgram: "",
  additionalContext: "",
  calorieTarget: "",
  proteinTarget: "",
  carbTarget: "",
  fatTarget: "",
  waterGoalOz: "",
};

export interface DataPoint {
  date: string; // "YYYY-MM-DD"
  value: number;
}

export interface ExerciseSession {
  date: string;
  title: string;
  type: number;
  duration: number; // minutes
}

export interface NutritionEntry {
  date: string;
  cals: number;
  protein: number;
  carbs: number;
  fat: number;
  items?: Array<{ name: string; cals: number; protein: number; mealType: number }>;
}

export interface DexaScan {
  date: string;
  weight: number;
  bodyFat: number;
  leanMass: number;
}

export interface LabResult {
  id: string;
  date: string;
  name: string;
  value: string;
  reference: string;
  status: "green" | "amber" | "red";
  direction?: "high" | "low";
}

export interface RecoveryNote {
  date: string;
  note: string;
}

export interface BloodPressurePoint {
  date: string;
  systolic: number;
  diastolic: number;
}

export interface HealthData {
  weight: DataPoint[];
  hrv: DataPoint[];
  rhr: DataPoint[];
  sleep: DataPoint[];
  steps: DataPoint[];
  exercise: ExerciseSession[];
  nutrition: NutritionEntry[];
  bodyFat: DataPoint[];
  leanMass: DataPoint[];
  activeCals: DataPoint[];
  spo2: DataPoint[];
  respiratoryRate: DataPoint[];
  hydration: DataPoint[];
  bloodPressure: BloodPressurePoint[];
}

export interface MicroGoal {
  name: string;
  target: number;
  unit: string;
}

export interface WaterEntry {
  date: string; // YYYY-MM-DD
  oz: number;   // daily total
}

export interface AppState {
  dexa: DexaScan[];
  labs: LabResult[];
  recovery: RecoveryNote[];
  micros: MicroGoal[];
  water: WaterEntry[];
}

export type FuelCtx = {
  trained: "yes" | "no" | null;
  sleep: "good" | "poor" | null;
  goal: "recomp" | "performance" | "recovery";
};

export const DEFAULT_MICROS: MicroGoal[] = [
  { name: "Sodium", target: 2300, unit: "mg" },
  { name: "Fiber", target: 30, unit: "g" },
  { name: "Potassium", target: 4700, unit: "mg" },
  { name: "Calcium", target: 1000, unit: "mg" },
  { name: "Iron", target: 8, unit: "mg" },
];

export const MACRO_TARGETS = {
  calories: 1800,
  protein: 180,
  carbs: 160,
  fat: 60,
};

export const HRV_NORMAL_LOW = 69;
export const HRV_NORMAL_HIGH = 89;
export const SLEEP_TARGET = 7.5;
export const STEPS_TARGET = 10000;
