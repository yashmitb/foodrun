import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressAnimation } from '@/lib/motion';
import { glass, radius as r } from '@/theme';

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
 * §3.3 — Glass surface: translucent fill, specular sheen, top hairline.
 *
 * Deliberately not a `BlurView`, and deliberately not iOS 26's Liquid Glass
 * either.
 *
 * No blur: a blur only earns its cost when there is detail behind it to
 * smear, and behind these cards is a smooth gradient. One blur per card was
 * the main reason scrolling dropped frames.
 *
 * No GlassView: Apple's own guidance is that Liquid Glass is for floating
 * chrome over content — a tab bar, a toolbar — not for the content itself,
 * and on a device it rendered as a heavy grey slab under this app's navy
 * text. This is also what reference/screens/ actually shows. The tab bar,
 * which is floating chrome, does use the real thing.
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

  const surface = (
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
