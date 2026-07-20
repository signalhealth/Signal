import React, { useState, useContext, useMemo, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  SafeAreaView,
} from "react-native";
import Svg, { Path as SvgPath } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { HealthContext } from "../context/HealthContext";
import { Card } from "../components/MetricCard";
import { MarkdownResult } from "../components/MarkdownResult";
import { LineChart } from "../components/WeightChart";
import { MultiRingGauge } from "../components/MultiRingGauge";
import { METRIC_ICON_PATHS } from "../components/metricIcons";
import { HERO_MIN_HEIGHT, HERO_CONTENT_TOP } from "../components/heroLayout";
import { LabResult, UserProfile } from "../types/health";
import { analyzeLab } from "../services/anthropic";
import { getAnthropicKey } from "../services/storage";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";
import { FONT_DISPLAY } from "../theme/typography";

const STATUS_CONFIG = {
  red: {
    bg: "rgba(241,26,34,0.15)",
    text: "#F11A22",
    border: "rgba(220,20,28,0.25)",
    headerColor: "#F11A22",
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

const LOWER_IS_BETTER = new Set([
  "LDL", "LDL Cholesterol", "Total Cholesterol", "Lp(a)", "Lipoprotein(a)",
  "Body Fat", "Triglycerides", "ApoB", "Lp-PLA2", "CRP", "Homocysteine",
  "BUN", "BUN/Creat Ratio", "Alb/Glob Ratio", "PSA, Total", "Insulin", "Hemoglobin A1C",
]);

function normName(n: string) { return n.toLowerCase().trim(); }

function badgeLabel(lab: LabResult): string {
  return lab.status === "red"
    ? lab.direction === "low" ? "LOW" : "HIGH"
    : lab.status === "amber" ? "MONITOR" : "OK";
}

interface LabChange {
  arrow: "↓" | "↑";
  absDiff: string;
  pct: number | null;
  improved: boolean;
  color: string;
  bg: string;
  border: string;
}

function getChange(lab: LabResult, allLabs: LabResult[]): LabChange | null {
  const sameMarker = allLabs
    .filter((l) => normName(l.name) === normName(lab.name) && l.id !== lab.id && l.date < lab.date)
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
  const color = improved ? "#00D084" : "#F5A623";
  return {
    arrow: diff < 0 ? "↓" : "↑",
    absDiff: Math.abs(diff).toFixed(1).replace(/\.0$/, ""),
    pct: prevNum !== 0 ? Math.round(Math.abs(diff / prevNum) * 100) : null,
    improved,
    color,
    bg: improved ? "rgba(0,208,132,0.12)" : "rgba(245,166,35,0.12)",
    border: improved ? "rgba(0,208,132,0.35)" : "rgba(245,166,35,0.35)",
  };
}

function parseReferenceRange(ref: string): { low: number; high: number } | null {
  const m = ref.trim().match(/^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const low = parseFloat(m[1]);
  const high = parseFloat(m[2]);
  if (isNaN(low) || isNaN(high) || low >= high) return null;
  return { low, high };
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Lab detail modal ─────────────────────────────────────────────────────────

function LabDetailModal({
  markerName,
  allLabs,
  onClose,
  onDelete,
  onAdd,
  userProfile,
}: {
  markerName: string;
  allLabs: LabResult[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onAdd: (lab: LabResult) => void;
  userProfile: UserProfile;
}) {
  const { theme, isDark } = useTheme();
  const [analysis, setAnalysis] = useState(
    "Tap Analyze below for a plain-language explanation and actionable guidance."
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [newDate, setNewDate] = useState(todayDateStr());
  const [newStatus, setNewStatus] = useState<"green" | "amber" | "red">("green");
  const [newDirection, setNewDirection] = useState<"high" | "low">("high");

  // Case-insensitive name match so old and new entries group correctly
  const entries = useMemo(
    () =>
      allLabs
        .filter((l) => normName(l.name) === normName(markerName))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allLabs, markerName]
  );

  useEffect(() => {
    if (entries.length === 0) onClose();
  }, [entries.length]);

  const latest = entries[0];
  const cfg = latest ? STATUS_CONFIG[latest.status] : STATUS_CONFIG.green;
  const change = latest ? getChange(latest, allLabs) : null;
  const refRange = latest?.reference ? parseReferenceRange(latest.reference) : null;

  // Pre-fill new entry status from latest
  useEffect(() => {
    if (latest) setNewStatus(latest.status);
  }, [latest?.status]);

  const chartData = useMemo(
    () =>
      entries
        .filter((e) => !isNaN(parseFloat(e.value)))
        .map((e) => ({ date: e.date, value: parseFloat(e.value) }))
        .reverse(),
    [entries]
  );

  async function handleAnalyze() {
    if (!latest) return;
    const key = await getAnthropicKey();
    if (!key) {
      setAnalysis("Add your Anthropic API key in ⚙ settings to enable AI analysis.");
      return;
    }
    setAnalyzing(true);
    setAnalysis("Analyzing…");
    const result = await analyzeLab(key, latest, allLabs, userProfile);
    setAnalyzing(false);
    if (result.authError) {
      setAnalysis("API key rejected — update it in ⚙ settings.");
    } else if (result.success && result.text) {
      setAnalysis(result.text);
    } else {
      setAnalysis(result.error || "An error occurred.");
    }
  }

  function handleAddEntry() {
    if (!newValue.trim()) return;
    const lab: LabResult = {
      id: `custom-${Date.now()}`,
      date: newDate,
      name: latest?.name ?? markerName, // preserve original casing
      value: newValue.trim(),
      reference: latest?.reference ?? "",
      status: newStatus,
      ...(newStatus === "red" && { direction: newDirection }),
    };
    onAdd(lab);
    setNewValue("");
    setNewDate(todayDateStr());
    setShowAddForm(false);
  }

  const s = mStyles(theme, isDark);

  const NewEntryStatusBtn = ({ value, label, color }: { value: "green" | "amber" | "red"; label: string; color: string }) => (
    <TouchableOpacity
      style={[s.statusBtn, newStatus === value && { borderColor: color, backgroundColor: `${color}22` }]}
      onPress={() => setNewStatus(value)}
    >
      <Text style={[s.statusBtnText, newStatus === value && { color }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: theme.tabBarBorder, backgroundColor: theme.tabBar }]}>
          <Text style={[s.headerTitle, { color: theme.text }]}>{markerName.toUpperCase()}</Text>
          <View style={s.headerRight}>
            <TouchableOpacity
              onPress={() => setShowAddForm((v) => !v)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[s.addEntryBtn, { borderColor: theme.accent }]}
            >
              <Text style={[s.addEntryBtnText, { color: theme.accent }]}>+ Add Entry</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[s.closeBtn, { color: theme.textTertiary }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Inline add-entry form */}
          {showAddForm && (
            <View style={[s.addFormCard, { backgroundColor: theme.insightCard, borderColor: theme.insightCardBorder }]}>
              <Text style={[s.sectionLabel, { color: theme.textTertiary }]}>NEW ENTRY</Text>
              <View style={s.addFormRow}>
                <TextInput
                  style={[s.formInput, { flex: 1, marginRight: 8, color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                  placeholder="Date (YYYY-MM-DD)"
                  placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
                  value={newDate}
                  onChangeText={setNewDate}
                />
                <TextInput
                  style={[s.formInput, { flex: 1, color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                  placeholder="Value"
                  placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
                  value={newValue}
                  onChangeText={setNewValue}
                  autoFocus
                />
              </View>
              {latest?.reference ? (
                <Text style={[s.prefilledRef, { color: theme.textTertiary }]}>Reference: {latest.reference}</Text>
              ) : null}
              <View style={s.addFormStatusRow}>
                <NewEntryStatusBtn value="green" label="✓ Normal" color="#00D084" />
                <NewEntryStatusBtn value="amber" label="⚠ Monitor" color="#F5A623" />
                <NewEntryStatusBtn value="red" label="✗ Flagged" color="#F11A22" />
              </View>
              {newStatus === "red" && (
                <View style={s.addFormStatusRow}>
                  <TouchableOpacity
                    style={[s.statusBtn, newDirection === "high" && { borderColor: "#F11A22", backgroundColor: "rgba(241,26,34,0.12)" }]}
                    onPress={() => setNewDirection("high")}
                  >
                    <Text style={[s.statusBtnText, newDirection === "high" && { color: "#F11A22" }]}>↑ Too High</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.statusBtn, newDirection === "low" && { borderColor: "#F11A22", backgroundColor: "rgba(241,26,34,0.12)" }]}
                    onPress={() => setNewDirection("low")}
                  >
                    <Text style={[s.statusBtnText, newDirection === "low" && { color: "#F11A22" }]}>↓ Too Low</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={[s.addBtn, { backgroundColor: theme.accent }, !newValue.trim() && { opacity: 0.4 }]}
                onPress={handleAddEntry}
                disabled={!newValue.trim()}
              >
                <Text style={s.addBtnText}>Save Entry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Latest value */}
          {latest && (
            <View style={s.latestRow}>
              <View style={s.latestRowLeft}>
                <Text style={[s.latestValue, { color: cfg.text }]}>{latest.value}</Text>
                <View style={[s.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                  <Text style={[s.badgeText, { color: cfg.text }]}>{badgeLabel(latest)}</Text>
                </View>
              </View>
              {change && (
                <View style={[s.pctBadge, { backgroundColor: change.bg, borderColor: change.border }]}>
                  <Text style={[s.pctBadgeText, { color: change.color }]}>
                    {change.arrow} {change.absDiff}{change.pct !== null ? ` (${change.pct}%)` : ""}
                  </Text>
                </View>
              )}
            </View>
          )}
          {latest?.reference ? (
            <Text style={[s.refText, { color: theme.textTertiary }]}>Reference: {latest.reference}</Text>
          ) : null}

          {/* Chart */}
          {chartData.length >= 2 && (() => {
            const trendColor = change ? change.color : theme.textTertiary;
            const vals = chartData.map((d) => d.value);
            const minVal = Math.min(...vals, ...(refRange ? [refRange.low] : [])) * 0.95;
            const maxVal = Math.max(...vals, ...(refRange ? [refRange.high] : [])) * 1.05;
            return (
              <View style={s.chartWrap}>
                <LineChart
                  data={chartData}
                  height={130}
                  color={trendColor}
                  showDots
                  minVal={minVal}
                  maxVal={maxVal}
                  rangeBand={refRange ? { low: refRange.low, high: refRange.high } : undefined}
                  dotColorFn={(v) => {
                    const max = Math.max(...vals);
                    const min = Math.min(...vals);
                    return v === max || v === min ? "#FFAA00" : trendColor;
                  }}
                />
              </View>
            );
          })()}

          {/* History */}
          <Text style={[s.sectionLabel, { color: theme.textTertiary }]}>HISTORY</Text>
          {[...entries].reverse().map((e) => {
            const eCfg = STATUS_CONFIG[e.status];
            // The latest entry's change is already shown in the badge up top — don't repeat it here.
            const trend = e.id === latest?.id ? null : getChange(e, allLabs);
            return (
              <View key={e.id} style={[s.historyRow, { borderBottomColor: theme.cardBorder }]}>
                <View style={s.historyLeft}>
                  <Text style={[s.historyDate, { color: theme.textSecondary }]}>{e.date}</Text>
                  {trend && (
                    <Text style={[s.historyTrend, { color: trend.color }]}>
                      {trend.arrow} {trend.absDiff} from last
                    </Text>
                  )}
                </View>
                <View style={s.historyRight}>
                  <Text style={[s.historyValue, { color: eCfg.text }]}>{e.value}</Text>
                  <View style={[s.badge, { backgroundColor: eCfg.bg, borderColor: eCfg.border }]}>
                    <Text style={[s.badgeText, { color: eCfg.text }]}>{badgeLabel(e)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(`Delete this entry?`, `${e.name} · ${e.value} (${e.date})`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => onDelete(e.id) },
                      ])
                    }
                  >
                    <Text style={[s.delBtn, { color: theme.textTertiary }]}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {/* AI advisor */}
          <View style={[s.advisorCard, { backgroundColor: theme.insightCard, borderColor: theme.insightCardBorder }]}>
            <Text style={[s.advisorLabel, { color: theme.accent }]}>SIGNAL LAB ADVISOR</Text>
            <MarkdownResult theme={theme} fontSize={13}>{analysis}</MarkdownResult>
            <TouchableOpacity
              style={[s.analyzeBtn, { backgroundColor: theme.accent }, analyzing && { opacity: 0.5 }]}
              onPress={handleAnalyze}
              disabled={analyzing}
            >
              <Text style={s.analyzeBtnText}>
                {analyzing ? "ANALYZING…" : `ANALYZE ${markerName.toUpperCase()}`}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function mStyles(theme: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
    },
    headerTitle: { fontFamily: FONT_DISPLAY, fontSize: 14, letterSpacing: 1.4 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 14 },
    pctBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    pctBadgeText: { fontSize: 12, fontWeight: "700" },
    addEntryBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    addEntryBtnText: { fontSize: 12, fontWeight: "600" },
    closeBtn: { fontSize: 20, fontWeight: "400" },
    content: { padding: 20, paddingBottom: 48 },
    addFormCard: {
      borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 20,
    },
    addFormRow: { flexDirection: "row", marginBottom: 8 },
    addFormStatusRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
    prefilledRef: { fontSize: 11, marginBottom: 10 },
    formInput: {
      borderWidth: 1, borderRadius: 8, padding: 9,
      paddingHorizontal: 12, fontSize: 13,
    },
    statusBtn: {
      flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)", alignItems: "center",
    },
    statusBtnText: { fontSize: 11, fontWeight: "600", color: "#8899AA" },
    addBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", marginTop: 4 },
    addBtnText: { fontFamily: FONT_DISPLAY, color: "#FFFFFF", fontSize: 13 },
    latestRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginBottom: 6, marginTop: 4,
    },
    latestRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    latestValue: { fontSize: 36, fontWeight: "700" },
    refText: { fontSize: 12, marginBottom: 12, letterSpacing: 0.3 },
    chartWrap: { marginBottom: 12, marginTop: 4 },
    sectionLabel: {
      fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: 1.5,
      textTransform: "uppercase", marginBottom: 8, marginTop: 8,
    },
    historyRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingVertical: 12, borderBottomWidth: 1,
    },
    historyLeft: { flex: 1 },
    historyDate: { fontSize: 13, fontWeight: "500" },
    historyTrend: { fontSize: 11, fontWeight: "600", marginTop: 2 },
    historyRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    historyValue: { fontSize: 15, fontWeight: "700" },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5, borderWidth: 1 },
    badgeText: { fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: 0.9, textTransform: "uppercase" },
    delBtn: { fontSize: 20, paddingHorizontal: 4 },
    advisorCard: {
      borderWidth: 1, borderRadius: 16, padding: 20, marginTop: 28,
    },
    advisorLabel: {
      fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: 1.5,
      textTransform: "uppercase", marginBottom: 10,
    },
    analyzeBtn: { borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 },
    analyzeBtnText: { fontFamily: FONT_DISPLAY, color: "#FFFFFF", fontSize: 13, letterSpacing: 0.8 },
  });
}

// ── Main screen ──────────────────────────────────────────────────────────────

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STATUS_RANK = { red: 0, amber: 1, green: 2 } as const;

export function LabsScreen() {
  const { appState, updateAppState, userProfile } = useContext(HealthContext);
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);
  const scrollRef = useRef<ScrollView>(null);

  const [openSections, setOpenSections] = useState<Record<"red" | "amber" | "green", boolean>>({
    red: false, amber: false, green: false,
  });

  function toggleSection(key: "red" | "amber" | "green") {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const [labDate, setLabDate] = useState(todayDateStr);
  const [labName, setLabName] = useState("");
  const [labValue, setLabValue] = useState("");
  const [labRef, setLabRef] = useState("");
  const [labStatus, setLabStatus] = useState<"green" | "amber" | "red">("green");
  const [labDirection, setLabDirection] = useState<"high" | "low">("high");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [detailMarker, setDetailMarker] = useState<string | null>(null);

  const allLabs = useMemo(
    () => [...appState.labs].sort((a, b) => b.date.localeCompare(a.date)),
    [appState.labs]
  );

  const knownMarkers = useMemo(() => {
    const seen = new Map<string, LabResult>();
    for (const lab of allLabs) {
      const key = normName(lab.name);
      if (!seen.has(key)) seen.set(key, lab);
    }
    return Array.from(seen.values());
  }, [allLabs]);

  const suggestions = useMemo(() => {
    const q = normName(labName);
    if (!q) return [];
    return knownMarkers
      .filter((m) => normName(m.name).includes(q))
      .slice(0, 6);
  }, [labName, knownMarkers]);

  function applySuggestion(lab: LabResult) {
    setLabName(lab.name);
    setLabRef(lab.reference ?? "");
    setLabStatus(lab.status);
    if (lab.direction) setLabDirection(lab.direction);
    setShowSuggestions(false);
  }

  // One entry per marker (case-insensitive dedup, most recent wins)
  const latestByName = useMemo(() => {
    const map = new Map<string, LabResult>();
    for (const lab of allLabs) {
      const key = normName(lab.name);
      if (!map.has(key)) map.set(key, lab);
    }
    return Array.from(map.values());
  }, [allLabs]);

  const redLabs   = latestByName.filter((l) => l.status === "red");
  const amberLabs = latestByName.filter((l) => l.status === "amber");
  const greenLabs = latestByName.filter((l) => l.status === "green");

  // Change log: compare most recent vs previous entry per marker
  const changeLog = useMemo(() => {
    const byName = new Map<string, LabResult[]>();
    for (const lab of allLabs) {
      const key = normName(lab.name);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(lab);
    }
    const toOptimalNames: string[] = [];
    const toMonitorNames: string[] = [];
    const toFlaggedNames: string[] = [];
    for (const [, entries] of byName) {
      if (entries.length < 2) continue;
      const curr = STATUS_RANK[entries[0].status];
      const prev = STATUS_RANK[entries[1].status];
      if (curr === prev) continue;
      // Bucket by the resulting status, not just direction of change —
      // a green→amber drop is Monitor, not Flagged; only landing on red is Flagged.
      if (entries[0].status === "green") toOptimalNames.push(entries[0].name);
      else if (entries[0].status === "red") toFlaggedNames.push(entries[0].name);
      else toMonitorNames.push(entries[0].name);
    }
    return {
      toOptimal: toOptimalNames.length,
      toMonitor: toMonitorNames.length,
      toFlagged: toFlaggedNames.length,
      toOptimalNames,
      toMonitorNames,
      toFlaggedNames,
      hasChanges: toOptimalNames.length + toMonitorNames.length + toFlaggedNames.length > 0,
    };
  }, [allLabs]);

  // Auto-fill reference when marker name matches an existing entry
  useEffect(() => {
    if (!labName.trim()) return;
    const match = allLabs.find((l) => normName(l.name) === normName(labName));
    if (match?.reference && !labRef) setLabRef(match.reference);
  }, [labName]);

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
    updateAppState({ ...appState, labs: [...appState.labs, newLab] });
    setLabName("");
    setLabValue("");
    setLabRef("");
  }

  function addLabDirect(lab: LabResult) {
    updateAppState({ ...appState, labs: [...appState.labs, lab] });
  }

  function deleteLab(id: string) {
    updateAppState({ ...appState, labs: appState.labs.filter((l) => l.id !== id) });
  }

  const StatusToggle = ({ value, label, color }: { value: "green" | "amber" | "red"; label: string; color: string }) => (
    <TouchableOpacity
      style={[styles.statusBtn, labStatus === value && { borderColor: color, backgroundColor: `${color}22` }]}
      onPress={() => setLabStatus(value)}
    >
      <Text style={[styles.statusBtnText, labStatus === value && { color }]}>{label}</Text>
    </TouchableOpacity>
  );

  function renderSection(
    labs: LabResult[],
    key: "red" | "amber" | "green",
    title: string,
    color: string,
    bgColor: string,
    borderColor: string,
    emptyText: string
  ) {
    return (
      <Card>
        <TouchableOpacity onPress={() => toggleSection(key)} style={styles.accordionHeader} activeOpacity={0.7}>
          <View style={styles.accordionLeft}>
            <View style={[styles.accordionDot, { backgroundColor: color }]} />
            <Text style={[styles.accordionTitle, { color }]}>{title}</Text>
            {labs.length > 0 && (
              <View style={[styles.accordionCount, { backgroundColor: bgColor, borderColor }]}>
                <Text style={[styles.accordionCountText, { color }]}>{labs.length}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.accordionChevron, { color: theme.textTertiary }]}>
            {openSections[key] ? "▲" : "▼"}
          </Text>
        </TouchableOpacity>
        {openSections[key] && (
          labs.length > 0
            ? labs.map((lab, i) => {
                const cfg = STATUS_CONFIG[lab.status];
                const trend = getChange(lab, allLabs);
                const allForMarker = allLabs.filter(l => normName(l.name) === normName(lab.name));
                return (
                  <TouchableOpacity
                    key={lab.id || i}
                    onPress={() => setDetailMarker(lab.name)}
                    style={styles.labRow}
                    activeOpacity={0.7}
                  >
                    <View style={styles.labLeft}>
                      <Text style={styles.labName}>{lab.name}</Text>
                      <Text style={styles.labRef}>ref {lab.reference}</Text>
                      {trend && (
                        <Text style={[styles.labTrend, { color: trend.color }]}>
                          {trend.arrow} {trend.absDiff} from last
                        </Text>
                      )}
                      {allForMarker.length > 1 && (
                        <Text style={[styles.labHistory, { color: theme.textTertiary }]}>
                          {allForMarker.length} entries · tap for history
                        </Text>
                      )}
                    </View>
                    <View style={styles.labRight}>
                      <Text style={[styles.labValue, { color: cfg.text }]}>{lab.value}</Text>
                      <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                        <Text style={[styles.badgeText, { color: cfg.text }]}>{badgeLabel(lab)}</Text>
                      </View>
                      <Text style={[styles.chevron, { color: theme.textTertiary }]}>›</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            : <Text style={[styles.emptyNote, { marginTop: 8 }]}>{emptyText}</Text>
        )}
      </Card>
    );
  }

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Status Rings Hero ── */}
        <View style={[styles.heroWrap, { backgroundColor: theme.hero }]}>
          <MultiRingGauge
            rings={[
              { fraction: latestByName.length ? greenLabs.length / latestByName.length : 0, color: "#00D084" },
              { fraction: latestByName.length ? amberLabs.length / latestByName.length : 0, color: "#F5A623" },
              { fraction: latestByName.length ? redLabs.length / latestByName.length : 0, color: "#F11A22" },
            ]}
          />
          <View style={styles.ringLegend}>
            <View style={styles.ringLegendItem}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <SvgPath d={METRIC_ICON_PATHS.optimal} stroke="#00D084" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.ringLegendText}>Optimal {greenLabs.length}</Text>
            </View>
            <View style={styles.ringLegendItem}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <SvgPath d={METRIC_ICON_PATHS.monitor} stroke="#F5A623" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.ringLegendText}>Monitor {amberLabs.length}</Text>
            </View>
            <View style={styles.ringLegendItem}>
              <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                <SvgPath d={METRIC_ICON_PATHS.flagged} stroke="#F11A22" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.ringLegendText}>Flagged {redLabs.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sheet}>

        {/* Change log */}
        {changeLog.hasChanges && (
          <View style={[styles.changeLogCard, { backgroundColor: theme.insightCard, borderColor: theme.insightCardBorder }]}>
            <Text style={[styles.changeLogTitle, { color: theme.textTertiary }]}>SINCE LAST UPDATE</Text>
            <View style={styles.changeLogStats}>
              {changeLog.toOptimal > 0 && (
                <View style={styles.changeLogStat}>
                  <Text style={[styles.changeLogNum, { color: "#00D084" }]}>{changeLog.toOptimal}</Text>
                  <Text style={[styles.changeLogLabel, { color: "#00D084" }]}>↑ Optimal</Text>
                </View>
              )}
              {changeLog.toMonitor > 0 && (
                <View style={styles.changeLogStat}>
                  <Text style={[styles.changeLogNum, { color: "#F5A623" }]}>{changeLog.toMonitor}</Text>
                  <Text style={[styles.changeLogLabel, { color: "#F5A623" }]}>↑ Monitor</Text>
                </View>
              )}
              {changeLog.toFlagged > 0 && (
                <View style={styles.changeLogStat}>
                  <Text style={[styles.changeLogNum, { color: "#F11A22" }]}>{changeLog.toFlagged}</Text>
                  <Text style={[styles.changeLogLabel, { color: "#F11A22" }]}>↓ Flagged</Text>
                </View>
              )}
            </View>
            {(changeLog.toOptimalNames.length > 0 || changeLog.toMonitorNames.length > 0 || changeLog.toFlaggedNames.length > 0) && (
              <View style={styles.changeLogNames}>
                {changeLog.toOptimalNames.length > 0 && (
                  <Text style={[styles.changeLogNameLine, { color: theme.textSecondary }]}>
                    <Text style={{ color: "#00D084" }}>Optimal: </Text>{changeLog.toOptimalNames.join(", ")}
                  </Text>
                )}
                {changeLog.toMonitorNames.length > 0 && (
                  <Text style={[styles.changeLogNameLine, { color: theme.textSecondary }]}>
                    <Text style={{ color: "#F5A623" }}>Monitor: </Text>{changeLog.toMonitorNames.join(", ")}
                  </Text>
                )}
                {changeLog.toFlaggedNames.length > 0 && (
                  <Text style={[styles.changeLogNameLine, { color: theme.textSecondary }]}>
                    <Text style={{ color: "#F11A22" }}>Flagged: </Text>{changeLog.toFlaggedNames.join(", ")}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {renderSection(redLabs, "red", "FLAGGED", "#F11A22", "rgba(241,26,34,0.15)", "rgba(220,20,28,0.25)", "No flagged results.")}
        {renderSection(amberLabs, "amber", "MONITOR", "#F5A623", "rgba(245,166,35,0.1)", "rgba(245,166,35,0.25)", "No monitored results.")}
        {renderSection(greenLabs, "green", "OPTIMAL", "#00D084", "rgba(0,208,132,0.15)", "rgba(0,200,120,0.25)", "No optimal results yet.")}

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
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)}
            />
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.formInput, { flex: 1 }]}
                placeholder="Marker name"
                placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
                value={labName}
                onChangeText={(t) => { setLabName(t); setShowSuggestions(true); }}
                onFocus={() => { setShowSuggestions(true); setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100); }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <View style={[styles.suggestionsBox, { backgroundColor: theme.tabBar, borderColor: theme.tabBarBorder }]}>
                  {suggestions.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.suggestionRow, { borderBottomColor: theme.cardBorder }]}
                      onPress={() => applySuggestion(m)}
                    >
                      <Text style={[styles.suggestionName, { color: theme.text }]}>{m.name}</Text>
                      <Text style={[styles.suggestionMeta, { color: theme.textTertiary }]}>{m.value} · {m.reference}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
          <View style={styles.formRow}>
            <TextInput
              style={[styles.formInput, { flex: 1, marginRight: 8 }]}
              placeholder="Value"
              placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
              value={labValue}
              onChangeText={setLabValue}
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)}
            />
            <TextInput
              style={[styles.formInput, { flex: 1 }]}
              placeholder="Reference range"
              placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
              value={labRef}
              onChangeText={setLabRef}
              onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)}
            />
          </View>
          <View style={styles.statusRow}>
            <StatusToggle value="green" label="✓ Normal" color="#00D084" />
            <StatusToggle value="amber" label="⚠ Monitor" color="#F5A623" />
            <StatusToggle value="red" label="✗ Flagged" color="#F11A22" />
          </View>
          {labStatus === "red" && (
            <View style={[styles.statusRow, { marginTop: 0 }]}>
              <TouchableOpacity
                style={[styles.statusBtn, labDirection === "high" && { borderColor: "#F11A22", backgroundColor: "rgba(241,26,34,0.12)" }]}
                onPress={() => setLabDirection("high")}
              >
                <Text style={[styles.statusBtnText, labDirection === "high" && { color: "#F11A22" }]}>↑ Too High</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.statusBtn, labDirection === "low" && { borderColor: "#F11A22", backgroundColor: "rgba(241,26,34,0.12)" }]}
                onPress={() => setLabDirection("low")}
              >
                <Text style={[styles.statusBtnText, labDirection === "low" && { color: "#F11A22" }]}>↓ Too Low</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={styles.addBtn} onPress={addLab}>
            <Text style={styles.addBtnText}>Add Lab Result</Text>
          </TouchableOpacity>
        </Card>
        </View>
      </ScrollView>

      {detailMarker && (
        <LabDetailModal
          markerName={detailMarker}
          allLabs={allLabs}
          onClose={() => setDetailMarker(null)}
          onDelete={deleteLab}
          onAdd={addLabDirect}
          userProfile={userProfile}
        />
      )}
    </>
  );
}

function makeStyles(theme: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, paddingBottom: 110, gap: 12 },
    heroWrap: {
      alignItems: "center",
      minHeight: HERO_MIN_HEIGHT,
      paddingTop: HERO_CONTENT_TOP,
      paddingBottom: 20,
      marginTop: -16,
      marginHorizontal: -16,
    },
    sheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      marginTop: -24,
      marginHorizontal: -16,
      paddingHorizontal: 16,
      paddingTop: 24,
      gap: 12,
    },
    ringLegend: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 10,
      marginTop: 18,
      paddingHorizontal: 12,
    },
    ringLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    ringLegendText: { fontSize: 11.5, fontWeight: "600", color: "rgba(255,255,255,0.85)" },
    sectionLabel: {
      fontFamily: FONT_DISPLAY, fontSize: 11, letterSpacing: 1.5,
      textTransform: "uppercase", marginBottom: 14, color: theme.textTertiary,
    },
    changeLogCard: {
      borderWidth: 1, borderRadius: 14, padding: 16,
    },
    changeLogTitle: {
      fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: 1.4, marginBottom: 14, color: theme.textTertiary,
    },
    changeLogStats: { flexDirection: "row", gap: 24 },
    changeLogStat: { alignItems: "center" },
    changeLogNum: { fontSize: 28, fontWeight: "800", lineHeight: 30 },
    changeLogLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, marginTop: 2 },
    changeLogNames: { marginTop: 12, gap: 4 },
    changeLogNameLine: { fontSize: 12, lineHeight: 17 },
    labRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.cardBorder,
      paddingHorizontal: 4, marginHorizontal: -4,
    },
    labLeft: { flex: 1 },
    labName: { fontSize: 15, color: theme.text, fontWeight: "500" },
    labRef: { fontSize: 12, color: theme.textTertiary, marginTop: 3, letterSpacing: 0.3 },
    labTrend: { fontSize: 11, fontWeight: "600", marginTop: 3, letterSpacing: 0.2 },
    labHistory: { fontSize: 11, marginTop: 2 },
    labRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    labValue: { fontWeight: "700", fontSize: 15 },
    chevron: { fontSize: 20, marginLeft: -4 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5, borderWidth: 1 },
    badgeText: { fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: 0.9, textTransform: "uppercase" },
    formRow: { flexDirection: "row", marginBottom: 8 },
    formInput: {
      backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.inputBorder,
      borderRadius: 8, padding: 9, paddingHorizontal: 12, fontSize: 13, color: theme.text,
    },
    statusRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
    statusBtn: {
      flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1,
      borderColor: theme.pillBorder, alignItems: "center",
    },
    statusBtnText: { fontSize: 12, fontWeight: "600", color: theme.textSecondary },
    addBtn: {
      backgroundColor: theme.accent, borderRadius: 8, paddingVertical: 12,
      alignItems: "center", marginTop: 4,
    },
    addBtnText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
    emptyNote: { fontSize: 13, color: theme.textTertiary, marginVertical: 8 },
    accordionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    accordionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    accordionDot: { width: 8, height: 8, borderRadius: 4 },
    accordionTitle: { fontFamily: FONT_DISPLAY, fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase" },
    accordionCount: {
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1,
      minWidth: 24, alignItems: "center",
    },
    accordionCountText: { fontSize: 11, fontWeight: "700" },
    accordionChevron: { fontSize: 10 },
    suggestionsBox: {
      position: "absolute", top: 38, left: 0, right: 0, zIndex: 100,
      borderWidth: 1, borderRadius: 8, overflow: "hidden",
    },
    suggestionRow: {
      paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1,
    },
    suggestionName: { fontSize: 13, fontWeight: "500" },
    suggestionMeta: { fontSize: 11, marginTop: 1 },
  });
}
