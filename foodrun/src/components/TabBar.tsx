import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CircleDollarSign,
  CircleUserRound,
  House,
  ReceiptText,
  Search,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLOR_SHIFT, PRESS, SNAPPY, haptic } from '@/lib/motion';
import { colors, glass, layout } from '@/theme';

/** A floating tab bar is exactly what Apple's own Liquid Glass is for. */
const LIQUID = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

export type TabKey = 'home' | 'find' | 'order' | 'money' | 'account';

/** §4 — tab label is "My Order" everywhere (prototype mismatch fixed). */
const TABS: { key: TabKey; label: string; Icon: typeof House }[] = [
  { key: 'home', label: 'Home', Icon: House },
  { key: 'find', label: 'Find', Icon: Search },
  { key: 'order', label: 'My Order', Icon: ReceiptText },
  { key: 'money', label: 'Money', Icon: CircleDollarSign },
  { key: 'account', label: 'Account', Icon: CircleUserRound },
];

type Props = {
  active: TabKey;
  onChange: (key: TabKey) => void;
};

type Rect = { x: number; width: number };

function Tab({
  label,
  Icon,
  on,
  hot,
  onPress,
  onLayout,
}: {
  label: string;
  Icon: typeof House;
  on: boolean;
  /** The finger is over this tab mid-drag, even though it is not active yet. */
  hot: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const t = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    t.set(withSpring(on || hot ? 1 : 0, SNAPPY));
  }, [on, hot, t]);

  // A small lift + scale on the icon so the tab under your thumb reads even
  // before the capsule finishes travelling to it.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + t.get() * 0.1 }, { translateY: -t.get() * 1.5 }],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={onPress}
      onLayout={onLayout}
      style={styles.tab}
    >
      {/*
        Icon only. The label is gone from the bar, so `accessibilityLabel`
        above is now the only name this control has — without it the tab bar
        would be five unlabelled buttons to VoiceOver.
      */}
      <Animated.View style={iconStyle}>
        <Icon
          size={27}
          color={on || hot ? colors.navy : colors.faint}
          strokeWidth={on || hot ? 2.2 : 1.9}
        />
      </Animated.View>
    </Pressable>
  );
}

/**
 * §3.5 — Floating glass pill, 14px from the sides, resting on the home
 * indicator rather than hovering above it.
 *
 * The selected capsule is a single view that travels between measured tab
 * frames instead of a background toggled per tab, and it can be *dragged*:
 * press anywhere on the bar and slide, and the capsule follows your thumb,
 * committing when you let go. That is the interaction iOS uses for its own
 * segmented controls, and it only works if the capsule is one continuous
 * object — which is also what makes it feel physical rather than like five
 * separate buttons.
 *
 * While it moves it stretches along the direction of travel and relaxes back
 * when it lands, the way Apple's Liquid Glass deforms under motion.
 */
