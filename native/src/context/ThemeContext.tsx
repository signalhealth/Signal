import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "signal_theme_v1";

export interface ThemeColors {
  bg: string;
  card: string;
  cardAlt: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textQuaternary: string;
  accent: string;
  accentBright: string;
  gradientStart: string;
  gradientMid: string;
  gradientEnd: string;
  hero: string;
  tabBar: string;
  tabBarBorder: string;
  tabActiveBg: string;
  inputBg: string;
  inputBorder: string;
  insightCard: string;
  insightCardBorder: string;
  pillBorder: string;
  pillActiveBg: string;
  sectionBorder: string;
  green: string;
  amber: string;
  red: string;
  gray: string;
}

// BMW / M color system
// Roundel: BMW Blue #0166B1 · Black · White
// Secondary (typography/UI): Dark Blue #031E49 · Gray #6F6F6F
// M Motorsport: M Blue #008AC9 · M Purple/Dark Blue #2B115A · M Red #F11A22

export const darkTheme: ThemeColors = {
  bg: "#000000",
  card: "#031E49",
  cardAlt: "#0B2955",
  cardBorder: "rgba(111,111,111,0.25)",
  text: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.78)",
  textTertiary: "rgba(255,255,255,0.58)",
  textQuaternary: "rgba(255,255,255,0.34)",
  accent: "#0166B1",
  accentBright: "#008AC9",
  gradientStart: "#008AC9",
  gradientMid: "#0166B1",
  gradientEnd: "#2B115A",
  hero: "#031E49",
  tabBar: "rgba(3,30,73,0.96)",
  tabBarBorder: "rgba(111,111,111,0.22)",
  tabActiveBg: "rgba(0,138,201,0.22)",
  inputBg: "#0B2955",
  inputBorder: "rgba(111,111,111,0.3)",
  insightCard: "#031E49",
  insightCardBorder: "rgba(120,60,190,0.5)",
  pillBorder: "rgba(1,102,177,0.4)",
  pillActiveBg: "#0166B1",
  sectionBorder: "rgba(111,111,111,0.22)",
  green: "#00D084",
  amber: "#F5A623",
  red: "#F11A22",
  gray: "#6F6F6F",
};

export const lightTheme: ThemeColors = {
  bg: "#F2F2F3",
  card: "#FFFFFF",
  cardAlt: "#EDEDEE",
  cardBorder: "rgba(111,111,111,0.2)",
  text: "#000000",
  textSecondary: "rgba(0,0,0,0.65)",
  textTertiary: "rgba(0,0,0,0.45)",
  textQuaternary: "rgba(0,0,0,0.25)",
  accent: "#0166B1",
  accentBright: "#008AC9",
  gradientStart: "#008AC9",
  gradientMid: "#0166B1",
  gradientEnd: "#2B115A",
  hero: "#031E49",
  tabBar: "rgba(255,255,255,0.97)",
  tabBarBorder: "rgba(111,111,111,0.22)",
  tabActiveBg: "rgba(1,102,177,0.12)",
  inputBg: "#EFEFF0",
  inputBorder: "rgba(111,111,111,0.35)",
  insightCard: "#F5F0FA",
  insightCardBorder: "rgba(43,17,90,0.25)",
  pillBorder: "rgba(1,102,177,0.3)",
  pillActiveBg: "#0166B1",
  sectionBorder: "rgba(111,111,111,0.18)",
  green: "#00A86B",
  amber: "#D4881A",
  red: "#F11A22",
  gray: "#6F6F6F",
};

interface ThemeContextValue {
  theme: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val === "light") setIsDark(false);
      else setIsDark(true);
    });
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem(THEME_KEY, next ? "dark" : "light");
      return next;
    });
  }

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
