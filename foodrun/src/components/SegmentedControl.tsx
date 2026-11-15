import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { PRESS, SNAPPY, haptic } from '@/lib/motion';
import { colors, fonts, glass, radius as r } from '@/theme';

export type Segment<T extends string> = { value: T; label: string; a11y?: string };

type Props<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
};

type Rect = { x: number; width: number };

/**
 * §3.5 — glass track, selected segment white with a small shadow.
 *
 * Like the tab bar, the selection is one travelling object rather than a
 * style toggled per segment, and it can be dragged: press and slide and the
 * thumb follows your finger, committing where you let go. UIKit's own
 * segmented control has worked this way since it was introduced, and it is
 * the reason the thing feels like a physical switch.
 */
export function SegmentedControl<T extends string>({ segments, value, onChange }: Props<T>) {
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [hot, setHot] = useState<number | null>(null);
  const activeIndex = segments.findIndex((s) => s.value === value);
  const target = rects[value];
  const first = useRef(true);

  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const press = useSharedValue(0);

  const framesSV = useSharedValue<Rect[]>([]);
  useEffect(() => {
    framesSV.set(segments.map((s) => rects[s.value]).filter(Boolean) as Rect[]);
  }, [rects, segments, framesSV]);

  useEffect(() => {
    if (!target) return;
    if (first.current) {
      x.set(target.x);
      w.set(target.width);
      first.current = false;
      return;
    }
    x.set(withSpring(target.x, SNAPPY));
    // Segment widths can differ, unlike the tab bar's equal fifths.
    w.set(withSpring(target.width, SNAPPY));
  }, [target, x, w]);

  const commit = React.useCallback(
    (i: number) => {
      setHot(null);
      const next = segments[i]?.value;
      if (next && next !== value) {
        haptic('select');
        onChange(next);
      }
    },
    [segments, value, onChange],
  );

  const hover = React.useCallback((i: number) => {
    setHot(i);
    haptic('select');
  }, []);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          press.set(withSpring(1, PRESS));
          const frames = framesSV.get();
          const i = indexAt(frames, e.x);
          if (i >= 0) {
            x.set(withSpring(frames[i].x, SNAPPY));
            w.set(withSpring(frames[i].width, SNAPPY));
            runOnJS(hover)(i);
          }
        })
        .onUpdate((e) => {
          const frames = framesSV.get();
          const i = indexAt(frames, e.x);
          if (i < 0) return;
          if (Math.abs(frames[i].x - x.get()) > 1) {
            x.set(withSpring(frames[i].x, SNAPPY));
            w.set(withSpring(frames[i].width, SNAPPY));
            runOnJS(hover)(i);
          }
        })
        .onEnd((e) => {
          const frames = framesSV.get();
          const i = indexAt(frames, e.x);
          if (i >= 0) runOnJS(commit)(i);
        })
        .onFinalize(() => {
          press.set(withSpring(0, PRESS));
          runOnJS(setHot)(null);
        }),
    [framesSV, x, w, press, hover, commit],
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { scale: 1 - press.get() * 0.02 }],
    width: w.get(),
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.track}>
        {target ? <Animated.View style={[styles.thumb, thumbStyle]} pointerEvents="none" /> : null}
        {segments.map((s, i) => {
          const on = i === activeIndex;
          return (
            <Pressable
              key={s.value}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={s.a11y ?? s.label}
              onPress={() => commit(i)}
              onLayout={(e: LayoutChangeEvent) => {
                const { x: lx, width } = e.nativeEvent.layout;
                setRects((prev) => {
                  const p = prev[s.value];
                  if (p && Math.abs(p.x - lx) < 0.5 && Math.abs(p.width - width) < 0.5) return prev;
                  return { ...prev, [s.value]: { x: lx, width } };
                });
              }}
              style={styles.segment}
            >
              <Text style={[styles.text, (on || hot === i) && styles.textOn]}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}

/** Which segment contains this x. Worklet: called from the gesture. */
function indexAt(frames: Rect[], x: number): number {
  'worklet';
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (x >= f.x && x <= f.x + f.width) return i;
  }
  if (frames.length === 0) return -1;
  return x < frames[0].x ? 0 : frames.length - 1;
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: r.segmented,
    backgroundColor: glass.fill,
    borderWidth: 1,
    borderColor: glass.border,
  },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: r.segmented - 2,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.08,
    elevation: 2,
  },
  segment: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: r.segmented - 2 },
  text: { fontSize: 15, fontFamily: fonts.medium, color: '#5A6676' },
  textOn: { color: colors.navy, fontFamily: fonts.semiBold },
});
