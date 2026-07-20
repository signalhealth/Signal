import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { ThemeColors } from "../context/ThemeContext";
import { GAUGE_SIZE } from "./heroLayout";
import { FONT_DISPLAY } from "../theme/typography";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  score: number;
  theme: ThemeColors;
  isDark: boolean;
  size?: number;
}

export function RecoveryGauge({ score, theme, isDark, size = GAUGE_SIZE }: Props) {
  const CX = size / 2;
  const CY = size / 2;
  const TW = size * 0.07;
  const R = size / 2 - TW / 2 - size * 0.03;
  const CIRCUMFERENCE = 2 * Math.PI * R;

  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(animVal, {
      toValue: score,
      useNativeDriver: false,
      tension: 32,
      friction: 8,
    }).start();
  }, [score]);

  const s        = Math.round(score);
  const hasScore = score > 0;
  const dashOffset = animVal.interpolate({
    inputRange: [0, 100],
    outputRange: [CIRCUMFERENCE, 0],
    extrapolate: "clamp",
  });

  const RING_COLOR = theme.accent; // BMW Blue
  const label     = s < 40 ? "REST DAY"
                  : s < 60 ? "TAKE IT EASY"
                  : s < 80 ? "GO AHEAD"
                  : "GO HARD";

  const TRACK = "rgba(255,255,255,0.18)";

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={CX} cy={CY} r={R} stroke={TRACK} strokeWidth={TW} fill="none" />

        {hasScore && (
          <AnimatedCircle
            cx={CX} cy={CY} r={R}
            stroke={RING_COLOR}
            strokeWidth={TW}
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            fill="none"
            rotation={-90}
            origin={`${CX}, ${CY}`}
          />
        )}

        <SvgText x={CX} y={CY + size * 0.08} textAnchor="middle" fill="#FFFFFF" fontSize={size * 0.285} fontWeight="800">
          {hasScore ? s : "—"}
        </SvgText>
        <SvgText x={CX} y={CY + size * 0.19} textAnchor="middle" fill="#FFFFFF" fontSize={size * 0.06} fontFamily={FONT_DISPLAY}>
          {hasScore ? label : "NO DATA"}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 4 },
});
