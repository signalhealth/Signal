import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { GAUGE_SIZE } from "./heroLayout";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface RingSpec {
  fraction: number;
  color: string;
}

interface Props {
  size?: number;
  strokeWidth?: number;
  gap?: number;
  rings: RingSpec[];
  trackColor?: string;
}

export function MultiRingGauge({
  size = GAUGE_SIZE,
  strokeWidth = 15,
  gap = 6,
  rings,
  trackColor = "rgba(255,255,255,0.18)",
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const animVals = useRef(rings.map(() => new Animated.Value(0))).current;
  const fractionsKey = rings.map((r) => Math.max(0, Math.min(1, r.fraction)).toFixed(3)).join(",");

  useEffect(() => {
    const anims = rings.map((ring, i) =>
      Animated.spring(animVals[i], {
        toValue: Math.max(0, Math.min(1, ring.fraction)),
        useNativeDriver: false,
        tension: 30,
        friction: 8,
      })
    );
    Animated.stagger(90, anims).start();
  }, [fractionsKey]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((ring, i) => {
        const r = cx - strokeWidth / 2 - i * (strokeWidth + gap);
        const circumference = 2 * Math.PI * r;
        const dashOffset = animVals[i].interpolate({
          inputRange: [0, 1],
          outputRange: [circumference, 0],
        });
        return (
          <React.Fragment key={i}>
            <Circle cx={cx} cy={cy} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
            <AnimatedCircle
              cx={cx}
              cy={cy}
              r={r}
              stroke={ring.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              fill="none"
              rotation={-90}
              origin={`${cx}, ${cy}`}
            />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
