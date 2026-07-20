import React, { useContext, useEffect } from "react";
import {
  View,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  PanResponder,
  Platform,
} from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import type { NavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import { requireOptionalNativeModule } from "expo-modules-core";

import { HealthProvider, HealthContext } from "./src/context/HealthContext";
import { ThemeProvider, useTheme, ThemeColors } from "./src/context/ThemeContext";
import { Header } from "./src/components/Header";
import { ProfileModal } from "./src/components/ProfileModal";
import { ProgressScreen } from "./src/screens/ProgressScreen";
import { RecoveryScreen } from "./src/screens/RecoveryScreen";
import { FuelScreen } from "./src/screens/FuelScreen";
import { LabsScreen } from "./src/screens/LabsScreen";
import { calcWellnessScore } from "./src/utils/wellnessScore";
import { WellnessModal } from "./src/components/WellnessModal";
import { useFonts } from "expo-font";
import { FONT_DISPLAY } from "./src/theme/typography";

const Tab = createBottomTabNavigator();

// ── Tab icons ─────────────────────────────────────────────────────

function CalendarIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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

function RecoveryIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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

function FuelIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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

function LabsIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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

function TabBarButton({
  theme,
  style,
  children,
  accessibilityState,
  ...rest
}: BottomTabBarButtonProps & { theme: ThemeColors }) {
  const focused = accessibilityState?.selected;
  return (
    <TouchableOpacity
      {...rest}
      accessibilityState={accessibilityState}
      activeOpacity={0.7}
      style={[
        style,
        styles.tabButton,
        focused && { backgroundColor: theme.tabActiveBg },
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

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
  const [showWellness, setShowWellness] = React.useState(false);
  const initials = userProfile.name ? getInitials(userProfile.name) : "PJ";
  const lastSwipe = React.useRef(0);

  const wellnessBreakdown = React.useMemo(() => {
    return calcWellnessScore({ healthData, appState, userProfile });
  }, [healthData, appState, userProfile]);

  const wellnessScore = wellnessBreakdown.completeness > 0 ? wellnessBreakdown.score : null;

  useEffect(() => {
    if (Platform.OS !== "android") return;
    // Check via the non-throwing lookup first — expo-navigation-bar's own JS
    // entry calls the throwing requireNativeModule() at its top level, which
    // Metro's dev overlay surfaces as a red screen even when the caller (us)
    // wraps the import in try/catch. Skipping the import entirely until the
    // native module is registered avoids that path until the next native build.
    if (!requireOptionalNativeModule("ExpoNavigationBar")) return;
    try {
      const NavigationBar = require("expo-navigation-bar");
      NavigationBar.setBackgroundColorAsync(theme.hero).catch(() => {});
      NavigationBar.setButtonStyleAsync("light").catch(() => {});
    } catch {
      // Defensive fallback — should not trigger given the check above.
    }
  }, [theme.hero]);

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
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.safeArea, { backgroundColor: theme.hero, paddingTop: insets.top }]}>
        <Header
          loading={loading}
          onLogoPress={() => navigationRef.navigate("Today")}
          onProfilePress={() => setShowProfile(true)}
          onScorePress={() => setShowWellness(true)}
          theme={theme}
          wellnessScore={wellnessScore}
        />
      </View>
      <ProfileModal visible={showProfile} onClose={() => setShowProfile(false)} />
      <WellnessModal visible={showWellness} onClose={() => setShowWellness(false)} breakdown={wellnessBreakdown} />
      {!loading && !permissionGranted && <PermissionsPrompt />}
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
          tabBarActiveTintColor: theme.gradientMid,
          tabBarInactiveTintColor: theme.textTertiary,
          tabBarShowLabel: false,
          tabBarItemStyle: styles.tabItem,
          tabBarButton: (props) => <TabBarButton {...props} theme={theme} />,
          tabBarIcon: ({ color }) => {
            const size = 27;
            if (route.name === "Today") return <CalendarIcon color={color} size={size} />;
            if (route.name === "Recovery") return <RecoveryIcon color={color} size={size} />;
            if (route.name === "Fuel") return <FuelIcon color={color} size={size} />;
            if (route.name === "Labs") return <LabsIcon color={color} size={size} />;
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
  const [fontsLoaded] = useFonts({
    [FONT_DISPLAY]: require("./assets/fonts/SpaceGrotesk_700Bold.ttf"),
  });
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
    paddingTop: 14,
  },
  tabItem: {
    flex: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
    marginTop: -8,
    borderRadius: 18,
    paddingVertical: 12,
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
