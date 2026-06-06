import React, { useState, useContext, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { HealthContext } from "../context/HealthContext";
import { Card } from "../components/MetricCard";
import { MarkdownResult } from "../components/MarkdownResult";
import { LabResult } from "../types/health";
import { analyzeLab } from "../services/anthropic";
import { getAnthropicKey } from "../services/storage";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";

const STATUS_CONFIG = {
  red: {
    bg: "rgba(255,59,48,0.15)",
    text: "#FF3B30",
    border: "rgba(233,40,58,0.25)",
    headerColor: "#FF3B30",
    sectionTitle: "Flagged",
  },
  amber: {
    bg: "rgba(245,166,35,0.1)",
    text: "#F5A623",
    border: "rgba(245,166,35,0.25)",
    badgeLabel: "MONITOR",
    headerColor: "#F5A623",
    sectionTitle: "Monitor",
  },
  green: {
    bg: "rgba(0,208,132,0.15)",
    text: "#00D084",
    border: "rgba(0,200,120,0.25)",
    badgeLabel: "OK",
    headerColor: "#00D084",
    sectionTitle: "Optimal",
  },
} as const;

// Markers where lower is better (↓ shown as green improvement)
const LOWER_IS_BETTER = new Set([
  "LDL",
  "LDL Cholesterol",
  "Total Cholesterol",
  "Lp(a)",
  "Lipoprotein(a)",
  "Body Fat",
  "Triglycerides",
  "ApoB",
  "Lp-PLA2",
  "CRP",
  "Homocysteine",
  "BUN",
  "BUN/Creat Ratio",
  "Alb/Glob Ratio",
  "PSA, Total",
  "Insulin",
  "Hemoglobin A1C",
]);

function getTrendArrow(
  lab: LabResult,
  allLabs: LabResult[]
): { arrow: string; delta: string; color: string } | null {
  // Find the most recent prior entry with the same name
  const sameMarker = allLabs
    .filter((l) => l.name === lab.name && l.id !== lab.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!sameMarker.length) return null;

  const prev = sameMarker[0];
  const currNum = parseFloat(lab.value);
  const prevNum = parseFloat(prev.value);
  if (isNaN(currNum) || isNaN(prevNum)) return null;

  const diff = currNum - prevNum;
  if (diff === 0) return null;

  const lowerBetter = LOWER_IS_BETTER.has(lab.name);
  const improved = lowerBetter ? diff < 0 : diff > 0;
  const arrow = diff < 0 ? "↓" : "↑";
  const absDiff = Math.abs(diff).toFixed(1).replace(/\.0$/, "");
  return {
    arrow,
    delta: `${arrow} ${absDiff}`,
    color: improved ? "#00D084" : "#F5A623",
  };
}

function LabRow({
  lab,
  allLabs,
  onDelete,
  onPress,
  selected,
  styles,
}: {
  lab: LabResult;
  allLabs: LabResult[];
  onDelete: () => void;
  onPress: () => void;
  selected: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  const cfg = STATUS_CONFIG[lab.status];
  const trend = getTrendArrow(lab, allLabs);
  const badgeLabel =
    lab.status === "red"
      ? lab.direction === "low" ? "LOW" : "HIGH"
      : lab.status === "amber"
      ? "MONITOR"
      : "OK";
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.labRow, selected && styles.labRowSelected]}
      activeOpacity={0.7}
    >
      <View style={styles.labLeft}>
        <Text style={styles.labName}>{lab.name}</Text>
        <Text style={styles.labRef}>ref {lab.reference}</Text>
        {trend && (
          <Text style={[styles.labTrend, { color: trend.color }]}>
            {trend.delta} from last
          </Text>
        )}
      </View>
      <View style={styles.labRight}>
        <Text style={[styles.labValue, { color: cfg.text }]}>
          {lab.value}
        </Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: cfg.bg, borderColor: cfg.border },
          ]}
        >
          <Text style={[styles.badgeText, { color: cfg.text }]}>
            {badgeLabel}
          </Text>
        </View>
        {onDelete && (
          <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onDelete(); }}>
            <Text style={styles.delBtn}>×</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function LabsScreen() {
  const { appState, updateAppState, userProfile } = useContext(HealthContext);
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const [labDate, setLabDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [labName, setLabName] = useState("");
  const [labValue, setLabValue] = useState("");
  const [labRef, setLabRef] = useState("");
  const [labStatus, setLabStatus] = useState<"green" | "amber" | "red">("green");
  const [labDirection, setLabDirection] = useState<"high" | "low">("high");

  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [labAnalysis, setLabAnalysis] = useState("Tap any lab result above, then tap Analyze for a plain-language explanation and actionable guidance.");
  const [labAnalysisLoading, setLabAnalysisLoading] = useState(false);

  const allLabs = [...appState.labs].sort((a, b) => b.date.localeCompare(a.date));

  function addLab() {
    if (!labName.trim() || !labValue.trim()) {
      Alert.alert("Invalid", "Please enter a marker name and value.");
      return;
    }
    const newLab: LabResult = {
      id: `custom-${Date.now()}`,
      date: labDate,
      name: labName.trim(),
      value: labValue.trim(),
      reference: labRef.trim(),
      status: labStatus,
      ...(labStatus === "red" && { direction: labDirection }),
    };
    const updated = {
      ...appState,
      labs: [...appState.labs, newLab],
    };
    updateAppState(updated);
    setLabName("");
    setLabValue("");
    setLabRef("");
  }

  function deleteLab(id: string) {
    const lab = appState.labs.find((l) => l.id === id);
    Alert.alert(
      `Delete ${lab?.name ?? "lab result"}?`,
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const updated = {
              ...appState,
              labs: appState.labs.filter((l) => l.id !== id),
            };
            updateAppState(updated);
          },
        },
      ]
    );
  }

  async function handleAnalyzeLab() {
    const lab = allLabs.find((l) => l.id === selectedLabId);
    if (!lab) {
      setLabAnalysis("Tap a lab result first, then tap Analyze.");
      return;
    }
    const key = await getAnthropicKey();
    if (!key) {
      setLabAnalysis("Add your Anthropic API key in ⚙ settings (top right) to enable AI analysis.");
      return;
    }
    setLabAnalysisLoading(true);
    setLabAnalysis("Analyzing…");
    const result = await analyzeLab(key, lab, allLabs, userProfile);
    setLabAnalysisLoading(false);
    if (result.authError) {
      setLabAnalysis("API key rejected — update it in ⚙ settings (top right).");
    } else if (result.success && result.text) {
      setLabAnalysis(result.text);
    } else {
      setLabAnalysis(result.error || "An error occurred.");
    }
  }

  const selectedLab = allLabs.find((l) => l.id === selectedLabId);

  const StatusToggle = ({
    value,
    label,
    color,
  }: {
    value: "green" | "amber" | "red";
    label: string;
    color: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.statusBtn,
        labStatus === value && {
          borderColor: color,
          backgroundColor: `${color}22`,
        },
      ]}
      onPress={() => setLabStatus(value)}
    >
      <Text
        style={[
          styles.statusBtnText,
          labStatus === value && { color },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Flagged */}
      {allLabs.some((l) => l.status === "red") && (
        <Card>
          <Text style={[styles.sectionLabel, { color: theme.red }]}>FLAGGED</Text>
          {allLabs.filter((l) => l.status === "red").map((lab, i) => (
            <LabRow
              key={lab.id || i}
              lab={lab}
              allLabs={allLabs}
              onDelete={() => deleteLab(lab.id)}
              onPress={() => setSelectedLabId(lab.id === selectedLabId ? null : lab.id)}
              selected={lab.id === selectedLabId}
              styles={styles}
            />
          ))}
        </Card>
      )}

      {/* Monitor */}
      {allLabs.some((l) => l.status === "amber") && (
        <Card>
          <Text style={[styles.sectionLabel, { color: theme.amber }]}>MONITOR</Text>
          {allLabs.filter((l) => l.status === "amber").map((lab, i) => (
            <LabRow
              key={lab.id || i}
              lab={lab}
              allLabs={allLabs}
              onDelete={() => deleteLab(lab.id)}
              onPress={() => setSelectedLabId(lab.id === selectedLabId ? null : lab.id)}
              selected={lab.id === selectedLabId}
              styles={styles}
            />
          ))}
        </Card>
      )}

      {/* Optimal */}
      {allLabs.some((l) => l.status === "green") && (
        <Card>
          <Text style={[styles.sectionLabel, { color: theme.green }]}>OPTIMAL</Text>
          {allLabs.filter((l) => l.status === "green").map((lab, i) => (
            <LabRow
              key={lab.id || i}
              lab={lab}
              allLabs={allLabs}
              onDelete={() => deleteLab(lab.id)}
              onPress={() => setSelectedLabId(lab.id === selectedLabId ? null : lab.id)}
              selected={lab.id === selectedLabId}
              styles={styles}
            />
          ))}
        </Card>
      )}

      {/* Signal Lab Advisor */}
      <View style={styles.advisorCard}>
        <Text style={styles.advisorLabel}>SIGNAL LAB ADVISOR</Text>
        {selectedLab && (
          <Text style={styles.selectedLabName}>
            {selectedLab.name} · {selectedLab.value}
            {selectedLab.status !== "green" ? (selectedLab.direction === "low" ? " ↓ LOW" : " ↑ HIGH") : ""}
          </Text>
        )}
        <MarkdownResult theme={theme} fontSize={13}>{labAnalysis}</MarkdownResult>
        <TouchableOpacity
          style={[styles.analyzeBtn, (!selectedLabId || labAnalysisLoading) && { opacity: 0.5 }]}
          onPress={handleAnalyzeLab}
          disabled={!selectedLabId || labAnalysisLoading}
        >
          <Text style={styles.analyzeBtnText}>
            {labAnalysisLoading ? "ANALYZING..." : selectedLabId ? `ANALYZE ${selectedLab?.name?.toUpperCase()}` : "SELECT A MARKER ABOVE"}
          </Text>
        </TouchableOpacity>
      </View>

      {allLabs.length === 0 && (
        <Card>
          <Text style={styles.sectionLabel}>LAB RESULTS</Text>
          <Text style={styles.emptyNote}>
            No lab results yet. Add your first result below.
          </Text>
        </Card>
      )}

      {/* Add Result */}
      <Card>
        <Text style={styles.sectionLabel}>ADD RESULT</Text>
        <View style={styles.formRow}>
          <TextInput
            style={[styles.formInput, { flex: 1, marginRight: 8 }]}
            placeholder="Date (YYYY-MM-DD)"
            placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
            value={labDate}
            onChangeText={setLabDate}
          />
          <TextInput
            style={[styles.formInput, { flex: 1 }]}
            placeholder="Marker name"
            placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
            value={labName}
            onChangeText={setLabName}
          />
        </View>
        <View style={styles.formRow}>
          <TextInput
            style={[styles.formInput, { flex: 1, marginRight: 8 }]}
            placeholder="Value"
            placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
            value={labValue}
            onChangeText={setLabValue}
          />
          <TextInput
            style={[styles.formInput, { flex: 1 }]}
            placeholder="Reference range"
            placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
            value={labRef}
            onChangeText={setLabRef}
          />
        </View>

        <View style={styles.statusRow}>
          <StatusToggle value="green" label="✓ Normal" color="#00D084" />
          <StatusToggle value="amber" label="⚠ Monitor" color="#F5A623" />
          <StatusToggle value="red" label="✗ Flagged" color="#FF3B30" />
        </View>

        {labStatus === "red" && (
          <View style={[styles.statusRow, { marginTop: 0 }]}>
            <TouchableOpacity
              style={[styles.statusBtn, labDirection === "high" && { borderColor: "#FF3B30", backgroundColor: "rgba(255,59,48,0.12)" }]}
              onPress={() => setLabDirection("high")}
            >
              <Text style={[styles.statusBtnText, labDirection === "high" && { color: "#FF3B30" }]}>↑ Too High</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusBtn, labDirection === "low" && { borderColor: "#FF3B30", backgroundColor: "rgba(255,59,48,0.12)" }]}
              onPress={() => setLabDirection("low")}
            >
              <Text style={[styles.statusBtnText, labDirection === "low" && { color: "#FF3B30" }]}>↓ Too Low</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.addBtn} onPress={addLab}>
          <Text style={styles.addBtnText}>Add Lab Result</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}

