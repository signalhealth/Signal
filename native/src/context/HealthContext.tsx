import React, { createContext, useState, useEffect, useRef, ReactNode } from "react";
import { AppState as RNAppState } from "react-native";
import {
  HealthData,
  AppState,
  UserProfile,
  DEFAULT_PROFILE,
} from "../types/health";
import {
  initializeHealthConnect,
  checkGrantedPermissions,
  requestHealthPermissions,
  openHealthConnectPermissions,
  readAllHealthData,
} from "../services/healthConnect";
import {
  loadAppState,
  saveAppState,
  loadUserProfile,
  saveUserProfile,
} from "../services/storage";

interface HealthContextValue {
  healthData: HealthData;
  appState: AppState;
  userProfile: UserProfile;
  loading: boolean;
  healthInitializing: boolean;
  permissionGranted: boolean;
  refresh: () => Promise<void>;
  updateAppState: (state: AppState) => void;
  updateUserProfile: (profile: UserProfile) => void;
  openPermissions: () => Promise<void>;
}

const emptyHealthData: HealthData = {
  weight: [],
  hrv: [],
  rhr: [],
  sleep: [],
  steps: [],
  exercise: [],
  nutrition: [],
  bodyFat: [],
  leanMass: [],
  activeCals: [],
  spo2: [],
  respiratoryRate: [],
  hydration: [],
  bloodPressure: [],
};

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

const defaultAppState: AppState = {
  dexa: [],
  labs: [],
  recovery: [],
  micros: [],
  water: [],
};

export const HealthContext = createContext<HealthContextValue>({
  healthData: emptyHealthData,
  appState: defaultAppState,
  userProfile: DEFAULT_PROFILE,
  loading: false,
  healthInitializing: false,
  permissionGranted: false,
  refresh: async () => {},
  updateAppState: () => {},
  updateUserProfile: () => {},
  openPermissions: async () => {},
});

export function HealthProvider({ children }: { children: ReactNode }) {
  const [healthData, setHealthData] = useState<HealthData>(emptyHealthData);
  const [appState, setAppState] = useState<AppState>(defaultAppState);
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [healthInitializing, setHealthInitializing] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    bootstrap();
  }, []);

  // When app returns to foreground, re-check permissions in case user just
  // granted them manually in Health Connect
  useEffect(() => {
    const sub = RNAppState.addEventListener("change", async (state) => {
      if (state === "active" && initializedRef.current && !permissionGranted) {
        const granted = await checkGrantedPermissions();
        if (granted) {
          setPermissionGranted(true);
          setHealthInitializing(true);
          try {
            const data = await readAllHealthData();
            setHealthData(data);
          } finally {
            setHealthInitializing(false);
          }
        }
      }
    });
    return () => sub.remove();
  }, [permissionGranted]);

  async function bootstrap() {
    // Phase 1: load persisted data from AsyncStorage — very fast (~50ms).
    // Set loading=false as soon as this completes so the UI renders immediately
    // with real labs data and a computed wellness score.
    try {
      const [savedState, savedProfile] = await Promise.all([
        loadAppState(),
        loadUserProfile(),
      ]);
      setAppState(savedState);
      setUserProfile(savedProfile);
    } catch {
      // Proceed with defaults if storage fails
    } finally {
      setLoading(false);
    }

    // Phase 2: initialize Health Connect in the background without blocking
    // the UI. healthInitializing drives the "SYNCING" indicator in the header.
    try {
      const initialized = await withTimeout(initializeHealthConnect(), 10000, false);
      if (initialized) {
        let granted = await checkGrantedPermissions();
        if (!granted) {
          granted = await withTimeout(requestHealthPermissions(), 90000, false);
        }
        setPermissionGranted(granted);
        if (granted) {
          const data = await readAllHealthData();
          setHealthData(data);
        }
      }
    } catch {
      // Health Connect errors are non-fatal
    } finally {
      initializedRef.current = true;
      setHealthInitializing(false);
    }
  }

  async function refresh() {
    try {
      const data = await readAllHealthData();
      setHealthData(data);
    } catch {}
  }

  function updateAppState(newState: AppState) {
    setAppState(newState);
    saveAppState(newState);
  }

  function updateUserProfile(profile: UserProfile) {
    setUserProfile(profile);
    saveUserProfile(profile);
  }

  return (
    <HealthContext.Provider
      value={{
        healthData,
        appState,
        userProfile,
        loading,
        healthInitializing,
        permissionGranted,
        refresh,
        updateAppState,
        updateUserProfile,
        openPermissions: async () => {
          setHealthInitializing(true);
          try {
            const granted = await requestHealthPermissions();
            setPermissionGranted(granted);
            if (granted) {
              const data = await readAllHealthData();
              setHealthData(data);
            } else {
              openHealthConnectPermissions();
            }
          } finally {
            setHealthInitializing(false);
          }
        },
      }}
    >
      {children}
    </HealthContext.Provider>
  );
}
