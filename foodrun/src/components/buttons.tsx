import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, glass, motion, radius } from '@/theme';

function usePressScale(scaleTo: number) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const onPressIn = () => {
    scale.set(withTiming(scaleTo, { duration: 90 }));
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const onPressOut = () => {
    scale.set(withTiming(1, { duration: 140 }));
  };
  return { style, onPressIn, onPressOut };
}

type PrimaryProps = {
  /** Says exactly what happens ("Join run · $2"). */
  label: string;
  onPress?: () => void;
  /** Disabled buttons say what's missing ("Add your order #"). */
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * §3.5 — Primary button: orange pill, NAVY 17/700 text (white on orange fails
 * WCAG — never use it), orange glow shadow, scale 0.97 on press + light haptic.
 */
export function PrimaryButton({ label, onPress, disabled, icon, style }: PrimaryProps) {
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale(motion.pressScale);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          styles.primary,
          disabled ? styles.primaryDisabled : styles.primaryEnabled,
          pressStyle,
          style,
        ]}
      >
        <Text style={[styles.primaryText, disabled && styles.primaryTextDisabled]}>{label}</Text>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
      </Animated.View>
    </Pressable>
  );
}

type SecondaryProps = {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** §3.5 — Secondary button: glass pill, navy 15/600 text, optional leading icon. */
export function SecondaryButton({ label, onPress, icon, style }: SecondaryProps) {
  const { style: pressStyle, onPressIn, onPressOut } = usePressScale(motion.pressScale);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.secondaryWrap, glass.shadow, pressStyle, style]}>
        <BlurView intensity={glass.blurIntensity} tint="light" style={styles.secondaryBlur}>
          <View style={styles.secondaryInner}>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text style={styles.secondaryText}>{label}</Text>
          </View>
        </BlurView>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryEnabled: {
    backgroundColor: colors.orange,
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    shadowOpacity: 0.35,
    elevation: 5,
  },
  primaryDisabled: {
    backgroundColor: 'rgba(18,53,91,0.12)',
  },
  primaryText: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.navy,
    letterSpacing: -0.15,
  },
  primaryTextDisabled: {
    color: colors.faint,
  },
  secondaryWrap: {
    borderRadius: radius.pill,
  },
  secondaryBlur: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: glass.fill,
  },
  secondaryInner: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.border,
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryText: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.navy,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
});
