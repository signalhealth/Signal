import React, { useState, useContext } from "react";
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
import { UserProfile } from "../types/health";

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
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#5A7090"
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

export function ProfileModal({ visible, onClose }: Props) {
  const { userProfile, updateUserProfile } = useContext(HealthContext);
  const [draft, setDraft] = useState<UserProfile>(userProfile);

  // Sync draft when modal opens with latest saved profile
  React.useEffect(() => {
    if (visible) setDraft(userProfile);
  }, [visible]);

  function set<K extends keyof UserProfile>(key: K, val: UserProfile[K]) {
    setDraft((prev) => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    updateUserProfile(draft);
    onClose();
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
              trackColor={{ false: "#1A3A5C", true: "#0066CC" }}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07070D",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#182030",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.4)",
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
    color: "rgba(0,102,204,0.7)",
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0A1628",
    borderWidth: 1,
    borderColor: "#1A3A5C",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#FFFFFF",
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
    borderBottomColor: "#182030",
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  footer: {
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#182030",
  },
  saveBtn: {
    backgroundColor: "#0066CC",
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
