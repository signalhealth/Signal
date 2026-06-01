import React, { useState, useContext } from "react";
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

const BASE_LABS: Array<Omit<LabResult, "id">> = [
  { date: "2026-04", name: "LDL Cholesterol", value: "189", reference: "<100", status: "red" },
  { date: "2026-04", name: "Lp(a)", value: "108.6", reference: "0–30", status: "red" },
  { date: "2026-04", name: "Estradiol (E2)", value: "<5", reference: "11.3–43.2", status: "red" },
  { date: "2026-04", name: "Total Cholesterol", value: "265", reference: "<200", status: "red" },
  { date: "2026-04", name: "ApoB", value: "123", reference: "66–133", status: "amber" },
  { date: "2026-04", name: "Lp-PLA2", value: "234", reference: "<225", status: "amber" },
  { date: "2026-04", name: "Testosterone Total", value: "446", reference: "238–1048", status: "amber" },
  { date: "2026-04", name: "Hematocrit", value: "48.3", reference: "38.3–48.6", status: "amber" },
  { date: "2026-04", name: "Vitamin D", value: "35", reference: "30–100", status: "amber" },
  { date: "2026-04", name: "DHEA-S", value: "118", reference: "88.9–427", status: "amber" },
  { date: "2026-04", name: "HbA1c", value: "5.2", reference: "<5.7", status: "green" },
  { date: "2026-04", name: "Fasting Insulin", value: "5.9", reference: "<10", status: "green" },
  { date: "2026-04", name: "Triglycerides", value: "76", reference: "<150", status: "green" },
  { date: "2026-04", name: "HDL", value: "63", reference: ">60", status: "green" },
  { date: "2026-04", name: "PSA", value: "0.423", reference: "<4.0", status: "green" },
  { date: "2026-04", name: "Homocysteine", value: "9.8", reference: "<15", status: "green" },
  { date: "2026-04", name: "Cortisol", value: "16.2", reference: "6–18.4", status: "green" },
];

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

function LabRow({
  lab,
  onDelete,
}: {
  lab: Omit<LabResult, "id"> & { id?: string };
  onDelete?: () => void;
}) {
  const cfg = STATUS_CONFIG[lab.status];
  return (
    <View style={styles.labRow}>
      <View style={styles.labLeft}>
        <Text style={styles.labName}>{lab.name}</Text>
        <Text style={styles.labRef}>ref {lab.reference}</Text>
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
  const [labDate, setLabDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [labName, setLabName] = useState("");
  const [labValue, setLabValue] = useState("");
  const [labRef, setLabRef] = useState("");
  const [labStatus, setLabStatus] = useState<"green" | "amber" | "red">(
    "green"
  );

  const allLabs = [
    ...BASE_LABS.map((l, i) => ({ ...l, id: `base-${i}` })),
    ...appState.labs,
  ];

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
    const updated = {
      ...appState,
      labs: appState.labs.filter((l) => l.id !== id),
    };
    updateAppState(updated);
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
      <Card>
        <Text style={[styles.sectionLabel, { color: "#FF3B30" }]}>
          FLAGGED
        </Text>
        {allLabs
          .filter((l) => l.status === "red")
          .map((lab, i) => (
            <LabRow
              key={lab.id || i}
              lab={lab}
              onDelete={
                lab.id?.startsWith("custom-")
                  ? () => deleteLab(lab.id!)
                  : undefined
              }
            />
          ))}
      </Card>

      {/* Monitor */}
      <Card>
        <Text style={[styles.sectionLabel, { color: "#F5A623" }]}>
          MONITOR
        </Text>
        {allLabs
          .filter((l) => l.status === "amber")
          .map((lab, i) => (
            <LabRow
              key={lab.id || i}
              lab={lab}
              onDelete={
                lab.id?.startsWith("custom-")
                  ? () => deleteLab(lab.id!)
                  : undefined
              }
            />
          ))}
      </Card>

      {/* Optimal */}
      <Card>
        <Text style={[styles.sectionLabel, { color: "#00D084" }]}>
          OPTIMAL
        </Text>
        {allLabs
          .filter((l) => l.status === "green")
          .map((lab, i) => (
            <LabRow
              key={lab.id || i}
              lab={lab}
              onDelete={
                lab.id?.startsWith("custom-")
                  ? () => deleteLab(lab.id!)
                  : undefined
              }
            />
          ))}
      </Card>

      {/* Add Result */}
      <Card>
        <Text style={styles.sectionLabel}>ADD RESULT</Text>
        <View style={styles.formRow}>
          <TextInput
            style={[styles.formInput, { flex: 1, marginRight: 8 }]}
            placeholder="Date (YYYY-MM-DD)"
            placeholderTextColor="#5A7090"
            value={labDate}
            onChangeText={setLabDate}
          />
          <TextInput
            style={[styles.formInput, { flex: 1 }]}
            placeholder="Marker name"
            placeholderTextColor="#5A7090"
            value={labName}
            onChangeText={setLabName}
          />
        </View>
        <View style={styles.formRow}>
          <TextInput
            style={[styles.formInput, { flex: 1, marginRight: 8 }]}
            placeholder="Value"
            placeholderTextColor="#5A7090"
            value={labValue}
            onChangeText={setLabValue}
          />
          <TextInput
            style={[styles.formInput, { flex: 1 }]}
            placeholder="Reference range"
            placeholderTextColor="#5A7090"
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

        {appState.labs.length > 0 && (
          <View style={{ marginTop: 8 }}>
            {appState.labs.map((lab) => (
              <View key={lab.id} style={styles.customLabItem}>
                <Text style={styles.customLabText}>
                  {lab.date} · {lab.name}: {lab.value}
                </Text>
                <TouchableOpacity onPress={() => deleteLab(lab.id)}>
                  <Text style={styles.delBtn}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07070D" },
  content: { padding: 16, paddingBottom: 110, gap: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 14,
    color: "rgba(255,255,255,0.35)",
  },
  labRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,102,204,0.25)",
  },
  labLeft: { flex: 1 },
  labName: { fontSize: 15, color: "#FFFFFF", fontWeight: "500" },
  labRef: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    marginTop: 3,
    letterSpacing: 0.3,
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
    color: "rgba(255,255,255,0.3)",
    paddingHorizontal: 4,
  },

  formRow: { flexDirection: "row", marginBottom: 8 },
  formInput: {
    backgroundColor: "#0A1628",
    borderWidth: 1,
    borderColor: "#1A3A5C",
    borderRadius: 8,
    padding: 9,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#FFFFFF",
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
    borderColor: "rgba(0,102,204,0.4)",
    alignItems: "center",
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },
  addBtn: {
    backgroundColor: "#0066CC",
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
    borderBottomColor: "#182030",
  },
  customLabText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
  },
});
