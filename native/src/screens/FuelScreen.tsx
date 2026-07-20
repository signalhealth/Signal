import React, { useState, useContext, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import Svg, { Path as SvgPath } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { HealthContext } from "../context/HealthContext";
import { Card } from "../components/MetricCard";
import { LineChart } from "../components/WeightChart";
import { MarkdownResult } from "../components/MarkdownResult";
import { MultiRingGauge } from "../components/MultiRingGauge";
import { METRIC_ICON_PATHS } from "../components/metricIcons";
import { HERO_MIN_HEIGHT, HERO_CONTENT_TOP } from "../components/heroLayout";
import { FuelCtx, MACRO_TARGETS } from "../types/health";
import { FONT_DISPLAY } from "../theme/typography";

function WaterGlass({ oz, goal, theme }: { oz: number; goal: number; theme: ThemeColors }) {
  const W = 72;
  const H = 110;
  const pct = Math.min(1, goal > 0 ? oz / goal : 0);

  // Tapered glass: top full width, bottom inset 10 each side
  const fillH = pct * (H - 2);
  const fillY = H - fillH;
  // Left wall: x=0 at y=0, x=10 at y=H; Right wall: x=W at y=0, x=W-10 at y=H
  const leftAtFill = (fillY / H) * 10;
  const rightAtFill = W - (fillY / H) * 10;

  const color = pct >= 1 ? theme.green : pct >= 0.5 ? theme.accentBright : theme.amber;

  const fillPath = pct > 0
    ? `M${leftAtFill},${fillY} L10,${H} L${W - 10},${H} L${rightAtFill},${fillY} Z`
    : "";
  const wavePath = pct > 0 && pct < 1
    ? `M${leftAtFill + 2},${fillY} Q${W / 2},${fillY - 4} ${rightAtFill - 2},${fillY}`
    : "";

  // Tick marks at 25%, 50%, 75%
  const ticks = [0.25, 0.5, 0.75].map((p) => {
    const ty = H - p * (H - 2);
    const lx = (ty / H) * 10;
    return { y: ty, x1: lx + 1, x2: lx + 7 };
  });

  return (
    <Svg width={W} height={H}>
      {pct > 0 && <SvgPath d={fillPath} fill={color + "40"} />}
      {wavePath ? <SvgPath d={wavePath} stroke={color} strokeWidth={1.5} fill="none" opacity={0.8} /> : null}
      <SvgPath d={`M0,0 L10,${H} M${W},0 L${W - 10},${H}`} stroke={theme.textTertiary} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <SvgPath d={`M10,${H} L${W - 10},${H}`} stroke={theme.textTertiary} strokeWidth={1.5} strokeLinecap="round" />
      {ticks.map((t, i) => (
        <SvgPath key={i} d={`M${t.x1},${t.y} L${t.x2},${t.y}`} stroke={theme.textTertiary} strokeWidth={1} opacity={0.35} />
      ))}
    </Svg>
  );
}

function parseMacroTarget(val: string, fallback: number): number {
  const n = parseInt(val, 10);
  return isNaN(n) || n <= 0 ? fallback : n;
}
import { analyzeFuel as analyzeWithAI } from "../services/anthropic";
import { getAnthropicKey } from "../services/storage";
import { writeHydration } from "../services/healthConnect";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtShortDate(iso: string | undefined): string {
  if (!iso) return "";
  const [, mm, dd] = iso.split("-").map(Number);
  return `${MONTHS[mm - 1]} ${dd}`;
}

function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const [yr, mm, dd] = iso.split("-").map(Number);
  return `${MONTHS[mm - 1]} ${dd}, ${yr}`;
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function MacroBox({
  label,
  value,
  target,
  unit,
  color,
  theme,
}: {
  label: string;
  value: number | undefined;
  target: string | null;
  unit: string;
  color: string;
  theme: ThemeColors;
}) {
  return (
    <View style={[macroStyles.box, { backgroundColor: theme.cardAlt }]}>
      <Text style={[macroStyles.label, { color: theme.textTertiary }]}>{label.toUpperCase()}</Text>
      <Text style={[macroStyles.value, { color }]}>
        {value !== undefined ? value : "—"}
      </Text>
      {target !== null && (
        <Text style={[macroStyles.target, { color: theme.textTertiary }]}>
          / {target} {unit}
        </Text>
      )}
    </View>
  );
}

const macroStyles = StyleSheet.create({
  box: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 8,
  },
  value: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 36,
  },
  target: { fontSize: 12, marginTop: 4 },
});

