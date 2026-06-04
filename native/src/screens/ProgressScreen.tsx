import React, { useState, useContext, useCallback, useMemo } from "react";
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
// TextInput kept for DexaAddForm
import { useFocusEffect } from "@react-navigation/native";
import { HealthContext } from "../context/HealthContext";
import { Card } from "../components/MetricCard";
import { WeightChart, SparkBars } from "../components/WeightChart";
import { HRV_NORMAL_LOW, HRV_NORMAL_HIGH, SLEEP_TARGET } from "../types/health";
import { getInsight } from "../services/anthropic";
import { getAnthropicKey } from "../services/storage";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";

function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(iso: string): string {
  const [yr, mm, dd] = iso.split("-").map(Number);
  return `${MONTHS[mm - 1]} ${dd}, ${yr}`;
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function ProgressScreen() {
  const { healthData, appState, userProfile, refresh, loading } = useContext(HealthContext);
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);

  const COLORS = {
    green: theme.green,
    amber: theme.amber,
    red: theme.red,
    blue: theme.accent,
    white: theme.text,
    gray2: theme.textSecondary,
    gray3: theme.textTertiary,
  };

  const [wtDays, setWtDays] = useState(14);
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
  const [insight, setInsight] = useState<string>(
    "Your personalized coaching insight will appear here."
  );
  const [insightLoading, setInsightLoading] = useState(false);

  // ── Weight ──────────────────────────────────────────────────────
  const weightSorted = [...healthData.weight].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const windowStart = (() => {
    const d = new Date(Date.now() - wtDays * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const wtSlice = weightSorted.filter((d) => d.date >= windowStart);
  const latestWt = weightSorted[weightSorted.length - 1]?.value;
  const wtStart = wtSlice[0]?.value;
  const wtChange = latestWt && wtStart ? (wtStart - latestWt).toFixed(1) : null;
  const isDown = latestWt && wtStart ? latestWt < wtStart : false;
  const wt7Avg =
    weightSorted.length >= 7
      ? avg(weightSorted.slice(-7).map((d) => d.value)).toFixed(1)
      : latestWt?.toFixed(1);
  const latestWtDate = weightSorted[weightSorted.length - 1]?.date;
  const today = localDateStr();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const wtDateLabel =
    latestWtDate === today
      ? "Today"
      : latestWtDate === yesterday
      ? "Yesterday"
      : latestWtDate ? fmtDate(latestWtDate) : "";

  // ── Vitals ──────────────────────────────────────────────────────
  const latestHRV = healthData.hrv[0]?.value;
  const latestHRVDate = healthData.hrv[0]?.date;
  const latestSleep = healthData.sleep[0]?.value;
  const latestSleepDate = healthData.sleep[0]?.date;

  // Deduplicate RHR
  const seenRhr = new Map<string, number>();
  for (const pt of healthData.rhr) {
    if (!seenRhr.has(pt.date)) seenRhr.set(pt.date, pt.value);
  }
  const rhrEntries = Array.from(seenRhr.entries());
  const latestRHR = rhrEntries[0]?.[1];
  const latestRHRDate = rhrEntries[0]?.[0];

  function fmtVitalDate(date: string | undefined): string {
    if (!date) return "";
    if (date === today) return "Today";
    if (date === yesterday) return "Yesterday";
    return date.slice(5);
  }

  const hrvStatus =
    latestHRV === undefined
      ? null
      : latestHRV >= HRV_NORMAL_HIGH
      ? { label: `ELEVATED ${HRV_NORMAL_LOW}–${HRV_NORMAL_HIGH}ms`, color: COLORS.green }
      : latestHRV >= HRV_NORMAL_LOW
      ? { label: `IN RANGE ${HRV_NORMAL_LOW}–${HRV_NORMAL_HIGH}ms`, color: COLORS.green }
      : { label: `BELOW ${HRV_NORMAL_LOW}–${HRV_NORMAL_HIGH}ms`, color: COLORS.amber };

  const sleepStatus =
    latestSleep === undefined
      ? null
      : latestSleep >= SLEEP_TARGET
      ? { label: `ON TARGET ${SLEEP_TARGET}H`, color: COLORS.green }
      : latestSleep >= 7.0
      ? { label: `NEAR TARGET ${SLEEP_TARGET}H`, color: COLORS.amber }
      : { label: `BELOW ${SLEEP_TARGET}H TARGET`, color: COLORS.red };

  // ── Steps ───────────────────────────────────────────────────────
  const stepsSorted = [...healthData.steps].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const latestStepEntry = stepsSorted[stepsSorted.length - 1];
  const todaySteps = latestStepEntry?.value;
  const stepsDateLabel = latestStepEntry?.date === today
    ? "Today"
    : latestStepEntry?.date === yesterday
    ? "Yesterday"
    : latestStepEntry?.date
    ? fmtDate(latestStepEntry.date)
    : "";
  const stepsLast14 = stepsSorted.slice(-14);

  // ── DEXA ────────────────────────────────────────────────────────
  const latestDexa = appState.dexa[appState.dexa.length - 1];

  // ── Body Composition (scale > DEXA fallback) ─────────────────────
  const [bfDays, setBfDays] = useState(30);
  const bfSorted = [...healthData.bodyFat].sort((a, b) => a.date.localeCompare(b.date));
  const lmSorted = [...healthData.leanMass].sort((a, b) => a.date.localeCompare(b.date));
  const latestBFEntry = bfSorted[bfSorted.length - 1];
  const latestLMEntry = lmSorted[lmSorted.length - 1];
  const latestBF = latestBFEntry?.value ?? latestDexa?.bodyFat;
  const latestLM = latestLMEntry?.value ?? latestDexa?.leanMass;
  const bfFromScale = latestBFEntry !== undefined;
  const lmFromScale = latestLMEntry !== undefined;
  const bfWindowStart = (() => {
    const d = new Date(Date.now() - bfDays * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const bfTrend = bfSorted.filter((d) => d.date >= bfWindowStart);

  // ── AI Insight ──────────────────────────────────────────────────
  async function handleGetInsight() {
    const key = await getAnthropicKey();
    if (!key) {
      setInsight("Add your Anthropic API key in ⚙ settings (top right) to enable AI insights.");
      return;
    }
    setInsightLoading(true);
    setInsight("Analyzing your data…");
    const result = await getInsight(key, healthData, appState, userProfile);
    setInsightLoading(false);
    if (result.authError) {
      setInsight("API key rejected — update it in ⚙ settings (top right).");
    } else if (result.success && result.text) {
      setInsight(result.text);
    } else {
      setInsight(result.error || "An error occurred. Check your network and try again.");
    }
  }

  return (
    <ScrollView
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
      {/* ── Weight Card ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.lbl}>WEIGHT</Text>
          <View style={styles.pills}>
            {([14, 30, 60] as const).map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setWtDays(d)}
                style={[styles.pill, wtDays === d && styles.pillOn]}
              >
                <Text
                  style={[
                    styles.pillText,
                    wtDays === d && styles.pillTextOn,
                  ]}
                >
                  {d}D
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.weightCenter}>
          <View style={styles.weightNumRow}>
            <Text style={styles.weightNum}>
              {latestWt?.toFixed(1) ?? "—"}
            </Text>
            <Text style={styles.weightUnit}>lbs</Text>
          </View>
          <Text style={styles.weightDateLabel}>{wtDateLabel}</Text>

          {wtChange && (
            <View style={styles.deltaRow}>
              <Text
                style={[
                  styles.delta,
                  { color: isDown ? COLORS.green : COLORS.red },
                ]}
              >
                {isDown ? "▼" : "▲"} {Math.abs(parseFloat(wtChange))} lbs
              </Text>
              <Text style={styles.deltaSince}>
                since {wtSlice[0]?.date ? fmtDate(wtSlice[0].date) : ""}
              </Text>
            </View>
          )}

          <Text style={styles.avgLabel}>
            7-day avg{" "}
            <Text style={styles.avgVal}>{wt7Avg ?? "—"}</Text> lbs
          </Text>
        </View>

        <WeightChart data={wtSlice} height={120} />
      </Card>

      {/* ── Vitals Card ── */}
      <Card>
        <Text style={styles.lbl}>VITALS</Text>
        <View style={styles.vitalsGrid}>
          <View style={[styles.vitalCell, styles.vitalBorderRight]}>
            <Text style={styles.vitalLabel}>HRV</Text>
            <Text style={styles.vitalNum}>{latestHRV ?? "—"}</Text>
            <Text style={styles.vitalUnit}>ms</Text>
            {latestHRVDate && (
              <Text style={styles.vitalDate}>{fmtVitalDate(latestHRVDate)}</Text>
            )}
            {hrvStatus && (
              <Text style={[styles.vitalStatus, { color: hrvStatus.color }]}>
                {hrvStatus.label}
              </Text>
            )}
          </View>
          <View style={[styles.vitalCell, styles.vitalBorderRight, { paddingHorizontal: 16 }]}>
            <Text style={styles.vitalLabel}>RHR</Text>
            <Text style={styles.vitalNum}>{latestRHR ?? "—"}</Text>
            <Text style={styles.vitalUnit}>bpm</Text>
            {latestRHRDate && (
              <Text style={styles.vitalDate}>{fmtVitalDate(latestRHRDate)}</Text>
            )}
            {latestRHR !== undefined && (
              <Text
                style={[
                  styles.vitalStatus,
                  {
                    color:
                      latestRHR <= 55
                        ? COLORS.green
                        : latestRHR <= 65
                        ? COLORS.amber
                        : COLORS.red,
                  },
                ]}
              >
                {latestRHR <= 55
                  ? "EXCELLENT ≤55"
                  : latestRHR <= 65
                  ? "NORMAL 56–65"
                  : "ELEVATED >65"}
              </Text>
            )}
          </View>
          <View style={[styles.vitalCell, { paddingLeft: 16 }]}>
            <Text style={styles.vitalLabel}>SLEEP</Text>
            <Text style={styles.vitalNum}>{latestSleep?.toFixed(1) ?? "—"}</Text>
            <Text style={styles.vitalUnit}>hr</Text>
            {latestSleepDate && (
              <Text style={styles.vitalDate}>{fmtVitalDate(latestSleepDate)}</Text>
            )}
            {sleepStatus && (
              <Text
                style={[styles.vitalStatus, { color: sleepStatus.color }]}
              >
                {sleepStatus.label}
              </Text>
            )}
          </View>
        </View>
      </Card>

      {/* ── Steps Card ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.lbl}>STEPS</Text>
          <Text style={styles.dateLabel}>{stepsDateLabel}</Text>
        </View>
        <View style={styles.stepsNumRow}>
          <Text style={styles.stepsNum}>
            {todaySteps !== undefined ? todaySteps.toLocaleString() : "0"}
          </Text>
          <Text style={styles.stepsGoal}>/ 10,000</Text>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.trackFill,
              {
                width: `${Math.min(100, ((todaySteps ?? 0) / 10000) * 100)}%` as `${number}%`,
                backgroundColor: COLORS.blue,
              },
            ]}
          />
        </View>
        <View style={{ marginTop: 14 }}>
          <SparkBars data={stepsLast14} height={60} target={10000} />
        </View>
      </Card>

      {/* ── Body Composition ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.lbl}>BODY COMPOSITION</Text>
          {bfTrend.length > 0 && (
            <View style={styles.pills}>
              {([30, 60, 90] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setBfDays(d)}
                  style={[styles.pill, bfDays === d && styles.pillOn]}
                >
                  <Text style={[styles.pillText, bfDays === d && styles.pillTextOn]}>
                    {d}D
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {(latestBF !== undefined || latestLM !== undefined) ? (
          <>
            <View style={styles.compRow}>
              <View style={styles.compCell}>
                <Text style={styles.compLabel}>Body Fat</Text>
                <Text style={[styles.compValue, {
                  color: latestBF !== undefined
                    ? latestBF > 22 ? COLORS.red : latestBF > 18 ? COLORS.amber : COLORS.green
                    : COLORS.gray2,
                }]}>
                  {latestBF?.toFixed(1) ?? "—"}%
                </Text>
                <Text style={styles.compSource}>{bfFromScale ? "SCALE" : latestDexa ? "DEXA" : ""}</Text>
              </View>
              <View style={[styles.compCell, styles.compCellBorder]}>
                <Text style={styles.compLabel}>Lean Mass</Text>
                <Text style={[styles.compValue, {
                  color: latestLM !== undefined
                    ? latestLM < 121 ? COLORS.red : latestLM < 127 ? COLORS.amber : COLORS.green
                    : COLORS.gray2,
                }]}>
                  {latestLM?.toFixed(1) ?? "—"} lbs
                </Text>
                <Text style={styles.compSource}>{lmFromScale ? "SCALE" : latestDexa ? "DEXA" : ""}</Text>
              </View>
              <View style={styles.compCell}>
                <Text style={styles.compLabel}>Weight</Text>
                <Text style={[styles.compValue, {
                  color: latestWt !== undefined
                    ? latestWt > 175 ? COLORS.red : latestWt > 165 ? COLORS.amber : COLORS.green
                    : COLORS.gray2,
                }]}>
                  {latestWt?.toFixed(1) ?? "—"} lbs
                </Text>
                <Text style={styles.compSource}>{wtDateLabel.toUpperCase()}</Text>
              </View>
            </View>

            <View style={{ marginTop: 20 }}>
              {latestBF !== undefined && (() => {
                const bf = latestBF;
                const bfColor = bf > 22 ? COLORS.red : bf > 18 ? COLORS.amber : COLORS.green;
                const bfFill = Math.min(1, Math.max(0, (36 - bf) / (36 - 15)));
                return (
                  <GoalProgressBar
                    label="Body Fat"
                    value={bf}
                    fill={bfFill}
                    unit="%"
                    color={bfColor}
                    startLabel="Start 36%"
                    goalLabel="Goal 15%"
                    theme={theme}
                  />
                );
              })()}
              {latestLM !== undefined && (() => {
                const lm = latestLM;
                const lmColor = lm < 121 ? COLORS.red : lm < 127 ? COLORS.amber : COLORS.green;
                const lmFill = Math.min(1, Math.max(0, (lm - 117.5) / (132 - 117.5)));
                return (
                  <GoalProgressBar
                    label="Lean Mass"
                    value={lm}
                    fill={lmFill}
                    unit="lbs"
                    color={lmColor}
                    startLabel="Start 117.5 lbs"
                    goalLabel="Goal 132 lbs"
                    theme={theme}
                  />
                );
              })()}
              {latestWt !== undefined && (() => {
                const sw = latestWt;
                const swColor = sw > 175 ? COLORS.red : sw > 165 ? COLORS.amber : COLORS.green;
                const swFill = Math.min(1, Math.max(0, (189 - sw) / (189 - 155)));
                return (
                  <GoalProgressBar
                    label="Scale Weight"
                    value={sw}
                    fill={swFill}
                    unit="lbs"
                    color={swColor}
                    startLabel="Start 189 lbs"
                    goalLabel="Goal 155 lbs"
                    theme={theme}
                  />
                );
              })()}
            </View>

            {bfTrend.length > 1 && (
              <View style={{ marginTop: 4 }}>
                <Text style={[styles.lbl, { marginBottom: 8 }]}>BF% TREND</Text>
                <WeightChart data={bfTrend} height={100} />
              </View>
            )}
          </>
        ) : (
          <Text style={styles.emptyNote}>
            Sync your scale to Health Connect — or add a DEXA scan below.
          </Text>
        )}
      </Card>

      {/* ── DEXA Timeline ── */}
      <Card>
        <Text style={styles.lbl}>DEXA TIMELINE</Text>
        {appState.dexa.length === 0 ? (
          <Text style={styles.emptyNote}>No scans added yet.</Text>
        ) : (
          appState.dexa
            .slice()
            .reverse()
            .map((scan, i) => (
              <View key={i} style={styles.dexaRow}>
                <View style={styles.dexaDot} />
                <View>
                  <Text style={styles.dexaDateText}>{fmtDate(scan.date)}</Text>
                  <Text style={styles.dexaStats}>
                    {scan.weight} lbs · {scan.bodyFat}% BF · {scan.leanMass}{" "}
                    lbs lean
                  </Text>
                </View>
              </View>
            ))
        )}
        <DexaAddForm theme={theme} styles={styles} />
      </Card>

      {/* ── Signal Insight ── */}
      <View style={styles.insightCard}>
        <Text style={styles.insightLabel}>SIGNAL INSIGHT</Text>
        <Text style={styles.insightText}>{insight}</Text>
        <TouchableOpacity
          style={[styles.insightBtn, insightLoading && { opacity: 0.6 }]}
          onPress={handleGetInsight}
          disabled={insightLoading}
        >
          <Text style={styles.insightBtnText}>
            {insightLoading ? "THINKING..." : "GET INSIGHT"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Inline DEXA add form ──────────────────────────────────────────

function DexaAddForm({ theme, styles }: { theme: ThemeColors; styles: ReturnType<typeof makeStyles> }) {
  const { appState, updateAppState } = useContext(HealthContext);
  const { isDark } = useTheme();
  const [date, setDate] = useState(localDateStr());
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [leanMass, setLeanMass] = useState("");

  function handleAdd() {
    const w = parseFloat(weight);
    const bf = parseFloat(bodyFat);
    const lm = parseFloat(leanMass);
    if (!date || isNaN(w) || isNaN(bf) || isNaN(lm)) {
      Alert.alert("Invalid", "Please fill in all fields with valid numbers.");
      return;
    }
    const updated = {
      ...appState,
      dexa: [
        ...appState.dexa,
        { date, weight: w, bodyFat: bf, leanMass: lm },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    };
    updateAppState(updated);
    setWeight("");
    setBodyFat("");
    setLeanMass("");
  }

  return (
    <View style={styles.addFormWrap}>
      <Text style={styles.addFormLabel}>ADD SCAN</Text>
      <View style={styles.formRow}>
        <TextInput
          style={[styles.formInput, { flex: 1 }]}
          placeholder="Date (YYYY-MM-DD)"
          placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
          value={date}
          onChangeText={setDate}
        />
      </View>
      <View style={styles.formRow}>
        <TextInput
          style={[styles.formInput, { flex: 1, marginRight: 8 }]}
          placeholder="Weight (lbs)"
          placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
        />
        <TextInput
          style={[styles.formInput, { flex: 1 }]}
          placeholder="Body Fat %"
          placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
          keyboardType="decimal-pad"
          value={bodyFat}
          onChangeText={setBodyFat}
        />
      </View>
      <TextInput
        style={styles.formInput}
        placeholder="Lean Mass (lbs)"
        placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
        keyboardType="decimal-pad"
        value={leanMass}
        onChangeText={setLeanMass}
      />
      <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
        <Text style={styles.addBtnText}>Add DEXA Result</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Goal Progress Bar ──────────────────────────────────────────────
interface GoalProgressBarProps {
  label: string;
  value: number;
  fill: number;
  unit: string;
  color: string;
  startLabel: string;
  goalLabel: string;
  theme: ThemeColors;
}

function GoalProgressBar({ label, value, fill, unit, color, startLabel, goalLabel, theme }: GoalProgressBarProps) {
  const pct = Math.min(100, Math.max(0, fill * 100));
  return (
    <View style={gpbStyles.wrap}>
      <View style={gpbStyles.row}>
        <Text style={[gpbStyles.label, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[gpbStyles.valueText, { color }]}>
          {value}{unit ? ` ${unit}` : ""}
        </Text>
      </View>
      <View style={[gpbStyles.track, { backgroundColor: theme.sectionBorder }]}>
        <View
          style={[
            gpbStyles.fill,
            { width: `${pct}%` as `${number}%`, backgroundColor: color },
          ]}
        />
      </View>
      <View style={gpbStyles.barEndRow}>
        <Text style={[gpbStyles.barEnd, { color: theme.textQuaternary }]}>{startLabel}</Text>
        <Text style={[gpbStyles.barEnd, { color: theme.textQuaternary }]}>{goalLabel}</Text>
      </View>
    </View>
  );
}

const gpbStyles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  label: { fontSize: 14 },
  valueText: { fontSize: 14, fontWeight: "700" },
  barEndRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  barEnd: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  track: {
    height: 4,
    borderRadius: 99,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 99 },
  sub: {
    fontSize: 11,
    marginTop: 5,
    letterSpacing: 0.3,
  },
});

function makeStyles(theme: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, paddingBottom: 32, gap: 12 },
    lbl: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      color: theme.textTertiary,
      marginBottom: 12,
      textTransform: "uppercase",
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
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

    weightCenter: { alignItems: "center", paddingVertical: 8 },
    weightNumRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
    },
    weightNum: {
      fontSize: 60,
      fontWeight: "700",
      color: theme.text,
      lineHeight: 64,
      letterSpacing: -2,
    },
    weightUnit: {
      fontSize: 20,
      color: theme.textSecondary,
      fontWeight: "400",
      paddingBottom: 8,
    },
    weightDateLabel: {
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: 2,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    deltaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 10,
    },
    delta: { fontSize: 14, fontWeight: "500" },
    deltaSince: { fontSize: 13, color: theme.textTertiary },
    avgLabel: {
      fontSize: 13,
      color: theme.textTertiary,
      marginTop: 6,
    },
    avgVal: { color: theme.textSecondary, fontWeight: "600" },

    vitalsGrid: {
      flexDirection: "row",
      marginTop: 4,
    },
    vitalCell: { flex: 1 },
    vitalBorderRight: {
      borderRightWidth: 1,
      borderRightColor: theme.cardBorder,
    },
    vitalLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 1,
      color: theme.textTertiary,
      textTransform: "uppercase",
    },
    vitalNum: {
      fontSize: 34,
      fontWeight: "700",
      color: theme.text,
      marginTop: 6,
      lineHeight: 38,
    },
    vitalUnit: { fontSize: 11, color: theme.textTertiary, marginTop: 3 },
    vitalDate: {
      fontSize: 10,
      color: theme.textTertiary,
      marginTop: 3,
      letterSpacing: 0.3,
    },
    vitalStatus: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      marginTop: 8,
    },

    stepsNumRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
      marginBottom: 10,
    },
    stepsNum: {
      fontSize: 48,
      fontWeight: "700",
      color: theme.text,
      lineHeight: 52,
      letterSpacing: -1,
    },
    stepsGoal: { fontSize: 14, color: theme.textTertiary, paddingBottom: 4 },
    dateLabel: { fontSize: 11, color: theme.textTertiary },
    track: {
      height: 4,
      backgroundColor: theme.sectionBorder,
      borderRadius: 99,
      overflow: "hidden",
      marginBottom: 4,
    },
    trackFill: { height: "100%", borderRadius: 99 },

    compRow: {
      flexDirection: "row",
      marginTop: 4,
    },
    compCell: {
      flex: 1,
      alignItems: "center",
    },
    compCellBorder: {
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: theme.cardBorder,
    },
    compLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.8,
      color: theme.textTertiary,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    compValue: {
      fontSize: 24,
      fontWeight: "700",
      lineHeight: 28,
    },
    compSource: {
      fontSize: 9,
      fontWeight: "600",
      letterSpacing: 0.8,
      color: theme.textTertiary,
      textTransform: "uppercase",
      marginTop: 4,
    },

    dexaDate: {
      fontSize: 11,
      color: theme.textTertiary,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginTop: 4,
      marginBottom: 20,
    },

    dexaRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.sectionBorder,
      marginBottom: 4,
    },
    dexaDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.accent,
      marginTop: 4,
    },
    dexaDateText: { fontSize: 12, fontWeight: "600", color: theme.text },
    dexaStats: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    emptyNote: {
      fontSize: 13,
      color: theme.textTertiary,
      marginVertical: 8,
    },

    addFormWrap: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.cardBorder,
    },
    addFormLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 1,
      color: theme.textTertiary,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    formRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
    formInput: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      padding: 9,
      paddingHorizontal: 12,
      fontFamily: "SpaceGrotesk_400Regular",
      fontSize: 13,
      color: theme.text,
      marginBottom: 8,
    },
    addBtn: {
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 4,
    },
    addBtnText: {
      color: "#FFFFFF",
      fontWeight: "600",
      fontSize: 14,
      letterSpacing: 0.3,
    },

    insightCard: {
      backgroundColor: theme.insightCard,
      borderWidth: 1,
      borderColor: theme.insightCardBorder,
      borderRadius: 16,
      padding: 24,
    },
    insightLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      color: theme.accent,
      marginBottom: 10,
    },
    insightText: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.textSecondary,
      marginTop: 4,
    },
    insightBtnRow: { flexDirection: "row", gap: 8, marginTop: 16 },
    insightBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: isDark ? "rgba(0,102,204,0.12)" : "rgba(0,102,204,0.08)",
      alignItems: "center",
    },
    insightBtnText: {
      color: theme.accentBright,
      fontWeight: "700",
      fontSize: 12,
      letterSpacing: 1,
    },
    insightSettingsBtn: {
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    insightSettingsIcon: {
      color: theme.textTertiary,
      fontSize: 14,
    },
    apiKeyInstructions: {
      fontSize: 13,
      color: theme.textSecondary,
      lineHeight: 19,
      marginBottom: 10,
    },
    apiKeyInput: {
      backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
      borderWidth: 1,
      borderColor: theme.cardBorder,
      borderRadius: 8,
      padding: 10,
      paddingHorizontal: 12,
      fontSize: 13,
      color: theme.text,
      marginBottom: 8,
    },
    apiKeyError: { fontSize: 11, color: theme.red, marginBottom: 8 },
    apiKeySaveBtn: {
      backgroundColor: theme.accent,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: "center",
    },
    apiKeySaveBtnText: {
      color: theme.text,
      fontWeight: "600",
      fontSize: 13,
    },
  });
}
