import React from "react";
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from "react-native";
import Svg, { Circle, Path } from "react-native-svg"; // used for logo
import { ThemeColors } from "../context/ThemeContext";

interface HeaderProps {
  loading?: boolean;
  onLogoPress?: () => void;
  onProfilePress: () => void;
  onThemeToggle: () => void;
  isDark: boolean;
  theme: ThemeColors;
  initials?: string;
  wellnessScore?: number | null;
}

function ProfileAvatar({ initials }: { initials: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

function wellnessColor(score: number): string {
  if (score >= 80) return "#00D084";
  if (score >= 60) return "#F5A623";
  return "#FF3B30";
}

export function Header({ loading = false, onLogoPress, onProfilePress, onThemeToggle, isDark, theme, initials = "PJ", wellnessScore = null }: HeaderProps) {
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

  const iconColor = theme.textTertiary;

  return (
    <View style={[styles.header, { backgroundColor: theme.tabBar, borderBottomColor: theme.tabBarBorder }]}>
      <TouchableOpacity
        onPress={onLogoPress}
        activeOpacity={onLogoPress ? 0.7 : 1}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 16 }}
      >
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
          <Text style={[styles.title, { color: theme.text }]}>Signal</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.right}>
        {loading && (
          <Text style={[styles.syncText, { color: theme.textTertiary }]}>SYNCING</Text>
        )}
        <Animated.View style={[styles.dot, { opacity: pulseAnim }]} />
        <TouchableOpacity
          onPress={onThemeToggle}
          style={styles.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 16, color: iconColor }}>{isDark ? "☀" : "☽"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onProfilePress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.avatarWrap}
        >
          {wellnessScore !== null && (
            <View style={[styles.scoreBadge, { backgroundColor: wellnessColor(wellnessScore) }]}>
              <Text style={styles.scoreBadgeText}>{wellnessScore}</Text>
            </View>
          )}
          <ProfileAvatar initials={initials} />
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
    borderBottomWidth: 1,
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
  iconBtn: {
    padding: 2,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#CC2200",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  avatarWrap: {
    position: "relative",
  },
  scoreBadge: {
    position: "absolute",
    top: -7,
    left: -18,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 1,
    minWidth: 22,
    alignItems: "center",
  },
  scoreBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});
