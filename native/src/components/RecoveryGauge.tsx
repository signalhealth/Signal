import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import { ThemeColors } from "../context/ThemeContext";

interface Props {
  score: number;
  theme: ThemeColors;
  isDark: boolean;
}

const W = 260;
const H = 160;
const CX = W / 2;
const CY = H - 18;
const R = 108;
const TRACK_W = 18;
const NEEDLE_LEN = 84;

// math convention: 0°=right, 90°=up, 180°=left
function pt(deg: number, r = R) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
}

// arc from startDeg → endDeg going counterclockwise on screen (through the top)
function arc(startDeg: number, endDeg: number, r = R): string {
  const s = pt(startDeg, r);
  const e = pt(endDeg, r);
  // large-arc-flag: 1 if span > 180°, else 0
  const span = startDeg - endDeg;
  const large = span > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// score → gauge angle: 0 score = 180° (left), 100 score = 0° (right)
function scoreToAngle(s: number): number {
  return 180 - s * 1.8;
}

export function RecoveryGauge({ score, theme, isDark }: Props) {
  const animVal = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = animVal.addListener(({ value }) => setDisplay(value));
    Animated.spring(animVal, {
      toValue: score,
      useNativeDriver: false,
      tension: 32,
      friction: 5, // lower = more bounce
    }).start();
    return () => animVal.removeListener(id);
  }, [score]);

  const needleAngle = scoreToAngle(display);
  const tip = pt(needleAngle, NEEDLE_LEN);
  const base = pt(needleAngle, 12);

  const RED = "#FF3B30";
  const AMBER = isDark ? "#FFAA00" : "#F5A623";
  const GREEN = isDark ? "#00D084" : "#00C875";
  const TRACK = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";

  const s = Math.round(display);
  const needleColor = s < 40 ? RED : s < 70 ? AMBER : GREEN;
  const scoreColor = s < 40 ? RED : s < 70 ? AMBER : GREEN;
  const label = s < 40 ? "NEEDS REST" : s < 55 ? "LOW" : s < 70 ? "MODERATE" : s < 85 ? "GOOD" : "PEAK";

  return (
    <View style={styles.wrap}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Track: two 90° arcs to avoid degenerate 180° arc */}
        <Path d={arc(180, 90)} stroke={TRACK} strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" />
        <Path d={arc(90, 0)} stroke={TRACK} strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" />

        {/* Color zones */}
        <Path d={arc(180, 108)} stroke={RED}   strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" opacity={0.8} />
        <Path d={arc(108, 54)}  stroke={AMBER} strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" opacity={0.8} />
        <Path d={arc(54, 0)}    stroke={GREEN}  strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" opacity={0.8} />

        {/* Zone labels */}
        {/* Needle */}
        <Line
          x1={base.x.toFixed(2)} y1={base.y.toFixed(2)}
          x2={tip.x.toFixed(2)}  y2={tip.y.toFixed(2)}
          stroke={needleColor}
          strokeWidth={3}
          strokeLinecap="round"
        />

        {/* Center hub */}
        <Circle cx={CX} cy={CY} r={10} fill={needleColor} />
        <Circle cx={CX} cy={CY} r={5}  fill={isDark ? "#0D1F38" : "#F5F7FA"} />

        {/* Needle tip dot */}
        <Circle cx={tip.x.toFixed(2)} cy={tip.y.toFixed(2)} r={5} fill={needleColor} />
      </Svg>

      <View style={styles.scoreBox}>
        <Text style={[styles.num, { color: scoreColor }]}>{score > 0 ? s : "—"}</Text>
        <Text style={[styles.pct, { color: scoreColor }]}>{score > 0 ? "% " + label : "NO DATA"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 4 },
  scoreBox: { alignItems: "center", marginTop: -12 },
  num: { fontSize: 56, fontWeight: "800", letterSpacing: -2, lineHeight: 60 },
  pct: { fontSize: 12, fontWeight: "700", letterSpacing: 2, marginTop: 2 },
});
