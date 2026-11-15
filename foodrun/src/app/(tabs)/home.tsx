import { router } from 'expo-router';
import { ArrowRight, MapPin, Plus } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import { AppBackground } from '@/components/AppBackground';
import { Avatar } from '@/components/Avatar';
import { PrimaryButton, SecondaryButton } from '@/components/buttons';
import { GlassCard } from '@/components/GlassCard';
import { RunCard } from '@/components/RunCard';
import { destinationById, hallById } from '@/data/dining';
import { isActiveOrder, useStore } from '@/data/store';
import { dayName, greeting } from '@/lib/format';
import { LAYOUT, enterUp, stagger } from '@/lib/motion';
import { useNow } from '@/lib/useAppClock';
import { colors, fonts, layout, radius, type } from '@/theme';

const STATUS_LINE: Record<string, (n: string) => string> = {
  pending: (n) => `Waiting to confirm with ${n}`,
  confirmed: (n) => `${n} will grab your order`,
  picked_up: (n) => `${n} has your food`,
  on_the_way: (n) => `${n} is on the way`,
  arrived: (n) => `${n} is here`,
  delivered: () => 'Delivered',
};

/** §6.1 — Home. Max 4 blocks above the tab bar; bottom filled per P8. */
export default function Home() {
  const me = useStore((s) => s.me);
  const destinationId = useStore((s) => s.destinationId);
  const dropSpot = useStore((s) => s.dropSpot);
  const runs = useStore((s) => s.runs);
  const storedOrder = useStore((s) => s.myOrder);
  /**
   * A delivered order is finished, not active. It stays in the store until the
   * next join archives it, so without this the Home card kept showing
   * "Delivered" under an ACTIVE ORDER heading, with an empty ETA beside it.
   */
  const myOrder = isActiveOrder(storedOrder) ? storedOrder : null;
  const myRun = useStore((s) => s.myRun);
  const pastOrders = useStore((s) => s.pastOrders);
  // The clock itself runs at the root, so progress keeps moving on every tab.
  const now = useNow();

  const dest = destinationById(destinationId);
  const destShort = dest?.name.replace(' Library', '') ?? '';
  const incoming = runs.filter(
    (r) =>
      r.destinationId === destinationId &&
      r.status === 'open' &&
      r.runner.id !== me?.id &&
      new Date(r.leaveAt).getTime() - now < 20 * 60_000,
  );
  const heading = runs.filter(
    (r) => r.destinationId === destinationId && r.runner.id !== me?.id && r.status === 'open',
  );
  const run = myOrder ? runs.find((r) => r.id === myOrder.runId) : null;
  const runnerFirst = run?.runner.firstName ?? 'Your runner';
  const progress =
    myOrder == null
      ? 0
      : { pending: 10, confirmed: 15, picked_up: 45, on_the_way: 75, arrived: 100, delivered: 100 }[
          myOrder.status as string
        ] ?? 0;

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
          {/* Block 1: greeting */}
          <Animated.View entering={enterUp(stagger(0))} style={styles.top}>
            <View>
              <Text style={[type.eyebrow as object, { fontFamily: fonts.semiBold }]}>
                {dayName()}
              </Text>
              <Text style={[type.largeTitle as object, { fontFamily: fonts.bold, marginTop: 4 }]}>
                {greeting()},{'\n'}
                {me?.firstName ?? 'Triton'}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/account')} accessibilityLabel="Account">
              <Avatar initials={me?.initials ?? '?'} size={40} />
            </Pressable>
          </Animated.View>

          <Animated.View entering={enterUp(stagger(1))}>
          <Pressable onPress={() => router.push('/onboarding')} accessibilityLabel="Change location">
            <GlassCard radius={radius.pill} padding={0} style={{ alignSelf: 'flex-start', marginTop: 14 }}>
              <View style={styles.pillInner}>
                <MapPin size={16} color={colors.navy} strokeWidth={1.9} />
                <Text style={styles.pillText}>{dropSpot ?? dest?.name ?? 'Pick a spot'}</Text>
              </View>
            </GlassCard>
          </Pressable>
          </Animated.View>

          {/* Block 2: hero */}
          <Animated.View entering={enterUp(stagger(2))}>
          <GlassCard style={{ marginTop: 16 }}>
            <Text style={[type.cardHeadline as object, { fontFamily: fonts.bold }]}>
              Hungry? Food is{'\n'}already headed your way.
            </Text>
            <Text style={styles.heroSub}>
              {incoming.length} {incoming.length === 1 ? 'run' : 'runs'} to {destShort} in the next
              20 min
            </Text>
            <PrimaryButton
              label="Find a Run"
              icon={<ArrowRight size={18} color={colors.navy} strokeWidth={2.2} />}
              onPress={() => router.push('/find')}
              style={{ marginTop: 20 }}
            />
          </GlassCard>
          </Animated.View>

          <Animated.View entering={enterUp(stagger(3))}>
            <SecondaryButton
              label={myRun ? 'Your active run' : 'Post a run and earn'}
              icon={<Plus size={17} color={colors.navy} strokeWidth={2} />}
              onPress={() => router.push(myRun ? '/active-run' : '/post-run')}
              style={{ marginTop: 12 }}
            />
          </Animated.View>

          {/* Block 3: active order */}
          {myOrder ? (
            <Animated.View entering={enterUp()} layout={LAYOUT}>
              <Text style={styles.sectionLabel}>ACTIVE ORDER</Text>
              <GlassCard
                padding={18}
                onPress={() => router.push('/order')}
                accessibilityLabel="Open your order"
                style={{ marginTop: 10 }}
              >
                <View style={styles.row}>
                  <Avatar initials={run?.runner.initials ?? '?'} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{myOrder.restaurant}</Text>
                    <Text style={styles.rowSub}>
                      {STATUS_LINE[myOrder.status]?.(runnerFirst) ?? ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <AnimatedNumber
                      value={myOrder.status === 'arrived' ? 'Here' : (myOrder.etaMinutes || '–')}
                      style={styles.eta}
                      label={
                        myOrder.status === 'arrived'
                          ? 'Your runner is here'
                          : `Arriving in ${myOrder.etaMinutes ?? 'a few'} minutes`
                      }
                    />
                    {myOrder.status !== 'arrived' ? <Text style={styles.etaUnit}>min</Text> : null}
                  </View>
                </View>
                <View style={styles.track}>
                  <Animated.View
                    style={[styles.trackFill, { width: `${progress}%` }]}
                    layout={LAYOUT}
                  />
                </View>
              </GlassCard>
            </Animated.View>
          ) : null}

          {/* Block 4 (P8): runs heading your way / earn card / order again */}
          {heading.length > 0 && !myOrder ? (
            <>
              <Text style={styles.sectionLabel}>RUNS HEADING YOUR WAY</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 10, marginHorizontal: -layout.screenMargin }}
                contentContainerStyle={{ paddingHorizontal: layout.screenMargin, gap: 12 }}
              >
                {heading.slice(0, 3).map((r, i) => (
                  <Animated.View
                    key={r.id}
                    entering={enterUp(stagger(i + 4))}
                    style={{ width: 300 }}
                  >
                    <RunCard
                      run={r}
                      compact
                      myDestinationId={destinationId}
                      onJoin={() => router.push({ pathname: '/join/[runId]', params: { runId: r.id } })}
                    />
                  </Animated.View>
                ))}
              </ScrollView>
            </>
          ) : null}

          {!myRun ? (
            <GlassCard padding={18} style={{ marginTop: 16 }} onPress={() => router.push('/post-run')}>
              <Text style={styles.rowTitle}>Earn tonight</Text>
              <Text style={[styles.rowSub, { marginTop: 4 }]}>
                You&apos;re near {destShort}. {2 + (heading.length % 3)} people at{' '}
                {hallById('pines')?.name ?? 'Pines'} want food here. Post a run and earn about $
                {(2 * (2 + (heading.length % 3))).toFixed(0)}.
              </Text>
            </GlassCard>
          ) : null}

          {pastOrders.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>ORDER AGAIN</Text>
              {pastOrders.slice(0, 2).map((o) => (
                <GlassCard key={o.id} padding={16} style={{ marginTop: 10 }} onPress={() => router.push('/find')}>
                  <Text style={styles.rowTitle}>{o.restaurant}</Text>
                  <Text style={styles.rowSub}>{hallById(o.hallId)?.name}</Text>
                </GlassCard>
              ))}
            </>
          ) : null}

          <View style={{ height: 130 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: layout.screenMargin, paddingTop: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 6 },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  pillText: { fontSize: 14, color: colors.navy, fontFamily: fonts.medium },
  heroSub: { marginTop: 6, fontSize: 15, color: colors.muted, fontFamily: fonts.regular },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 26,
    marginHorizontal: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  rowTitle: { fontSize: 17, fontFamily: fonts.semiBold, color: colors.ink },
  rowSub: { fontSize: 14, color: colors.muted, fontFamily: fonts.regular, marginTop: 2 },
  eta: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.navy,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  etaUnit: { fontSize: 12, color: colors.muted, fontFamily: fonts.regular },
  track: {
    height: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(18,53,91,0.1)',
    marginTop: 16,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: 5, backgroundColor: colors.orange },
});
