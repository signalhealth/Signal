import React, { useState, useContext, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { HealthContext } from "../context/HealthContext";
import { useTheme, ThemeColors } from "../context/ThemeContext";
import { UserProfile } from "../types/health";
import {
  getAnthropicKey,
  setAnthropicKey,
  removeAnthropicKey,
} from "../services/storage";

interface Props {
  visible: boolean;
  onClose: () => void;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: "default" | "decimal-pad" | "numeric";
  multiline?: boolean;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const APP_VERSION = "1.1.0";

export function ProfileModal({ visible, onClose }: Props) {
  const { userProfile, updateUserProfile } = useContext(HealthContext);
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [draft, setDraft] = useState<UserProfile>(userProfile);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");

  useEffect(() => {
    if (visible) {
      setDraft(userProfile);
      setNewApiKey("");
      setApiKeyError("");
      getAnthropicKey().then((k) => setApiKeySaved(!!k));
    }
  }, [visible]);

  function set<K extends keyof UserProfile>(key: K, val: UserProfile[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    if (newApiKey.trim()) {
      const k = newApiKey.trim().replace(/\s+/g, "");
      if (!k.startsWith("sk-ant-")) {
        setApiKeyError("Key should start with sk-ant- — check for typos");
        return;
      }
      await setAnthropicKey(k);
    }
    updateUserProfile(draft);
    onClose();
  }

  async function handleRemoveKey() {
    await removeAnthropicKey();
    setApiKeySaved(false);
    setNewApiKey("");
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Signal Profile</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.section, { marginTop: 0 }]}>APPEARANCE</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.inputBorder, true: theme.accent }}
              thumbColor="#FFFFFF"
            />
          </View>

          <Text style={styles.section}>YOUR INFO</Text>
          <Field
            label="Name"
            value={draft.name}
            onChangeText={(v) => set("name", v)}
            placeholder="What should Signal call you?"
          />

          <Text style={styles.section}>GOALS</Text>
          <Field
            label="Goal"
            value={draft.goal}
            onChangeText={(v) => set("goal", v)}
            placeholder="e.g. Body recomp — reach 155 lbs / 15% body fat"
            multiline
          />
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field
                label="Target Weight (lbs)"
                value={draft.targetWeight}
                onChangeText={(v) => set("targetWeight", v)}
                placeholder="155"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Target Body Fat %"
                value={draft.targetBodyFat}
                onChangeText={(v) => set("targetBodyFat", v)}
                placeholder="15"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <Field
            label="Target Date"
            value={draft.targetDate}
            onChangeText={(v) => set("targetDate", v)}
            placeholder="May 2027"
          />

          <Text style={styles.section}>BACKGROUND</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field
                label="Starting Weight (lbs)"
                value={draft.startingWeight}
                onChangeText={(v) => set("startingWeight", v)}
                placeholder="177"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Starting Date"
                value={draft.startingDate}
                onChangeText={(v) => set("startingDate", v)}
                placeholder="Feb 2026"
              />
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>On TRT</Text>
            <Switch
              value={draft.onTRT}
              onValueChange={(v) => set("onTRT", v)}
              trackColor={{ false: theme.inputBorder, true: theme.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
          {draft.onTRT && (
            <Field
              label="TRT Start Date"
              value={draft.trtStartDate}
              onChangeText={(v) => set("trtStartDate", v)}
              placeholder="May 15, 2026"
            />
          )}

          <Text style={styles.section}>TRAINING</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field
                label="Days / Week"
                value={draft.trainingDaysPerWeek}
                onChangeText={(v) => set("trainingDaysPerWeek", v)}
                placeholder="4"
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Program"
                value={draft.trainingProgram}
                onChangeText={(v) => set("trainingProgram", v)}
                placeholder="C1, GZCLP, etc."
              />
            </View>
          </View>

          <Text style={styles.section}>ADDITIONAL CONTEXT</Text>
          <Field
            label="Anything else Signal should know"
            value={draft.additionalContext}
            onChangeText={(v) => set("additionalContext", v)}
            placeholder="Dietary restrictions, medical context, notes…"
            multiline
          />

          <Text style={styles.section}>FUEL TARGETS</Text>
          <Text style={styles.sectionHint}>Leave blank to hide targets on the Fuel screen.</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field
                label="Calories (kcal)"
                value={draft.calorieTarget}
                onChangeText={(v) => set("calorieTarget", v)}
                placeholder="e.g. 1800"
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Protein (g)"
                value={draft.proteinTarget}
                onChangeText={(v) => set("proteinTarget", v)}
                placeholder="e.g. 180"
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field
                label="Carbs (g)"
                value={draft.carbTarget}
                onChangeText={(v) => set("carbTarget", v)}
                placeholder="e.g. 160"
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Fat (g)"
                value={draft.fatTarget}
                onChangeText={(v) => set("fatTarget", v)}
                placeholder="e.g. 60"
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={{ width: "50%", paddingRight: 4 }}>
            <Field
              label="Water Goal (oz)"
              value={draft.waterGoalOz}
              onChangeText={(v) => set("waterGoalOz", v)}
              placeholder="e.g. 64"
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.section}>AI ANALYSIS</Text>
          {apiKeySaved ? (
            <View style={styles.keySavedRow}>
              <Text style={styles.keySavedText}>Anthropic API key saved ✓</Text>
              <TouchableOpacity onPress={handleRemoveKey} style={styles.removeKeyBtn}>
                <Text style={styles.removeKeyBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Anthropic API Key</Text>
              <TextInput
                style={styles.input}
                placeholder="sk-ant-api03-…"
                placeholderTextColor={theme.textTertiary}
                value={newApiKey}
                onChangeText={(v) => { setNewApiKey(v); setApiKeyError(""); }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              {apiKeyError ? (
                <Text style={styles.apiKeyError}>{apiKeyError}</Text>
              ) : (
                <Text style={styles.apiKeyHint}>
                  Used for AI insights on Progress, Fuel, and Labs. Stored only on this device.
                </Text>
              )}
            </View>
          )}
          <Text style={styles.versionText}>Signal v{APP_VERSION}</Text>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save Profile</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.sectionBorder,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text,
      letterSpacing: -0.3,
    },
    closeBtn: {
      padding: 6,
    },
    closeBtnText: {
      fontSize: 18,
      color: theme.textSecondary,
    },
    scroll: { flex: 1 },
    scrollContent: {
      padding: 20,
      paddingBottom: 20,
    },
    section: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      color: theme.accent,
      textTransform: "uppercase",
      marginTop: 24,
      marginBottom: 12,
    },
    sectionHint: {
      fontSize: 12,
      color: theme.textTertiary,
      marginTop: -8,
      marginBottom: 12,
      lineHeight: 18,
    },
    field: {
      marginBottom: 12,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    input: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      color: theme.text,
    },
    inputMulti: {
      minHeight: 72,
      textAlignVertical: "top",
    },
    row: {
      flexDirection: "row",
    },
    toggleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.sectionBorder,
      marginBottom: 12,
    },
    toggleLabel: {
      fontSize: 15,
      color: theme.text,
      fontWeight: "500",
    },
    keySavedRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "rgba(0,208,132,0.08)",
      borderWidth: 1,
      borderColor: "rgba(0,208,132,0.2)",
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 12,
    },
    keySavedText: {
      fontSize: 14,
      color: theme.green,
      fontWeight: "500",
    },
    removeKeyBtn: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(255,59,48,0.4)",
    },
    removeKeyBtnText: {
      fontSize: 12,
      color: theme.red,
      fontWeight: "600",
    },
    apiKeyHint: {
      fontSize: 11,
      color: theme.textTertiary,
      marginTop: 5,
      lineHeight: 16,
    },
    apiKeyError: {
      fontSize: 11,
      color: theme.red,
      marginTop: 5,
    },
    versionText: {
      fontSize: 11,
      color: theme.textQuaternary,
      textAlign: "center",
      marginTop: 28,
      letterSpacing: 0.5,
    },
    footer: {
      padding: 20,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderTopColor: theme.sectionBorder,
    },
    saveBtn: {
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: "center",
    },
    saveBtnText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 16,
      letterSpacing: 0.3,
    },
  });
}
