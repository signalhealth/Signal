import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated } from "react-native";
import Svg, { Path, Text as SvgText, Defs, LinearGradient, Stop } from "react-native-svg";
import { ThemeColors } from "../context/ThemeContext";

interface Props {
  score: number;
  theme: ThemeColors;
  isDark: boolean;
}

const W    = 260;
const CY   = 143;
const R    = 108;
const TW   = 20;   // track width
const H    = CY + 12;

// BMW Blues
const BLUE_LIGHT = "#60AFFF";
const BLUE_MID   = "#1C69D4";
const BLUE_DARK  = "#003A99";

// Gradient spans the horizontal width of the arc
const GX1 = W / 2 - R;  // ≈ 22  (left endpoint)
const GX2 = W / 2 + R;  // ≈ 238 (right endpoint)

function pt(deg: number, r = R) {
  const rad = (deg * Math.PI) / 180;
  return { x: W / 2 + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
}

// Sweep-flag=1 → clockwise on screen → draws top arch
function arc(a: number, b: number, r = R): string {
  const s = pt(a, r);
  const e = pt(b, r);
  const large = (a - b) > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// White triangle ON the arc, tip pointing inward
function trianglePath(angleDeg: number): string {
  const rad = (angleDeg * Math.PI) / 180;
  const CX = W / 2;
  const outerR  = R + TW / 2 + 2;
  const innerR  = R - TW / 2 - 2;
  const halfBase = 8;
  const tx = CX + innerR * Math.cos(rad);
  const ty = CY  - innerR * Math.sin(rad);
  const lx = CX + outerR * Math.cos(rad) - halfBase * Math.sin(rad);
  const ly = CY  - outerR * Math.sin(rad) - halfBase * Math.cos(rad);
  const rx = CX + outerR * Math.cos(rad) + halfBase * Math.sin(rad);
  const ry = CY  - outerR * Math.sin(rad) + halfBase * Math.cos(rad);
  return `M ${tx.toFixed(1)} ${ty.toFixed(1)} L ${lx.toFixed(1)} ${ly.toFixed(1)} L ${rx.toFixed(1)} ${ry.toFixed(1)} Z`;
}

// Radial tick mark at a score position
function tickPath(score: number): string {
  const deg = 180 - score * 1.8;
  const inner = pt(deg, R - TW / 2 - 6);
  const outer = pt(deg, R + TW / 2 + 6);
  return `M ${inner.x.toFixed(1)} ${inner.y.toFixed(1)} L ${outer.x.toFixed(1)} ${outer.y.toFixed(1)}`;
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

  const needleAngle = scoreToAngle(display);
  const s = Math.round(display);

  const RED   = "#FF3B30";
  const AMBER = isDark ? "#FFAA00" : "#F5A623";
  const GREEN = isDark ? "#00D084" : "#00C875";
  const zoneColor = s < 40 ? RED : s < 70 ? AMBER : GREEN;
  const label = s < 40 ? "NEEDS REST" : s < 55 ? "LOW" : s < 70 ? "MODERATE" : s < 85 ? "GOOD" : "PEAK";

  return (
    <View style={styles.wrap}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="arcGrad" x1={GX1} y1={0} x2={GX2} y2={0} gradientUnits="userSpaceOnUse">
            <Stop offset="0%"   stopColor={BLUE_LIGHT} stopOpacity={0.95} />
            <Stop offset="55%"  stopColor={BLUE_MID}   stopOpacity={0.95} />
            <Stop offset="100%" stopColor={BLUE_DARK}  stopOpacity={1}    />
          </LinearGradient>
          <LinearGradient id="glowGrad" x1={GX1} y1={0} x2={GX2} y2={0} gradientUnits="userSpaceOnUse">
            <Stop offset="0%"   stopColor={BLUE_LIGHT} stopOpacity={0.2}  />
            <Stop offset="50%"  stopColor={BLUE_MID}   stopOpacity={0.1}  />
            <Stop offset="100%" stopColor={BLUE_DARK}  stopOpacity={0.2}  />
          </LinearGradient>
        </Defs>

        {/* Soft glow halo */}
        <Path d={arc(180, 90)} stroke="url(#glowGrad)" strokeWidth={TW + 14} strokeLinecap="butt" fill="none" />
        <Path d={arc(90, 0)}   stroke="url(#glowGrad)" strokeWidth={TW + 14} strokeLinecap="butt" fill="none" />

        {/* Main blue gradient arc */}
        <Path d={arc(180, 90)} stroke="url(#arcGrad)" strokeWidth={TW} strokeLinecap="butt" fill="none" />
        <Path d={arc(90, 0)}   stroke="url(#arcGrad)" strokeWidth={TW} strokeLinecap="butt" fill="none" />

        {/* Glass highlight — bright edge along outer curve */}
        <Path d={arc(180, 90, R + TW / 2 - 3)} stroke="rgba(255,255,255,0.28)" strokeWidth={2.5} strokeLinecap="butt" fill="none" />
        <Path d={arc(90,  0,  R + TW / 2 - 3)} stroke="rgba(255,255,255,0.28)" strokeWidth={2.5} strokeLinecap="butt" fill="none" />

        {/* Inner shadow — depth on inner edge */}
        <Path d={arc(180, 90, R - TW / 2 + 2)} stroke="rgba(0,20,80,0.4)" strokeWidth={2} strokeLinecap="butt" fill="none" />
        <Path d={arc(90,  0,  R - TW / 2 + 2)} stroke="rgba(0,20,80,0.4)" strokeWidth={2} strokeLinecap="butt" fill="none" />

        {/* Threshold ticks: 65 = train light, 75 = train as planned */}
        <Path d={tickPath(65)} stroke="rgba(255,255,255,0.6)"  strokeWidth={2}   strokeLinecap="round" fill="none" />
        <Path d={tickPath(75)} stroke="rgba(255,255,255,0.85)" strokeWidth={2.5} strokeLinecap="round" fill="none" />

        {/* Triangle indicator */}
        <Path d={trianglePath(needleAngle)} fill="#FFFFFF" opacity={isDark ? 0.92 : 0.8} />

        {/* Score + label inside the arch */}
        <SvgText x={W / 2} y={CY - 28} textAnchor="middle" fill={zoneColor} fontSize={54} fontWeight="800">
          {score > 0 ? String(s) : "—"}
        </SvgText>
        <SvgText x={W / 2} y={CY - 6} textAnchor="middle" fill={zoneColor} fontSize={11} fontWeight="700">
          {score > 0 ? `% ${label}` : "NO DATA"}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 4, paddingBottom: 4 },
});
