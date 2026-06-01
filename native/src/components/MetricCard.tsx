import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";

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
  red: "#FF3B30",
  blue: "#0066CC",
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
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
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
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0D1B36",
    borderWidth: 1,
    borderColor: "rgba(0,102,204,0.4)",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.35)",
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
    color: "#FFFFFF",
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
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
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    marginBottom: 10,
  },
});
