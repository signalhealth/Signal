import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppState,
  DexaScan,
  LabResult,
  MicroGoal,
  RecoveryNote,
  DEFAULT_MICROS,
} from "../types/health";

const KEYS = {
  ANTHROPIC_KEY: "anthropic_key",
  APP_STATE: "signal_app_state_v1",
  MICROS: "signal_micros_v1",
} as const;

// ── Anthropic API Key ──────────────────────────────────────────────

export async function getAnthropicKey(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.ANTHROPIC_KEY);
  } catch {
    return null;
  }
}

export async function setAnthropicKey(key: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.ANTHROPIC_KEY, key);
}

export async function removeAnthropicKey(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.ANTHROPIC_KEY);
}

// ── App State (dexa, labs, recovery) ─────────────────────────────

const DEFAULT_STATE: AppState = {
  dexa: [],
  labs: [],
  recovery: [],
  micros: DEFAULT_MICROS,
};

export async function loadAppState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.APP_STATE);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      return {
        ...DEFAULT_STATE,
        ...parsed,
        micros: parsed.micros || DEFAULT_MICROS,
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_STATE };
}

export async function saveAppState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.APP_STATE, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// ── Micro goals ───────────────────────────────────────────────────

export async function loadMicroGoals(): Promise<MicroGoal[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MICROS);
    if (raw) return JSON.parse(raw) as MicroGoal[];
  } catch {
    // ignore
  }
  return DEFAULT_MICROS;
}

export async function saveMicroGoals(goals: MicroGoal[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.MICROS, JSON.stringify(goals));
  } catch {
    // ignore
  }
}
