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
import { ProgressBar } from "../components/ProgressBar";
import { WeightChart, SparkBars } from "../components/WeightChart";
import { HRV_NORMAL_LOW, HRV_NORMAL_HIGH, SLEEP_TARGET } from "../types/health";
import { getInsight } from "../services/anthropic";
import {
  getAnthropicKey,
  setAnthropicKey,
  removeAnthropicKey,
} from "../services/storage";

const COLORS = {
  green: "#00D084",
  amber: "#F5A623",
  red: "#FF3B30",
  blue: "#0066CC",
  white: "#FFFFFF",
  gray2: "rgba(255,255,255,0.6)",
  gray3: "rgba(255,255,255,0.35)",
};

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function ProgressScreen() {
  const { healthData, appState } = useContext(HealthContext);
  const [wtDays, setWtDays] = useState(14);
  const [insight, setInsight] = useState<string>(
    "Your personalized coaching insight will appear here."
  );
  const [insightLoading, setInsightLoading] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");

  // ── Weight ──────────────────────────────────────────────────────
  const weightSorted = [...healthData.weight].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const wtSlice = weightSorted.slice(-wtDays);
  const latestWt = weightSorted[weightSorted.length - 1]?.value;
  const wtStart = wtSlice[0]?.value;
  const wtChange = latestWt && wtStart ? (wtStart - latestWt).toFixed(1) : null;
  const isDown = latestWt && wtStart ? latestWt < wtStart : false;
  const wt7Avg =
    weightSorted.length >= 7
      ? avg(weightSorted.slice(-7).map((d) => d.value)).toFixed(1)
      : latestWt?.toFixed(1);
  const latestWtDate = weightSorted[weightSorted.length - 1]?.date;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const wtDateLabel =
    latestWtDate === today
      ? "Today"
      : latestWtDate === yesterday
      ? "Yesterday"
      : latestWtDate?.slice(5) || "";

  // ── Vitals ──────────────────────────────────────────────────────
  const latestHRV = healthData.hrv[0]?.value;
  const latestSleep = healthData.sleep[0]?.value;

  // Deduplicate RHR
  const seenRhr = new Map<string, number>();
  for (const pt of healthData.rhr) {
    if (!seenRhr.has(pt.date)) seenRhr.set(pt.date, pt.value);
  }
  const rhrVals = Array.from(seenRhr.values());
  const latestRHR = rhrVals[0];

  const hrvStatus =
    latestHRV === undefined
      ? null
      : latestHRV >= HRV_NORMAL_HIGH
      ? { label: "ELEVATED", color: COLORS.green }
      : latestHRV >= HRV_NORMAL_LOW
      ? { label: "IN RANGE", color: COLORS.green }
      : { label: "BELOW RANGE", color: COLORS.amber };

  const sleepStatus =
    latestSleep === undefined
      ? null
      : latestSleep >= SLEEP_TARGET
      ? { label: "ON TARGET", color: COLORS.green }
      : latestSleep >= 7.0
      ? { label: "NEAR TARGET", color: COLORS.amber }
      : { label: "BELOW TARGET", color: COLORS.red };

  // ── Steps ───────────────────────────────────────────────────────
  const stepsSorted = [...healthData.steps].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const todaySteps = stepsSorted.find((s) => s.date === today)?.value;
  const stepsLast14 = stepsSorted.slice(-14);

  // ── DEXA ────────────────────────────────────────────────────────
  const latestDexa = appState.dexa[appState.dexa.length - 1];

  // ── AI Insight ──────────────────────────────────────────────────
  async function handleGetInsight() {
    const key = await getAnthropicKey();
    if (!key) {
      setShowApiKeyInput(true);
      return;
    }
    setInsightLoading(true);
    setInsight("Analyzing your data…");
    const result = await getInsight(key, healthData, appState);
    setInsightLoading(false);
    if (result.authError) {
      await removeAnthropicKey();
      setShowApiKeyInput(true);
      setInsight("Your personalized coaching insight will appear here.");
    } else if (result.success && result.text) {
      setInsight(result.text);
    } else {
      setInsight(result.error || "An error occurred.");
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
    handleGetInsight();
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
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
                since {wtSlice[0]?.date?.slice(5)}
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
                  ? "EXCELLENT"
                  : latestRHR <= 65
                  ? "NORMAL"
                  : "ELEVATED"}
              </Text>
            )}
          </View>
          <View style={[styles.vitalCell, { paddingLeft: 16 }]}>
            <Text style={styles.vitalLabel}>SLEEP</Text>
            <Text style={styles.vitalNum}>{latestSleep?.toFixed(1) ?? "—"}</Text>
            <Text style={styles.vitalUnit}>hr</Text>
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
          <Text style={styles.dateLabel}>{today.slice(5)}</Text>
        </View>
        <View style={styles.stepsNumRow}>
          <Text style={styles.stepsNum}>
            {todaySteps?.toLocaleString() ?? "—"}
          </Text>
          <Text style={styles.stepsGoal}>/ 10,000</Text>
        </View>
        {todaySteps !== undefined && (
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                {
                  width: `${Math.min(100, (todaySteps / 10000) * 100)}%` as `${number}%`,
                  backgroundColor: COLORS.blue,
                },
              ]}
            />
          </View>
        )}
        <View style={{ marginTop: 14 }}>
          <SparkBars data={stepsLast14} height={60} target={10000} />
        </View>
      </Card>

      {/* ── Body Composition ── */}
      <Card>
        <Text style={styles.lbl}>BODY COMPOSITION</Text>
        {latestDexa ? (
          <Text style={styles.dexaDate}>DEXA · {latestDexa.date}</Text>
        ) : null}
        <ProgressBar
          label="Body Fat"
          value={latestDexa?.bodyFat ?? 26.2}
          max={50}
          unit="%"
          color={COLORS.red}
          subLabel={`Goal 15% · ${latestDexa ? "" : "was 37% · −10.8 pts"}`}
        />
        <ProgressBar
          label="Lean Mass"
          value={latestDexa?.leanMass ?? 116.9}
          max={190}
          unit="lbs"
          color={COLORS.blue}
          subLabel="Goal 132 lbs"
        />
        <ProgressBar
          label="Scale Weight"
          value={latestWt ?? 162.8}
          max={210}
          unit="lbs"
          color="rgba(255,255,255,0.55)"
          subLabel="Goal 155 lbs"
        />
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
                  <Text style={styles.dexaDateText}>{scan.date}</Text>
                  <Text style={styles.dexaStats}>
                    {scan.weight} lbs · {scan.bodyFat}% BF · {scan.leanMass}{" "}
                    lbs lean
                  </Text>
                </View>
              </View>
            ))
        )}
        <DexaAddForm />
      </Card>

      {/* ── Signal Insight ── */}
      <View style={styles.insightCard}>
        <Text style={styles.insightLabel}>SIGNAL INSIGHT</Text>
        {showApiKeyInput ? (
          <View>
            <Text style={styles.apiKeyInstructions}>
              Enter your Anthropic API key. Stored only on this device, never
              sent anywhere else.
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
          <Text style={styles.insightText}>{insight}</Text>
        )}
        <View style={styles.insightBtnRow}>
          <TouchableOpacity
            style={[styles.insightBtn, insightLoading && { opacity: 0.6 }]}
            onPress={handleGetInsight}
            disabled={insightLoading}
          >
            <Text style={styles.insightBtnText}>
              {insightLoading ? "THINKING..." : "GET INSIGHT"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.insightSettingsBtn}
            onPress={async () => {
              await removeAnthropicKey();
              setShowApiKeyInput(true);
              setInsight(
                "Your personalized coaching insight will appear here."
              );
            }}
          >
            <Text style={styles.insightSettingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Inline DEXA add form ──────────────────────────────────────────

function DexaAddForm() {
  const { appState, updateAppState } = useContext(HealthContext);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
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
          placeholderTextColor="#5A7090"
          value={date}
          onChangeText={setDate}
        />
      </View>
      <View style={styles.formRow}>
        <TextInput
          style={[styles.formInput, { flex: 1, marginRight: 8 }]}
          placeholder="Weight (lbs)"
          placeholderTextColor="#5A7090"
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
        />
        <TextInput
          style={[styles.formInput, { flex: 1 }]}
          placeholder="Body Fat %"
          placeholderTextColor="#5A7090"
          keyboardType="decimal-pad"
          value={bodyFat}
          onChangeText={setBodyFat}
        />
      </View>
      <TextInput
        style={styles.formInput}
        placeholder="Lean Mass (lbs)"
        placeholderTextColor="#5A7090"
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07070D" },
  content: { padding: 16, paddingBottom: 110, gap: 12 },
  lbl: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.35)",
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
    borderColor: "rgba(0,102,204,0.4)",
    backgroundColor: "transparent",
  },
  pillOn: { backgroundColor: "#0066CC", borderColor: "#0066CC" },
  pillText: { fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
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
    color: "#FFFFFF",
    lineHeight: 64,
    letterSpacing: -2,
  },
  weightUnit: {
    fontSize: 20,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "400",
    paddingBottom: 8,
  },
  weightDateLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
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
  deltaSince: { fontSize: 13, color: "rgba(255,255,255,0.35)" },
  avgLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
    marginTop: 6,
  },
  avgVal: { color: "rgba(255,255,255,0.6)", fontWeight: "600" },

  vitalsGrid: {
    flexDirection: "row",
    marginTop: 4,
  },
  vitalCell: { flex: 1 },
  vitalBorderRight: {
    borderRightWidth: 1,
    borderRightColor: "rgba(0,102,204,0.25)",
  },
  vitalLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
  },
  vitalNum: {
    fontSize: 34,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 6,
    lineHeight: 38,
  },
  vitalUnit: { fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3 },
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
    color: "#FFFFFF",
    lineHeight: 52,
    letterSpacing: -1,
  },
  stepsGoal: { fontSize: 14, color: "rgba(255,255,255,0.35)", paddingBottom: 4 },
  dateLabel: { fontSize: 11, color: "rgba(255,255,255,0.35)" },
  track: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 99,
    overflow: "hidden",
    marginBottom: 4,
  },
  trackFill: { height: "100%", borderRadius: 99 },

  dexaDate: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
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
    borderBottomColor: "#182030",
    marginBottom: 4,
  },
  dexaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0066CC",
    marginTop: 4,
  },
  dexaDateText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
  dexaStats: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  emptyNote: {
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
    marginVertical: 8,
  },

  addFormWrap: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,102,204,0.25)",
  },
  addFormLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  formRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  formInput: {
    backgroundColor: "#0A1628",
    borderWidth: 1,
    borderColor: "#1A3A5C",
    borderRadius: 8,
    padding: 9,
    paddingHorizontal: 12,
    fontFamily: "SpaceGrotesk_400Regular",
    fontSize: 13,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: "#0066CC",
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
    backgroundColor: "#0A2050",
    borderWidth: 1,
    borderColor: "rgba(0,102,204,0.4)",
    borderRadius: 16,
    padding: 24,
  },
  insightLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "rgba(0,102,204,0.7)",
    marginBottom: 10,
  },
  insightText: {
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  insightBtnRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  insightBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,102,204,0.35)",
    backgroundColor: "rgba(0,102,204,0.12)",
    alignItems: "center",
  },
  insightBtnText: {
    color: "rgba(100,170,255,0.9)",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1,
  },
  insightSettingsBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  insightSettingsIcon: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
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
});
