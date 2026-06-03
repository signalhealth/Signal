import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, { Path, Polyline, Line, Text as SvgText } from "react-native-svg";
import { DataPoint } from "../types/health";

const SCREEN_W = Dimensions.get("window").width;

interface WeightChartProps {
  data: DataPoint[];
  height?: number;
}

function movingAvg(vals: number[], w = 7): number[] {
  return vals.map((_, i) => {
    const slice = vals.slice(Math.max(0, i - w + 1), i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

function buildPath(
  points: Array<{ x: number; y: number }>,
  smooth = false
): string {
  if (!points.length) return "";
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    if (smooth) {
      const cp1x = (points[i - 1].x + points[i].x) / 2;
      const cp1y = points[i - 1].y;
      const cp2x = cp1x;
      const cp2y = points[i].y;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i].x},${points[i].y}`;
    } else {
      d += ` L${points[i].x},${points[i].y}`;
    }
  }
  return d;
}

export function WeightChart({ data, height = 120 }: WeightChartProps) {
  if (!data.length) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const vals = sorted.map((d) => d.value);
  const ma = movingAvg(vals, 7);

  const minVal = Math.min(...vals) - 1;
  const maxVal = Math.max(...vals) + 1;

  const chartW = SCREEN_W - 40 - 40; // card padding
  const chartH = height;
  const padTop = 6;
  const padBottom = 6;

  function toX(i: number) {
    return (i / (sorted.length - 1)) * chartW;
  }
  function toY(v: number) {
    return (
      padTop +
      ((maxVal - v) / (maxVal - minVal)) * (chartH - padTop - padBottom)
    );
  }

  const rawPoints = vals.map((v, i) => ({ x: toX(i), y: toY(v) }));
  const maPoints = ma.map((v, i) => ({ x: toX(i), y: toY(v) }));

  const rawPath = buildPath(rawPoints, true);
  const maPath = buildPath(maPoints, true);

  // Labels
  const startLabel = sorted[0].date.slice(5);
  const endLabel = sorted[sorted.length - 1].date.slice(5);

  return (
    <View>
      <Svg width={chartW} height={chartH}>
        {/* Raw line — faint */}
        <Path
          d={rawPath}
          stroke="rgba(96,175,255,0.25)"
          strokeWidth={1}
          fill="none"
        />
        {/* Moving average — bright */}
        <Path
          d={maPath}
          stroke="#60AFFF"
          strokeWidth={2.5}
          fill="none"
        />
      </Svg>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>{startLabel}</Text>
        <Text style={styles.axisLabel}>{endLabel}</Text>
      </View>
    </View>
  );
}

// Spark bar chart for steps
interface SparkBarsProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  target?: number;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtStepCount(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

export function SparkBars({
  data,
  height = 60,
  color = "#0066CC",
  target,
}: SparkBarsProps) {
  const labelH = 28; // space for count above + day below bar
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  // Always render — even if empty, show placeholder
  const vals = sorted.map((d) => d.value);
  const maxVal = vals.length ? Math.max(...vals, target || 0) * 1.1 : (target || 10000);

  const chartW = SCREEN_W - 40 - 40;
  const barW = Math.max(2, (chartW / Math.max(vals.length, 1)) * 0.7);
  const gap = vals.length > 1
    ? (chartW - barW * vals.length) / (vals.length - 1)
    : 0;

  const totalH = height + labelH;

  return (
    <View style={{ width: chartW }}>
      <Svg width={chartW} height={totalH}>
        {vals.map((v, i) => {
          const barH = maxVal > 0 ? (v / maxVal) * height : 0;
          const x = i * (barW + gap);
          const barY = height - barH;
          const isToday = i === vals.length - 1;
          const barColor = isToday
            ? "#60AFFF"
            : v >= (target || 10000)
            ? "rgba(96,175,255,0.6)"
            : "rgba(96,175,255,0.3)";
          // Day of week label
          const dateStr = sorted[i].date; // "YYYY-MM-DD"
          const [yr, mo, dy] = dateStr.split("-").map(Number);
          const dow = DOW[new Date(yr, mo - 1, dy).getDay()];
          const barCenterX = x + barW / 2;

          return (
            <React.Fragment key={i}>
              {/* Bar */}
              <Path
                d={`M${x},${height} L${x},${barY} L${x + barW},${barY} L${x + barW},${height} Z`}
                fill={barColor}
              />
              {/* Step count above bar */}
              <SvgText
                x={barCenterX}
                y={barY > 10 ? barY - 3 : 9}
                fontSize={8}
                fill="rgba(255,255,255,0.45)"
                textAnchor="middle"
              >
                {fmtStepCount(v)}
              </SvgText>
              {/* Day label below */}
              <SvgText
                x={barCenterX}
                y={height + 16}
                fontSize={8}
                fill="rgba(255,255,255,0.35)"
                textAnchor="middle"
              >
                {dow}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

// Line chart for HRV/sleep/RHR
interface LineChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  showDots?: boolean;
  dotColorFn?: (v: number) => string;
  refLines?: Array<{ value: number; color: string }>;
  minVal?: number;
  maxVal?: number;
  barMode?: boolean;
  barColorFn?: (v: number) => string;
}

export function LineChart({
  data,
  height = 130,
  color = "#60AFFF",
  showDots = false,
  dotColorFn,
  refLines,
  minVal: _minVal,
  maxVal: _maxVal,
  barMode = false,
  barColorFn,
}: LineChartProps) {
  if (!data.length) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const vals = sorted.map((d) => d.value);

  const minVal = _minVal ?? Math.min(...vals) * 0.95;
  const maxVal = _maxVal ?? Math.max(...vals) * 1.05;

  const chartW = SCREEN_W - 40 - 40;
  const chartH = height;
  const padTop = 8;
  const padBottom = 8;

  function toX(i: number) {
    if (sorted.length === 1) return chartW / 2;
    return (i / (sorted.length - 1)) * chartW;
  }
  function toY(v: number) {
    const range = maxVal - minVal;
    if (range === 0) return chartH / 2;
    return (
      padTop + ((maxVal - v) / range) * (chartH - padTop - padBottom)
    );
  }

  if (barMode) {
    const barW = Math.max(2, (chartW / vals.length) * 0.75);
    const gap = (chartW - barW * vals.length) / Math.max(1, vals.length - 1);
    return (
      <Svg width={chartW} height={chartH}>
        {vals.map((v, i) => {
          const barH = Math.max(2, ((v - minVal) / (maxVal - minVal)) * chartH);
          const x = i * (barW + gap);
          const y = chartH - barH;
          const fc = barColorFn ? barColorFn(v) : color;
          return (
            <Path
              key={i}
              d={`M${x},${chartH} L${x},${y} L${x + barW},${y} L${x + barW},${chartH} Z`}
              fill={fc}
            />
          );
        })}
      </Svg>
    );
  }

  const points = vals.map((v, i) => ({ x: toX(i), y: toY(v) }));
  const linePath = buildPath(points, true);

  return (
    <Svg width={chartW} height={chartH}>
      {/* Reference lines */}
      {refLines?.map((rl, i) => (
        <Line
          key={i}
          x1={0}
          y1={toY(rl.value)}
          x2={chartW}
          y2={toY(rl.value)}
          stroke={rl.color}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}
      {/* Main line */}
      <Path d={linePath} stroke={color} strokeWidth={2} fill="none" />
      {/* Dots */}
      {showDots &&
        points.map((p, i) => {
          const dc = dotColorFn ? dotColorFn(vals[i]) : color;
          return (
            <Path
              key={i}
              d={`M${p.x - 3},${p.y} a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0`}
              fill={dc}
            />
          );
        })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 12,
  },
  axisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  axisLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
  },
});
