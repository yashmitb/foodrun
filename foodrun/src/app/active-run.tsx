import { router } from 'expo-router';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { Avatar } from '@/components/Avatar';
import { PrimaryButton, SecondaryButton } from '@/components/buttons';
import { GlassCard } from '@/components/GlassCard';
import { useToast } from '@/components/Toast';
import { destinationById, hallById } from '@/data/dining';
import * as backend from '@/data/backend';
import { useStore } from '@/data/store';
import { clockTime, countdown, money } from '@/lib/format';
import { LAYOUT, enterUp, haptic, stagger } from '@/lib/motion';
import { useNow } from '@/lib/useAppClock';
import { colors, fonts, layout, type } from '@/theme';

/**
 * §6.7 — Active Run (runner). Orders show first name, restaurant, LAST 4 in
 * big type, drop spot. Pending orders gray with the cancel countdown. Per-order
 * Mark picked up → Start delivering → enter handoff code to deliver.
 */
export default function ActiveRun() {
  const toast = useToast();
  const run = useStore((s) => s.myRun);
  const orders = useStore((s) => s.myRunOrders);
  const endMyRun = useStore((s) => s.endMyRun);
  const earningsCents = useStore((s) => s.earningsCents);

  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const now = useNow();

  if (!run) {
    return (
      <AppBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.empty}>
            <Text style={[type.cardHeadline as object, { fontFamily: fonts.bold }]}>
              No active run
            </Text>
            <PrimaryButton
              label="Post a run"
              onPress={() => router.replace('/post-run')}
              style={{ marginTop: 20 }}
              contentStyle={{ paddingHorizontal: 40 }}
            />
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  const hall = hallById(run.hallId);
  const dest = destinationById(run.destinationId);
  const pickedCount = orders.filter((o) =>
    ['picked_up', 'on_the_way', 'delivered'].includes(o.status),
  ).length;
  const deliveredAll = orders.length > 0 && orders.every((o) => o.status === 'delivered');
  const anyPicked = orders.some((o) => o.status === 'picked_up');

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
              <ChevronLeft size={20} color={colors.navy} strokeWidth={2} />
            </Pressable>
            <View>
              <Text style={[type.eyebrow as object, { fontFamily: fonts.semiBold }]}>
                YOUR RUN · LEAVES {clockTime(run.leaveAt)}
              </Text>
              <Text style={[type.cardHeadline as object, { fontFamily: fonts.bold }]}>
                {hall?.name} → {dest?.name.replace(' Library', '')}
              </Text>
            </View>
          </View>

          {orders.map((o, idx) => {
            const pending = o.status === 'pending';
            const cd = pending ? countdown(o.cancelUntil, now) : null;
            return (
              <Animated.View
                key={o.id}
                entering={enterUp(stagger(idx))}
                layout={LAYOUT}
                style={{ marginTop: 12 }}
              >
              {/* Reanimated owns opacity on a view that carries entering/layout,
                  so the dimming lives on an inner view instead. */}
              <View style={{ opacity: pending ? 0.6 : 1 }}>
              <GlassCard padding={16}>
                <View style={styles.row}>
                  <Avatar initials={o.ordererName.slice(0, 2).toUpperCase()} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                      {o.ordererName} · {o.restaurant}
                    </Text>
                    <View style={styles.spotRow}>
                      <MapPin size={13} color={colors.muted} strokeWidth={1.8} />
                      <Text style={styles.rowSub}>{o.dropSpotText}</Text>
                    </View>
                  </View>
                  <Text style={styles.last4}>#{o.t2gLast4}</Text>
                </View>

                {pending ? (
                  <Text style={styles.pendingNote}>
                    Pending · don&apos;t grab yet · confirms in {cd ?? '0:00'}
                  </Text>
                ) : o.status === 'confirmed' ? (
                  <View style={styles.actionRow}>
                    <PrimaryButton
                      label="Mark picked up"
                      onPress={() => {
                        haptic('success');
                        void backend.runnerMarkPickedUp(o.id);
                      }}
                      style={styles.smallBtn}
                      contentStyle={styles.smallBtnInner}
                    />
                    <SecondaryButton
                      label="Not ready yet"
                      onPress={() => {
                        void backend.runnerMarkNotReady(o.id);
                        toast.show({ message: `${o.ordererName} can see it's not ready.` });
                      }}
                      style={styles.smallBtn}
                      contentStyle={styles.smallBtnInner}
                    />
                  </View>
                ) : o.status === 'picked_up' ? (
                  <Text style={styles.statusNote}>In your bag ✓</Text>
                ) : o.status === 'on_the_way' ? (
                  codeFor === o.id ? (
                    <View style={styles.codeRow}>
                      <TextInput
                        value={codeInput}
                        onChangeText={(t) => setCodeInput(t.replace(/\D/g, '').slice(0, 4))}
                        placeholder="4-digit code"
                        placeholderTextColor="#A6AFBC"
                        keyboardType="number-pad"
                        style={styles.codeInput}
                        autoFocus
                      />
                      <PrimaryButton
                        label="Deliver"
                        disabled={codeInput.length !== 4}
                        onPress={async () => {
                          const code = codeInput;
                          setCodeInput('');
                          setCodeFor(null);
                          const ok = await backend.runnerDeliver(o.id, code);
                          haptic(ok ? 'success' : 'error');
                          toast.show({
                            message: ok
                              ? `Delivered. ${money(o.feeCents)} earned.`
                              : "Code didn't match. Ask them to show it again.",
                          });
                        }}
                        style={styles.smallBtn}
                      contentStyle={styles.smallBtnInner}
                      />
                    </View>
                  ) : (
                    <View style={styles.actionRow}>
                      <PrimaryButton
                        label={`Enter ${o.ordererName}'s code`}
                        onPress={() => setCodeFor(o.id)}
                        style={styles.smallBtn}
                      contentStyle={styles.smallBtnInner}
                      />
                      <SecondaryButton
                        label="Can't find them"
                        onPress={() =>
                          toast.show({
                            message: 'Message them, or leave at the front desk with a photo.',
                          })
                        }
                        style={styles.smallBtn}
                      contentStyle={styles.smallBtnInner}
                      />
                    </View>
                  )
                ) : (
                  <Text style={[styles.statusNote, { color: colors.success }]}>
                    Delivered ✓ {money(o.feeCents)}
                  </Text>
                )}
              </GlassCard>
              </View>
              </Animated.View>
            );
          })}

          {orders.length === 0 ? (
            <Text style={styles.waiting}>Waiting for orderers to join…</Text>
          ) : null}

          {pickedCount > 0 && anyPicked && !deliveredAll ? (
            <PrimaryButton
              label={`Start delivering · ${pickedCount} ${pickedCount === 1 ? 'bag' : 'bags'}`}
              onPress={() => {
                haptic('success');
                void backend.runnerStartDelivering();
                toast.show({ message: 'Orderers can see you on the way.' });
              }}
              style={{ marginTop: 16 }}
            />
          ) : null}

          {deliveredAll ? (
            <Animated.View entering={FadeIn.duration(400)}>
            <GlassCard style={{ marginTop: 16 }}>
              <Text style={[type.cardHeadline as object, { fontFamily: fonts.bold }]}>
                Run done. {money(earningsCents)} earned 🎉
              </Text>
              <PrimaryButton
                label="Finish run"
                onPress={() => {
                  endMyRun();
                  router.replace('/money');
                }}
                style={{ marginTop: 16 }}
              />
            </GlassCard>
            </Animated.View>
          ) : null}

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: layout.screenMargin, paddingTop: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,53,91,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontSize: 16, fontFamily: fonts.semiBold, color: colors.ink },
  rowSub: { fontSize: 13, color: colors.muted, fontFamily: fonts.regular },
  spotRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  last4: {
    fontSize: 26,
    fontFamily: fonts.bold,
    color: colors.navy,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  pendingNote: { marginTop: 12, fontSize: 13, color: colors.faint, fontFamily: fonts.medium },
  statusNote: { marginTop: 12, fontSize: 14, color: colors.navy, fontFamily: fonts.semiBold },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  smallBtn: { flexGrow: 1, flexBasis: 0 },
  smallBtnInner: { paddingVertical: 11, paddingHorizontal: 14 },
  codeRow: { flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'center' },
  codeInput: {
    flex: 1,
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.navy,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  waiting: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 15,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
});
