import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { SMOOTH, usePressAnimation } from '@/lib/motion';
import { colors, fonts, glass, radius } from '@/theme';

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
 * §3.5 — Primary button: orange pill, NAVY 17/700 text (white on orange is
 * 2.5:1 and fails WCAG — never use it), orange glow, spring press + haptic.
 *
 * The enabled→disabled change is animated: the label often swaps between
 * "Add last 4 digits" and "Review" as the user fills the Join sheet, and a
 * hard color cut there is the single jumpiest thing in the flow.
 */
export function PrimaryButton({ label, onPress, disabled, icon, style }: PrimaryProps) {
  const press = usePressAnimation({ scaleTo: 0.96, haptic: 'medium' });
  const enabled = useSharedValue(disabled ? 0 : 1);

  useEffect(() => {
    enabled.set(withSpring(disabled ? 0 : 1, SMOOTH));
  }, [disabled, enabled]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: enabled.get() }));
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: enabled.get() * 0.35,
  }));

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
      {...(disabled ? {} : press.handlers)}
    >
      <Animated.View style={[styles.glow, glowStyle, press.style, style]}>
        <View style={styles.primary}>
          <View style={styles.disabledFill} />
          <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
            <LinearGradient
              // a touch lighter at the top: the pill reads as lit, not flat
              colors={['#F79A3D', colors.orange]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <View style={styles.primaryContent}>
            <Text style={[styles.primaryText, disabled && styles.primaryTextDisabled]}>
              {label}
            </Text>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
          </View>
        </View>
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
  const press = usePressAnimation({ scaleTo: 0.97, dimTo: 0.92, haptic: 'light' });
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...press.handlers}
    >
      <Animated.View style={[styles.secondaryShadow, press.style, style]}>
        <View style={[styles.secondaryClip, { backgroundColor: glass.fill }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.secondaryInner}>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text style={styles.secondaryText}>{label}</Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glow: {
    borderRadius: radius.pill,
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 5,
  },
  primary: {
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  disabledFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18,53,91,0.12)',
  },
  primaryContent: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  secondaryShadow: {
    borderRadius: radius.pill,
    shadowColor: '#12355B',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 20,
    shadowOpacity: 0.07,
    elevation: 3,
  },
  secondaryClip: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.border,
  },
  secondaryInner: {
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
