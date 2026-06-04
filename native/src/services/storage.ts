import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppState,
  DexaScan,
  LabResult,
  MicroGoal,
  RecoveryNote,
  WaterEntry,
  DEFAULT_MICROS,
  UserProfile,
  DEFAULT_PROFILE,
} from "../types/health";
import { LABS_SEED } from "../data/labsSeed";

const KEYS = {
  ANTHROPIC_KEY: "anthropic_key",
  APP_STATE: "signal_app_state_v1",
  MICROS: "signal_micros_v1",
  USER_PROFILE: "signal_user_profile_v1",
  LABS_SEED_APPLIED: "signal_labs_seed_v1",
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
  water: [],
};

export async function loadAppState(): Promise<AppState> {
  try {
    const [raw, seedApplied] = await Promise.all([
      AsyncStorage.getItem(KEYS.APP_STATE),
      AsyncStorage.getItem(KEYS.LABS_SEED_APPLIED),
    ]);

    let state: AppState;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      state = {
        ...DEFAULT_STATE,
        ...parsed,
        micros: parsed.micros || DEFAULT_MICROS,
        water: parsed.water || [],
      };
    } else {
      state = { ...DEFAULT_STATE };
    }

    if (!seedApplied && state.labs.length === 0) {
      state = { ...state, labs: LABS_SEED };
      await Promise.all([
        AsyncStorage.setItem(KEYS.APP_STATE, JSON.stringify(state)),
        AsyncStorage.setItem(KEYS.LABS_SEED_APPLIED, "1"),
      ]);
    }

    return state;
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

// ── User Profile ──────────────────────────────────────────────────

export async function loadUserProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.USER_PROFILE);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_PROFILE };
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
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
