import React, { useContext } from "react";
import {
  View,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";

import { HealthProvider, HealthContext } from "./src/context/HealthContext";
import { Header } from "./src/components/Header";
import { ProfileModal } from "./src/components/ProfileModal";
import { ProgressScreen } from "./src/screens/ProgressScreen";
import { RecoveryScreen } from "./src/screens/RecoveryScreen";
import { FuelScreen } from "./src/screens/FuelScreen";
import { LabsScreen } from "./src/screens/LabsScreen";

const Tab = createBottomTabNavigator();

// ── Tab icons ─────────────────────────────────────────────────────

function ProgressIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 18.5l6-6 4 4L22 6.92"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={3.5} cy={18.5} r={1.5} fill={color} />
      <Circle cx={9.5} cy={12.5} r={1.5} fill={color} />
      <Circle cx={13.5} cy={16.5} r={1.5} fill={color} />
      <Circle cx={22} cy={7} r={1.5} fill={color} />
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
      <Path
        d="M3 3h18M3 3v14a2 2 0 002 2h14a2 2 0 002-2V3M8 3v4h8V3M12 11v6M9 14h6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

// ── App Shell ─────────────────────────────────────────────────────

function PermissionsPrompt() {
  const { openPermissions } = useContext(HealthContext);
  return (
    <View style={styles.permissionsContainer}>
      <Text style={styles.permissionsTitle}>Connect Health Data</Text>
      <Text style={styles.permissionsBody}>
        Signal reads your health data directly from Health Connect on your
        device — no login required.{"\n\n"}Tap below to grant Health Connect
        permissions.
      </Text>
      <TouchableOpacity style={styles.permissionsButton} onPress={openPermissions}>
        <Text style={styles.permissionsButtonText}>Open Health Connect</Text>
      </TouchableOpacity>
    </View>
  );
}

function AppShell() {
  const { loading, permissionGranted } = useContext(HealthContext);
  const insets = useSafeAreaInsets();
  const [showProfile, setShowProfile] = React.useState(false);

  return (
    <View style={styles.shell}>
      <StatusBar barStyle="light-content" backgroundColor="#07070D" />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <Header loading={loading} onProfilePress={() => setShowProfile(true)} />
      </SafeAreaView>
      <ProfileModal visible={showProfile} onClose={() => setShowProfile(false)} />
      {loading ? (
        <View style={styles.permissionsContainer}>
          <ActivityIndicator color="#0066CC" size="large" />
        </View>
      ) : !permissionGranted ? (
        <PermissionsPrompt />
      ) : null}
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: [styles.tabBar, { paddingBottom: insets.bottom + 6, height: 60 + insets.bottom }],
          tabBarActiveTintColor: "#0066CC",
          tabBarInactiveTintColor: "rgba(255,255,255,0.35)",
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({ color }) => {
            if (route.name === "Progress") return <ProgressIcon color={color} />;
            if (route.name === "Recovery") return <RecoveryIcon color={color} />;
            if (route.name === "Fuel") return <FuelIcon color={color} />;
            if (route.name === "Labs") return <LabsIcon color={color} />;
            return null;
          },
        })}
      >
        <Tab.Screen name="Progress" component={ProgressScreen} />
        <Tab.Screen name="Recovery" component={RecoveryScreen} />
        <Tab.Screen name="Fuel" component={FuelScreen} />
        <Tab.Screen name="Labs" component={LabsScreen} />
      </Tab.Navigator>
    </View>
  );
}

// ── Root ──────────────────────────────────────────────────────────

export default function App() {
  return (
    <SafeAreaProvider>
      <HealthProvider>
        <NavigationContainer>
          <AppShell />
        </NavigationContainer>
      </HealthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#07070D",
  },
  safeArea: {
    backgroundColor: "rgba(9,9,14,0.96)",
  },
  tabBar: {
    backgroundColor: "rgba(17,17,24,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,102,204,0.25)",
    paddingTop: 10,
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
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  permissionsBody: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 32,
  },
  permissionsButton: {
    backgroundColor: "#0066CC",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  permissionsButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
