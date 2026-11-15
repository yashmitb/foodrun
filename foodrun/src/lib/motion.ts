import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import {
  Easing,
  FadeInDown,
  LinearTransition,
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
 * Apple's spring model, ported.
 *
 * Since iOS 17, UIKit and SwiftUI stopped exposing mass/damping/stiffness and
 * ask for two numbers instead: a *perceptual duration* and a *bounce*
 * (WWDC23, "Animate with springs"). The physics are derived, so a designer
 * never hand-tunes a damping coefficient and accidentally lands on something
 * that wobbles. The conversion, with mass pinned at 1:
 *
 *   stiffness = (2π / duration)²
 *   damping   = 4π · (1 − bounce) / duration        (bounce ≥ 0)
 *
 * which gives a damping ratio of exactly (1 − bounce): bounce 0 is critically
 * damped — fast, no overshoot — and bounce 0.3 overshoots noticeably. Apple's
 * advice is that 0 is the safe default and 0.15 already reads as lively.
 *
 * Why springs at all: a spring is defined by where it is and how fast it is
 * moving, so a *new* spring can pick up the current velocity and continue.
 * A duration curve cannot — interrupt it and it either snaps or restarts.
 * Every animation in this app must survive being interrupted, because every
 * one of them can be, by a tap or a drag.
 *
 * `reduceMotion: System` makes Reanimated jump straight to the end value when
 * the OS "Reduce Motion" switch is on (§3.6). If animations look dead on a
 * device, check Settings › Accessibility › Motion first.
 */
export function spring(duration: number, bounce = 0): WithSpringConfig {
  const w = (2 * Math.PI) / duration;
  return {
    mass: 1,
    stiffness: w * w,
    damping: 2 * (1 - bounce) * w,
    reduceMotion: ReduceMotion.System,
  };
}

/** Touch-down highlight. Must land inside one or two frames or it feels laggy. */
export const PRESS = spring(0.22, 0);

/** SwiftUI `.snappy` at control scale. Tab capsules, segmented controls, chips. */
export const SNAPPY = spring(0.32, 0.12);

/** SwiftUI `.smooth`. Cards, layout shifts, progress. No overshoot. */
export const SMOOTH = spring(0.45, 0);

/** Sheet present/dismiss. Matches the weight of a UIKit sheet. */
export const SHEET = spring(0.5, 0.1);

/** SwiftUI `.bouncy`. Hero entrances only — never on exits. */
export const BOUNCY = spring(0.5, 0.3);

/**
 * Opacity and color get curves, not springs: a spring on opacity can overshoot
 * past 1, which clips, and colour has no velocity to preserve.
 */
export const FADE: WithTimingConfig = {
  duration: 200,
  easing: Easing.out(Easing.quad),
  reduceMotion: ReduceMotion.System,
};

export const COLOR_SHIFT: WithTimingConfig = {
  duration: 350,
  easing: Easing.inOut(Easing.quad),
  reduceMotion: ReduceMotion.System,
};

/** Kept so existing imports keep working. */
export const SPRING_SNAPPY = SNAPPY;
export const SPRING_GENTLE = SMOOTH;
export const SPRING_BOUNCY = BOUNCY;
export const SPRING_SHEET = SHEET;

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
 * onto an Animated.View inside it.
 *
 * Only `transform` and `opacity` are touched. Those two are the compositor's
 * own properties — iOS can animate them without re-running layout or redrawing
 * the view's contents, which is what lets them hold 120Hz. Animating `width`,
 * `top` or `margin` instead walks the layout tree every frame; that is the
 * difference between smooth and almost smooth.
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
        pressed.set(withSpring(1, PRESS));
        if (hapticKind) haptic(hapticKind);
      },
      onPressOut: () => {
        pressed.set(withSpring(0, PRESS));
      },
    },
  };
}

/**
 * Entrance for a card or row: rises a short distance into place on a spring.
 *
 * Springified rather than a 420ms curve, for the same reason as everything
 * else here — a list can re-render while its rows are still arriving, and a
 * curve restarts from zero when that happens.
 */
export function enterUp(delay = 0) {
  return FadeInDown.delay(delay)
    .springify()
    .mass(1)
    .stiffness(158)
    .damping(22.6)
    .reduceMotion(ReduceMotion.System);
}

/**
 * Layout spring for lists that grow, shrink or reorder. Reanimated animates
 * the real layout change here, so this is the one place a non-transform
 * animation is unavoidable — keep it to lists, never to a continuous loop.
 */
export const LAYOUT = LinearTransition.springify()
  .mass(1)
  .stiffness(195)
  .damping(27.9)
  .reduceMotion(ReduceMotion.System);

/**
 * Stagger delay for list entrances. Capped so a long list never feels like
 * it's loading slowly — Apple fronts the first few and lands the rest together.
 */
export function stagger(index: number, step = 40, max = 200): number {
  return Math.min(index * step, max);
}

/** Cross-fade only when the OS asks for reduced motion (§3.6). */
export function useMotionEnabled(): boolean {
  return !useReducedMotion();
}

export { withSpring, withTiming };
