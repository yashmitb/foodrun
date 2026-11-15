import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { destinationById } from '@/data/dining';
import { useJoinDraft } from '@/data/joinDraft';
import { useStore } from '@/data/store';
import { BOUNCY, haptic } from '@/lib/motion';
import { colors, fonts, motion } from '@/theme';

/** How long to look before offering a way out. */
const NO_STICKER_AFTER_MS = 7000;

/** Viewfinder is a fixed 240pt square; the line sweeps between these insets. */
const VIEWFINDER = 240;
const SWEEP_TOP = VIEWFINDER * 0.08;
const SWEEP_TRAVEL = VIEWFINDER * 0.82;

/**
 * §6.3 Step 3 — table QR scanner.
 *
 * A real table QR encodes the spot label ("Geisel 2F, Table 14"). If nothing
 * is found we surface choices instead of inventing a spot: silently filling in
 * a plausible table sends someone's food to the wrong place, and the check
 * mark makes them believe it was really scanned.
 */
export default function Scan() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const run = useStore((s) => s.runs.find((r) => r.id === runId));
  const dest = run ? destinationById(run.destinationId) : null;

  const [permission, requestPermission] = useCameraPermissions();
  const [noSticker, setNoSticker] = useState(false);
  const sweep = useSharedValue(0);
  const found = useSharedValue(0);
  const done = useRef(false);

  const demoSpot = dest?.name.includes('Geisel')
    ? 'Geisel 2F, Table 14'
    : `${dest?.name ?? 'Drop spot'}, Table 3`;

  const patch = useJoinDraft((d) => d.patch);
  const finish = useCallback(
    (spot: string) => {
      if (done.current) return;
      done.current = true;
      haptic('success');
      found.set(withSpring(1, BOUNCY));
      patch({ dropSpot: spot });
      // let the frame turn green before the sheet comes back
      setTimeout(() => router.back(), 260);
    },
    [found, patch],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    sweep.set(
      withRepeat(
        withTiming(1, { duration: motion.scanSweep.duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    const t = setTimeout(() => {
      if (!done.current) setNoSticker(true);
    }, NO_STICKER_AFTER_MS);
    return () => clearTimeout(t);
  }, [sweep]);

  /**
   * `translateY` over an animated `top`: the sweep runs continuously for as
   * long as the scanner is open, and a percentage `top` would put a layout
   * pass on every one of those frames. The viewfinder is a fixed 240pt box,
   * so the travel can just be a constant.
   */
  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: SWEEP_TOP + sweep.get() * SWEEP_TRAVEL }],
    opacity: 1 - found.get(),
  }));

  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + found.get() * 0.04 }],
    borderColor: found.get() > 0.5 ? colors.success : 'rgba(255,255,255,0.85)',
  }));

  const cameraOk = Platform.OS !== 'web' && permission?.granted;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Point at the table sticker</Text>

      <Animated.View style={[styles.viewfinder, frameStyle]}>
        {cameraOk ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              const text = (data ?? '').trim();
              // Only trust a sticker that looks like a spot label.
              if (text.length > 0 && text.length <= 60) finish(text);
            }}
          />
        ) : (
          <View style={styles.qr}>
            {[0, 1, 2].map((r) => (
              <View key={r} style={styles.qrRow}>
                {[0, 1, 2].map((c) => (
                  <View key={c} style={[styles.qrCell, (r + c) % 2 === 0 && styles.qrCellDark]} />
                ))}
              </View>
            ))}
          </View>
        )}
        <Animated.View style={[styles.scanLine, lineStyle]} />
      </Animated.View>

      {noSticker ? (
        <Animated.View entering={FadeInDown.duration(280)} style={styles.fallback}>
          <Text style={styles.fallbackTitle}>No sticker found</Text>
          <Text style={styles.fallbackBody}>
            Keep the camera on it, or set your spot by hand so your runner knows where to go.
          </Text>
          <Pressable
            onPress={() => {
              done.current = true;
              router.back();
            }}
            style={styles.fallbackPrimary}
            accessibilityRole="button"
          >
            <Text style={styles.fallbackPrimaryText}>Pick a spot instead</Text>
          </Pressable>
          {!cameraOk ? (
            <Pressable
              onPress={() => finish(`${demoSpot} (demo)`)}
              style={styles.fallbackGhost}
              accessibilityRole="button"
            >
              <Text style={styles.fallbackGhostText}>Use a demo spot</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : (
        <Animated.Text entering={FadeIn} style={styles.scanning}>
          Scanning…
        </Animated.Text>
      )}

      <Pressable
        onPress={() => {
          done.current = true;
          router.back();
        }}
        style={styles.cancel}
        accessibilityRole="button"
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B1520',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingHorizontal: 28,
  },
  title: { color: colors.white, fontSize: 17, fontFamily: fonts.semiBold },
  viewfinder: {
    width: VIEWFINDER,
    height: VIEWFINDER,
    borderRadius: 30,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: '#1B2836',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: { width: '100%', height: '100%' },
  qr: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#0E1116',
    overflow: 'hidden',
  },
  qrRow: { flexDirection: 'row', flex: 1 },
  qrCell: { flex: 1, backgroundColor: '#0E1116' },
  qrCellDark: { backgroundColor: '#F2F5F9' },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.orange,
    shadowColor: colors.orange,
    shadowRadius: 14,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  scanning: { color: '#B7C3D1', fontSize: 14, fontFamily: fonts.regular },
  fallback: { alignItems: 'center', gap: 10 },
  fallbackTitle: { color: colors.white, fontSize: 16, fontFamily: fonts.semiBold },
  fallbackBody: {
    color: '#B7C3D1',
    fontSize: 13,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 18,
  },
  fallbackPrimary: {
    marginTop: 4,
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: colors.orange,
  },
  fallbackPrimaryText: { color: colors.navy, fontSize: 15, fontFamily: fonts.bold },
  fallbackGhost: { paddingVertical: 8, paddingHorizontal: 16 },
  fallbackGhostText: { color: '#B7C3D1', fontSize: 13, fontFamily: fonts.semiBold },
  cancel: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  cancelText: { color: colors.white, fontSize: 14, fontFamily: fonts.semiBold },
});
