import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { ThemeColors } from "../context/ThemeContext";
import { FONT_DISPLAY } from "../theme/typography";

interface HeaderProps {
  loading?: boolean;
  onLogoPress?: () => void;
  onProfilePress: () => void;
  onScorePress?: () => void;
  theme: ThemeColors;
  initials?: string;
  wellnessScore?: number | null;
}

function wellnessColor(score: number): string {
  if (score >= 80) return "#00D084";
  if (score >= 60) return "#F5A623";
  return "#F11A22";
}

export function Header({
  loading = false,
  onLogoPress,
  onProfilePress,
  onScorePress,
  theme,
  wellnessScore = null,
}: HeaderProps) {
  return (
    <View style={[styles.header, { backgroundColor: theme.hero }]}>
      <TouchableOpacity
        onPress={onLogoPress}
        activeOpacity={onLogoPress ? 0.7 : 1}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 16 }}
      >
        <View style={styles.logoRow}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.appIcon}
          />
          <Text style={styles.title}>Signal</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.right}>
        {loading && (
          <Text style={[styles.syncText, { color: "rgba(255,255,255,0.65)" }]}>SYNCING</Text>
        )}

        {wellnessScore !== null && (
          <TouchableOpacity
            onPress={onScorePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
          >
            <View style={[styles.scoreCircle, { backgroundColor: wellnessColor(wellnessScore) }]}>
              <Text style={styles.scoreText}>{wellnessScore}</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onProfilePress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Image
            source={require("../../assets/profile.jpg")}
            style={styles.avatar}
          />
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
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  appIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 22,
    letterSpacing: -0.4,
    color: "#FFFFFF",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  syncText: {
    fontSize: 9,
    letterSpacing: 0.8,
  },
  scoreCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
});
