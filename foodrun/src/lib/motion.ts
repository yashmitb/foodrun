import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type WithSpringConfig,
  type WithTimingConfig,
} from 'react-native-reanimated';

/**
 * iOS-feeling motion. UIKit animates with springs, not fixed curves — the
 * duration follows from the physics, so a press that's interrupted mid-flight
 * resolves smoothly instead of snapping. These mirror SwiftUI's presets.
 *
 * All configs set `reduceMotion: System`, so Reanimated drops to an instant
 * value when the OS "Reduce Motion" switch is on (§3.6).
 */

/** Crisp, no overshoot. Buttons, taps, toggles. */
export const SPRING_SNAPPY: WithSpringConfig = {
  mass: 0.6,
  damping: 18,
  stiffness: 320,
  overshootClamping: false,
  reduceMotion: ReduceMotion.System,
};

/** Soft settle. Cards, layout shifts, progress. */
export const SPRING_GENTLE: WithSpringConfig = {
  mass: 0.9,
  damping: 20,
  stiffness: 180,
  reduceMotion: ReduceMotion.System,
};

/** A little life. Sheets, hero entrances. */
export const SPRING_BOUNCY: WithSpringConfig = {
  mass: 0.8,
  damping: 15,
  stiffness: 200,
  reduceMotion: ReduceMotion.System,
};

/** Sheet present / dismiss — matches the iOS sheet feel. */
export const SPRING_SHEET: WithSpringConfig = {
  mass: 0.85,
  damping: 22,
  stiffness: 260,
  reduceMotion: ReduceMotion.System,
};

/** For opacity and color, where a spring would look wrong. */
export const FADE: WithTimingConfig = {
  duration: 220,
  easing: Easing.out(Easing.quad),
  reduceMotion: ReduceMotion.System,
};

export const COLOR_SHIFT: WithTimingConfig = {
  duration: 420,
  easing: Easing.inOut(Easing.quad),
  reduceMotion: ReduceMotion.System,
};

export type HapticKind = 'light' | 'medium' | 'select' | 'success' | 'warning' | 'error';

/** Fire-and-forget haptic. No-ops on web, never rejects into a crash. */
export function haptic(kind: HapticKind = 'light') {
  if (Platform.OS === 'web') return;
  const run = () => {
    switch (kind) {
      case 'medium':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'select':
        return Haptics.selectionAsync();
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      default:
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  void run()?.catch(() => {});
}

type PressOptions = {
  /** How far it shrinks. 0.96 for buttons, 0.985 for big cards. */
  scaleTo?: number;
  /** Dim slightly while held, like UIKit's highlight state. */
  dimTo?: number;
  haptic?: HapticKind | false;
};

/**
 * Spring press feedback. Spread the handlers onto a Pressable and the style
 * onto an Animated.View inside it. Because it springs, a quick tap still
 * reads: the scale is already travelling back before the finger lifts.
 */
export function usePressAnimation({
  scaleTo = 0.96,
  dimTo = 1,
  haptic: hapticKind = 'light',
}: PressOptions = {}) {
  const pressed = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.get() * (1 - scaleTo) }],
    opacity: 1 - pressed.get() * (1 - dimTo),
  }));

  return {
    style,
    handlers: {
      onPressIn: () => {
        pressed.set(withSpring(1, SPRING_SNAPPY));
        if (hapticKind) haptic(hapticKind);
      },
      onPressOut: () => {
        pressed.set(withSpring(0, SPRING_SNAPPY));
      },
    },
  };
}

/**
 * Stagger delay for list entrances. Capped so a long list never feels like
 * it's loading slowly — Apple fronts the first few and lands the rest together.
 */
export function stagger(index: number, step = 45, max = 260): number {
  return Math.min(index * step, max);
}

/** Cross-fade only when the OS asks for reduced motion (§3.6). */
export function useMotionEnabled(): boolean {
  return !useReducedMotion();
}

export { withSpring, withTiming };
