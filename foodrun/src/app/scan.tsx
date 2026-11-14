import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { destinationById } from '@/data/dining';
import { useJoinDraft } from '@/data/joinDraft';
import { useStore } from '@/data/store';
import { colors, fonts, motion } from '@/theme';

/**
 * §6.3 Step 3 — table QR scanner. Real camera when permitted (works in Expo
 * Go); a demo sticker resolves after 4s so the flow never dead-ends. A real
 * table QR encodes the spot label ("Geisel 2F, Table 14").
 */
export default function Scan() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const draft = useJoinDraft();
  const run = useStore((s) => s.runs.find((r) => r.id === runId));
  const dest = run ? destinationById(run.destinationId) : null;

  const [permission, requestPermission] = useCameraPermissions();
  const sweep = useSharedValue(0);
  const done = useRef(false);

  const finish = (spot: string) => {
    if (done.current) return;
    done.current = true;
    draft.patch({ dropSpot: spot });
    router.back();
  };

  const demoSpot = dest?.name.includes('Geisel')
    ? 'Geisel 2F, Table 14'
    : `${dest?.name ?? 'Drop spot'}, Table 3`;

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
    // Demo fallback: resolve even with no sticker in frame.
    const t = setTimeout(() => finish(demoSpot), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lineStyle = useAnimatedStyle(() => ({
    top: `${8 + sweep.get() * 82}%`,
  }));

  const cameraOk = Platform.OS !== 'web' && permission?.granted;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Point at the table sticker</Text>
      <View style={styles.viewfinder}>
        {cameraOk ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              const text = (data ?? '').trim();
              finish(text.length > 0 && text.length <= 60 ? text : demoSpot);
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
      </View>
      <Text style={styles.scanning}>Scanning…</Text>
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
  },
  title: { color: colors.white, fontSize: 17, fontFamily: fonts.semiBold },
  viewfinder: {
    width: 240,
    height: 240,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
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
  cancel: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  cancelText: { color: colors.white, fontSize: 14, fontFamily: fonts.semiBold },
});
