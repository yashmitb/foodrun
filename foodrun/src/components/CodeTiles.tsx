import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { codeTile, colors, fonts } from '@/theme';

type Props = {
  /** 4-digit handoff code, e.g. "4821". */
  code: string;
  /** Small = on My Order card; big = full-screen view (§3.4). */
  size?: 'small' | 'big';
};

/** §3.4 — Handoff code tiles: navy fill, white bold digits. */
export function CodeTiles({ code, size = 'small' }: Props) {
  const t = codeTile[size];
  return (
    <View style={styles.row} accessibilityLabel={`Handoff code ${code.split('').join(' ')}`}>
      {code.split('').map((c, i) => (
        <View
          key={i}
          style={[styles.tile, { width: t.width, height: t.height, borderRadius: t.radius }]}
        >
          <Text style={[styles.digit, { fontSize: t.fontSize }]}>{c}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  tile: {
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
});
