import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { CodeTiles } from '@/components/CodeTiles';
import { useStore } from '@/data/store';
import { colors, fonts } from '@/theme';

/** §6.5 — full-screen handoff code: white, big tiles, tap anywhere to close. */
export default function BigCode() {
  const order = useStore((s) => s.myOrder);
  const runs = useStore((s) => s.runs);
  const runner = runs.find((r) => r.id === order?.runId)?.runner;

  if (!order) {
    router.back();
    return null;
  }

  return (
    <Pressable style={styles.root} onPress={() => router.back()} accessibilityLabel="Close code">
      <Text style={styles.label}>SHOW {runner?.firstName?.toUpperCase() ?? 'YOUR RUNNER'} THIS CODE</Text>
      <CodeTiles code={order.handoffCode} size="big" />
      <Text style={styles.sub}>Screen brightness turned up</Text>
      <Text style={styles.closeChip}>Tap anywhere to close</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 20,
  },
  label: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.faint,
    letterSpacing: 0.6,
  },
  sub: { fontSize: 15, color: colors.muted, fontFamily: fonts.regular },
  closeChip: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.navy,
    backgroundColor: 'rgba(18,53,91,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
