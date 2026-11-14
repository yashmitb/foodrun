import { Clock, User } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { PrimaryButton } from '@/components/buttons';
import { GlassCard } from '@/components/GlassCard';
import { destinationById, hallById } from '@/data/dining';
import type { Run } from '@/data/types';
import { clockTime, money } from '@/lib/format';
import { colors, fonts, radius } from '@/theme';

type Props = {
  run: Run;
  onJoin?: (run: Run) => void;
  /** Highlight the end dot when it matches the user's destination (P1). */
  myDestinationId?: string;
  compact?: boolean;
};

/**
 * §6.2 — Run card. Row 1 runner + price, row 2 route line with labeled dots
 * (start orange, end navy), row 3 leave time + spots + Join.
 */
export function RunCard({ run, onJoin, myDestinationId, compact }: Props) {
  const hall = hallById(run.hallId);
  const dest = destinationById(run.destinationId);
  const mine = run.destinationId === myDestinationId;
  const full = run.spotsLeft <= 0;
  return (
    <GlassCard radius={radius.runCard} padding={compact ? 14 : 17}>
      <View style={styles.row}>
        <Avatar initials={run.runner.initials} size={compact ? 38 : 44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {run.runner.name} <Text style={styles.star}>★ {run.runner.ratingAvg.toFixed(1)}</Text>
          </Text>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: colors.orange }]} />
            <Text style={styles.hall} numberOfLines={1}>
              {hall?.name ?? run.hallId}
            </Text>
            <View style={styles.line} />
            <View style={[styles.dot, { backgroundColor: colors.navy }]} />
            <Text style={[styles.hall, mine && styles.mine]} numberOfLines={1}>
              {dest?.name?.replace(' Library', '') ?? run.destinationId}
            </Text>
          </View>
        </View>
        <Text style={styles.price}>{money(run.feeCents)}</Text>
      </View>
      <View style={[styles.row, { marginTop: 12 }]}>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Clock size={14} color={colors.muted} strokeWidth={1.8} />
            <Text style={styles.metaText}>{clockTime(run.leaveAt)}</Text>
          </View>
          <View style={styles.metaItem}>
            <User size={14} color={colors.muted} strokeWidth={1.8} />
            <Text style={styles.metaText}>{full ? 'Full' : `${run.spotsLeft} left`}</Text>
          </View>
        </View>
        {onJoin ? (
          <PrimaryButton
            label={full ? 'Full' : 'Join'}
            disabled={full}
            onPress={() => onJoin(run)}
            style={styles.join}
          />
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  name: { fontSize: 17, fontFamily: fonts.semiBold, color: colors.ink },
  star: { color: colors.orange, fontSize: 13, fontFamily: fonts.semiBold },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  hall: { fontSize: 14, color: colors.navy, fontFamily: fonts.semiBold, flexShrink: 1 },
  mine: { color: colors.navy, textDecorationLine: 'underline' },
  line: { width: 28, height: 1.5, backgroundColor: 'rgba(18,53,91,0.25)', flexShrink: 0 },
  price: { fontSize: 20, color: colors.navy, fontFamily: fonts.bold, letterSpacing: -0.5 },
  meta: { flexDirection: 'row', gap: 16, flex: 1, marginLeft: 57 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, color: colors.muted, fontFamily: fonts.regular },
  join: { paddingVertical: 9, paddingHorizontal: 20 },
});
