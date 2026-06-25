import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

const palette = {
  bg: '#F4F7FB',
  base: '#E5ECF6',
  highlight: '#EEF3FA',
};

/** A single shimmering placeholder block. */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = 10,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: radius, backgroundColor: palette.base, opacity },
        style,
      ]}
    />
  );
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonBlock width={40} height={40} radius={14} style={{ marginBottom: 14, backgroundColor: palette.highlight }} />
      <SkeletonBlock width="55%" height={22} radius={8} style={{ marginBottom: 8 }} />
      <SkeletonBlock width="70%" height={12} radius={6} />
    </View>
  );
}

/**
 * Full-screen loading skeleton that mirrors the shared screen layout (gradient
 * hero + a 2-column card grid). Used in place of the spinner so screens feel
 * instant and premium while data loads.
 */
export default function ScreenSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <SkeletonBlock width={52} height={52} radius={18} style={{ backgroundColor: 'rgba(255,255,255,0.35)', marginBottom: 16 }} />
        <SkeletonBlock width="45%" height={26} radius={8} style={{ backgroundColor: 'rgba(255,255,255,0.5)', marginBottom: 10 }} />
        <SkeletonBlock width="85%" height={13} radius={6} style={{ backgroundColor: 'rgba(255,255,255,0.35)' }} />
        <View style={styles.heroBand}>
          <SkeletonBlock width="100%" height={48} radius={16} style={{ backgroundColor: 'rgba(255,255,255,0.6)' }} />
        </View>
      </View>

      <SkeletonBlock width="35%" height={20} radius={8} style={{ marginBottom: 16 }} />

      <View style={styles.grid}>
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: 18, paddingTop: 14 },
  hero: {
    borderRadius: 30,
    padding: 20,
    marginBottom: 22,
    backgroundColor: '#6D7CFF',
  },
  heroBand: { marginTop: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D9E2F1',
  },
});
