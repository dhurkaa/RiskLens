import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Text } from './app-text';

type Props = {
  score: number; // 0 - 100
  size?: number;
  strokeWidth?: number;
  label?: string;
  caption?: string;
  /** Render compact (no caption block), used inside chat cards. */
  compact?: boolean;
};

function bandColors(score: number): [string, string] {
  if (score >= 80) return ['#42D392', '#2BB47B']; // healthy green
  if (score >= 60) return ['#4BE1EC', '#5AA9FF']; // stable cyan/blue
  if (score >= 40) return ['#F7B955', '#FF9F43']; // pressure amber
  if (score >= 20) return ['#FF8A5B', '#FF6B7A']; // at-risk orange/red
  return ['#FF6B7A', '#E84855']; // critical red
}

/**
 * Animated radial gauge used for the Business Health Score. Works identically on
 * web and native by driving an Animated.Value through a JS listener and
 * recomputing the arc each frame (cheap for a one-shot sweep).
 */
export default function HealthGauge({
  score,
  size = 168,
  strokeWidth = 14,
  label = 'Health',
  caption,
  compact = false,
}: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setDisplay(value));
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: clamped,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [clamped, anim]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = display / 100;
  const dashOffset = circumference * (1 - progress * 0.75); // 3/4 sweep (270°)
  const [c1, c2] = bandColors(clamped);

  return (
    <View style={[styles.wrap, { width: size }]}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={c1} />
              <Stop offset="1" stopColor={c2} />
            </LinearGradient>
          </Defs>

          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5ECF6"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(135 ${size / 2} ${size / 2})`}
          />

          {/* Progress */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#gaugeGrad)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(135 ${size / 2} ${size / 2})`}
          />
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.score, { color: c2 }]}>{Math.round(display)}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
      </View>

      {!compact && caption ? (
        <View style={[styles.captionPill, { backgroundColor: `${c1}22` }]}>
          <View style={[styles.dot, { backgroundColor: c2 }]} />
          <Text style={[styles.captionText, { color: c2 }]}>{caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1,
  },
  label: {
    color: '#738199',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  captionPill: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  captionText: {
    fontSize: 13,
    fontWeight: '900',
  },
});
