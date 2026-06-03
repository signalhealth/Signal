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
  tabBar: string;
  tabBarBorder: string;
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
}

export const darkTheme: ThemeColors = {
  bg: "#07070D",
  card: "#0D1B36",
  cardAlt: "#0A1628",
  cardBorder: "rgba(0,102,204,0.4)",
  text: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.6)",
  textTertiary: "rgba(255,255,255,0.35)",
  textQuaternary: "rgba(255,255,255,0.2)",
  accent: "#0066CC",
  accentBright: "#60AFFF",
  tabBar: "rgba(17,17,24,0.96)",
  tabBarBorder: "rgba(0,102,204,0.2)",
  inputBg: "#0A1628",
  inputBorder: "#1A3A5C",
  insightCard: "#0A2050",
  insightCardBorder: "rgba(0,102,204,0.4)",
  pillBorder: "rgba(0,102,204,0.4)",
  pillActiveBg: "#0066CC",
  sectionBorder: "#182030",
  green: "#00D084",
  amber: "#F5A623",
  red: "#FF3B30",
};

export const lightTheme: ThemeColors = {
  bg: "#F0F4F8",
  card: "#FFFFFF",
  cardAlt: "#F8FAFC",
  cardBorder: "rgba(0,102,204,0.15)",
  text: "#0A1628",
  textSecondary: "rgba(10,22,40,0.65)",
  textTertiary: "rgba(10,22,40,0.45)",
  textQuaternary: "rgba(10,22,40,0.25)",
  accent: "#0066CC",
  accentBright: "#1C69D4",
  tabBar: "rgba(255,255,255,0.97)",
  tabBarBorder: "rgba(0,102,204,0.15)",
  inputBg: "#EFF3F8",
  inputBorder: "#C0CCD8",
  insightCard: "#E8F2FF",
  insightCardBorder: "rgba(0,102,204,0.2)",
  pillBorder: "rgba(0,102,204,0.3)",
  pillActiveBg: "#0066CC",
  sectionBorder: "#E0E8F0",
  green: "#00A86B",
  amber: "#D4881A",
  red: "#CC2200",
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
