import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { ThemeColors } from "../context/ThemeContext";

interface Props {
  score: number;
  theme: ThemeColors;
  isDark: boolean;
}

const W = 260;
const H = 150;
const CX = W / 2;
const CY = H - 10; // arc endpoints at y=140
const R = 108;
const TRACK_W = 20;

// math convention: 0°=right, 90°=up, 180°=left
function pt(deg: number, r = R) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
}

// arc from startDeg → endDeg going clockwise on screen (through the top)
function arc(startDeg: number, endDeg: number, r = R): string {
  const s = pt(startDeg, r);
  const e = pt(endDeg, r);
  const span = startDeg - endDeg;
  const large = span > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// small triangle sitting ON the arc, tip pointing inward toward center
function trianglePath(angleDeg: number): string {
  const rad = (angleDeg * Math.PI) / 180;
  const outerR = R + TRACK_W / 2 + 2; // base just outside arc
  const innerR = R - TRACK_W / 2 - 2; // tip just inside arc
  const halfBase = 8;

  const tx = CX + innerR * Math.cos(rad);
  const ty = CY - innerR * Math.sin(rad);
  const lx = CX + outerR * Math.cos(rad) - halfBase * Math.sin(rad);
  const ly = CY - outerR * Math.sin(rad) - halfBase * Math.cos(rad);
  const rx = CX + outerR * Math.cos(rad) + halfBase * Math.sin(rad);
  const ry = CY - outerR * Math.sin(rad) + halfBase * Math.cos(rad);

  return `M ${tx.toFixed(1)} ${ty.toFixed(1)} L ${lx.toFixed(1)} ${ly.toFixed(1)} L ${rx.toFixed(1)} ${ry.toFixed(1)} Z`;
}

// score 0 = 180° (left), score 100 = 0° (right)
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
      friction: 5,
    }).start();
    return () => animVal.removeListener(id);
  }, [score]);

  const needleAngle = scoreToAngle(display);

  const RED   = "#FF3B30";
  const AMBER = isDark ? "#FFAA00" : "#F5A623";
  const GREEN = isDark ? "#00D084" : "#00C875";
  const TRACK = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";

  const s = Math.round(display);
  const zoneColor = s < 40 ? RED : s < 70 ? AMBER : GREEN;
  const label = s < 40 ? "NEEDS REST" : s < 55 ? "LOW" : s < 70 ? "MODERATE" : s < 85 ? "GOOD" : "PEAK";
  const triColor = isDark ? "#FFFFFF" : "#FFFFFF";

  return (
    <View style={styles.wrap}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Track: two 90° arcs to avoid degenerate 180° arc */}
        <Path d={arc(180, 90)} stroke={TRACK} strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" />
        <Path d={arc(90, 0)}   stroke={TRACK} strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" />

        {/* Color zones */}
        <Path d={arc(180, 108)} stroke={RED}   strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" opacity={0.85} />
        <Path d={arc(108, 54)}  stroke={AMBER} strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" opacity={0.85} />
        <Path d={arc(54, 0)}    stroke={GREEN}  strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" opacity={0.85} />

        {/* Triangle indicator on the arc */}
        <Path d={trianglePath(needleAngle)} fill={triColor} opacity={0.92} />
      </Svg>

      {/* Score number centered below the arch opening */}
      <View style={styles.scoreBox}>
        <Text style={[styles.num, { color: zoneColor }]}>{score > 0 ? s : "—"}</Text>
        <Text style={[styles.pct, { color: zoneColor }]}>{score > 0 ? "% " + label : "NO DATA"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 4 },
  scoreBox: { alignItems: "center", marginTop: 10 },
  num: { fontSize: 56, fontWeight: "800", letterSpacing: -2, lineHeight: 60 },
  pct: { fontSize: 12, fontWeight: "700", letterSpacing: 2, marginTop: 2 },
});
