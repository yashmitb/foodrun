import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { useMotionEnabled } from '@/lib/motion';

type Props = {
  value: number | string;
  style?: StyleProp<TextStyle>;
  /** Screen-reader text; the digits alone rarely say enough. */
  label?: string;
};

/**
 * Swaps a number by rolling the new value up from below, the way iOS timers
 * and Activity rings do. The ETA is the biggest element in the app (§3.7), so
 * a hard text replacement there is very visible.
 */
export function AnimatedNumber({ value, style, label }: Props) {
  const animate = useMotionEnabled();

  if (!animate) {
    return (
      <Text style={style} accessibilityLabel={label}>
        {value}
      </Text>
    );
  }

  return (
    <View style={styles.clip} accessibilityLabel={label}>
      <Animated.Text
        key={String(value)}
        entering={FadeInDown.duration(320).withInitialValues({
          transform: [{ translateY: 26 }],
        })}
        exiting={FadeOutUp.duration(200)}
        style={style}
      >
        {value}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', justifyContent: 'center' },
});
