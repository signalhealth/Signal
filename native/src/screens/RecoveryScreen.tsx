import React, { useState, useContext, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { HealthContext } from "../context/HealthContext";
import { Card } from "../components/MetricCard";
import { LineChart } from "../components/WeightChart";
import { RecoveryGauge } from "../components/RecoveryGauge";
import { calcRecoveryScore } from "../utils/recoveryScore";
import {
  HRV_NORMAL_LOW,
  HRV_NORMAL_HIGH,
  SLEEP_TARGET,
} from "../types/health";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);
  const pillStylesMemo = useMemo(() => makePillStyles(theme), [theme]);

  const COLORS = {
    green: theme.green,
    amber: theme.amber,
    red: theme.red,
    blue: theme.accent,
    gray2: theme.textSecondary,
    gray3: theme.textTertiary,
  };

  const [hrvDays, setHrvDays] = useState(14);
  const [sleepDays, setSleepDays] = useState(14);
  const [rhrDays, setRhrDays] = useState(14);
  const [recDate, setRecDate] = useState(localDateStr());
  const [recNote, setRecNote] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      refresh();
    }, [])
  );

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  // ── Recovery Score ───────────────────────────────────────────────
  const recovery = useMemo(() => calcRecoveryScore({
    hrv: healthData.hrv,
    rhr: healthData.rhr,
    sleep: healthData.sleep,
    activeCals: healthData.activeCals,
  }), [healthData]);

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

  const hrvBadgeVal = hrvPeriodAvg ?? latestHRV;
  const hrvBadge =
    hrvBadgeVal === undefined
      ? null
      : hrvBadgeVal >= HRV_NORMAL_HIGH
      ? { text: "ELEVATED", cls: "green" as const }
      : hrvBadgeVal >= HRV_NORMAL_LOW
      ? { text: "IN RANGE", cls: "green" as const }
      : { text: "BELOW RANGE", cls: "amber" as const };

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

  const sleepBadgeVal = sleepPeriodAvg ?? lastNightSleep;
  const sleepBadge =
    sleepBadgeVal === undefined
      ? null
      : sleepBadgeVal >= SLEEP_TARGET
      ? { text: "ON TARGET", cls: "green" as const }
      : sleepBadgeVal >= 7.0
      ? { text: "NEAR TARGET", cls: "amber" as const }
      : { text: "BELOW TARGET", cls: "red" as const };

  // ── RHR ──────────────────────────────────────────────────────────
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

  const rhrBadgeVal = rhrPeriodAvg ?? latestRHR;
  const rhrBadge =
    rhrBadgeVal === undefined
      ? null
      : rhrBadgeVal <= 55
      ? { text: "EXCELLENT", cls: "green" as const }
      : rhrBadgeVal <= 65
      ? { text: "NORMAL", cls: "amber" as const }
      : { text: "ELEVATED", cls: "red" as const };

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

  function toggleInfo() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setInfoOpen(o => !o);
  }

  const BADGE_COLORS = {
    green: { bg: "rgba(0,208,132,0.15)", text: theme.green, border: "rgba(0,200,120,0.25)" },
    amber: { bg: "rgba(245,166,35,0.1)", text: theme.amber, border: "rgba(245,166,35,0.25)" },
    red: { bg: "rgba(255,59,48,0.15)", text: theme.red, border: "rgba(233,40,58,0.25)" },
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accentBright}
          colors={[theme.accentBright]}
        />
      }
    >
      {/* ── Recovery Score Gauge ── */}
      <Card>
        <Text style={styles.lbl}>RECOVERY SCORE</Text>
        <RecoveryGauge score={recovery.score} theme={theme} isDark={isDark} />
        {recovery.hasData && (
          <View style={styles.breakdownRow}>
            {recovery.hrv !== null && (
              <View style={styles.breakdownItem}>
                <Text style={[styles.breakdownVal, { color: theme.text }]}>{recovery.hrv}ms</Text>
                <Text style={styles.breakdownKey}>HRV</Text>
                {recovery.hrvDate && recovery.hrvDate !== localDateStr() && (
                  <Text style={styles.breakdownDate}>{recovery.hrvDate.slice(5)}</Text>
                )}
              </View>
            )}
            {recovery.sleep !== null && (
              <View style={styles.breakdownItem}>
                <Text style={[styles.breakdownVal, { color: theme.text }]}>{recovery.sleep?.toFixed(1)}h</Text>
                <Text style={styles.breakdownKey}>SLEEP</Text>
                {recovery.sleepDate && recovery.sleepDate !== localDateStr() && (
                  <Text style={styles.breakdownDate}>{recovery.sleepDate.slice(5)}</Text>
                )}
              </View>
            )}
            {recovery.rhr !== null && (
              <View style={styles.breakdownItem}>
                <Text style={[styles.breakdownVal, { color: theme.text }]}>{recovery.rhr}</Text>
                <Text style={styles.breakdownKey}>RHR</Text>
                {recovery.rhrDate && recovery.rhrDate !== localDateStr() && (
                  <Text style={styles.breakdownDate}>{recovery.rhrDate.slice(5)}</Text>
                )}
              </View>
            )}
            {recovery.activeCalsYesterday !== null && (
              <View style={styles.breakdownItem}>
                <Text style={[styles.breakdownVal, { color: theme.text }]}>{recovery.activeCalsYesterday}</Text>
                <Text style={styles.breakdownKey}>CAL BURNED</Text>
              </View>
            )}
          </View>
        )}
        {(recovery.trendBonus !== 0 || recovery.penalty !== 0) && (
          <View style={styles.modifierRow}>
            {recovery.trendBonus !== 0 && (
              <Text style={[styles.modifier, { color: recovery.trendBonus > 0 ? theme.green : theme.amber }]}>
                HRV trend {recovery.trendBonus > 0 ? "+" : ""}{recovery.trendBonus} pts
              </Text>
            )}
            {recovery.penalty !== 0 && (
              <Text style={[styles.modifier, { color: theme.amber }]}>
                Training load {recovery.penalty} pts
              </Text>
            )}
          </View>
        )}
      </Card>

      {/* ── HRV Card ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.lbl}>HRV</Text>
          <PillGroup value={hrvDays} onChange={setHrvDays} pillStyles={pillStylesMemo} />
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
          rangeBand={{ low: HRV_NORMAL_LOW, high: HRV_NORMAL_HIGH, label: `Normal range: ${HRV_NORMAL_LOW}–${HRV_NORMAL_HIGH} ms` }}
          minVal={0}
        />
      </Card>

      {/* ── Sleep Card ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.lbl}>SLEEP</Text>
          <PillGroup value={sleepDays} onChange={setSleepDays} pillStyles={pillStylesMemo} />
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
          rangeBand={{ low: 7.5, high: 9, label: "Target range: 7.5–9 hr" }}
          minVal={0}
          maxVal={12}
        />
      </Card>

      {/* ── RHR Card ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.lbl}>RHR</Text>
          <PillGroup value={rhrDays} onChange={setRhrDays} pillStyles={pillStylesMemo} />
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
        <LineChart
          data={rhrSlice}
          height={120}
          color="#60AFFF"
          rangeBand={{ low: 45, high: 65, label: "Normal range: 45–65 bpm" }}
          minVal={40}
          maxVal={90}
        />
      </Card>

      {/* ── Recovery Notes ── */}
      <Card>
        <Text style={styles.lbl}>RECOVERY NOTES</Text>
        <View style={styles.formRow}>
          <TextInput
            style={[styles.formInput, { width: 130 }]}
            placeholder="Date"
            placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
            value={recDate}
            onChangeText={setRecDate}
          />
          <TextInput
            style={[styles.formInput, { flex: 1 }]}
            placeholder="e.g. 79ms — full recovery"
            placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
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

      {/* ── How is this calculated? ── */}
      <TouchableOpacity onPress={toggleInfo} activeOpacity={0.7} style={styles.infoToggle}>
        <Text style={styles.infoToggleText}>How is the recovery score calculated?</Text>
        <Text style={[styles.infoChevron, { color: theme.textTertiary }]}>{infoOpen ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {infoOpen && (
        <View style={styles.infoBox}>
          <Text style={[styles.infoTitle, { color: theme.text }]}>Recovery Score</Text>
          <Text style={[styles.infoBody, { color: theme.textSecondary }]}>
            Your score (0–100) is a weighted composite of three signals measured each morning:
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoFactor, { color: theme.text }]}>HRV  40%</Text>
            <Text style={[styles.infoDesc, { color: theme.textTertiary }]}>
              Heart rate variability — the best single marker of nervous system recovery. Higher is better.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoFactor, { color: theme.text }]}>Sleep  35%</Text>
            <Text style={[styles.infoDesc, { color: theme.textTertiary }]}>
              Duration relative to your 7.5h target. Both under- and over-sleeping reduce the score.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoFactor, { color: theme.text }]}>RHR  25%</Text>
            <Text style={[styles.infoDesc, { color: theme.textTertiary }]}>
              Resting heart rate — a chronically elevated RHR signals fatigue or systemic stress.
            </Text>
          </View>
          <View style={[styles.infoRow, { marginTop: 8 }]}>
            <Text style={[styles.infoFactor, { color: theme.textSecondary }]}>Modifiers</Text>
            <Text style={[styles.infoDesc, { color: theme.textTertiary }]}>
              A hard training day (high active calories) applies a small penalty. An HRV trending above your 7-day baseline adds a bonus. Both reflect real recovery demand.
            </Text>
          </View>
          <View style={styles.infoZones}>
            <Text style={[styles.infoZoneChip, { backgroundColor: "rgba(255,59,48,0.15)", color: "#FF3B30" }]}>0–39 Rest</Text>
            <Text style={[styles.infoZoneChip, { backgroundColor: "rgba(255,170,0,0.15)", color: "#FFAA00" }]}>40–69 Moderate</Text>
            <Text style={[styles.infoZoneChip, { backgroundColor: "rgba(0,208,132,0.15)", color: "#00D084" }]}>70–100 Good</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ── Pill group component ─────────────────────────────────────────