export function TabBar({ active, onChange }: Props) {
  const insets = useSafeAreaInsets();
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [hotIndex, setHotIndex] = useState<number | null>(null);
  const activeIndex = TABS.findIndex((t) => t.key === active);
  const target = rects[active];
  const hasMeasured = !!target;
  const firstPlacement = useRef(true);

  const x = useSharedValue(0);
  const appear = useSharedValue(0);
  const press = useSharedValue(0);
  /** Drag velocity, used only to stretch the capsule while it travels. */
  const travel = useSharedValue(0);

  // The gesture runs on the UI thread, so the measured frames have to live
  // in a shared value rather than in React state.
  const framesSV = useSharedValue<Rect[]>([]);
  useEffect(() => {
    framesSV.set(TABS.map((t) => rects[t.key]).filter(Boolean) as Rect[]);
  }, [rects, framesSV]);

  useEffect(() => {
    if (!target) return;
    if (firstPlacement.current) {
      // Don't fly in from x=0 on mount; land it where it belongs.
      x.set(target.x);
      appear.set(withTiming(1, COLOR_SHIFT));
      firstPlacement.current = false;
      return;
    }
    x.set(withSpring(target.x, SNAPPY));
  }, [target, x, appear]);

  const commit = React.useCallback(
    (i: number) => {
      setHotIndex(null);
      const key = TABS[i]?.key;
      if (!key) return;
      if (key !== active) {
        haptic('select');
        onChange(key);
      }
    },
    [active, onChange],
  );

  const hover = React.useCallback((i: number | null) => {
    setHotIndex(i);
    if (i != null) haptic('select');
  }, []);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        // minDistance 0 so a plain tap is the same gesture as a drag; the
        // capsule starts moving on touch-down instead of on release.
        .minDistance(0)
        .onBegin((e) => {
          press.set(withSpring(1, PRESS));
          const frames = framesSV.get();
          const i = indexAt(frames, e.x);
          if (i >= 0) {
            x.set(withSpring(frames[i].x, SNAPPY));
            runOnJS(hover)(i);
          }
        })
        .onUpdate((e) => {
          const frames = framesSV.get();
          const i = indexAt(frames, e.x);
          if (i < 0) return;
          travel.set(e.velocityX);
          if (Math.abs(frames[i].x - x.get()) > 1) {
            x.set(withSpring(frames[i].x, SNAPPY));
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
          travel.set(withSpring(0, SNAPPY));
          runOnJS(setHotIndex)(null);
        }),
    [framesSV, x, press, travel, hover, commit],
  );

  /**
   * Stretch along the direction of travel, capped so it reads as give in the
   * material rather than as a rubber band. Area is kept roughly constant —
   * what widens also thins — which is what makes it look like one volume of
   * glass being pushed rather than a box being scaled.
   */
  const squash = useDerivedValue(() => {
    const s = Math.min(Math.abs(travel.get()) / 2600, 0.18);
    return s;
  });

  const capsuleStyle = useAnimatedStyle(() => {
    const s = squash.get();
    return {
      transform: [
        { translateX: x.get() },
        { scaleX: 1 + s },
        { scaleY: 1 - s * 0.45 - press.get() * 0.03 },
      ],
      opacity: appear.get(),
    };
  });

  return (
    <View
      /*
       * Sit low. The home indicator's inset is generous for a bar that is
       * already a floating pill, so most of it is given back; the floor keeps
       * it off the very edge on a device with no inset at all.
       */
      style={[styles.wrap, { bottom: Math.max(insets.bottom - 16, 8) }]}
      accessibilityRole="tablist"
    >
      <Bar>
        <GestureDetector gesture={pan}>
          <View style={styles.inner}>
            {hasMeasured ? (
              <Animated.View
                style={[styles.capsule, { width: target.width }, capsuleStyle]}
                pointerEvents="none"
              />
            ) : null}
            {TABS.map(({ key, label, Icon }, i) => (
              <Tab
                key={key}
                label={label}
                Icon={Icon}
                on={i === activeIndex}
                hot={hotIndex === i}
                onPress={() => {
                  // The pan gesture already commits; this is the accessibility
                  // path and the fallback if gestures are unavailable.
                  if (key !== active) {
                    haptic('select');
                    onChange(key);
                  }
                }}
                onLayout={(e) => {
                  const { x: lx, width } = e.nativeEvent.layout;
                  setRects((prev) => {
                    const p = prev[key];
                    if (p && Math.abs(p.x - lx) < 0.5 && Math.abs(p.width - width) < 0.5) {
                      return prev;
                    }
                    return { ...prev, [key]: { x: lx, width } };
                  });
                }}
              />
            ))}
          </View>
        </GestureDetector>
      </Bar>
    </View>
  );
}

/** Which tab frame contains this x. Worklet: called from the gesture. */
function indexAt(frames: Rect[], x: number): number {
  'worklet';
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (x >= f.x && x <= f.x + f.width) return i;
  }
  if (frames.length === 0) return -1;
  // Past either end, clamp rather than lose the drag.
  return x < frames[0].x ? 0 : frames.length - 1;
}

/** Native glass where the OS has it, a cheap translucent fill where it doesn't. */
function Bar({ children }: { children: React.ReactNode }) {
  if (LIQUID) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="light"
        isInteractive
        style={styles.clip}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.clip, { backgroundColor: glass.fill }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: layout.tabBarSide,
    right: layout.tabBarSide,
    borderRadius: 32,
    zIndex: 5,
    shadowColor: '#12355B',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    shadowOpacity: 0.14,
    elevation: 8,
  },
  clip: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
  },
  inner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    /*
     * No horizontal padding: with it, the first and last tabs started inset
     * from the bar's edge, so the capsule stopped short at either end and
     * looked mis-centred. Now the row spans the bar and the capsule can reach
     * both ends. Vertical padding stays, to keep the capsule off the rim.
     */
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  capsule: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 26,
    backgroundColor: 'rgba(18,53,91,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 22,
    flex: 1,
  },
});
