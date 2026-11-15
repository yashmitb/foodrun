import { BlurView } from 'expo-blur';
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
 * §3.3 — Glass surface.
 *
 * Real iOS glass is three layers, not one translucent fill: the blur, a
 * top-down sheen that fades out by ~55%, and a bright hairline along the top
 * edge where light catches. Dropping any one of them reads as "gray box with
 * blur". The shadow sits on an outer view because the blur clips its children.
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
    <View style={[styles.blurClip, { borderRadius: radius }]}>
      <BlurView intensity={glass.blurIntensity} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.fill }]} />
      {/* specular sheen */}
      <LinearGradient
        colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* hairline where light catches the top edge */}
      <View style={[styles.topEdge, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
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
  shadow: {
    shadowColor: '#12355B',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 30,
    shadowOpacity: 0.08,
    elevation: 4,
    backgroundColor: 'transparent',
  },
  blurClip: {
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
