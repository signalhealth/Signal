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
  Modal,
} from "react-native";
import Svg, { Path as SvgPath } from "react-native-svg";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HealthContext } from "../context/HealthContext";
import { Card } from "../components/MetricCard";
import { WeightChart, SparkBars } from "../components/WeightChart";
import { MarkdownResult } from "../components/MarkdownResult";
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
function fmtShortDate(iso: string | undefined): string {
  if (!iso) return "";
  const [, mm, dd] = iso.split("-").map(Number);
  return `${MONTHS[mm - 1]} ${dd}`;
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function daysUntilAug5(): number {
  const now = new Date();
  const yr = now.getFullYear();
  let target = new Date(yr, 7, 5);
  if (now.getTime() >= target.getTime()) target = new Date(yr + 1, 7, 5);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

// ── Quick Card ─────────────────────────────────────────────────────

interface QuickCardProps {
  label: string;
  value: string | number | undefined;
  unit?: string;
  date?: string;
  color: string;
  onPress?: () => void;
  theme: ThemeColors;
}

function QuickCard({ label, value, unit, date, color, onPress, theme }: QuickCardProps) {
  return (
    <TouchableOpacity
      style={[qcStyles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={qcStyles.topRow}>
        <Text style={[qcStyles.label, { color: theme.textTertiary }]}>{label}</Text>
        {date ? <Text style={[qcStyles.date, { color: theme.textTertiary }]}>{date}</Text> : null}
      </View>
      <View style={qcStyles.metricRow}>
        <Text style={[qcStyles.value, { color: theme.text }]}>{value ?? "—"}</Text>
        {unit ? <Text style={[qcStyles.unit, { color: theme.textSecondary }]}> {unit}</Text> : null}
      </View>
      <View style={qcStyles.footer}>
        <Text style={[qcStyles.chevron, { color: color }]}>›</Text>
      </View>
      <View style={[qcStyles.bottomBar, { backgroundColor: color }]} />
    </TouchableOpacity>
  );
}

const qcStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  date: { fontSize: 9, letterSpacing: 0.3 },
  metricRow: { flexDirection: "row", alignItems: "baseline" },
  value: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, lineHeight: 32 },
  unit: { fontSize: 11, fontWeight: "400" },
  footer: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, paddingBottom: 6 },
  chevron: { fontSize: 20, lineHeight: 22 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3 },
});

// ── Weight Detail Modal ────────────────────────────────────────────