function PillGroup({
  value,
  onChange,
  pillStyles,
}: {
  value: number;
  onChange: (v: number) => void;
  pillStyles: ReturnType<typeof makePillStyles>;
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

function makePillStyles(theme: ThemeColors) {
  return StyleSheet.create({
    pills: { flexDirection: "row", gap: 4 },
    pill: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.pillBorder,
      backgroundColor: "transparent",
    },
    pillOn: { backgroundColor: theme.pillActiveBg, borderColor: theme.accent },
    pillText: { fontSize: 10, fontWeight: "600", color: theme.textSecondary },
    pillTextOn: { color: "#FFFFFF" },
  });
}

function makeStyles(theme: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, paddingBottom: 110, gap: 12 },
    lbl: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      color: theme.textTertiary,
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
      color: theme.text,
      lineHeight: 44,
      letterSpacing: -0.8,
    },
    numUnit: { fontSize: 15, color: theme.textSecondary },
    subText: { fontSize: 12, color: theme.textTertiary, marginTop: 4 },
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
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      padding: 9,
      paddingHorizontal: 12,
      fontSize: 13,
      color: theme.text,
    },
    addBtn: {
      backgroundColor: theme.accent,
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
      borderBottomColor: theme.sectionBorder,
    },
    recItemLeft: { flex: 1 },
    recDate: { fontSize: 12, fontWeight: "600", color: theme.textSecondary },
    recNote: { fontSize: 12, color: theme.textTertiary, marginTop: 2 },
    delBtn: { fontSize: 18, color: theme.textTertiary, paddingHorizontal: 4 },
    // breakdown row under gauge
    breakdownRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.sectionBorder,
    },
    breakdownItem: { alignItems: "center" },
    breakdownVal: { fontSize: 16, fontWeight: "700" },
    breakdownKey: { fontSize: 9, fontWeight: "600", letterSpacing: 1, color: theme.textTertiary, marginTop: 2 },
    breakdownDate: { fontSize: 9, color: theme.amber, marginTop: 2, letterSpacing: 0.3 },
    modifierRow: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 6 },
    modifier: { fontSize: 11, fontWeight: "600" },
    // info tooltip
    infoToggle: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    infoToggleText: { fontSize: 12, color: theme.textTertiary, fontStyle: "italic" },
    infoChevron: { fontSize: 10 },
    infoBox: {
      backgroundColor: theme.card,
      borderRadius: 12,
      padding: 16,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.sectionBorder,
    },
    infoTitle: { fontSize: 14, fontWeight: "700" },
    infoBody: { fontSize: 12, lineHeight: 18 },
    infoRow: { flexDirection: "row", gap: 12 },
    infoFactor: { fontSize: 12, fontWeight: "700", width: 80 },
    infoDesc: { flex: 1, fontSize: 12, lineHeight: 17 },
    infoZones: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
    infoZoneChip: {
      fontSize: 11, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 6, overflow: "hidden",
    },
  });
}
