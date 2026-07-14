import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WellnessBreakdown } from "../utils/wellnessScore";
import { useTheme } from "../context/ThemeContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  breakdown: WellnessBreakdown;
}

const CATEGORIES: Array<{
  key: keyof WellnessBreakdown["categories"];
  label: string;
  weight: string;
}> = [
  { key: "cardiovascular",  label: "Cardiovascular",      weight: "25%" },
  { key: "metabolic",       label: "Metabolic",            weight: "20%" },
  { key: "fitness",         label: "Fitness",              weight: "20%" },
  { key: "hormonal",        label: "Hormonal",             weight: "15%" },
  { key: "bodyComp",        label: "Body Composition",     weight: "10%" },
  { key: "sleepRecovery",   label: "Sleep / Recovery",     weight: "10%" },
];

function scoreColor(score: number): string {
  if (score >= 80) return "#00D084";
  if (score >= 60) return "#F5A623";
  return "#FF3B30";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 70) return "Fair";
  if (score >= 60) return "Below Average";
  return "Needs Attention";
}

export function WellnessModal({ visible, onClose, breakdown }: Props) {
  const { theme, isDark } = useTheme();
  const sheetBg = isDark ? "#0D1117" : "#FFFFFF";
  const presentCount = Object.values(breakdown.categories).filter((v) => v !== null).length;
  const totalCount = CATEGORIES.length;
  const color = scoreColor(breakdown.score);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: sheetBg, borderColor: theme.tabBarBorder }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: theme.textQuaternary }]} />

          {/* Header row */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: theme.textTertiary }]}>WELLNESS SCORE</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[styles.closeBtn, { color: theme.textTertiary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Big score */}
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreBig, { color }]}>{breakdown.score}</Text>
            <View>
              <Text style={[styles.scoreLabel, { color }]}>{scoreLabel(breakdown.score)}</Text>
              <Text style={[styles.completeness, { color: theme.textTertiary }]}>
                {presentCount}/{totalCount} categories tracked
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {CATEGORIES.map(({ key, label, weight }) => {
              const val = breakdown.categories[key];
              const c = val !== null ? scoreColor(val) : theme.textQuaternary;
              return (
                <View key={key} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={[styles.catLabel, { color: theme.text }]}>{label}</Text>
                    <Text style={[styles.catWeight, { color: theme.textTertiary }]}>{weight}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    {val !== null ? (
                      <>
                        <Text style={[styles.catScore, { color: c }]}>{Math.round(val)}</Text>
                        <View style={[styles.barTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }]}>
                          <View
                            style={[styles.barFill, { width: `${Math.round(val)}%`, backgroundColor: c }]}
                          />
                        </View>
                      </>
                    ) : (
                      <Text style={[styles.noData, { color: theme.textQuaternary }]}>No data</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  closeBtn: {
    fontSize: 18,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  },
  scoreBig: {
    fontSize: 64,
    fontWeight: "800",
    lineHeight: 68,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  completeness: {
    fontSize: 12,
    marginTop: 3,
  },
  divider: {
    height: 1,
    marginBottom: 16,
  },
  list: {
    gap: 16,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowLeft: {
    width: 140,
  },
  catLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  catWeight: {
    fontSize: 11,
    marginTop: 1,
  },
  rowRight: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  catScore: {
    fontSize: 14,
    fontWeight: "700",
    width: 28,
    textAlign: "right",
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  noData: {
    fontSize: 12,
  },
});
