import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
  color?: string;
  subLabel?: string;
}

export function ProgressBar({
  label,
  value,
  max,
  unit = "",
  color = "#0166B1",
  subLabel,
}: ProgressBarProps) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.valueText, { color }]}>
          {value}
          {unit ? ` ${unit}` : ""}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct}%` as `${number}%`, backgroundColor: color },
          ]}
        />
      </View>
      {subLabel ? <Text style={styles.sub}>{subLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  label: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
  },
  valueText: {
    fontSize: 14,
    fontWeight: "700",
  },
  track: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 99,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 99,
  },
  sub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginTop: 5,
    letterSpacing: 0.3,
  },
});
