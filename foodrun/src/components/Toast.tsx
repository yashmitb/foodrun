import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { colors, fonts, glass } from '@/theme';

type ToastData = {
  message: string;
  action?: { label: string; onPress: () => void };
  /** ms; defaults 3200, 6000 with action. */
  duration?: number;
};

type ToastContextValue = { show: (toast: ToastData) => void };

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

/**
 * §3.5 — Toast: dark glass, white text, optional orange action.
 * Wrap screens in <ToastProvider>; call useToast().show({...}).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((t: ToastData) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(
      () => setToast(null),
      t.duration ?? (t.action ? 6000 : 3200),
    );
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          // Springs in, curves out: Apple lets things arrive with some weight
          // but never makes you wait on a dismissal.
          entering={SlideInDown.springify().damping(22).stiffness(260).mass(0.9)}
          exiting={SlideOutDown.duration(180)}
          style={styles.wrap}
          accessibilityRole="alert"
        >
          {/* The fill is already 88% opaque — a blur behind it was invisible
              work on top of whatever was scrolling underneath. */}
          <View style={styles.blur}>
            <View style={styles.inner}>
              <Text style={styles.text} numberOfLines={2}>
                {toast.message}
              </Text>
              {toast.action ? (
                <Pressable
                  onPress={() => {
                    setToast(null);
                    toast.action!.onPress();
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.action}>{toast.action.label}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 104,
    borderRadius: 18,
    zIndex: 30,
  },
  blur: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: glass.toastFill,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  text: {
    flex: 1,
    fontSize: 15,
    color: colors.white,
    fontFamily: fonts.regular,
  },
  action: {
    fontSize: 15,
    color: colors.orange,
    fontFamily: fonts.bold,
  },
});
