import { BlurView } from 'expo-blur';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

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
 * §3.3 — Glass surface: white 55% fill, blur 24 + saturate, 1px light border,
 * inner top highlight, soft navy shadow.
 */
export function GlassCard({
  children,
  radius = r.bigCard,
  style,
  padding = 22,
  onPress,
  accessibilityLabel,
}: Props) {
  const body = (
    <View style={[styles.shadowWrap, { borderRadius: radius }, glass.shadow, style]}>
      <BlurView
        intensity={glass.blurIntensity}
        tint="light"
        style={[styles.blur, { borderRadius: radius }]}
      >
        <View style={[styles.inner, { borderRadius: radius, padding }]}>{children}</View>
      </BlurView>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : undefined)}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    backgroundColor: 'transparent',
  },
  blur: {
    overflow: 'hidden',
    backgroundColor: glass.fill,
  },
  inner: {
    borderWidth: 1,
    borderColor: glass.border,
    // inner top highlight
    borderTopColor: 'rgba(255,255,255,0.9)',
  },
});
