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
import { useFocusEffect } from "@react-navigation/native";
import { HealthContext } from "../context/HealthContext";
import { Card } from "../components/MetricCard";
import { MarkdownResult } from "../components/MarkdownResult";
import { LineChart } from "../components/WeightChart";
import { LabResult, UserProfile } from "../types/health";
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

const LOWER_IS_BETTER = new Set([
  "LDL", "LDL Cholesterol", "Total Cholesterol", "Lp(a)", "Lipoprotein(a)",
  "Body Fat", "Triglycerides", "ApoB", "Lp-PLA2", "CRP", "Homocysteine",
  "BUN", "BUN/Creat Ratio", "Alb/Glob Ratio", "PSA, Total", "Insulin", "Hemoglobin A1C",
]);

function badgeLabel(lab: LabResult): string {
  return lab.status === "red"
    ? lab.direction === "low" ? "LOW" : "HIGH"
    : lab.status === "amber" ? "MONITOR" : "OK";
}

function getTrendArrow(
  lab: LabResult,
  allLabs: LabResult[]
): { delta: string; color: string } | null {
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
  return { delta: `${arrow} ${absDiff} from last`, color: improved ? "#00D084" : "#F5A623" };
}

// ── Lab detail modal ─────────────────────────────────────────────────────────

function LabDetailModal({
  markerName,
  allLabs,
  onClose,
  onDelete,
  userProfile,
}: {
  markerName: string;
  allLabs: LabResult[];
  onClose: () => void;
  onDelete: (id: string) => void;
  userProfile: UserProfile;
}) {
  const { theme, isDark } = useTheme();
  const [analysis, setAnalysis] = useState(
    "Tap Analyze below for a plain-language explanation and actionable guidance."
  );
  const [analyzing, setAnalyzing] = useState(false);

  const entries = allLabs
    .filter((l) => l.name === markerName)
    .sort((a, b) => b.date.localeCompare(a.date));

  useEffect(() => {
    if (entries.length === 0) onClose();
  }, [entries.length]);

  const latest = entries[0];
  const cfg = latest ? STATUS_CONFIG[latest.status] : STATUS_CONFIG.green;

  const chartData = useMemo(() =>
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

  const s = mStyles(theme, isDark);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: theme.tabBarBorder, backgroundColor: theme.tabBar }]}>
          <Text style={[s.headerTitle, { color: theme.text }]}>{markerName.toUpperCase()}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[s.closeBtn, { color: theme.textTertiary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Latest value */}
          {latest && (
            <View style={s.latestRow}>
              <Text style={[s.latestValue, { color: cfg.text }]}>{latest.value}</Text>
              <View style={[s.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                <Text style={[s.badgeText, { color: cfg.text }]}>{badgeLabel(latest)}</Text>
              </View>
            </View>
          )}
          {latest?.reference ? (
            <Text style={[s.refText, { color: theme.textTertiary }]}>Reference: {latest.reference}</Text>
          ) : null}

          {/* Chart */}
          {chartData.length >= 2 && (
            <View style={s.chartWrap}>
              <LineChart
                data={chartData}
                height={130}
                color={cfg.text}
                showDots
                dotColorFn={(v) => {
                  if (!latest) return cfg.text;
                  const max = Math.max(...chartData.map(d => d.value));
                  const min = Math.min(...chartData.map(d => d.value));
                  return v === max || v === min ? "#FFAA00" : cfg.text;
                }}
              />
            </View>
          )}

          {/* History */}
          <Text style={[s.sectionLabel, { color: theme.textTertiary }]}>HISTORY</Text>
          {entries.map((e) => {
            const eCfg = STATUS_CONFIG[e.status];
            const trend = getTrendArrow(e, allLabs);
            return (
              <View key={e.id} style={[s.historyRow, { borderBottomColor: theme.cardBorder }]}>
                <View style={s.historyLeft}>
                  <Text style={[s.historyDate, { color: theme.textSecondary }]}>{e.date}</Text>
                  {trend && (
                    <Text style={[s.historyTrend, { color: trend.color }]}>{trend.delta}</Text>
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
      paddingVertical: 16,
      borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 14, fontWeight: "700", letterSpacing: 1.4 },
    closeBtn: { fontSize: 20, fontWeight: "400" },
    content: { padding: 20, paddingBottom: 48, gap: 0 },
    latestRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
    latestValue: { fontSize: 36, fontWeight: "700" },
    refText: { fontSize: 12, marginBottom: 20, letterSpacing: 0.3 },
    chartWrap: { marginBottom: 24, marginTop: 4 },
    sectionLabel: {
      fontSize: 11, fontWeight: "700", letterSpacing: 1.5,
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
    badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase" },
    delBtn: { fontSize: 20, paddingHorizontal: 4 },
    advisorCard: {
      borderWidth: 1, borderRadius: 16, padding: 20, marginTop: 28,
    },
    advisorLabel: {
      fontSize: 11, fontWeight: "700", letterSpacing: 1.5,
      textTransform: "uppercase", marginBottom: 10,
    },
    analyzeBtn: { borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 },
    analyzeBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13, letterSpacing: 0.8 },
  });
}

// ── Main screen ──────────────────────────────────────────────────────────────

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

  const [labDate, setLabDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [labName, setLabName] = useState("");
  const [labValue, setLabValue] = useState("");
  const [labRef, setLabRef] = useState("");
  const [labStatus, setLabStatus] = useState<"green" | "amber" | "red">("green");
  const [labDirection, setLabDirection] = useState<"high" | "low">("high");

  const [detailMarker, setDetailMarker] = useState<string | null>(null);

  // All entries sorted newest-first — used for trend arrows and modal history
  const allLabs = useMemo(
    () => [...appState.labs].sort((a, b) => b.date.localeCompare(a.date)),
    [appState.labs]
  );

  // One entry per marker name (most recent wins) for section display
  const latestByName = useMemo(() => {
    const map = new Map<string, LabResult>();
    for (const lab of allLabs) {
      if (!map.has(lab.name)) map.set(lab.name, lab);
    }
    return Array.from(map.values());
  }, [allLabs]);

  const redLabs = latestByName.filter((l) => l.status === "red");
  const amberLabs = latestByName.filter((l) => l.status === "amber");
  const greenLabs = latestByName.filter((l) => l.status === "green");

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
                const trend = getTrendArrow(lab, allLabs);
                const allForMarker = allLabs.filter(l => l.name === lab.name);
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
                      {trend && <Text style={[styles.labTrend, { color: trend.color }]}>{trend.delta}</Text>}
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
      >
        {renderSection(redLabs, "red", "FLAGGED", "#FF3B30", "rgba(255,59,48,0.15)", "rgba(233,40,58,0.25)", "No flagged results.")}
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

      {detailMarker && (
        <LabDetailModal
          markerName={detailMarker}
          allLabs={allLabs}
          onClose={() => setDetailMarker(null)}
          onDelete={deleteLab}
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
    sectionLabel: {
      fontSize: 11, fontWeight: "700", letterSpacing: 1.5,
      textTransform: "uppercase", marginBottom: 14, color: theme.textTertiary,
    },
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
    badgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.9, textTransform: "uppercase" },

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
    accordionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" },
    accordionCount: {
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1,
      minWidth: 24, alignItems: "center",
    },
    accordionCountText: { fontSize: 11, fontWeight: "700" },
    accordionChevron: { fontSize: 10 },
  });
}
