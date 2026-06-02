import React from "react";
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from "react-native";
import Svg, { Circle, Path, G } from "react-native-svg";

interface HeaderProps {
  loading?: boolean;
  onProfilePress: () => void;
}

function GearIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Header({ loading = false, onProfilePress }: HeaderProps) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={styles.header}>
      <View style={styles.logoRow}>
        <Svg width={32} height={26} viewBox="0 0 56 44" fill="none">
          <Circle cx={28} cy={36} r={4} fill="#1C69D4" />
          <Path
            d="M17 27 Q28 15 39 27"
            stroke="#1C69D4"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M10 19 Q28 4 46 19"
            stroke="#1C69D4"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
            opacity={0.55}
          />
          <Path
            d="M3 12 Q28 -6 53 12"
            stroke="#1C69D4"
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
            opacity={0.25}
          />
        </Svg>
        <Text style={styles.title}>Signal</Text>
      </View>
      <View style={styles.right}>
        {loading && (
          <Text style={styles.syncText}>SYNCING</Text>
        )}
        <Animated.View style={[styles.dot, { opacity: pulseAnim }]} />
        <TouchableOpacity onPress={onProfilePress} style={styles.gearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <GearIcon />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    backgroundColor: "rgba(9,9,14,0.96)",
    borderBottomWidth: 1,
    borderBottomColor: "#182030",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.4,
    marginLeft: 10,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  syncText: {
    fontSize: 9,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0066CC",
    shadowColor: "#0066CC",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  gearBtn: {
    padding: 2,
  },
});
