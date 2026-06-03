import React, { useState, useContext, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { HealthContext } from "../context/HealthContext";
import { Card } from "../components/MetricCard";
import { LineChart } from "../components/WeightChart";
import {
  HRV_NORMAL_LOW,
  HRV_NORMAL_HIGH,
  SLEEP_TARGET,
} from "../types/health";

const COLORS = {
  green: "#00D084",
  amber: "#F5A623",
  red: "#FF3B30",
  blue: "#0066CC",
  gray2: "rgba(255,255,255,0.6)",
  gray3: "rgba(255,255,255,0.35)",
};

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function localDateStr(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(iso: string): string {
  const [yr, mm, dd] = iso.split("-").map(Number);
  return `${MONTHS[mm - 1]} ${dd}, ${yr}`;
}

function daysAgoStr(days: number): string {
  return localDateStr(days);
}

export function RecoveryScreen() {
  const { healthData, appState, updateAppState, refresh } = useContext(HealthContext);
  const [hrvDays, setHrvDays] = useState(14);
  const [sleepDays, setSleepDays] = useState(14);
  const [rhrDays, setRhrDays] = useState(14);
  const [recDate, setRecDate] = useState(localDateStr());
  const [recNote, setRecNote] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [])
  );

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  // ── HRV ─────────────────────────────────────────────────────────
  const hrvSorted = [...healthData.hrv].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const cutoffHrv = daysAgoStr(hrvDays);
  const hrvSlice = hrvSorted.filter((d) => d.date >= cutoffHrv);
  const latestHRV = hrvSorted[hrvSorted.length - 1]?.value;
  const hrvPeriodAvg = hrvSlice.length
    ? Math.round(avg(hrvSlice.map((d) => d.value)))
    : latestHRV;

  const hrvBadge =
    latestHRV === undefined
      ? null
      : latestHRV >= HRV_NORMAL_HIGH
      ? { text: `ELEVATED ${HRV_NORMAL_LOW}–${HRV_NORMAL_HIGH}ms`, cls: "green" as const }
      : latestHRV >= HRV_NORMAL_LOW
      ? { text: `IN RANGE ${HRV_NORMAL_LOW}–${HRV_NORMAL_HIGH}ms`, cls: "green" as const }
      : { text: `BELOW ${HRV_NORMAL_LOW}–${HRV_NORMAL_HIGH}ms`, cls: "amber" as const };

  // ── Sleep ────────────────────────────────────────────────────────
  const sleepSorted = [...healthData.sleep].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const cutoffSleep = daysAgoStr(sleepDays);
  const sleepSlice = sleepSorted.filter((d) => d.date >= cutoffSleep);
  const lastNightSleep = sleepSorted[sleepSorted.length - 1]?.value;
  const sleepPeriodAvg = sleepSlice.length
    ? avg(sleepSlice.map((d) => d.value))
    : lastNightSleep;

  const sleepBadge =
    lastNightSleep === undefined
      ? null
      : lastNightSleep >= SLEEP_TARGET
      ? { text: `ON TARGET ${SLEEP_TARGET}H`, cls: "green" as const }
      : lastNightSleep >= 7.0
      ? { text: `NEAR TARGET ${SLEEP_TARGET}H`, cls: "amber" as const }
      : { text: `BELOW ${SLEEP_TARGET}H TARGET`, cls: "red" as const };

  // ── RHR ──────────────────────────────────────────────────────────
  // Deduplicate by date
  const seenRhr = new Map<string, number>();
  for (const pt of healthData.rhr) {
    if (!seenRhr.has(pt.date)) seenRhr.set(pt.date, pt.value);
  }
  const rhrDeduped = Array.from(seenRhr.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const cutoffRhr = daysAgoStr(rhrDays);
  const rhrSlice = rhrDeduped.filter((d) => d.date >= cutoffRhr);
  const latestRHR = rhrDeduped[rhrDeduped.length - 1]?.value;
  const rhrPeriodAvg = rhrSlice.length
    ? Math.round(avg(rhrSlice.map((d) => d.value)))
    : latestRHR;

  const rhrBadge =
    latestRHR === undefined
      ? null
      : latestRHR <= 55
      ? { text: "EXCELLENT ≤55", cls: "green" as const }
      : latestRHR <= 65
      ? { text: "NORMAL 56–65", cls: "amber" as const }
      : { text: "ELEVATED >65", cls: "red" as const };

  // ── Recovery Notes ───────────────────────────────────────────────
  function addRecoveryNote() {
    if (!recNote.trim()) {
      Alert.alert("Empty", "Please enter a note.");
      return;
    }
    const updated = {
      ...appState,
      recovery: [
        ...appState.recovery,
        { date: recDate, note: recNote.trim() },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    };
    updateAppState(updated);
    setRecNote("");
  }

  function deleteRecoveryNote(idx: number) {
    const updated = {
      ...appState,
      recovery: appState.recovery.filter((_, i) => i !== idx),
    };
    updateAppState(updated);
  }

  const BADGE_COLORS = {
    green: { bg: "rgba(0,208,132,0.15)", text: "#00D084", border: "rgba(0,200,120,0.25)" },
    amber: { bg: "rgba(245,166,35,0.1)", text: "#F5A623", border: "rgba(245,166,35,0.25)" },
    red: { bg: "rgba(255,59,48,0.15)", text: "#FF3B30", border: "rgba(233,40,58,0.25)" },
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#60AFFF"
          colors={["#60AFFF"]}
        />
      }
    >
      {/* ── HRV Card ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.lbl}>HEART RATE VARIABILITY</Text>
          <PillGroup value={hrvDays} onChange={setHrvDays} />
        </View>
        <View style={styles.metricRow}>
          <View>
            <View style={styles.numRow}>
              <Text style={styles.numLg}>{hrvPeriodAvg ?? "—"}</Text>
              <Text style={styles.numUnit}>ms · {hrvDays}-day avg</Text>
            </View>
            <Text style={styles.subText}>
              Normal range: {HRV_NORMAL_LOW}–{HRV_NORMAL_HIGH} ms
            </Text>
          </View>
          {hrvBadge && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: BADGE_COLORS[hrvBadge.cls].bg,
                  borderColor: BADGE_COLORS[hrvBadge.cls].border,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: BADGE_COLORS[hrvBadge.cls].text },
                ]}
              >
                {hrvBadge.text}
              </Text>
            </View>
          )}
        </View>
        <LineChart
          data={hrvSlice}
          height={150}
          color="#60AFFF"
          showDots
          dotColorFn={(v) =>
            v >= HRV_NORMAL_LOW && v <= HRV_NORMAL_HIGH
              ? "#60AFFF"
              : v < HRV_NORMAL_LOW
              ? "#FFAA00"
              : "#00D084"
          }
          refLines={[
            { value: HRV_NORMAL_HIGH, color: "rgba(96,175,255,0.3)" },
            { value: HRV_NORMAL_LOW, color: "rgba(96,175,255,0.3)" },
          ]}
          minVal={0}
        />
      </Card>

      {/* ── Sleep Card ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.lbl}>SLEEP DURATION</Text>
          <PillGroup value={sleepDays} onChange={setSleepDays} />
        </View>
        <View style={styles.metricRow}>
          <View>
            <View style={styles.numRow}>
              <Text style={styles.numLg}>
                {sleepPeriodAvg?.toFixed(1) ?? "—"}
              </Text>
              <Text style={styles.numUnit}>hr · {sleepDays}-day avg</Text>
            </View>
          </View>
          {sleepBadge && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: BADGE_COLORS[sleepBadge.cls].bg,
                  borderColor: BADGE_COLORS[sleepBadge.cls].border,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: BADGE_COLORS[sleepBadge.cls].text },
                ]}
              >
                {sleepBadge.text}
              </Text>
            </View>
          )}
        </View>
        <LineChart
          data={sleepSlice}
          height={130}
          barMode
          barColorFn={(v) =>
            v >= 7.5
              ? "rgba(96,175,255,0.8)"
              : v >= 7
              ? "rgba(96,175,255,0.45)"
              : "rgba(255,59,48,0.55)"
          }
          minVal={0}
          maxVal={12}
        />
      </Card>

      {/* ── RHR Card ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.lbl}>RESTING HEART RATE</Text>
          <PillGroup value={rhrDays} onChange={setRhrDays} />
        </View>
        <View style={styles.metricRow}>
          <View>
            <View style={styles.numRow}>
              <Text style={styles.numLg}>{rhrPeriodAvg ?? "—"}</Text>
              <Text style={styles.numUnit}>bpm · {rhrDays}-day avg</Text>
            </View>
          </View>
          {rhrBadge && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: BADGE_COLORS[rhrBadge.cls].bg,
                  borderColor: BADGE_COLORS[rhrBadge.cls].border,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: BADGE_COLORS[rhrBadge.cls].text },
                ]}
              >
                {rhrBadge.text}
              </Text>
            </View>
          )}
        </View>
        <LineChart data={rhrSlice} height={120} color="#60AFFF" minVal={40} />
      </Card>

      {/* ── Recovery Notes ── */}
      <Card>
        <Text style={styles.lbl}>RECOVERY NOTES</Text>
        <View style={styles.formRow}>
          <TextInput
            style={[styles.formInput, { width: 130 }]}
            placeholder="Date"
            placeholderTextColor="#5A7090"
            value={recDate}
            onChangeText={setRecDate}
          />
          <TextInput
            style={[styles.formInput, { flex: 1 }]}
            placeholder="e.g. 79ms — full recovery"
            placeholderTextColor="#5A7090"
            value={recNote}
            onChangeText={setRecNote}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addRecoveryNote}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        {appState.recovery
          .slice()
          .reverse()
          .map((r, i) => (
            <View key={i} style={styles.recItem}>
              <View style={styles.recItemLeft}>
                <Text style={styles.recDate}>{fmtDate(r.date)}</Text>
                <Text style={styles.recNote}>{r.note}</Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  deleteRecoveryNote(appState.recovery.length - 1 - i)
                }
              >
                <Text style={styles.delBtn}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
      </Card>
    </ScrollView>
  );
}

// ── Pill group component ─────────────────────────────────────────

function PillGroup({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={pillStyles.pills}>
      {([14, 30, 60] as const).map((d) => (
        <TouchableOpacity
          key={d}
          onPress={() => onChange(d)}
          style={[pillStyles.pill, value === d && pillStyles.pillOn]}
        >
          <Text
            style={[
              pillStyles.pillText,
              value === d && pillStyles.pillTextOn,
            ]}
          >
            {d}D
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pills: { flexDirection: "row", gap: 4 },
  pill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(0,102,204,0.4)",
    backgroundColor: "transparent",
  },
  pillOn: { backgroundColor: "#0066CC", borderColor: "#0066CC" },
  pillText: { fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
  pillTextOn: { color: "#FFFFFF" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07070D" },
  content: { padding: 16, paddingBottom: 110, gap: 12 },
  lbl: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.35)",
    marginBottom: 0,
    textTransform: "uppercase",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  numRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  numLg: {
    fontSize: 40,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 44,
    letterSpacing: -0.8,
  },
  numUnit: { fontSize: 15, color: "rgba(255,255,255,0.6)" },
  subText: { fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 },
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
  formRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 6,
    marginBottom: 8,
  },
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
  addBtn: {
    backgroundColor: "#0066CC",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  addBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
  recItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#182030",
  },
  recItemLeft: { flex: 1 },
  recDate: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },
  recNote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
  delBtn: {
    fontSize: 18,
    color: "rgba(255,255,255,0.3)",
    paddingHorizontal: 4,
  },
});
