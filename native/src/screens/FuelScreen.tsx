import React, { useState, useContext, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { HealthContext } from "../context/HealthContext";
import { Card } from "../components/MetricCard";
import { LineChart } from "../components/WeightChart";
import { FuelCtx, MACRO_TARGETS, DEFAULT_MICROS } from "../types/health";
import { analyzeFuel as analyzeWithAI } from "../services/anthropic";
import {
  getAnthropicKey,
  setAnthropicKey,
  removeAnthropicKey,
} from "../services/storage";
import { useTheme } from "../context/ThemeContext";
import { ThemeColors } from "../context/ThemeContext";

function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  target: string;
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
      <Text style={[macroStyles.target, { color: theme.textTertiary }]}>
        / {target} {unit}
      </Text>
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
  const { healthData, appState, userProfile, refresh } = useContext(HealthContext);
  const { theme, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(theme, isDark), [theme, isDark]);

  const COLORS = {
    green: theme.green,
    amber: theme.amber,
    blue: theme.accent,
    red: theme.red,
  };

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
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");
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

  const today = localDateStr();

  // Calorie history for chart
  const nutritionSorted = [...healthData.nutrition].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const todayNutrition =
    healthData.nutrition.find((n) => n.date === today) ??
    (nutritionSorted.length > 0 ? nutritionSorted[nutritionSorted.length - 1] : undefined);
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
      setShowApiKeyInput(true);
      return;
    }
    setFuelLoading(true);
    setFuelResult("Analyzing…");
    const result = await analyzeWithAI(key, healthData, fuelCtx, appState, userProfile);
    setFuelLoading(false);
    if (result.authError) {
      setFuelResult("API key rejected — tap ⚙ to update it.");
    } else if (result.success && result.text) {
      setFuelResult(result.text);
    } else {
      setFuelResult(result.error || "An error occurred.");
    }
  }

  async function handleSaveApiKey() {
    const k = apiKeyInput.trim().replace(/\s+/g, "");
    if (!k.startsWith("sk-ant-")) {
      setApiKeyError("Key should start with sk-ant- — check for typos");
      return;
    }
    await setAnthropicKey(k);
    setShowApiKeyInput(false);
    setApiKeyInput("");
    setApiKeyError("");
    handleAnalyze();
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
      {/* ── Today's Intake ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.lbl}>TODAY'S INTAKE</Text>
            <Text style={styles.dateText}>
              {todayNutrition?.date === today
                ? today
                : todayNutrition?.date
                ? `${todayNutrition.date} (latest)`
                : today}
            </Text>
          </View>
          {healthData.nutrition.length > 0 && (
            <Text style={styles.syncBadge}>Health Connect ✓</Text>
          )}
        </View>

        <View style={styles.macroGrid}>
          <MacroBox
            label="Calories"
            value={todayNutrition?.cals}
            target={MACRO_TARGETS.calories.toLocaleString()}
            unit="kcal"
            color={theme.text}
            theme={theme}
          />
          <MacroBox
            label="Protein"
            value={todayNutrition?.protein}
            target={`${MACRO_TARGETS.protein}g`}
            unit=""
            color={COLORS.green}
            theme={theme}
          />
        </View>
        <View style={[styles.macroGrid, { marginTop: 10 }]}>
          <MacroBox
            label="Carbs"
            value={todayNutrition?.carbs}
            target={`${MACRO_TARGETS.carbs}g`}
            unit=""
            color={COLORS.blue}
            theme={theme}
          />
          <MacroBox
            label="Fat"
            value={todayNutrition?.fat}
            target={`${MACRO_TARGETS.fat}g`}
            unit=""
            color={COLORS.amber}
            theme={theme}
          />
        </View>

        {todayNutrition && (
          <View style={{ marginTop: 16 }}>
            <MacroProgressBar
              label="Calories"
              value={todayNutrition.cals}
              max={MACRO_TARGETS.calories}
              color={COLORS.blue}
              displayVal={`${todayNutrition.cals} / ${MACRO_TARGETS.calories}`}
              theme={theme}
            />
            <MacroProgressBar
              label="Protein"
              value={todayNutrition.protein}
              max={MACRO_TARGETS.protein}
              color={COLORS.green}
              displayVal={`${todayNutrition.protein}g / ${MACRO_TARGETS.protein}g`}
              theme={theme}
            />
            <MacroProgressBar
              label="Carbs"
              value={todayNutrition.carbs}
              max={MACRO_TARGETS.carbs}
              color={COLORS.blue}
              displayVal={`${todayNutrition.carbs}g / ${MACRO_TARGETS.carbs}g`}
              theme={theme}
            />
            <MacroProgressBar
              label="Fat"
              value={todayNutrition.fat}
              max={MACRO_TARGETS.fat}
              color={COLORS.amber}
              displayVal={`${todayNutrition.fat}g / ${MACRO_TARGETS.fat}g`}
              last
              theme={theme}
            />
          </View>
        )}
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
        {showApiKeyInput ? (
          <View>
            <Text style={styles.apiKeyInstructions}>
              Enter your Anthropic API key to enable AI analysis.
            </Text>
            <TextInput
              style={styles.apiKeyInput}
              placeholder="sk-ant-api03-…"
              placeholderTextColor={isDark ? "#5A7090" : "#8899AA"}
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {apiKeyError ? (
              <Text style={styles.apiKeyError}>{apiKeyError}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.apiKeySaveBtn}
              onPress={handleSaveApiKey}
            >
              <Text style={styles.apiKeySaveBtnText}>Save &amp; Analyze</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.fuelResultText}>{fuelResult}</Text>
        )}
        <View style={styles.analyzeBtnRow}>
          <TouchableOpacity
            style={[styles.analyzeBtn, fuelLoading && { opacity: 0.6 }]}
            onPress={handleAnalyze}
            disabled={fuelLoading}
          >
            <Text style={styles.analyzeBtnText}>
              {fuelLoading ? "ANALYZING..." : "ANALYZE"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={async () => {
              await removeAnthropicKey();
              setShowApiKeyInput(true);
              setFuelResult(
                "Enter today's intake and tap Analyze to get a personalized recommendation."
              );
            }}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

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
              Avg: {Math.round(avg(calHistory.map((n) => n.cals)))} kcal ·
              Target: {MACRO_TARGETS.calories.toLocaleString()} kcal
            </Text>
            <LineChart
              data={calHistory.map((n) => ({ date: n.date, value: n.cals }))}
              height={140}
              barMode
              barColorFn={(v) =>
                v >= MACRO_TARGETS.calories - 100 && v <= MACRO_TARGETS.calories + 100
                  ? "rgba(96,175,255,0.8)"
                  : v > MACRO_TARGETS.calories + 100
                  ? "rgba(255,59,48,0.7)"
                  : "rgba(255,170,0,0.7)"
              }
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
          <AvgStat
            value={last30.length ? avgProtein : "—"}
            unit="protein"
            color={COLORS.green}
            theme={theme}
          />
          <AvgStat
            value={last30.length ? avgCarbs : "—"}
            unit="carbs"
            color={COLORS.blue}
            theme={theme}
          />
          <AvgStat
            value={last30.length ? avgFat : "—"}
            unit="fat"
            color={COLORS.amber}
            theme={theme}
          />
        </View>
      </Card>

      {/* ── Micronutrient Goals ── */}
      <Card>
        <Text style={styles.lbl}>MICRONUTRIENT GOALS</Text>
        {(appState.micros.length > 0 ? appState.micros : DEFAULT_MICROS).map(
          (micro, i, arr) => (
            <View
              key={micro.name}
              style={[
                styles.microRow,
                i === arr.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={styles.microName}>{micro.name}</Text>
              <Text style={styles.microTarget}>
                {micro.target} {micro.unit}
              </Text>
            </View>
          )
        )}
      </Card>
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
    fontFamily: "SpaceGrotesk_700Bold",
    fontSize: 30,
    fontWeight: "700",
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

function MacroProgressBar({
  label,
  value,
  max,
  color,
  displayVal,
  last = false,
  theme,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  displayVal: string;
  last?: boolean;
  theme: ThemeColors;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <View style={[mpbStyles.wrap, last && { marginBottom: 0 }]}>
      <View style={mpbStyles.row}>
        <Text style={[mpbStyles.label, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[mpbStyles.val, { color }]}>{displayVal}</Text>
      </View>
      <View style={[mpbStyles.track, { backgroundColor: theme.sectionBorder }]}>
        <View
          style={[
            mpbStyles.fill,
            { width: `${pct}%` as `${number}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

const mpbStyles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  label: { fontSize: 14 },
  val: { fontSize: 13, fontWeight: "600" },
  track: {
    height: 4,
    borderRadius: 99,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 99 },
});

function makeStyles(theme: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16, paddingBottom: 110, gap: 12 },
    lbl: {
      fontSize: 11,
      fontWeight: "700",
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
    analyzeBtnRow: { flexDirection: "row", gap: 8, marginTop: 16 },
    analyzeBtn: {
      flex: 1,
      backgroundColor: theme.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
    },
    analyzeBtnText: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 14,
      letterSpacing: 1,
    },
    settingsBtn: {
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    settingsIcon: { color: theme.textTertiary, fontSize: 14 },
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
    pillTextOn: { color: theme.text },

    microRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: theme.sectionBorder,
    },
    microName: {
      fontSize: 14,
      color: theme.text,
    },
    microTarget: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
    },
  });
}
