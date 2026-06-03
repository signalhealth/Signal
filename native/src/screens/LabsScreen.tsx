import React, { useState, useContext, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { HealthContext } from "../context/HealthContext";
import { Card } from "../components/MetricCard";
import { LabResult } from "../types/health";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";

const STATUS_CONFIG = {
  red: {
    bg: "rgba(255,59,48,0.15)",
    text: "#FF3B30",
    border: "rgba(233,40,58,0.25)",
    badgeLabel: "HIGH",
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

// Markers where lower is better (show ↓ as improvement)
const LOWER_IS_BETTER = new Set([
  "LDL",
  "LDL Cholesterol",
  "Total Cholesterol",
  "Lp(a)",
  "Body Fat",
  "Triglycerides",
  "ApoB",
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
  styles,
}: {
  lab: LabResult;
  allLabs: LabResult[];
  onDelete: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const cfg = STATUS_CONFIG[lab.status];
  const trend = getTrendArrow(lab, allLabs);
  return (
    <View style={styles.labRow}>
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
            {cfg.badgeLabel}
          </Text>
        </View>
        {onDelete && (
          <TouchableOpacity onPress={onDelete}>
            <Text style={styles.delBtn}>×</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function LabsScreen() {
  const { appState, updateAppState } = useContext(HealthContext);
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);

  const [labDate, setLabDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [labName, setLabName] = useState("");
  const [labValue, setLabValue] = useState("");
  const [labRef, setLabRef] = useState("");
  const [labStatus, setLabStatus] = useState<"green" | "amber" | "red">(
    "green"
  );

  const allLabs = appState.labs;

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
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Flagged */}
      {allLabs.some((l) => l.status === "red") && (
        <Card>
          <Text style={[styles.sectionLabel, { color: theme.red }]}>
            FLAGGED
          </Text>
          {allLabs
            .filter((l) => l.status === "red")
            .map((lab, i) => (
              <LabRow
                key={lab.id || i}
                lab={lab}
                allLabs={allLabs}
                onDelete={() => deleteLab(lab.id)}
                styles={styles}
              />
            ))}
        </Card>
      )}

      {/* Monitor */}
      {allLabs.some((l) => l.status === "amber") && (
        <Card>
          <Text style={[styles.sectionLabel, { color: theme.amber }]}>
            MONITOR
          </Text>
          {allLabs
            .filter((l) => l.status === "amber")
            .map((lab, i) => (
              <LabRow
                key={lab.id || i}
                lab={lab}
                allLabs={allLabs}
                onDelete={() => deleteLab(lab.id)}
                styles={styles}
              />
            ))}
        </Card>
      )}

      {/* Optimal */}
      {allLabs.some((l) => l.status === "green") && (
        <Card>
          <Text style={[styles.sectionLabel, { color: theme.green }]}>
            OPTIMAL
          </Text>
          {allLabs
            .filter((l) => l.status === "green")
            .map((lab, i) => (
              <LabRow
                key={lab.id || i}
                lab={lab}
                allLabs={allLabs}
                onDelete={() => deleteLab(lab.id)}
                styles={styles}
              />
            ))}
        </Card>
      )}

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
    addBtnText: { color: theme.text, fontWeight: "600", fontSize: 14 },
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
  });
}
