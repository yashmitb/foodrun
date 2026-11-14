import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, motion } from '@/theme';

export const ORDER_STAGES = ['Ordered', 'Picked up', 'On the way', 'Arrived'] as const;

type Props = {
  /** Index of the current stage (0–3). Done = navy, current = orange, upcoming = line. */
  current: number;
  labels?: readonly string[];
};

function Segment({ state }: { state: 'done' | 'current' | 'upcoming' }) {
  const t = useSharedValue(state === 'done' ? 2 : state === 'current' ? 1 : 0);
  useEffect(() => {
    t.set(
      withTiming(state === 'done' ? 2 : state === 'current' ? 1 : 0, {
        duration: motion.progress.duration,
      }),
    );
  }, [state, t]);
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      t.value,
      [0, 1, 2],
      [colors.line, colors.orange, colors.navy],
    ),
  }));
  return <Animated.View style={[styles.segment, style]} />;
}

/** §3.5 — Progress: 4 segments with labels, animates between states (§3.6). */
export function ProgressSteps({ current, labels = ORDER_STAGES }: Props) {
  return (
    <View accessibilityLabel={`Order status: ${labels[current] ?? ''}`}>
      <View style={styles.row}>
        {labels.map((_, i) => (
          <Segment key={i} state={i < current ? 'done' : i === current ? 'current' : 'upcoming'} />
        ))}
      </View>
      <View style={styles.labelRow}>
        {labels.map((l, i) => (
          <Text
            key={l}
            style={[
              styles.label,
              i < current && { color: colors.navy },
              i === current && { color: colors.orange, fontFamily: fonts.semiBold },
            ]}
          >
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 5, borderRadius: 5 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    color: colors.faint,
    fontFamily: fonts.regular,
  },
});
