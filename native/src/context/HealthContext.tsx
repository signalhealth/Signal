import React, { createContext, useState, useEffect, ReactNode } from "react";
import {
  HealthData,
  AppState,
} from "../types/health";
import {
  initializeHealthConnect,
  requestHealthPermissions,
  openHealthConnectPermissions,
  readAllHealthData,
} from "../services/healthConnect";
import { loadAppState, saveAppState } from "../services/storage";

interface HealthContextValue {
  healthData: HealthData;
  appState: AppState;
  loading: boolean;
  permissionGranted: boolean;
  refresh: () => Promise<void>;
  updateAppState: (state: AppState) => void;
  openPermissions: () => void;
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
  loading: false,
  permissionGranted: false,
  refresh: async () => {},
  updateAppState: () => {},
  openPermissions: () => {},
});

export function HealthProvider({ children }: { children: ReactNode }) {
  const [healthData, setHealthData] = useState<HealthData>(emptyHealthData);
  const [appState, setAppState] = useState<AppState>(defaultAppState);
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    setLoading(true);

    // Load persisted app state
    const savedState = await loadAppState();
    setAppState(savedState);

    const initialized = await initializeHealthConnect();
    if (initialized) {
      const granted = await requestHealthPermissions();
      setPermissionGranted(granted);
      if (granted) {
        const data = await readAllHealthData();
        setHealthData(data);
      }
    }

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

  return (
    <HealthContext.Provider
      value={{
        healthData,
        appState,
        loading,
        permissionGranted,
        refresh,
        updateAppState,
        openPermissions: openHealthConnectPermissions,
      }}
    >
      {children}
    </HealthContext.Provider>
  );
}
