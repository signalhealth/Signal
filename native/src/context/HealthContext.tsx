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
};

const defaultAppState: AppState = {
  dexa: [],
  labs: [],
  recovery: [],
  micros: [],
};

export const HealthContext = createContext<HealthContextValue>({
  healthData: emptyHealthData,
  appState: defaultAppState,
  userProfile: DEFAULT_PROFILE,
  loading: false,
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
          setLoading(true);
          try {
            const data = await readAllHealthData();
            setHealthData(data);
          } finally {
            setLoading(false);
          }
        }
      }
    });
    return () => sub.remove();
  }, [permissionGranted]);

  async function bootstrap() {
    setLoading(true);

    const [savedState, savedProfile] = await Promise.all([
      loadAppState(),
      loadUserProfile(),
    ]);
    setAppState(savedState);
    setUserProfile(savedProfile);

    const initialized = await initializeHealthConnect();
    if (initialized) {
      // Check existing grants first (no dialog, no delegate required)
      let granted = await checkGrantedPermissions();
      if (!granted) {
        // Try the permission dialog (works if delegate is set up correctly)
        granted = await requestHealthPermissions();
      }
      setPermissionGranted(granted);
      if (granted) {
        const data = await readAllHealthData();
        setHealthData(data);
      }
    }

    initializedRef.current = true;
    setLoading(false);
  }

  async function refresh() {
    setLoading(true);
    try {
      const data = await readAllHealthData();
      setHealthData(data);
    } finally {
      setLoading(false);
    }
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
        permissionGranted,
        refresh,
        updateAppState,
        updateUserProfile,
        openPermissions: async () => {
          setLoading(true);
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
            setLoading(false);
          }
        },
      }}
    >
      {children}
    </HealthContext.Provider>
  );
}
