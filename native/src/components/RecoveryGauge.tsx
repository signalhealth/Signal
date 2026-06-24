import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated } from "react-native";
import Svg, { Path, Text as SvgText, Defs, LinearGradient, Stop, Circle } from "react-native-svg";
import { ThemeColors } from "../context/ThemeContext";

interface Props {
  score: number;
  theme: ThemeColors;
  isDark: boolean;
}

const W     = 280;
const CX    = W / 2;   // 140
const CY    = 128;
const R     = 110;
const TW    = 14;
const H     = 218;

// Arc runs 270° from lower-left (225°) CW through top to lower-right (−45°)
const START = 225;
const END   = -45;
const SWEEP = 270;

// BMW Blues
const BLUE_LIGHT = "#60AFFF";
const BLUE_MID   = "#1C69D4";
const BLUE_DARK  = "#003A99";

// Gradient spans full circle width
const GX1 = CX - R;  // 30
const GX2 = CX + R;  // 250

// math convention: 0°=right, 90°=up (y = CY − r·sin)
function pt(deg: number, r = R) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
}

// Clockwise arc on screen (sweep-flag=1)
function arc(startDeg: number, endDeg: number, r = R): string {
  const s = pt(startDeg, r);
  const e = pt(endDeg, r);
  let span = startDeg - endDeg;
  if (span < 0) span += 360;
  const large = span > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// Score → arc angle (0 = 225°, 100 = −45°)
function scoreAngle(s: number): number {
  return START - (s / 100) * SWEEP;
}

// Radial tick mark
function tickPath(score: number, inset = 7, outset = 7): string {
  const deg = scoreAngle(score);
  const p1  = pt(deg, R - TW / 2 - inset);
  const p2  = pt(deg, R + TW / 2 + outset);
  return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
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

  const s             = Math.round(display);
  const fillEnd       = scoreAngle(display);
  const hasScore      = score > 0 && display > 1;

  const RED        = "#FF3B30";
  const AMBER      = isDark ? "#FFAA00" : "#F5A623";
  const LIME       = isDark ? "#9BD600" : "#7CB000";
  const GREEN      = isDark ? "#00D084" : "#00C875";
  const zoneColor  = s < 40 ? RED : s < 60 ? AMBER : s < 80 ? LIME : GREEN;
  const label      = s < 40 ? "REST DAY"
                   : s < 60 ? "TAKE IT EASY"
                   : s < 80 ? "GO AHEAD"
                   : "GO HARD";

  const TRACK = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)";

  return (
    <View style={styles.wrap}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="fillGrad" x1={GX1} y1={0} x2={GX2} y2={0} gradientUnits="userSpaceOnUse">
            <Stop offset="0%"   stopColor={BLUE_LIGHT} stopOpacity={0.95} />
            <Stop offset="50%"  stopColor={BLUE_MID}   stopOpacity={0.95} />
            <Stop offset="100%" stopColor={BLUE_DARK}  stopOpacity={1}    />
          </LinearGradient>
          <LinearGradient id="glowGrad" x1={GX1} y1={0} x2={GX2} y2={0} gradientUnits="userSpaceOnUse">
            <Stop offset="0%"   stopColor={BLUE_LIGHT} stopOpacity={0.2}  />
            <Stop offset="50%"  stopColor={BLUE_MID}   stopOpacity={0.1}  />
            <Stop offset="100%" stopColor={BLUE_DARK}  stopOpacity={0.2}  />
          </LinearGradient>
        </Defs>

        {/* Decorative rings */}
        <Circle cx={CX} cy={CY} r={R + TW / 2 + 5} stroke="rgba(255,255,255,0.09)" strokeWidth={1} fill="none" />
        <Circle cx={CX} cy={CY} r={R - TW / 2 - 5} stroke="rgba(255,255,255,0.05)" strokeWidth={1} fill="none" />

        {/* Full dark track */}
        <Path d={arc(START, END)} stroke={TRACK} strokeWidth={TW} strokeLinecap="round" fill="none" />

        {/* Blue filled arc */}
        {hasScore && (
          <>
            <Path d={arc(START, fillEnd)} stroke="url(#glowGrad)" strokeWidth={TW + 14} strokeLinecap="round" fill="none" />
            <Path d={arc(START, fillEnd)} stroke="url(#fillGrad)" strokeWidth={TW}      strokeLinecap="round" fill="none" />
            {/* Glass highlight on outer edge */}
            <Path d={arc(START, fillEnd, R + TW / 2 - 3)} stroke="rgba(255,255,255,0.22)" strokeWidth={2} strokeLinecap="round" fill="none" />
            {/* Inner shadow */}
            <Path d={arc(START, fillEnd, R - TW / 2 + 2)} stroke="rgba(0,20,80,0.3)"     strokeWidth={2} strokeLinecap="round" fill="none" />
          </>
        )}

        {/* Threshold ticks */}
        <Path d={tickPath(65, 6, 6)}  stroke="rgba(255,255,255,0.55)" strokeWidth={2}   strokeLinecap="round" fill="none" />
        <Path d={tickPath(75, 6, 9)}  stroke="rgba(255,255,255,0.85)" strokeWidth={2.5} strokeLinecap="round" fill="none" />
        <Path d={tickPath(100, 4, 8)} stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeLinecap="round" fill="none" />

        {/* Score centered in circle */}
        <SvgText x={CX} y={CY + 22} textAnchor="middle" fill={zoneColor} fontSize={72} fontWeight="800">
          {hasScore ? String(s) : "—"}
        </SvgText>
        <SvgText x={CX} y={CY + 48} textAnchor="middle" fill={zoneColor} fontSize={13} fontWeight="700">
          {hasScore ? `% ${label}` : "NO DATA"}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 4 },
});
