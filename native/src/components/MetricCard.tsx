import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../context/ThemeContext";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: "green" | "amber" | "red" | "blue";
  statusLabel?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
}

const STATUS_COLORS = {
  green: "#00D084",
  amber: "#F5A623",
  red: "#F11A22",
  blue: "#0166B1",
} as const;

export function MetricCard({
  label,
  value,
  unit,
  status,
  statusLabel,
  style,
  children,
}: MetricCardProps) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
        style,
      ]}
    >
      <Text style={[styles.label, { color: theme.textTertiary }]}>{label.toUpperCase()}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
        {unit && <Text style={[styles.unit, { color: theme.textSecondary }]}>{unit}</Text>}
      </View>
      {status && statusLabel && (
        <Text
          style={[
            styles.status,
            { color: STATUS_COLORS[status] },
          ]}
        >
          {statusLabel.toUpperCase()}
        </Text>
      )}
      {children}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.cardBorder },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const { theme } = useTheme();
  return <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  value: {
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 13,
    fontWeight: "400",
  },
  status: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
});
