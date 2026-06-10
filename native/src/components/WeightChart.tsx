import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import Svg, { Path, Polyline, Line, Text as SvgText, Rect } from "react-native-svg";
import { DataPoint } from "../types/health";
import { useTheme } from "../context/ThemeContext";

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
  const { theme } = useTheme();

  if (!data.length) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={{ color: theme.textQuaternary, fontSize: 12 }}>No data</Text>
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
        <Text style={{ fontSize: 11, color: theme.textTertiary }}>{startLabel}</Text>
        <Text style={{ fontSize: 11, color: theme.textTertiary }}>{endLabel}</Text>
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
  count?: number;
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
  count = 14,
}: SparkBarsProps) {
  const { theme } = useTheme();
  const labelH = 28;
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-count);
  const todayStr = new Date().toISOString().slice(0, 10);

  const vals = recent.map((d) => d.value);
  const maxVal = Math.max(...vals.filter((v) => v > 0), target || 0) * 1.1 || (target || 10000);

  const chartW = SCREEN_W - 40 - 40;
  const n = Math.max(recent.length, 1);
  const barW = Math.max(2, (chartW / n) * 0.7);
  const gap = n > 1 ? (chartW - barW * n) / (n - 1) : 0;
  const totalH = height + labelH;

  if (!recent.length) {
    return (
      <View style={[{ width: chartW, height: totalH }, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: theme.textQuaternary, fontSize: 12 }}>No step data</Text>
      </View>
    );
  }

  return (
    <View style={{ width: chartW }}>
      <Svg width={chartW} height={totalH}>
        {recent.map((entry, i) => {
          const v = entry.value;
          const dateStr = entry.date;
          const barH = maxVal > 0 && v > 0 ? (v / maxVal) * height : 0;
          const x = i * (barW + gap);
          const barY = height - barH;
          const isToday = dateStr === todayStr;
          const barColor = isToday
            ? "#60AFFF"
            : v >= (target || 10000)
            ? "rgba(96,175,255,0.6)"
            : "rgba(96,175,255,0.3)";
          const [yr, mo, dy] = dateStr.split("-").map(Number);
          const dow = DOW[new Date(yr, mo - 1, dy).getDay()];
          const barCenterX = x + barW / 2;

          return (
            <React.Fragment key={i}>
              {barH > 0 && (
                <Path
                  d={`M${x},${height} L${x},${barY} L${x + barW},${barY} L${x + barW},${height} Z`}
                  fill={barColor}
                />
              )}
              {v > 0 && (
                <SvgText
                  x={barCenterX}
                  y={barY > 10 ? barY - 3 : 9}
                  fontSize={8}
                  fill={theme.textSecondary}
                  textAnchor="middle"
                >
                  {fmtStepCount(v)}
                </SvgText>
              )}
              {/* Day label — always shown */}
              <SvgText
                x={barCenterX}
                y={height + 16}
                fontSize={8}
                fill={isToday ? theme.textSecondary : theme.textQuaternary}
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
  secondaryData?: DataPoint[];
  secondaryColor?: string;
  secondaryDotColorFn?: (v: number) => string;
  secondaryRangeBand?: { low: number; high: number; color?: string; label?: string };
  height?: number;
  color?: string;
  showDots?: boolean;
  dotColorFn?: (v: number) => string;
  refLines?: Array<{ value: number; color: string }>;
  rangeBand?: { low: number; high: number; color?: string; label?: string };
  minVal?: number;
  maxVal?: number;
  barMode?: boolean;
  barColorFn?: (v: number) => string;
}

export function LineChart({
  data,
  secondaryData,
  secondaryColor = "#A78BFA",
  secondaryDotColorFn,
  secondaryRangeBand,
  height = 130,
  color = "#60AFFF",
  showDots = false,
  dotColorFn,
  refLines,
  rangeBand,
  minVal: _minVal,
  maxVal: _maxVal,
  barMode = false,
  barColorFn,
}: LineChartProps) {
  const { theme } = useTheme();

  if (!data.length) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={{ color: theme.textQuaternary, fontSize: 12 }}>No data</Text>
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
    const bandColor = rangeBand?.color ?? "rgba(0,200,100,0.13)";
    return (
      <View>
        <Svg width={chartW} height={chartH}>
          {rangeBand && (() => {
            const y1 = Math.max(0, Math.min(chartH, toY(rangeBand.high)));
            const y2 = Math.max(0, Math.min(chartH, toY(rangeBand.low)));
            return (
              <Rect x={0} y={Math.min(y1, y2)} width={chartW} height={Math.max(1, Math.abs(y2 - y1))} fill={bandColor} />
            );
          })()}
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
        {rangeBand?.label && (
          <View style={legendStyles.row}>
            <View style={[legendStyles.swatch, { backgroundColor: "rgba(0,200,100,0.45)" }]} />
            <Text style={[legendStyles.text, { color: theme.textTertiary }]}>{rangeBand.label}</Text>
          </View>
        )}
      </View>
    );
  }

  const points = vals.map((v, i) => ({ x: toX(i), y: toY(v) }));
  const linePath = buildPath(points, true);
  const bandColor = rangeBand?.color ?? "rgba(0,200,100,0.13)";

  const secSorted = secondaryData
    ? [...secondaryData].sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const secVals = secSorted.map((d) => d.value);
  const secPoints = secVals.map((v, i) => ({
    x: secSorted.length === 1 ? chartW / 2 : (i / (secSorted.length - 1)) * chartW,
    y: toY(v),
  }));
  const secPath = secPoints.length ? buildPath(secPoints, true) : "";
  const secBandColor = secondaryRangeBand?.color ?? "rgba(167,139,250,0.12)";

  return (
    <View>
      <Svg width={chartW} height={chartH}>
        {/* Secondary range band */}
        {secondaryRangeBand && (() => {
          const y1 = Math.max(padTop, Math.min(chartH - padBottom, toY(secondaryRangeBand.high)));
          const y2 = Math.max(padTop, Math.min(chartH - padBottom, toY(secondaryRangeBand.low)));
          return (
            <Rect x={0} y={Math.min(y1, y2)} width={chartW} height={Math.max(1, Math.abs(y2 - y1))} fill={secBandColor} />
          );
        })()}
        {/* Primary range band (behind everything) */}
        {rangeBand && (() => {
          const y1 = Math.max(padTop, Math.min(chartH - padBottom, toY(rangeBand.high)));
          const y2 = Math.max(padTop, Math.min(chartH - padBottom, toY(rangeBand.low)));
          return (
            <Rect x={0} y={Math.min(y1, y2)} width={chartW} height={Math.max(1, Math.abs(y2 - y1))} fill={bandColor} />
          );
        })()}
        {/* Legacy reference lines */}
        {refLines?.map((rl, i) => (
          <Line
            key={i}
            x1={0} y1={toY(rl.value)} x2={chartW} y2={toY(rl.value)}
            stroke={rl.color} strokeWidth={1} strokeDasharray="4 4"
          />
        ))}
        {/* Secondary line */}
        {secPath ? <Path d={secPath} stroke={secondaryColor} strokeWidth={2} fill="none" /> : null}
        {/* Secondary dots */}
        {showDots && secPoints.map((p, i) => {
          const dc = secondaryDotColorFn ? secondaryDotColorFn(secVals[i]) : secondaryColor;
          return (
            <Path key={`sd${i}`} d={`M${p.x - 3},${p.y} a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0`} fill={dc} />
          );
        })}
        {/* Main line */}
        <Path d={linePath} stroke={color} strokeWidth={2} fill="none" />
        {/* Dots */}
        {showDots &&
          points.map((p, i) => {
            const dc = dotColorFn ? dotColorFn(vals[i]) : color;
            return (
              <Path key={i} d={`M${p.x - 3},${p.y} a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0`} fill={dc} />
            );
          })}
      </Svg>
      {(rangeBand?.label || secondaryRangeBand?.label) && (
        <View style={legendStyles.multiRow}>
          {rangeBand?.label && (
            <View style={legendStyles.row}>
              <View style={[legendStyles.swatch, { backgroundColor: "rgba(0,200,100,0.45)" }]} />
              <Text style={[legendStyles.text, { color: theme.textTertiary }]}>{rangeBand.label}</Text>
            </View>
          )}
          {secondaryRangeBand?.label && (
            <View style={legendStyles.row}>
              <View style={[legendStyles.swatch, { backgroundColor: "rgba(167,139,250,0.55)" }]} />
              <Text style={[legendStyles.text, { color: theme.textTertiary }]}>{secondaryRangeBand.label}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
  },
  axisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
});

const legendStyles = StyleSheet.create({
  multiRow: { gap: 4, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  text: { fontSize: 10, letterSpacing: 0.3 },
});
