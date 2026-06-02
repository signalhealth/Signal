import React, { useState, useContext } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { HealthContext } from "../context/HealthContext";
import { Card } from "../components/MetricCard";
import { LineChart } from "../components/WeightChart";
import { FuelCtx, MACRO_TARGETS } from "../types/health";
import { analyzeFuel as analyzeWithAI } from "../services/anthropic";
import {
  getAnthropicKey,
  setAnthropicKey,
  removeAnthropicKey,
} from "../services/storage";

const COLORS = {
  green: "#00D084",
  amber: "#F5A623",
  blue: "#0066CC",
  red: "#FF3B30",
};

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
}: {
  label: string;
  value: number | undefined;
  target: string;
  unit: string;
  color: string;
}) {
  return (
    <View style={macroStyles.box}>
      <Text style={macroStyles.label}>{label.toUpperCase()}</Text>
      <Text style={[macroStyles.value, { color }]}>
        {value !== undefined ? value : "—"}
      </Text>
      <Text style={macroStyles.target}>
        / {target} {unit}
      </Text>
    </View>
  );
}

const macroStyles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: "#0F2040",
    borderRadius: 12,
    padding: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 1,
    marginBottom: 8,
  },
  value: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 36,
  },
  target: { fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 },
});

export function FuelScreen() {
  const { healthData } = useContext(HealthContext);
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

  const today = new Date().toISOString().slice(0, 10);
  const todayNutrition = healthData.nutrition.find((n) => n.date === today);

  // Calorie history for chart
  const nutritionSorted = [...healthData.nutrition].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
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
    const result = await analyzeWithAI(key, healthData, fuelCtx);
    setFuelLoading(false);
    if (result.authError) {
      await removeAnthropicKey();
      setShowApiKeyInput(true);
      setFuelResult(
        "Enter today's intake and tap Analyze to get a personalized recommendation."
      );
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
    >
      {/* ── Today's Intake ── */}
      <Card>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.lbl}>TODAY'S INTAKE</Text>
            <Text style={styles.dateText}>{today}</Text>
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
            color="#FFFFFF"
          />
          <MacroBox
            label="Protein"
            value={todayNutrition?.protein}
            target={`${MACRO_TARGETS.protein}g`}
            unit=""
            color={COLORS.green}
          />
        </View>
        <View style={[styles.macroGrid, { marginTop: 10 }]}>
          <MacroBox
            label="Carbs"
            value={todayNutrition?.carbs}
            target={`${MACRO_TARGETS.carbs}g`}
            unit=""
            color={COLORS.blue}
          />
          <MacroBox
            label="Fat"
            value={todayNutrition?.fat}
            target={`${MACRO_TARGETS.fat}g`}
            unit=""
            color={COLORS.amber}
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
            />
            <MacroProgressBar
              label="Protein"
              value={todayNutrition.protein}
              max={MACRO_TARGETS.protein}
              color={COLORS.green}
              displayVal={`${todayNutrition.protein}g / ${MACRO_TARGETS.protein}g`}
            />
            <MacroProgressBar
              label="Carbs"
              value={todayNutrition.carbs}
              max={MACRO_TARGETS.carbs}
              color={COLORS.blue}
              displayVal={`${todayNutrition.carbs}g / ${MACRO_TARGETS.carbs}g`}
            />
            <MacroProgressBar
              label="Fat"
              value={todayNutrition.fat}
              max={MACRO_TARGETS.fat}
              color={COLORS.amber}
              displayVal={`${todayNutrition.fat}g / ${MACRO_TARGETS.fat}g`}
              last
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
              placeholderTextColor="#5A7090"
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
          <AvgStat value={last30.length ? avgCals : "—"} unit="kcal" />
          <AvgStat
            value={last30.length ? avgProtein : "—"}
            unit="protein"
            color={COLORS.green}
          />
          <AvgStat
            value={last30.length ? avgCarbs : "—"}
            unit="carbs"
            color={COLORS.blue}
          />
          <AvgStat
            value={last30.length ? avgFat : "—"}
            unit="fat"
            color={COLORS.amber}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

function AvgStat({
  value,
  unit,
  color = "#FFFFFF",
}: {
  value: number | string;
  unit: string;
  color?: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={[avgStyles.num, { color }]}>{value}</Text>
      <Text style={avgStyles.unit}>{unit}</Text>
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
    color: "rgba(255,255,255,0.35)",
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
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  displayVal: string;
  last?: boolean;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <View style={[mpbStyles.wrap, last && { marginBottom: 0 }]}>
      <View style={mpbStyles.row}>
        <Text style={mpbStyles.label}>{label}</Text>
        <Text style={[mpbStyles.val, { color }]}>{displayVal}</Text>
      </View>
      <View style={mpbStyles.track}>
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
  label: { fontSize: 14, color: "rgba(255,255,255,0.6)" },
  val: { fontSize: 13, fontWeight: "600" },
  track: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 99,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 99 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07070D" },
  content: { padding: 16, paddingBottom: 110, gap: 12 },
  lbl: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  dateText: { fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3 },
  syncBadge: {
    fontSize: 11,
    color: "#00D084",
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
    color: "rgba(255,255,255,0.35)",
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
    borderColor: "rgba(0,102,204,0.4)",
    backgroundColor: "transparent",
    alignItems: "center",
  },
  ctxBtnActive: {
    borderColor: "#0066CC",
    backgroundColor: "rgba(0,102,204,0.15)",
  },
  ctxBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },
  ctxBtnTextActive: { color: "#0066CC" },

  fuelAdvisorCard: {
    backgroundColor: "#0D1F3C",
    borderWidth: 1,
    borderColor: "rgba(0,102,204,0.4)",
    borderRadius: 16,
    padding: 20,
  },
  fuelAdvisorLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "rgba(0,102,204,0.8)",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  fuelResultText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 22,
    minHeight: 60,
  },
  analyzeBtn: {
    marginTop: 16,
    backgroundColor: "#0066CC",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  analyzeBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 1,
  },
  apiKeyInstructions: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 19,
    marginBottom: 10,
  },
  apiKeyInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(28,105,212,0.35)",
    borderRadius: 8,
    padding: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  apiKeyError: { fontSize: 11, color: "#FF3B30", marginBottom: 8 },
  apiKeySaveBtn: {
    backgroundColor: "rgba(28,105,212,0.85)",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  apiKeySaveBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },

  calHistoryLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 12,
  },
  noData: {
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
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
    borderColor: "rgba(0,102,204,0.4)",
    backgroundColor: "transparent",
  },
  pillOn: { backgroundColor: "#0066CC", borderColor: "#0066CC" },
  pillText: { fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
  pillTextOn: { color: "#FFFFFF" },
});
