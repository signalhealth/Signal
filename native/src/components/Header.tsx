import React from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

interface HeaderProps {
  loading?: boolean;
}

export function Header({ loading = false }: HeaderProps) {
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
        <Animated.View
          style={[styles.dot, { opacity: pulseAnim }]}
        />
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
    gap: 10,
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
});