export function FuelScreen() {
  const { healthData, appState, userProfile, refresh, updateAppState } = useContext(HealthContext);
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);

  const waterGoal = parseMacroTarget(userProfile.waterGoalOz, 64);
  const today = localDateStr();
  // Prefer HC hydration (aggregates Coros + Signal logs), fall back to local cache
  const hcTodayOz = healthData.hydration.find((h) => h.date === today)?.value;
  const todayWater = appState.water.find((w) => w.date === today)?.oz ?? hcTodayOz ?? 0;

  function adjustWater(delta: number) {
    const baseOz = appState.water.find((w) => w.date === today)?.oz ?? hcTodayOz ?? 0;
    const next = Math.max(0, Math.round(baseOz + delta));
    if (delta > 0) writeHydration(delta).catch(() => {});
    const existing = appState.water.find((w) => w.date === today);
    const newEntry = { date: today, oz: next };
    updateAppState({
      ...appState,
      water: existing
        ? appState.water.map((w) => (w.date === today ? newEntry : w))
        : [...appState.water, newEntry],
    });
  }

  const [fuelCtx, setFuelCtx] = useState<FuelCtx>({
    trained: null,
    sleep: null,
    goal: "recomp",
  });
  const [fuelResult, setFuelResult] = useState(
    "Enter today's intake and tap Analyze to get a personalized recommendation."
  );
  const [fuelLoading, setFuelLoading] = useState(false);
  const [calDays, setCalDays] = useState(14);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const hasAnyTarget =
    userProfile.calorieTarget ||
    userProfile.proteinTarget ||
    userProfile.carbTarget ||
    userProfile.fatTarget;
  const targets = hasAnyTarget
    ? {
        calories: parseMacroTarget(userProfile.calorieTarget, MACRO_TARGETS.calories),
        protein: parseMacroTarget(userProfile.proteinTarget, MACRO_TARGETS.protein),
        carbs: parseMacroTarget(userProfile.carbTarget, MACRO_TARGETS.carbs),
        fat: parseMacroTarget(userProfile.fatTarget, MACRO_TARGETS.fat),
      }
    : null;
  const ringTargets = targets ?? MACRO_TARGETS;
  const pct = (value: number | undefined, target: number) =>
    target ? Math.round(((value ?? 0) / target) * 100) : 0;

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

  // Calorie history for chart
  const nutritionSorted = [...healthData.nutrition].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const todayNutrition = healthData.nutrition.find((n) => n.date === today);
  const calHistory = nutritionSorted.slice(-calDays);

  // 30-day averages
  const last30 = nutritionSorted.slice(-30);
  const avgCals = Math.round(avg(last30.map((n) => n.cals)));
  const avgProtein = Math.round(avg(last30.map((n) => n.protein)));
  const avgCarbs = Math.round(avg(last30.map((n) => n.carbs)));
  const avgFat = Math.round(avg(last30.map((n) => n.fat)));

  function setCtx<K extends keyof FuelCtx>(key: K, val: FuelCtx[K]) {
    setFuelCtx((prev) => ({ ...prev, [key]: val }));
  }

  async function handleAnalyze() {
    const key = await getAnthropicKey();
    if (!key) {
      setFuelResult("Add your Anthropic API key in ⚙ settings (top right) to enable AI analysis.");
      return;
    }
    setFuelLoading(true);
    setFuelResult("Analyzing…");
    const result = await analyzeWithAI(key, healthData, fuelCtx, appState, userProfile);
    setFuelLoading(false);
    if (result.authError) {
      setFuelResult("API key rejected — update it in ⚙ settings (top right).");
    } else if (result.success && result.text) {
      setFuelResult(result.text);
    } else {
      setFuelResult(result.error || "An error occurred.");
    }
  }

  const CtxBtn = ({
    id,
    label,
    active,
    onPress,
  }: {
    id: string;
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      key={id}
      onPress={onPress}
      style={[styles.ctxBtn, active && styles.ctxBtnActive]}
    >
      <Text style={[styles.ctxBtnText, active && styles.ctxBtnTextActive]}>
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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accentBright}
          colors={[theme.accentBright]}
        />
      }
    >
      {/* ── Macro Rings Hero ── */}
      <View style={[styles.heroWrap, { backgroundColor: theme.hero }]}>
        <MultiRingGauge
          rings={[
            { fraction: (todayNutrition?.cals ?? 0) / ringTargets.calories, color: "#FFFFFF" },
            { fraction: (todayNutrition?.protein ?? 0) / ringTargets.protein, color: theme.red },
            { fraction: (todayNutrition?.carbs ?? 0) / ringTargets.carbs, color: theme.accentBright },
            { fraction: (todayNutrition?.fat ?? 0) / ringTargets.fat, color: theme.gray },
          ]}
        />
        <View style={styles.ringLegend}>
          <View style={styles.ringLegendItem}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <SvgPath d={METRIC_ICON_PATHS.calories} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.ringLegendText}>Cal {pct(todayNutrition?.cals, ringTargets.calories)}%</Text>
          </View>
          <View style={styles.ringLegendItem}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <SvgPath d={METRIC_ICON_PATHS.protein} stroke={theme.red} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.ringLegendText}>Protein {pct(todayNutrition?.protein, ringTargets.protein)}%</Text>
          </View>
          <View style={styles.ringLegendItem}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <SvgPath d={METRIC_ICON_PATHS.fat} stroke={theme.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.ringLegendText}>Fat {pct(todayNutrition?.fat, ringTargets.fat)}%</Text>
          </View>
          <View style={styles.ringLegendItem}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <SvgPath d={METRIC_ICON_PATHS.carbs} stroke={theme.accentBright} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.ringLegendText}>Carbs {pct(todayNutrition?.carbs, ringTargets.carbs)}%</Text>
          </View>
        </View>
      </View>

      <View style={styles.sheet}>

      {/* ── Today's Intake ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.lbl}>TODAY'S INTAKE</Text>
        </View>

        <View style={styles.macroGrid}>
          <MacroBox
            label="Calories"
            value={todayNutrition?.cals}
            target={targets ? targets.calories.toLocaleString() : null}
            unit="kcal"
            color={theme.text}
            theme={theme}
          />
          <MacroBox
            label="Protein"
            value={todayNutrition?.protein}
            target={targets ? `${targets.protein}g` : null}
            unit=""
            color={theme.red}
            theme={theme}
          />
        </View>
        <View style={[styles.macroGrid, { marginTop: 10 }]}>
          <MacroBox
            label="Carbs"
            value={todayNutrition?.carbs}
            target={targets ? `${targets.carbs}g` : null}
            unit=""
            color={theme.accentBright}
            theme={theme}
          />
          <MacroBox
            label="Fat"
            value={todayNutrition?.fat}
            target={targets ? `${targets.fat}g` : null}
            unit=""
            color={theme.gray}
            theme={theme}
          />
        </View>
      </Card>

      {/* ── Context Toggles ── */}
      <Card>
        <Text style={styles.lbl}>TODAY'S CONTEXT</Text>
        <View style={styles.ctxGrid}>
          <View style={styles.ctxCol}>
            <Text style={styles.ctxGroupLabel}>TRAINED TODAY?</Text>
            <View style={styles.ctxRow}>
              <CtxBtn
                id="yes"
                label="Yes"
                active={fuelCtx.trained === "yes"}
                onPress={() => setCtx("trained", "yes")}
              />
              <CtxBtn
                id="no"
                label="No"
                active={fuelCtx.trained === "no"}
                onPress={() => setCtx("trained", "no")}
              />
            </View>
          </View>
          <View style={styles.ctxCol}>
            <Text style={styles.ctxGroupLabel}>SLEEP QUALITY</Text>
            <View style={styles.ctxRow}>
              <CtxBtn
                id="good"
                label="Good"
                active={fuelCtx.sleep === "good"}
                onPress={() => setCtx("sleep", "good")}
              />
              <CtxBtn
                id="poor"
                label="Poor"
                active={fuelCtx.sleep === "poor"}
                onPress={() => setCtx("sleep", "poor")}
              />
            </View>
          </View>
        </View>
        <View style={{ marginTop: 14 }}>
          <Text style={styles.ctxGroupLabel}>GOAL TODAY</Text>
          <View style={styles.ctxRow}>
            {(
              [
                { id: "recomp", label: "Recomp" },
                { id: "performance", label: "Performance" },
                { id: "recovery", label: "Recovery" },
              ] as const
            ).map((g) => (
              <CtxBtn
                key={g.id}
                id={g.id}
                label={g.label}
                active={fuelCtx.goal === g.id}
                onPress={() => setCtx("goal", g.id)}
              />
            ))}
          </View>
        </View>
      </Card>

      {/* ── AI Fuel Advisor ── */}
      <View style={styles.fuelAdvisorCard}>
        <Text style={styles.fuelAdvisorLabel}>SIGNAL FUEL ADVISOR</Text>
        <MarkdownResult theme={theme}>{fuelResult}</MarkdownResult>
        <TouchableOpacity
          style={[styles.analyzeBtn, fuelLoading && { opacity: 0.6 }]}
          onPress={handleAnalyze}
          disabled={fuelLoading}
        >
          <Text style={styles.analyzeBtnText}>
            {fuelLoading ? "ANALYZING..." : "ANALYZE"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Water Tracking ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.lbl}>DAILY WATER</Text>
          <Text style={styles.dateText}>{fmtDate(today)}</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 20, marginTop: 4, marginBottom: 20 }}>
          <WaterGlass oz={todayWater} goal={waterGoal} theme={theme} />
          <View style={{ flex: 1, paddingBottom: 4 }}>
            <View style={styles.waterNumRow}>
              <Text style={styles.waterNum}>{todayWater}</Text>
              <Text style={styles.waterUnit}>oz</Text>
            </View>
            <Text style={styles.waterGoalLabel}>/ {waterGoal} oz goal</Text>
            <Text style={styles.waterPct}>
              {Math.round((todayWater / waterGoal) * 100)}% of goal
            </Text>
          </View>
        </View>

        <View style={styles.waterAdjRow}>
          <TouchableOpacity style={styles.waterAdjBtn} onPress={() => adjustWater(-8)}>
            <Text style={styles.waterAdjText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.waterAdjLabel}>8 oz</Text>
          <TouchableOpacity style={styles.waterAdjBtn} onPress={() => adjustWater(8)}>
            <Text style={styles.waterAdjText}>+</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* ── Calorie History Chart ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.lbl}>CALORIE HISTORY</Text>
          <View style={styles.pills}>
            {([14, 30, 60] as const).map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setCalDays(d)}
                style={[styles.pill, calDays === d && styles.pillOn]}
              >
                <Text
                  style={[
                    styles.pillText,
                    calDays === d && styles.pillTextOn,
                  ]}
                >
                  {d}D
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {calHistory.length > 0 ? (
          <>
            <Text style={styles.calHistoryLabel}>
              {`Avg: ${Math.round(avg(calHistory.map((n) => n.cals)))} kcal`}
              {targets ? ` · Target: ${targets.calories.toLocaleString()} kcal` : ""}
            </Text>
            <LineChart
              data={calHistory.map((n) => ({ date: n.date, value: n.cals }))}
              height={140}
              barMode
              barColorFn={(v) => {
                if (!targets) return "rgba(96,175,255,0.8)";
                return v >= targets.calories - 100 && v <= targets.calories + 100
                  ? "rgba(96,175,255,0.8)"
                  : v > targets.calories + 100
                  ? "rgba(241,26,34,0.7)"
                  : "rgba(255,170,0,0.7)";
              }}
              rangeBand={targets ? {
                low: targets.calories - 75,
                high: targets.calories + 75,
                color: "rgba(0,200,100,0.12)",
                label: `Target: ${targets.calories.toLocaleString()} kcal`,
              } : undefined}
              minVal={0}
              maxVal={2400}
            />
          </>
        ) : (
          <Text style={styles.noData}>
            No nutrition data available from Health Connect.
          </Text>
        )}
      </Card>

      {/* ── 30-Day Averages ── */}
      <Card>
        <Text style={styles.lbl}>30-DAY AVERAGES</Text>
        <View style={styles.avgGrid}>
          <AvgStat value={last30.length ? avgCals : "—"} unit="kcal" theme={theme} />
          <AvgStat value={last30.length ? avgProtein : "—"} unit="protein" theme={theme} />
          <AvgStat value={last30.length ? avgCarbs : "—"} unit="carbs" theme={theme} />
          <AvgStat value={last30.length ? avgFat : "—"} unit="fat" theme={theme} />
        </View>
      </Card>

      </View>
    </ScrollView>
  );
}

