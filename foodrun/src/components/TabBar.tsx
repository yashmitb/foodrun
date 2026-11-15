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
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLOR_SHIFT, SNAPPY, haptic } from '@/lib/motion';
import { colors, fonts, glass, layout } from '@/theme';

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
  onPress,
  onLayout,
}: {
  label: string;
  Icon: typeof House;
  on: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const t = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    t.set(withSpring(on ? 1 : 0, SNAPPY));
  }, [on, t]);

  // A small lift + scale on the icon so the selected tab reads even
  // before the capsule finishes travelling.
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
      <Animated.View style={iconStyle}>
        <Icon size={22} color={on ? colors.navy : colors.faint} strokeWidth={on ? 2.1 : 1.9} />
      </Animated.View>
      <Text style={[styles.label, on ? styles.labelOn : styles.labelOff]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * §3.5 — Floating glass pill, 14px from sides, 18px from bottom (+ safe area).
 *
 * The selected capsule is a single view that springs between measured tab
 * frames rather than a background toggled per tab. That continuity is what
 * makes an iOS tab bar feel physical instead of like five separate buttons.
 */
export function TabBar({ active, onChange }: Props) {
  const insets = useSafeAreaInsets();
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const activeIndex = TABS.findIndex((t) => t.key === active);
  const target = rects[active];
  const hasMeasured = !!target;
  const firstPlacement = useRef(true);

  const x = useSharedValue(0);
  const appear = useSharedValue(0);

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

  /**
   * Only `translateX` and `opacity` move. The five tabs are all `flex: 1`, so
   * the capsule's width is constant and animating it only forced a layout
   * pass every frame. Transform and opacity are the compositor's own
   * properties — they never touch layout, which is what lets this hold 120Hz.
   */
  const capsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    opacity: appear.get(),
  }));

  return (
    <View
      style={[styles.wrap, { bottom: layout.tabBarBottom + insets.bottom }]}
      accessibilityRole="tablist"
    >
      <Bar>
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
              onPress={() => {
                if (key !== active) haptic('select');
                onChange(key);
              }}
              onLayout={(e) => {
                const { x: lx, width } = e.nativeEvent.layout;
                setRects((prev) => {
                  const p = prev[key];
                  if (p && Math.abs(p.x - lx) < 0.5 && Math.abs(p.width - width) < 0.5) return prev;
                  return { ...prev, [key]: { x: lx, width } };
                });
              }}
            />
          ))}
        </View>
      </Bar>
    </View>
  );
}

/** Native glass where the OS has it, a cheap translucent fill where it doesn't. */
function Bar({ children }: { children: React.ReactNode }) {
  if (LIQUID) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive style={styles.clip}>
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
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  capsule: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: 20,
    backgroundColor: 'rgba(18,53,91,0.08)',
  },
  tab: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 20,
    flex: 1,
  },
  label: {
    fontSize: 11,
  },
  labelOn: { color: colors.navy, fontFamily: fonts.semiBold },
  labelOff: { color: colors.faint, fontFamily: fonts.regular },
});
