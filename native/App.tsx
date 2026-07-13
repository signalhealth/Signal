import React, { useContext } from "react";
import {
  View,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  PanResponder,
} from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import type { NavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";

import { HealthProvider, HealthContext } from "./src/context/HealthContext";
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { Header } from "./src/components/Header";
import { ProfileModal } from "./src/components/ProfileModal";
import { ProgressScreen } from "./src/screens/ProgressScreen";
import { RecoveryScreen } from "./src/screens/RecoveryScreen";
import { FuelScreen } from "./src/screens/FuelScreen";
import { LabsScreen } from "./src/screens/LabsScreen";
import { calcWellnessScore } from "./src/utils/wellnessScore";

const Tab = createBottomTabNavigator();

// ── Tab icons ─────────────────────────────────────────────────────

function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={8} cy={14} r={1} fill={color} />
      <Circle cx={12} cy={14} r={1} fill={color} />
      <Circle cx={16} cy={14} r={1} fill={color} />
      <Circle cx={8} cy={18} r={1} fill={color} />
      <Circle cx={12} cy={18} r={1} fill={color} />
    </Svg>
  );
}

function RecoveryIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FuelIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      {/* pump body */}
      <Path d="M3 22V7a2 2 0 012-2h8a2 2 0 012 2v15" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* base */}
      <Path d="M1 22h16" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* nozzle arm */}
      <Path d="M13 8h3l2 2.5v4.5h-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* display window */}
      <Path d="M6 9h6v4H6z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

function LabsIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 3h6M9 3v8L4 19a1 1 0 001 1h14a1 1 0 001-1L15 11V3M9 3H6M15 3h3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const TAB_ORDER = ["Today", "Recovery", "Fuel", "Labs"] as const;
type TabName = typeof TAB_ORDER[number];

// ── App Shell ─────────────────────────────────────────────────────

function PermissionsPrompt() {
  const { openPermissions } = useContext(HealthContext);
  const { theme } = useTheme();
  return (
    <View style={styles.permissionsContainer}>
      <Text style={[styles.permissionsTitle, { color: theme.text }]}>Connect Health Data</Text>
      <Text style={[styles.permissionsBody, { color: theme.textSecondary }]}>
        Tap below to open Health Connect, then:{"\n\n"}
        1. Tap <Text style={{ color: theme.text }}>App permissions</Text>{"\n"}
        2. Tap <Text style={{ color: theme.text }}>Signal</Text>{"\n"}
        3. Allow all health categories{"\n\n"}
        Return here — Signal connects automatically.
      </Text>
      <TouchableOpacity style={[styles.permissionsButton, { backgroundColor: theme.accent }]} onPress={openPermissions}>
        <Text style={[styles.permissionsButtonText, { color: theme.text }]}>Open Health Connect</Text>
      </TouchableOpacity>
    </View>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts[0]?.length >= 1) return parts[0].slice(0, 2).toUpperCase();
  return "PJ";
}

function AppShell({ navigationRef }: { navigationRef: NavigationContainerRef<Record<TabName, undefined>> }) {
  const { loading, permissionGranted, userProfile, healthData, appState } = useContext(HealthContext);
  const { theme, isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [showProfile, setShowProfile] = React.useState(false);
  const initials = userProfile.name ? getInitials(userProfile.name) : "PJ";
  const lastSwipe = React.useRef(0);

  const wellnessScore = React.useMemo(() => {
    if (!permissionGranted && !appState.labs.length && !appState.dexa.length) return null;
    const result = calcWellnessScore({ healthData, appState, userProfile });
    return result.completeness > 0 ? result.score : null;
  }, [healthData, appState, userProfile, permissionGranted]);

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 15 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2.5,
    onMoveShouldSetPanResponderCapture: () => false,
    onPanResponderRelease: (_, gs) => {
      const now = Date.now();
      if (now - lastSwipe.current < 400) return;
      const current = navigationRef.getCurrentRoute()?.name;
      const idx = TAB_ORDER.indexOf(current as TabName);
      if (idx === -1) return;
      if (gs.dx < -60 && idx < TAB_ORDER.length - 1) {
        navigationRef.navigate(TAB_ORDER[idx + 1]);
        lastSwipe.current = now;
      } else if (gs.dx > 60 && idx > 0) {
        navigationRef.navigate(TAB_ORDER[idx - 1]);
        lastSwipe.current = now;
      }
    },
  }), []);

  return (
    <View style={[styles.shell, { backgroundColor: theme.bg }]} {...panResponder.panHandlers}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.bg} />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.tabBar }]} edges={["top"]}>
        <Header
          loading={loading}
          onLogoPress={() => navigationRef.navigate("Today")}
          onProfilePress={() => setShowProfile(true)}
          onThemeToggle={toggleTheme}
          isDark={isDark}
          theme={theme}
          initials={initials}
          wellnessScore={wellnessScore}
        />
      </SafeAreaView>
      <ProfileModal visible={showProfile} onClose={() => setShowProfile(false)} />
      {loading ? (
        <View style={styles.permissionsContainer}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : !permissionGranted ? (
        <PermissionsPrompt />
      ) : null}
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: [
            styles.tabBar,
            {
              backgroundColor: theme.tabBar,
              borderTopColor: theme.tabBarBorder,
              paddingBottom: insets.bottom + 6,
              height: 60 + insets.bottom,
            },
          ],
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textTertiary,
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          tabBarIcon: ({ color }) => {
            if (route.name === "Today") return <CalendarIcon color={color} />;
            if (route.name === "Recovery") return <RecoveryIcon color={color} />;
            if (route.name === "Fuel") return <FuelIcon color={color} />;
            if (route.name === "Labs") return <LabsIcon color={color} />;
            return null;
          },
        })}
      >
        <Tab.Screen name="Today" component={ProgressScreen} />
        <Tab.Screen name="Recovery" component={RecoveryScreen} />
        <Tab.Screen name="Fuel" component={FuelScreen} />
        <Tab.Screen name="Labs" component={LabsScreen} />
      </Tab.Navigator>
    </View>
  );
}

// ── Root ──────────────────────────────────────────────────────────

export default function App() {
  const navigationRef = useNavigationContainerRef<Record<TabName, undefined>>();
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <HealthProvider>
          <NavigationContainer ref={navigationRef}>
            <AppShell navigationRef={navigationRef} />
          </NavigationContainer>
        </HealthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  safeArea: {},
  tabBar: {
    borderTopWidth: 1,
    paddingTop: 10,
  },
  tabItem: {
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 2,
  },
  permissionsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  permissionsTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  permissionsBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 32,
  },
  permissionsButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  permissionsButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
