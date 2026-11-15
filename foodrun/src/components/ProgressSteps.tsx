import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { COLOR_SHIFT, SPRING_GENTLE } from '@/lib/motion';
import { colors, fonts } from '@/theme';

export const ORDER_STAGES = ['Ordered', 'Picked up', 'On the way', 'Arrived'] as const;

type Props = {
  /** Index of the current stage (0–3). Done = navy, current = orange, upcoming = line. */
  current: number;
  labels?: readonly string[];
};

type SegState = 'done' | 'current' | 'upcoming';

/**
 * Each segment fills left-to-right rather than cross-fading, so the bar reads
 * as the order physically moving along a route — the peer review called this
 * the most important display on the screen.
 */
function Segment({ state }: { state: SegState }) {
  const fill = useSharedValue(state === 'upcoming' ? 0 : 1);
  const tone = useSharedValue(state === 'done' ? 1 : 0);

  useEffect(() => {
    fill.set(withSpring(state === 'upcoming' ? 0 : 1, SPRING_GENTLE));
    tone.set(withTiming(state === 'done' ? 1 : 0, COLOR_SHIFT));
  }, [state, fill, tone]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.get() * 100}%`,
    backgroundColor: interpolateColor(tone.get(), [0, 1], [colors.orange, colors.navy]),
  }));

  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fillStyle]} />
    </View>
  );
}

function StepLabel({ label, state }: { label: string; state: SegState }) {
  const t = useSharedValue(state === 'current' ? 1 : 0);
  const done = useSharedValue(state === 'done' ? 1 : 0);

  useEffect(() => {
    t.set(withSpring(state === 'current' ? 1 : 0, SPRING_GENTLE));
    done.set(withTiming(state === 'done' ? 1 : 0, COLOR_SHIFT));
  }, [state, t, done]);

  const style = useAnimatedStyle(() => ({
    color: interpolateColor(
      Math.max(t.get(), done.get() * 0.999),
      [0, 1],
      [colors.faint, t.get() > done.get() ? colors.orange : colors.navy],
    ),
    transform: [{ scale: 1 + t.get() * 0.04 }],
  }));

  return (
    <Animated.Text
      style={[styles.label, style, state === 'current' && { fontFamily: fonts.semiBold }]}
    >
      {label}
    </Animated.Text>
  );
}

/** §3.5 — Progress: 4 segments with labels, animates between states (§3.6). */
export function ProgressSteps({ current, labels = ORDER_STAGES }: Props) {
  const stateFor = (i: number): SegState =>
    i < current ? 'done' : i === current ? 'current' : 'upcoming';

  return (
    <View accessibilityLabel={`Order status: ${labels[current] ?? ''}`}>
      <View style={styles.row}>
        {labels.map((l, i) => (
          <Segment key={l} state={stateFor(i)} />
        ))}
      </View>
      <View style={styles.labelRow}>
        {labels.map((l, i) => (
          <StepLabel key={l} label={l} state={stateFor(i)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: 5,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    borderRadius: 5,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.regular,
  },
});
