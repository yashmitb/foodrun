import { router } from 'expo-router';
import { CreditCard, Landmark } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { SecondaryButton } from '@/components/buttons';
import { GlassCard } from '@/components/GlassCard';
import { useToast } from '@/components/Toast';
import { hallById } from '@/data/dining';
import { useStore } from '@/data/store';
import { money } from '@/lib/format';
import { colors, fonts, layout, type } from '@/theme';

/** §6.8 — Money: orderer fees + methods, runner earnings + payout (stubbed). */
export default function Money() {
  const toast = useToast();
  const earningsCents = useStore((s) => s.earningsCents);
  const deliveredCount = useStore((s) => s.deliveredCount);
  const pastOrders = useStore((s) => s.pastOrders);

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
          <Text style={[type.largeTitle as object, { fontFamily: fonts.bold, marginTop: 6 }]}>
            Money
          </Text>

          <GlassCard style={{ marginTop: 16 }}>
            <Text style={styles.label}>RUNNER EARNINGS</Text>
            <Text style={styles.big}>{money(earningsCents)}</Text>
            <Text style={styles.sub}>
              {deliveredCount} {deliveredCount === 1 ? 'delivery' : 'deliveries'} all time ·
              runners keep 100% of the fee
            </Text>
            <SecondaryButton
              label="Pay out to bank / Venmo"
              icon={<Landmark size={16} color={colors.navy} strokeWidth={1.8} />}
              onPress={() =>
                toast.show({ message: 'Payouts connect to Stripe in a later phase. Stubbed for now.' })
              }
              style={{ marginTop: 16 }}
            />
          </GlassCard>

          <GlassCard style={{ marginTop: 14 }} padding={18}>
            <Text style={styles.label}>PAYMENT METHOD</Text>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <CreditCard size={20} color={colors.navy} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Demo card ·· 4242</Text>
                <Text style={styles.sub}>Charged only after drop-off</Text>
              </View>
            </View>
          </GlassCard>

          <Text style={styles.sectionLabel}>FEE HISTORY</Text>
          {pastOrders.length === 0 ? (
            <GlassCard padding={18} style={{ marginTop: 10 }} onPress={() => router.push('/find')}>
              <Text style={styles.sub}>No orders yet. Join a run and your receipts land here.</Text>
            </GlassCard>
          ) : (
            pastOrders.map((o) => (
              <GlassCard key={o.id} padding={16} style={{ marginTop: 10 }}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{o.restaurant}</Text>
                    <Text style={styles.sub}>
                      {hallById(o.hallId)?.name} · {o.rating ? `rated ${o.rating}★` : 'delivered'}
                    </Text>
                  </View>
                  <Text style={styles.fee}>{money(o.feeCents)}</Text>
                </View>
              </GlassCard>
            ))
          )}

          <View style={{ height: 130 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: layout.screenMargin, paddingTop: 12 },
  label: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.faint, letterSpacing: 0.5 },
  big: {
    fontSize: 48,
    fontFamily: fonts.bold,
    color: colors.navy,
    letterSpacing: -2,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  sub: { fontSize: 14, color: colors.muted, fontFamily: fonts.regular, marginTop: 4 },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.faint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 26,
    marginHorizontal: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 8 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(18,53,91,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.ink },
  fee: { fontSize: 18, fontFamily: fonts.bold, color: colors.navy },
});
