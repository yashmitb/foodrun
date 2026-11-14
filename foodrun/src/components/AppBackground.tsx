import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { backgroundGradient, blobs } from '@/theme';

/**
 * §3.2 — Vertical gradient + 3 large blurred blobs.
 * Glass needs something behind it to blur, so keep this on every screen.
 * Blobs are solid circles under a full-bleed BlurView, which gives the ~60px blur.
 */
export function AppBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={backgroundGradient.colors}
        locations={backgroundGradient.locations}
        style={StyleSheet.absoluteFill}
      />
      {blobs.map((b, i) => (
        <View
          key={i}
          style={[
            styles.blob,
            {
              width: b.size,
              height: b.size,
              borderRadius: b.size / 2,
              backgroundColor: b.color,
              top: 'top' in b ? b.top : undefined,
              bottom: 'bottom' in b ? (b as { bottom: number }).bottom : undefined,
              left: 'left' in b ? b.left : undefined,
              right: 'right' in b ? (b as { right: number }).right : undefined,
            },
          ]}
        />
      ))}
      <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  blob: { position: 'absolute' },
});
