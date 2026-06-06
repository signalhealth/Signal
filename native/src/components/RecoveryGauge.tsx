import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";
import { ThemeColors } from "../context/ThemeContext";

interface Props {
  score: number;
  theme: ThemeColors;
  isDark: boolean;
}

const W = 260;
const CY = 143;       // arc endpoint baseline
const R = 108;
const TRACK_W = 20;
const H = CY + 12;   // just enough for stroke bleed, no wasted space

// math convention: 0°=right, 90°=up, 180°=left
function pt(deg: number, r = R) {
  const rad = (deg * Math.PI) / 180;
  return { x: W / 2 + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
}

// arc clockwise on screen (sweep-flag=1) → through the top
function arc(startDeg: number, endDeg: number, r = R): string {
  const s = pt(startDeg, r);
  const e = pt(endDeg, r);
  const large = (startDeg - endDeg) > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// white triangle ON the arc, tip pointing inward toward center
function trianglePath(angleDeg: number): string {
  const rad = (angleDeg * Math.PI) / 180;
  const CX = W / 2;
  const outerR = R + TRACK_W / 2 + 2;
  const innerR = R - TRACK_W / 2 - 2;
  const halfBase = 8;
  const tx = CX + innerR * Math.cos(rad);
  const ty = CY - innerR * Math.sin(rad);
  const lx = CX + outerR * Math.cos(rad) - halfBase * Math.sin(rad);
  const ly = CY - outerR * Math.sin(rad) - halfBase * Math.cos(rad);
  const rx = CX + outerR * Math.cos(rad) + halfBase * Math.sin(rad);
  const ry = CY - outerR * Math.sin(rad) + halfBase * Math.cos(rad);
  return `M ${tx.toFixed(1)} ${ty.toFixed(1)} L ${lx.toFixed(1)} ${ly.toFixed(1)} L ${rx.toFixed(1)} ${ry.toFixed(1)} Z`;
}

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

  const CX = W / 2;
  const needleAngle = scoreToAngle(display);

  const RED   = "#FF3B30";
  const AMBER = isDark ? "#FFAA00" : "#F5A623";
  const GREEN = isDark ? "#00D084" : "#00C875";
  const TRACK = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";

  const s = Math.round(display);
  const zoneColor = s < 40 ? RED : s < 70 ? AMBER : GREEN;
  const label = s < 40 ? "NEEDS REST" : s < 55 ? "LOW" : s < 70 ? "MODERATE" : s < 85 ? "GOOD" : "PEAK";

  return (
    <View style={styles.wrap}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Track */}
        <Path d={arc(180, 90)} stroke={TRACK} strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" />
        <Path d={arc(90, 0)}   stroke={TRACK} strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" />

        {/* Color zones */}
        <Path d={arc(180, 108)} stroke={RED}   strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" opacity={0.85} />
        <Path d={arc(108, 54)}  stroke={AMBER} strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" opacity={0.85} />
        <Path d={arc(54, 0)}    stroke={GREEN}  strokeWidth={TRACK_W} strokeLinecap="butt" fill="none" opacity={0.85} />

        {/* Triangle indicator */}
        <Path d={trianglePath(needleAngle)} fill="#FFFFFF" opacity={0.92} />

        {/* Score inside the arch opening */}
        <SvgText
          x={CX}
          y={CY - 28}
          textAnchor="middle"
          fill={zoneColor}
          fontSize={54}
          fontWeight="800"
        >
          {score > 0 ? String(s) : "—"}
        </SvgText>
        <SvgText
          x={CX}
          y={CY - 6}
          textAnchor="middle"
          fill={zoneColor}
          fontSize={11}
          fontWeight="700"
          letterSpacing={2}
        >
          {score > 0 ? `% ${label}` : "NO DATA"}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 4, paddingBottom: 4 },
});