function makeStyles(theme: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, paddingBottom: 110, gap: 12 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: 14,
      color: theme.textTertiary,
    },
    labRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: theme.cardBorder,
      borderRadius: 8,
      paddingHorizontal: 4,
      marginHorizontal: -4,
    },
    labRowSelected: {
      backgroundColor: isDark ? "rgba(0,102,204,0.12)" : "rgba(0,102,204,0.07)",
      borderBottomColor: "transparent",
    },
    labLeft: { flex: 1 },
    labName: { fontSize: 15, color: theme.text, fontWeight: "500" },
    labRef: {
      fontSize: 12,
      color: theme.textTertiary,
      marginTop: 3,
      letterSpacing: 0.3,
    },
    labTrend: {
      fontSize: 11,
      fontWeight: "600",
      marginTop: 3,
      letterSpacing: 0.2,
    },
    labRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    labValue: {
      fontWeight: "700",
      fontSize: 15,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 5,
      borderWidth: 1,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    delBtn: {
      fontSize: 18,
      color: theme.textTertiary,
      paddingHorizontal: 4,
    },

    formRow: { flexDirection: "row", marginBottom: 8 },
    formInput: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      padding: 9,
      paddingHorizontal: 12,
      fontSize: 13,
      color: theme.text,
    },
    statusRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 8,
    },
    statusBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.pillBorder,
      alignItems: "center",
    },
    statusBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    addBtn: {
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 4,
    },
    addBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
    customLabItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.sectionBorder,
    },
    customLabText: {
      fontSize: 12,
      color: theme.textTertiary,
    },
    emptyNote: {
      fontSize: 13,
      color: theme.textTertiary,
      marginVertical: 8,
    },

    advisorCard: {
      backgroundColor: theme.insightCard,
      borderWidth: 1,
      borderColor: theme.insightCardBorder,
      borderRadius: 16,
      padding: 20,
    },
    advisorLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      color: theme.accent,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    selectedLabName: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 10,
      letterSpacing: 0.3,
    },
    analysisText: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 22,
      minHeight: 60,
      marginBottom: 16,
    },
    analyzeBtn: {
      backgroundColor: theme.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
    },
    analyzeBtnText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 13,
      letterSpacing: 0.8,
    },
  });
}