function AvgStat({
  value,
  unit,
  color,
  theme,
}: {
  value: number | string;
  unit: string;
  color?: string;
  theme: ThemeColors;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={[avgStyles.num, { color: color ?? theme.text }]}>{value}</Text>
      <Text style={[avgStyles.unit, { color: theme.textTertiary }]}>{unit}</Text>
    </View>
  );
}

const avgStyles = StyleSheet.create({
  num: {
    fontWeight: "700",
    fontSize: 30,
    lineHeight: 34,
  },
  unit: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 5,
  },
});


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
    lbl: {
      fontFamily: FONT_DISPLAY,
      fontSize: 11,
      letterSpacing: 1.5,
      color: theme.textTertiary,
      textTransform: "uppercase",
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 16,
    },
    dateText: { fontSize: 12, color: theme.textTertiary, marginTop: 3 },
    syncDate: { fontSize: 11, color: theme.textTertiary, letterSpacing: 0.3 },
    syncBadge: {
      fontSize: 11,
      color: theme.green,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    macroGrid: { flexDirection: "row", gap: 10 },

    ctxGrid: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 0 },
    ctxCol: { flex: 1 },
    ctxGroupLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textTertiary,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 7,
    },
    ctxRow: { flexDirection: "row", gap: 6 },
    ctxBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.pillBorder,
      backgroundColor: "transparent",
      alignItems: "center",
    },
    ctxBtnActive: {
      borderColor: theme.accent,
      backgroundColor: isDark ? "rgba(0,102,204,0.15)" : "rgba(0,102,204,0.08)",
    },
    ctxBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
    },
    ctxBtnTextActive: { color: theme.accent },

    fuelAdvisorCard: {
      backgroundColor: theme.insightCard,
      borderWidth: 1,
      borderColor: theme.insightCardBorder,
      borderRadius: 16,
      padding: 20,
    },
    fuelAdvisorLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      color: theme.accent,
      textTransform: "uppercase",
      marginBottom: 12,
    },
    fuelResultText: {
      fontSize: 14,
      color: theme.textSecondary,
      lineHeight: 22,
      minHeight: 60,
    },
    analyzeBtn: {
      backgroundColor: theme.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 16,
    },
    analyzeBtnText: {
      fontFamily: FONT_DISPLAY,
      color: "#FFFFFF",
      fontSize: 14,
      letterSpacing: 1,
    },
    calHistoryLabel: {
      fontSize: 13,
      color: theme.textSecondary,
      marginBottom: 12,
    },
    noData: {
      fontSize: 13,
      color: theme.textTertiary,
      textAlign: "center",
      paddingVertical: 20,
    },

    avgGrid: {
      flexDirection: "row",
      gap: 12,
      marginTop: 4,
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

    track: {
      height: 4,
      backgroundColor: theme.sectionBorder,
      borderRadius: 99,
      overflow: "hidden",
    },
    trackFill: { height: "100%", borderRadius: 99 },

    waterNumRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
      marginTop: 4,
    },
    waterNum: {
      fontSize: 52,
      fontWeight: "700",
      color: theme.text,
      lineHeight: 56,
      letterSpacing: -1,
    },
    waterUnit: {
      fontSize: 16,
      color: theme.textSecondary,
      paddingBottom: 8,
    },
    waterGoalLabel: {
      fontSize: 14,
      color: theme.textTertiary,
      paddingBottom: 8,
    },
    waterPct: {
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    waterAdjRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 28,
    },
    waterAdjBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 1.5,
      borderColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    waterAdjText: {
      fontSize: 30,
      fontWeight: "400",
      color: theme.accent,
      lineHeight: 34,
      includeFontPadding: false,
    },
    waterAdjLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.textTertiary,
      letterSpacing: 0.5,
      minWidth: 40,
      textAlign: "center",
    },
  });
}
