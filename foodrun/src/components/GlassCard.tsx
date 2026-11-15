import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressAnimation } from '@/lib/motion';
import { glass, radius as r } from '@/theme';

/**
 * iOS 26 exposes Apple's real Liquid Glass through `UIVisualEffectView`, and
 * expo-glass-effect ships inside Expo Go, so no dev build is needed. It is not
 * a nicer blur: it refracts what is behind it and lights its own edges, which
 * is the part a hand-rolled stack can never fake. Checked once at module load
 * because the answer cannot change while the app is running.
 */
const LIQUID = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

type Props = {
  children: React.ReactNode;
  /** Corner radius. Big cards 28, run cards 24 (§3.3). */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Inner padding. Big cards use 22, run cards 16–18. */
  padding?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * §3.3 — Glass surface.
 *
 * The fallback path (iOS 25 and below, Android, web) deliberately has no
 * `BlurView`. A blur only earns its cost when there is detail behind it to
 * smear; behind these cards is a smooth gradient, so a translucent fill plus
 * a specular sheen is visually indistinguishable and free. One blur per card
 * was the main reason scrolling dropped frames.
 */
export function GlassCard({
  children,
  radius = r.bigCard,
  style,
  padding = 22,
  onPress,
  accessibilityLabel,
}: Props) {
  const press = usePressAnimation({ scaleTo: 0.985, dimTo: 0.97, haptic: 'light' });

  const surface = LIQUID ? (
    <GlassView glassEffectStyle="regular" style={[styles.clip, { borderRadius: radius }]}>
      <View style={{ padding }}>{children}</View>
    </GlassView>
  ) : (
    <View style={[styles.clip, { borderRadius: radius, backgroundColor: glass.fill }]}>
      {/* specular sheen: light falls off by ~55% of the height */}
      <LinearGradient
        colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* hairline where light catches the top edge */}
      <View
        style={[styles.topEdge, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
      />
      <View style={[styles.border, { borderRadius: radius }]} pointerEvents="none" />
      <View style={{ padding }}>{children}</View>
    </View>
  );

  if (!onPress) {
    return <View style={[styles.shadow, { borderRadius: radius }, style]}>{surface}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...press.handlers}
    >
      <Animated.View style={[styles.shadow, { borderRadius: radius }, press.style, style]}>
        {surface}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * The shadow sits on an outer view because the clip below hides its own
   * overflow. A tight radius on purpose: a 30pt shadow on a view iOS cannot
   * derive a `shadowPath` for is recomputed from the alpha channel on every
   * frame the view is animated, which made the press scale stutter.
   */
  shadow: glass.shadow,
  clip: {
    overflow: 'hidden',
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  border: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: glass.border,
  },
});