function WeightDetailModal({ data, onClose, theme, isDark }: {
  data: { date: string; value: number }[];
  onClose: () => void;
  theme: ThemeColors;
  isDark: boolean;
}) {
  const [days, setDays] = useState(30);
  const sorted = useMemo(() => [...data].sort((a, b) => a.date.localeCompare(b.date)), [data]);
  const cutoff = useMemo(() => {
    const d = new Date(Date.now() - days * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [days]);
  const slice = useMemo(() => sorted.filter(d => d.date >= cutoff), [sorted, cutoff]);
  const latest = sorted[sorted.length - 1]?.value;
  const earliest = slice[0]?.value;
  const isDown = latest !== undefined && earliest !== undefined ? latest < earliest : false;
  const change = latest !== undefined && earliest !== undefined
    ? Math.abs(latest - earliest).toFixed(1) : null;
  const avg7 = sorted.length >= 7
    ? avg(sorted.slice(-7).map(d => d.value)).toFixed(1)
    : latest?.toFixed(1);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[mStyles.container, { backgroundColor: theme.bg }]}>
        <View style={[mStyles.header, { borderBottomColor: theme.tabBarBorder, backgroundColor: theme.tabBar }]}>
          <Text style={[mStyles.headerTitle, { color: theme.text }]}>WEIGHT</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[mStyles.close, { color: theme.textTertiary }]}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={mStyles.content} showsVerticalScrollIndicator={false}>
          <View style={[mStyles.statsRow, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <View style={mStyles.stat}>
              <Text style={[mStyles.statVal, { color: theme.text }]}>{latest?.toFixed(1) ?? "—"}</Text>
              <Text style={[mStyles.statLbl, { color: theme.textTertiary }]}>CURRENT</Text>
            </View>
            <View style={[mStyles.statDivider, { backgroundColor: theme.sectionBorder }]} />
            <View style={mStyles.stat}>
              <Text style={[mStyles.statVal, { color: theme.text }]}>{avg7 ?? "—"}</Text>
              <Text style={[mStyles.statLbl, { color: theme.textTertiary }]}>7-DAY AVG</Text>
            </View>
            {change && (
              <>
                <View style={[mStyles.statDivider, { backgroundColor: theme.sectionBorder }]} />
                <View style={mStyles.stat}>
                  <Text style={[mStyles.statVal, { color: isDown ? theme.green : theme.red }]}>
                    {isDown ? "▼" : "▲"} {change}
                  </Text>
                  <Text style={[mStyles.statLbl, { color: theme.textTertiary }]}>{days}D CHANGE</Text>
                </View>
              </>
            )}
          </View>
          <View style={mStyles.pillRow}>
            {([14, 30, 60, 90] as const).map(d => (
              <TouchableOpacity
                key={d}
                onPress={() => setDays(d)}
                style={[mStyles.pill, { borderColor: theme.pillBorder }, days === d && { backgroundColor: theme.pillActiveBg, borderColor: theme.accent }]}
              >
                <Text style={[mStyles.pillText, { color: theme.textSecondary }, days === d && { color: "#FFF" }]}>{d}D</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Card>
            <WeightChart data={slice} height={220} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Steps Detail Modal ─────────────────────────────────────────────

function StepsDetailModal({ data, onClose, theme, isDark }: {
  data: { date: string; value: number }[];
  onClose: () => void;
  theme: ThemeColors;
  isDark: boolean;
}) {
  const sorted = useMemo(() => [...data].sort((a, b) => a.date.localeCompare(b.date)), [data]);
  const today = localDateStr();
  const todaySteps = sorted.find(d => d.date === today)?.value ?? sorted[sorted.length - 1]?.value;
  const avg7 = sorted.length >= 7 ? Math.round(avg(sorted.slice(-7).map(d => d.value))) : todaySteps;
  const avg30 = sorted.length >= 14 ? Math.round(avg(sorted.slice(-30).map(d => d.value))) : avg7;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[mStyles.container, { backgroundColor: theme.bg }]}>
        <View style={[mStyles.header, { borderBottomColor: theme.tabBarBorder, backgroundColor: theme.tabBar }]}>
          <Text style={[mStyles.headerTitle, { color: theme.text }]}>STEPS</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[mStyles.close, { color: theme.textTertiary }]}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={mStyles.content} showsVerticalScrollIndicator={false}>
          <View style={[mStyles.statsRow, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <View style={mStyles.stat}>
              <Text style={[mStyles.statVal, { color: theme.text }]}>{todaySteps?.toLocaleString() ?? "—"}</Text>
              <Text style={[mStyles.statLbl, { color: theme.textTertiary }]}>TODAY</Text>
            </View>
            <View style={[mStyles.statDivider, { backgroundColor: theme.sectionBorder }]} />
            <View style={mStyles.stat}>
              <Text style={[mStyles.statVal, { color: theme.text }]}>{avg7?.toLocaleString() ?? "—"}</Text>
              <Text style={[mStyles.statLbl, { color: theme.textTertiary }]}>7-DAY AVG</Text>
            </View>
            <View style={[mStyles.statDivider, { backgroundColor: theme.sectionBorder }]} />
            <View style={mStyles.stat}>
              <Text style={[mStyles.statVal, { color: theme.text }]}>{avg30?.toLocaleString() ?? "—"}</Text>
              <Text style={[mStyles.statLbl, { color: theme.textTertiary }]}>30-DAY AVG</Text>
            </View>
          </View>
          <Card>
            <SparkBars data={sorted} height={80} target={10000} count={28} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 1.5 },
  close: { fontSize: 18 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 20,
    borderWidth: 1,
    borderRadius: 14,
  },
  statDivider: { width: 1, height: 32 },
  stat: { alignItems: "center", flex: 1 },
  statVal: { fontSize: 22, fontWeight: "700", letterSpacing: -0.5 },
  statLbl: { fontSize: 9, fontWeight: "700", letterSpacing: 1, marginTop: 4, textTransform: "uppercase" },
  pillRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  pill: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: "600" },
});

// ── Main Screen ────────────────────────────────────────────────────

export function ProgressScreen() {
  const { healthData, appState, userProfile, refresh, loading } = useContext(HealthContext);
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);
  const scrollRef = useRef<ScrollView>(null);
  const navigation = useNavigation<any>();

  const [detailScreen, setDetailScreen] = useState<"weight" | "steps" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [insight, setInsight] = useState("Your personalized coaching insight will appear here.");
  const [insightLoading, setInsightLoading] = useState(false);

  const today = localDateStr();
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

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

  // ── Vitals ──────────────────────────────────────────────────────
  const hrvSorted = useMemo(() =>
    [...healthData.hrv].sort((a, b) => b.date.localeCompare(a.date)), [healthData.hrv]);
  const latestHRV = hrvSorted[0]?.value;
  const latestHRVDate = hrvSorted[0]?.date;

  const sleepSorted = useMemo(() =>
    [...healthData.sleep].sort((a, b) => b.date.localeCompare(a.date)), [healthData.sleep]);
  const latestSleep = sleepSorted[0]?.value;
  const latestSleepDate = sleepSorted[0]?.date;

  const rhrDeduped = useMemo(() => {
    const seen = new Map<string, number>();
    for (const pt of healthData.rhr) {
      if (!seen.has(pt.date)) seen.set(pt.date, pt.value);
    }
    return Array.from(seen.entries())
      .sort(([a], [b]) => b.localeCompare(a));
  }, [healthData.rhr]);
  const latestRHR = rhrDeduped[0]?.[1];
  const latestRHRDate = rhrDeduped[0]?.[0];

  function fmtVitalDate(date: string | undefined): string {
    if (!date) return "";
    if (date === today) return "Today";
    if (date === yesterday) return "Yesterday";
    return fmtShortDate(date);
  }

  const COLORS = { green: theme.green, amber: theme.amber, red: theme.red };

  const hrvColor = latestHRV === undefined ? theme.textTertiary
    : latestHRV >= HRV_NORMAL_LOW ? COLORS.green : COLORS.amber;
  const rhrColor = latestRHR === undefined ? theme.textTertiary
    : latestRHR <= 55 ? COLORS.green : latestRHR <= 65 ? COLORS.amber : COLORS.red;
  const sleepColor = latestSleep === undefined ? theme.textTertiary
    : latestSleep >= SLEEP_TARGET ? COLORS.green : latestSleep >= 7.0 ? COLORS.amber : COLORS.red;

  // ── Weight ──────────────────────────────────────────────────────
  const weightSorted = useMemo(() =>
    [...healthData.weight].sort((a, b) => a.date.localeCompare(b.date)), [healthData.weight]);
  const latestWt = weightSorted[weightSorted.length - 1]?.value;
  const latestWtDate = weightSorted[weightSorted.length - 1]?.date;
  const wtDateLabel = latestWtDate === today ? "Today"
    : latestWtDate === yesterday ? "Yesterday"
    : fmtShortDate(latestWtDate);

  const wt14Cutoff = (() => {
    const d = new Date(Date.now() - 14 * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const wtStart14 = weightSorted.filter(d => d.date >= wt14Cutoff)[0]?.value;
  const isDown = latestWt !== undefined && wtStart14 !== undefined ? latestWt < wtStart14 : null;
  const wtColor = isDown === null ? theme.textTertiary : isDown ? COLORS.green : COLORS.red;

  // ── Steps ───────────────────────────────────────────────────────
  const stepsSorted = useMemo(() =>
    [...healthData.steps].sort((a, b) => a.date.localeCompare(b.date)), [healthData.steps]);
  const latestStepEntry = stepsSorted[stepsSorted.length - 1];
  const todaySteps = latestStepEntry?.value;
  const stepsDateLabel = latestStepEntry?.date === today ? "Today"
    : latestStepEntry?.date === yesterday ? "Yesterday"
    : fmtShortDate(latestStepEntry?.date);
  const stepsColor = !todaySteps ? theme.textTertiary
    : todaySteps >= 10000 ? COLORS.green
    : todaySteps >= 7000 ? COLORS.amber
    : COLORS.red;

  // ── Body Composition ─────────────────────────────────────────────
  const latestDexa = appState.dexa[appState.dexa.length - 1];
  const bfSorted = useMemo(() =>
    [...healthData.bodyFat].sort((a, b) => a.date.localeCompare(b.date)), [healthData.bodyFat]);
  const lmSorted = useMemo(() =>
    [...healthData.leanMass].sort((a, b) => a.date.localeCompare(b.date)), [healthData.leanMass]);
  const latestBFEntry = bfSorted[bfSorted.length - 1];
  const latestLMEntry = lmSorted[lmSorted.length - 1];
  const latestBF = latestBFEntry?.value ?? latestDexa?.bodyFat;
  const latestLM = latestLMEntry?.value ?? latestDexa?.leanMass;
  const bfFromScale = latestBFEntry !== undefined;
  const lmFromScale = latestLMEntry !== undefined;

  // ── AI Insight ──────────────────────────────────────────────────
  async function handleGetInsight() {
    const key = await getAnthropicKey();
    if (!key) {
      setInsight("Add your Anthropic API key in settings (top right) to enable AI insights.");
      return;
    }
    setInsightLoading(true);
    setInsight("Analyzing your data…");
    const result = await getInsight(key, healthData, appState, userProfile);
    setInsightLoading(false);
    if (result.authError) {
      setInsight("API key rejected — update it in settings.");
    } else if (result.success && result.text) {
      setInsight(result.text);
    } else {
      setInsight(result.error || "An error occurred. Check your network and try again.");
    }
  }

  return (
    <>
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
        {/* ── Row 1: HRV · RHR · Sleep ── */}
        <View style={styles.triRow}>
          <QuickCard
            label="HRV"
            value={latestHRV}
            unit="ms"
            date={fmtVitalDate(latestHRVDate)}
            color={hrvColor}
            theme={theme}
            onPress={() => navigation.navigate("Recovery", { scrollTo: "hrv" })}
          />
          <QuickCard
            label="RHR"
            value={latestRHR}
            unit="bpm"
            date={fmtVitalDate(latestRHRDate)}
            color={rhrColor}
            theme={theme}
            onPress={() => navigation.navigate("Recovery", { scrollTo: "rhr" })}
          />
          <QuickCard
            label="SLEEP"
            value={latestSleep?.toFixed(1)}
            unit="hr"
            date={fmtVitalDate(latestSleepDate)}
            color={sleepColor}
            theme={theme}
            onPress={() => navigation.navigate("Recovery", { scrollTo: "sleep" })}
          />
        </View>

        {/* ── Row 2: Weight · Steps ── */}
        <View style={styles.duoRow}>
          <QuickCard
            label="WEIGHT"
            value={latestWt?.toFixed(1)}
            unit="lbs"
            date={wtDateLabel}
            color={wtColor}
            theme={theme}
            onPress={() => setDetailScreen("weight")}
          />
          <QuickCard
            label="STEPS"
            value={todaySteps?.toLocaleString()}
            unit="steps"
            date={stepsDateLabel}
            color={stepsColor}
            theme={theme}
            onPress={() => setDetailScreen("steps")}
          />
        </View>

        {/* ── Signal Insight ── */}
        <View style={styles.insightCard}>
          <Text style={styles.insightLabel}>SIGNAL INSIGHT</Text>
          <MarkdownResult theme={theme} fontSize={15}>{insight}</MarkdownResult>
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

        {/* ── Body Composition ── */}
        <Card>
          <Text style={styles.lbl}>BODY COMPOSITION</Text>
          {(latestBF !== undefined || latestLM !== undefined) ? (
            <View style={styles.compGaugeRow}>
              {latestBF !== undefined && (
                <MiniGauge
                  title={`Body Fat${bfFromScale ? " · Scale" : latestDexa ? " · DEXA" : ""}`}
                  value={`${latestBF.toFixed(1)}%`}
                  fill={(36 - latestBF) / (36 - 15)}
                  color={latestBF > 22 ? COLORS.red : latestBF > 18 ? COLORS.amber : COLORS.green}
                  startLabel="36%"
                  goalLabel="15%"
                  theme={theme}
                  isDark={isDark}
                />
              )}
              {latestLM !== undefined && (
                <MiniGauge
                  title={`Lean Mass${lmFromScale ? " · Scale" : latestDexa ? " · DEXA" : ""}`}
                  value={`${latestLM.toFixed(1)}`}
                  fill={(latestLM - 117.5) / (132 - 117.5)}
                  color={latestLM < 121 ? COLORS.red : latestLM < 127 ? COLORS.amber : COLORS.green}
                  startLabel="116 lbs"
                  goalLabel="132 lbs"
                  theme={theme}
                  isDark={isDark}
                />
              )}
            </View>
          ) : (
            <Text style={styles.emptyNote}>
              Sync your scale to Health Connect — or add a DEXA scan below.
            </Text>
          )}
        </Card>

        {/* ── DEXA Timeline ── */}
        <Card>
          <View style={styles.dexaHeaderRow}>
            <Text style={[styles.lbl, { marginBottom: 0 }]}>DEXA TIMELINE</Text>
            <View style={styles.dexaCountdownBlock}>
              <Text style={[styles.dexaCountdownNum, { color: theme.accent }]}>
                {daysUntilAug5()}
              </Text>
              <Text style={[styles.dexaCountdownLabel, { color: theme.textTertiary }]}>
                days · Aug 5
              </Text>
            </View>
          </View>
          <View style={{ height: 12 }} />
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
                      {scan.weight} lbs · {scan.bodyFat}% BF · {scan.leanMass} lbs lean
                    </Text>
                  </View>
                </View>
              ))
          )}
          <DexaAddForm theme={theme} styles={styles} />
        </Card>
      </ScrollView>

      {/* ── Detail Modals ── */}
      {detailScreen === "weight" && (
        <WeightDetailModal
          data={healthData.weight}
          onClose={() => setDetailScreen(null)}
          theme={theme}
          isDark={isDark}
        />
      )}
      {detailScreen === "steps" && (
        <StepsDetailModal
          data={healthData.steps}
          onClose={() => setDetailScreen(null)}
          theme={theme}
          isDark={isDark}
        />
      )}
    </>
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
    setWeight(""); setBodyFat(""); setLeanMass("");
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

// ── Mini Gauge ────────────────────────────────────────────────────

const MG_W = 110, MG_CX = 55, MG_CY = 52, MG_R = 40, MG_TW = 7, MG_H = 86;
const MG_START = 225, MG_END = -45, MG_SWEEP = 270;

function mgPt(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: MG_CX + MG_R * Math.cos(rad), y: MG_CY - MG_R * Math.sin(rad) };
}
function mgArc(s: number, e: number): string {
  const sp = mgPt(s), ep = mgPt(e);
  let span = s - e; if (span < 0) span += 360;
  const large = span > 180 ? 1 : 0;
  return `M ${sp.x.toFixed(2)} ${sp.y.toFixed(2)} A ${MG_R} ${MG_R} 0 ${large} 1 ${ep.x.toFixed(2)} ${ep.y.toFixed(2)}`;
}

function MiniGauge({
  title, value, fill, color, startLabel, goalLabel, theme, isDark,
}: {
  title: string; value: string; fill: number; color: string;
  startLabel: string; goalLabel: string; theme: ThemeColors; isDark: boolean;
}) {
  const clamp01 = Math.min(1, Math.max(0, fill));
  const fillEnd = MG_START - clamp01 * MG_SWEEP;
  const hasFill = clamp01 > 0.01;
  const TRACK = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  return (
    <View style={[mgStyles.tile, { backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }]}>
      <Text style={[mgStyles.mgValue, { color }]}>{value}</Text>
      <Text style={[mgStyles.mgTitle, { color: theme.textTertiary }]}>{title}</Text>
      <Svg width={MG_W} height={MG_H} viewBox={`0 0 ${MG_W} ${MG_H}`}>
        <SvgPath d={mgArc(MG_START, MG_END)} stroke={TRACK} strokeWidth={MG_TW} strokeLinecap="round" fill="none" />
        {hasFill && (
          <SvgPath d={mgArc(MG_START, fillEnd)} stroke={color} strokeWidth={MG_TW} strokeLinecap="round" fill="none" />
        )}
      </Svg>
      <View style={mgStyles.mgLabels}>
        <Text style={[mgStyles.mgLabel, { color: theme.textQuaternary }]}>{startLabel}</Text>
        <Text style={[mgStyles.mgLabel, { color: theme.textQuaternary }]}>{goalLabel}</Text>
      </View>
    </View>
  );
}

const mgStyles = StyleSheet.create({
  tile: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center" },
  mgValue: { fontSize: 26, fontWeight: "700", lineHeight: 30 },
  mgTitle: { fontSize: 9, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase", marginTop: 2, textAlign: "center" },
  mgLabels: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: -4 },
  mgLabel: { fontSize: 9, letterSpacing: 0.3 },
});

// ── Styles ────────────────────────────────────────────────────────

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

    triRow: { flexDirection: "row", gap: 8 },
    duoRow: { flexDirection: "row", gap: 8 },

    compGaugeRow: { flexDirection: "row", gap: 6, marginTop: 4 },

    // DEXA
    dexaHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    dexaCountdownBlock: { alignItems: "flex-end" },
    dexaCountdownNum: { fontSize: 32, fontWeight: "700", lineHeight: 34, letterSpacing: -1 },
    dexaCountdownLabel: { fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 2 },
    dexaRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.sectionBorder,
      marginBottom: 4,
    },
    dexaDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent, marginTop: 4 },
    dexaDateText: { fontSize: 12, fontWeight: "600", color: theme.text },
    dexaStats: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    emptyNote: { fontSize: 13, color: theme.textTertiary, marginVertical: 8 },

    // DEXA form
    addFormWrap: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.cardBorder },
    addFormLabel: {
      fontSize: 11, fontWeight: "600", letterSpacing: 1,
      color: theme.textTertiary, textTransform: "uppercase", marginBottom: 10,
    },
    formRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
    formInput: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      padding: 9,
      paddingHorizontal: 12,
      fontSize: 13,
      color: theme.text,
      marginBottom: 8,
    },
    addBtn: { backgroundColor: theme.accent, borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 4 },
    addBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14, letterSpacing: 0.3 },

    // Insight
    insightCard: {
      backgroundColor: theme.insightCard,
      borderWidth: 1,
      borderColor: theme.insightCardBorder,
      borderRadius: 16,
      padding: 24,
    },
    insightLabel: {
      fontSize: 11, fontWeight: "700", letterSpacing: 1.5, color: theme.accent, marginBottom: 10,
    },
    insightBtn: {
      marginTop: 16,
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: isDark ? "rgba(0,102,204,0.12)" : "rgba(0,102,204,0.08)",
      alignItems: "center",
    },
    insightBtnText: { color: theme.accentBright, fontWeight: "700", fontSize: 12, letterSpacing: 1 },
  });
}
