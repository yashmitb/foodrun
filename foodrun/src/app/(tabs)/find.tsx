import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { SecondaryButton } from '@/components/buttons';
import { GlassCard } from '@/components/GlassCard';
import { RunCard } from '@/components/RunCard';
import { SegmentedControl, type Segment } from '@/components/SegmentedControl';
import { useToast } from '@/components/Toast';
import { DESTINATIONS, HALLS, destinationById, hallById, isOpenNow } from '@/data/dining';
import { isActiveOrder, useStore } from '@/data/store';
import { LAYOUT, enterUp, haptic, stagger } from '@/lib/motion';
import { colors, fonts, layout, radius, type } from '@/theme';

/**
 * §6.2 — Find a Run. Defaults to runs ending at the user's destination (P1),
 * real search (heuristic 8 fix), full hall names scrolling horizontally (§4),
 * Now / Scheduled toggle (P6).
 */
const WHEN_SEGMENTS: readonly Segment<'now' | 'scheduled'>[] = [
  { value: 'now', label: 'Now', a11y: 'Runs leaving now' },
  { value: 'scheduled', label: 'Scheduled', a11y: 'Scheduled runs' },
];

export default function Find() {
  const toast = useToast();
  const me = useStore((s) => s.me);
  const runs = useStore((s) => s.runs);
  const myOrder = useStore((s) => s.myOrder);
  const hasActiveOrder = isActiveOrder(myOrder);
  const destinationId = useStore((s) => s.destinationId);
  const [destFilter, setDestFilter] = useState<string | 'anywhere'>(destinationId);
  const [hallFilter, setHallFilter] = useState<string>('all');
  const [when, setWhen] = useState<'now' | 'scheduled'>('now');
  const [query, setQuery] = useState('');
  const [pickingDest, setPickingDest] = useState(false);

  const dest = destFilter === 'anywhere' ? null : destinationById(destFilter);
  const destShort = dest?.name.replace(' Library', '') ?? 'Anywhere';

  const visibleHalls = useMemo(
    () =>
      HALLS.filter(
        (h) => isOpenNow(h) || runs.some((r) => r.hallId === h.id && r.status !== 'done'),
      ),
    [runs],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs
      .filter((r) => r.runner.id !== me?.id)
      .filter((r) => (when === 'now' ? r.status === 'open' : r.status === 'scheduled'))
      .filter((r) => destFilter === 'anywhere' || r.destinationId === destFilter)
      .filter((r) => hallFilter === 'all' || r.hallId === hallFilter)
      .filter((r) => {
        if (!q) return true;
        const hall = hallById(r.hallId);
        const hay = [
          r.runner.name,
          hall?.name ?? '',
          ...(hall?.restaurants ?? []),
          destinationById(r.destinationId)?.name ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(a.leaveAt).getTime() - new Date(b.leaveAt).getTime());
  }, [runs, me?.id, when, destFilter, hallFilter, query]);

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.wrap}
          showsVerticalScrollIndicator={false}
          /* Don't rubber-band a screen whose content already fits. */
          alwaysBounceVertical={false}
        >
          <Text style={[type.eyebrow as object, { fontFamily: fonts.semiBold, marginTop: 6 }]}>
            TO {destShort.toUpperCase()}
          </Text>
          <Text style={[type.largeTitle as object, { fontFamily: fonts.bold, marginTop: 4 }]}>
            Find a Run
          </Text>

          {/* Destination chip (P1) */}
          <Pressable onPress={() => setPickingDest((v) => !v)}>
            <GlassCard radius={radius.pill} padding={0} style={{ alignSelf: 'flex-start', marginTop: 12 }}>
              <View style={styles.destChip}>
                <Text style={styles.destChipText}>
                  Showing runs to {destShort} · <Text style={{ color: colors.orange }}>Change</Text>
                </Text>
              </View>
            </GlassCard>
          </Pressable>
          {pickingDest ? (
            <View style={styles.destList}>
              {[{ id: 'anywhere', name: 'Anywhere' }, ...DESTINATIONS].map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => {
                    setDestFilter(d.id as string);
                    setPickingDest(false);
                  }}
                  style={[styles.destOption, destFilter === d.id && styles.destOptionOn]}
                >
                  <Text
                    style={[styles.destOptionText, destFilter === d.id && { color: colors.white }]}
                  >
                    {d.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Search — real (heuristic 8) */}
          <GlassCard radius={18} padding={0} style={{ marginTop: 14 }}>
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Dining hall, restaurant, or runner"
                placeholderTextColor="#A6AFBC"
                style={styles.searchInput}
                returnKeyType="search"
              />
              {/* Trailing, not leading: the field is wide and the glyph reads
                  as an affordance at the end of it rather than as a label. */}
              <Search size={20} color={colors.faint} strokeWidth={1.9} />
            </View>
          </GlassCard>

          {/* Hall filter — full names, horizontal scroll (§4) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 12, marginHorizontal: -layout.screenMargin }}
            contentContainerStyle={{ paddingHorizontal: layout.screenMargin, gap: 8 }}
          >
            {[{ id: 'all', name: 'All' }, ...visibleHalls].map((h) => (
              <Pressable
                key={h.id}
                onPress={() => {
                  if (hallFilter !== h.id) haptic('select');
                  setHallFilter(h.id);
                }}
                style={[styles.hallChip, hallFilter === h.id && styles.hallChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: hallFilter === h.id }}
              >
                <Text style={[styles.hallChipText, hallFilter === h.id && styles.hallChipTextOn]}>
                  {h.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Now / Scheduled (P6) — drag or tap */}
          <View style={{ marginTop: 12 }}>
            <SegmentedControl
              segments={WHEN_SEGMENTS}
              value={when}
              onChange={setWhen}
            />
          </View>

          {hasActiveOrder ? (
            <Animated.View entering={FadeIn.duration(260)} style={{ marginTop: 14 }}>
              <GlassCard
                radius={radius.runCard}
                padding={14}
                onPress={() => router.push('/order')}
                accessibilityLabel="Open your active order"
              >
                <Text style={styles.bannerTitle}>You already have an order in flight</Text>
                <Text style={styles.bannerBody}>
                  Only one at a time. Tap to track it, or cancel it to join another run.
                </Text>
              </GlassCard>
            </Animated.View>
          ) : null}

          {list.map((r, i) => (
            <Animated.View
              key={r.id}
              entering={enterUp(stagger(i))}
              layout={LAYOUT}
              style={{ marginTop: 12 }}
            >
              <RunCard
                run={r}
                showDay={when === 'scheduled'}
                myDestinationId={destFilter === 'anywhere' ? destinationId : destFilter}
                onJoin={(run) => {
                  if (hasActiveOrder) {
                    haptic('warning');
                    toast.show({
                      message: 'Finish or cancel your current order first.',
                      action: { label: 'View', onPress: () => router.push('/order') },
                    });
                    return;
                  }
                  router.push({ pathname: '/join/[runId]', params: { runId: run.id } });
                }}
              />
            </Animated.View>
          ))}

          {list.length === 0 ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No {when === 'scheduled' ? 'scheduled ' : ''}runs
                {hallFilter !== 'all' ? ` from ${hallById(hallFilter)?.name}` : ''} right now.
              </Text>
              <SecondaryButton
                label="Request a run"
                onPress={() =>
                  toast.show({
                    message: 'Request posted. Runners heading your way will see it.',
                  })
                }
                style={{ marginTop: 14, alignSelf: 'center' }}
              />
            </Animated.View>
          ) : null}

          <View style={{ height: 130 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: 12,
    paddingBottom: layout.tabBarClearance,
  },
  destChip: { paddingVertical: 10, paddingHorizontal: 16 },
  destChipText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.navy },
  destList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  destOption: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: 'rgba(18,53,91,0.08)',
  },
  destOptionOn: { backgroundColor: colors.navy },
  destOptionText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.navy },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    fontFamily: fonts.regular,
    color: colors.ink,
    paddingVertical: 15,
  },
  hallChip: {
    // 44pt tall including the text: Apple's minimum comfortable touch target,
    // and these sit in a horizontal scroller where a near miss scrolls
    // instead of selecting.
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  hallChipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  hallChipText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.navy },
  hallChipTextOn: { color: colors.white },
  seg: { flexDirection: 'row', padding: 3 },
  segBtn: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  segBtnOn: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.08,
    elevation: 2,
  },
  segText: { fontSize: 13, fontFamily: fonts.medium, color: '#5A6676' },
  segTextOn: { color: colors.navy, fontFamily: fonts.semiBold },
  empty: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 10 },
  emptyTitle: { fontSize: 15, color: colors.muted, fontFamily: fonts.regular, textAlign: 'center' },
  bannerTitle: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.navy },
  bannerBody: { marginTop: 3, fontSize: 13, color: colors.muted, fontFamily: fonts.regular },
});
