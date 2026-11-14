import { router, useFocusEffect } from 'expo-router';
import { MapPin, MessageSquare, Star } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { Avatar } from '@/components/Avatar';
import { PrimaryButton } from '@/components/buttons';
import { CodeTiles } from '@/components/CodeTiles';
import { GlassCard } from '@/components/GlassCard';
import { ProgressSteps } from '@/components/ProgressSteps';
import { useToast } from '@/components/Toast';
import { hallById } from '@/data/dining';
import { useStore } from '@/data/store';
import type { ReportReason } from '@/data/types';
import { clockTime, countdown, updatedLabel } from '@/lib/format';
import { colors, fonts, layout, radius, type } from '@/theme';

const STAGE_INDEX: Record<string, number> = {
  pending: 0,
  confirmed: 0,
  picked_up: 1,
  on_the_way: 2,
  arrived: 3,
  delivered: 3,
};

const REPORT_REASONS: ReportReason[] = [
  'Runner is late',
  'Wrong or missing item',
  "Can't find my runner",
  'Other',
];

/** §6.5 — My Order: live tracker, timeline, cancel window, code, report, rating. */
export default function MyOrder() {
  const toast = useToast();
  const order = useStore((s) => s.myOrder);
  const runs = useStore((s) => s.runs);
  const tick = useStore((s) => s.tick);
  const cancelMyOrder = useStore((s) => s.cancelMyOrder);
  const rateRunner = useStore((s) => s.rateRunner);
  const reportProblem = useStore((s) => s.reportProblem);
  const [, force] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [stars, setStars] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const t = setInterval(() => {
        tick();
        force((x) => x + 1);
      }, 1000);
      return () => clearInterval(t);
    }, [tick]),
  );

  if (!order) {
    return (
      <AppBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.empty}>
            <Text style={[type.cardHeadline as object, { fontFamily: fonts.bold }]}>
              No active order
            </Text>
            <Text style={styles.emptySub}>Join a run and your order will show up here.</Text>
            <PrimaryButton
              label="Find a Run"
              onPress={() => router.push('/find')}
              style={{ marginTop: 20, alignSelf: 'center', paddingHorizontal: 40 }}
            />
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  const run = runs.find((r) => r.id === order.runId);
  const runner = run?.runner;
  const hall = hallById(order.hallId);
  const cd = order.status === 'pending' ? countdown(order.cancelUntil) : null;
  const stage = STAGE_INDEX[order.status] ?? 0;
  const delivered = order.status === 'delivered';
  const canFreeCancel = order.status === 'pending';
  const canCancel = ['pending', 'confirmed'].includes(order.status);

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
          <Text style={styles.screenTitle}>My Order</Text>

          {/* Hero */}
          <View style={styles.hero}>
            <Text style={[type.eyebrow as object, { fontFamily: fonts.semiBold }]}>
              {delivered
                ? 'Delivered'
                : order.status === 'arrived'
                  ? 'Your food is'
                  : order.status === 'pending'
                    ? 'Confirming'
                    : 'Arriving in'}
            </Text>
            {order.status === 'arrived' ? (
              <Text style={styles.here}>Here</Text>
            ) : delivered ? (
              <Text style={styles.here}>Enjoy!</Text>
            ) : order.status === 'pending' && cd ? (
              <>
                <Text style={styles.cancelCountdown}>{cd}</Text>
                <Text style={styles.cancelHint}>
                  Cancel free · {runner?.firstName} won&apos;t grab it yet
                </Text>
              </>
            ) : (
              <Text style={styles.heroNum}>
                {order.etaMinutes ?? '–'}
                <Text style={styles.heroUnit}> min</Text>
              </Text>
            )}
            <Text style={styles.heroSub}>
              {order.restaurant} · {hall?.name}
            </Text>
            {!delivered && order.status !== 'pending' && order.etaUpdatedAt ? (
              <Text style={styles.updated}>{updatedLabel(order.etaUpdatedAt)}</Text>
            ) : null}
          </View>

          <View style={{ marginTop: 22 }}>
            <ProgressSteps current={stage} />
          </View>

          {/* Timeline (P2) */}
          {order.events.length > 0 ? (
            <View style={styles.timeline}>
              {order.events.map((e) => (
                <View key={e.id} style={styles.timelineRow}>
                  <Text style={styles.timelineTime}>{clockTime(e.at)}</Text>
                  <Text style={styles.timelineLabel}>{e.label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Runner + drop spot */}
          <GlassCard padding={16} style={{ marginTop: 16 }}>
            <View style={styles.row}>
              <Avatar initials={runner?.initials ?? '?'} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{runner?.name}</Text>
                <Text style={styles.rowSub}>
                  Your runner · ★ {runner?.ratingAvg.toFixed(1)}
                </Text>
              </View>
              <Pressable
                onPress={() => toast.show({ message: 'Chat lands with notifications (Phase 5).' })}
                style={styles.iconBtn}
                accessibilityLabel="Message runner"
              >
                <MessageSquare size={20} color={colors.navy} strokeWidth={1.8} />
              </Pressable>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={[styles.iconBtn, { backgroundColor: 'rgba(242,140,40,0.15)' }]}>
                <MapPin size={20} color={colors.orange} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{order.dropSpotText}</Text>
                <Text style={styles.rowSub}>Drop spot</Text>
              </View>
            </View>
          </GlassCard>

          {/* Handoff code / rating */}
          {delivered ? (
            <GlassCard style={{ marginTop: 16 }}>
              <Text style={[styles.codeLabel, { marginBottom: 12 }]}>
                RATE {runner?.firstName?.toUpperCase()}
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setStars(n)} accessibilityLabel={`${n} stars`}>
                    <Star
                      size={34}
                      color={colors.orange}
                      fill={n <= stars ? colors.orange : 'transparent'}
                      strokeWidth={1.6}
                    />
                  </Pressable>
                ))}
              </View>
              <Text style={styles.containerNote}>
                Container reminder: Triton2Go reusable containers carry a $5 deposit. Return yours
                at any return machine with your own ID to get it back.
              </Text>
              <PrimaryButton
                label={stars > 0 ? `Submit ${stars}★` : 'Tap a star'}
                disabled={stars === 0}
                onPress={() => {
                  rateRunner(stars);
                  toast.show({ message: `Thanks! ${runner?.firstName} got your rating.` });
                }}
                style={{ marginTop: 16 }}
              />
            </GlassCard>
          ) : (
            <GlassCard
              style={{ marginTop: 16 }}
              onPress={() => router.push('/code')}
              accessibilityLabel="Show handoff code full screen"
            >
              <Text style={styles.codeLabel}>SHOW {runner?.firstName?.toUpperCase()} THIS CODE</Text>
              <View style={{ marginTop: 14 }}>
                <CodeTiles code={order.handoffCode} />
              </View>
              <Text style={styles.codeHint}>Tap to make it bigger</Text>
            </GlassCard>
          )}

          {/* Cancel (§6.4) + report */}
          {canCancel && !delivered ? (
            <Pressable
              onPress={() => {
                if (canFreeCancel) {
                  cancelMyOrder();
                  toast.show({ message: 'Order removed. No charge.' });
                } else {
                  setConfirmCancel(true);
                }
              }}
              style={styles.linkBtn}
            >
              <Text style={[styles.link, { color: colors.danger }]}>
                {canFreeCancel ? `Cancel free · ${cd ?? '0:00'}` : 'Cancel order'}
              </Text>
            </Pressable>
          ) : null}
          {!delivered ? (
            <Pressable onPress={() => setReporting(true)} style={styles.linkBtn}>
              <Text style={styles.link}>Report a problem</Text>
            </Pressable>
          ) : null}

          <View style={{ height: 130 }} />
        </ScrollView>

        {/* Report action sheet */}
        {reporting ? (
          <View style={StyleSheet.absoluteFill}>
            <Pressable style={styles.scrim} onPress={() => setReporting(false)} />
            <View style={styles.actions}>
              <View style={styles.actionGroup}>
                <Text style={styles.actionHeader}>What went wrong?</Text>
                {REPORT_REASONS.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => {
                      setReporting(false);
                      reportProblem(r);
                      toast.show({ message: `Reported: ${r}. We'll text you within 5 min.` });
                    }}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionText}>{r}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.actionGroup}>
                <Pressable onPress={() => setReporting(false)} style={styles.actionBtn}>
                  <Text style={[styles.actionText, { fontFamily: fonts.semiBold }]}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* Confirm-cancel dialog (§6.4: after window, cancel warns + notifies runner) */}
        {confirmCancel ? (
          <View style={StyleSheet.absoluteFill}>
            <Pressable style={styles.scrim} onPress={() => setConfirmCancel(false)} />
            <View style={styles.actions}>
              <View style={styles.actionGroup}>
                <Text style={styles.actionHeader}>
                  {runner?.firstName} already planned around your order. Cancel anyway?
                </Text>
                <Pressable
                  onPress={() => {
                    setConfirmCancel(false);
                    cancelMyOrder();
                    toast.show({ message: `Cancelled. ${runner?.firstName} was notified.` });
                  }}
                  style={styles.actionBtn}
                >
                  <Text style={[styles.actionText, { color: colors.danger }]}>Cancel order</Text>
                </Pressable>
              </View>
              <View style={styles.actionGroup}>
                <Pressable onPress={() => setConfirmCancel(false)} style={styles.actionBtn}>
                  <Text style={[styles.actionText, { fontFamily: fonts.semiBold }]}>Keep it</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: layout.screenMargin, paddingTop: 12 },
  screenTitle: {
    textAlign: 'center',
    fontSize: 17,
    fontFamily: fonts.semiBold,
    color: colors.navy,
    marginTop: 6,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptySub: {
    marginTop: 8,
    fontSize: 15,
    color: colors.muted,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  hero: { alignItems: 'center', marginTop: 22 },
  heroNum: {
    fontSize: 96,
    fontFamily: fonts.bold,
    color: colors.navy,
    letterSpacing: -5,
    lineHeight: 100,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: { fontSize: 24, letterSpacing: -0.5, color: colors.muted, fontFamily: fonts.medium },
  here: { fontSize: 64, fontFamily: fonts.bold, color: colors.orange, letterSpacing: -2 },
  cancelCountdown: {
    fontSize: 72,
    fontFamily: fonts.bold,
    color: colors.navy,
    letterSpacing: -3,
    fontVariant: ['tabular-nums'],
  },
  cancelHint: { fontSize: 13, color: colors.muted, fontFamily: fonts.regular, marginTop: 2 },
  heroSub: { marginTop: 6, fontSize: 15, color: colors.muted, fontFamily: fonts.regular },
  updated: { marginTop: 4, fontSize: 12, color: colors.faint, fontFamily: fonts.regular },
  timeline: { marginTop: 14, paddingHorizontal: 4 },
  timelineRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  timelineTime: {
    fontSize: 13,
    color: colors.faint,
    fontFamily: fonts.medium,
    width: 44,
    fontVariant: ['tabular-nums'],
  },
  timelineLabel: { fontSize: 13, color: colors.muted, fontFamily: fonts.regular, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  rowTitle: { fontSize: 17, fontFamily: fonts.semiBold, color: colors.ink },
  rowSub: { fontSize: 14, color: colors.muted, fontFamily: fonts.regular, marginTop: 2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(18,53,91,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
  codeLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.faint,
    letterSpacing: 0.6,
  },
  codeHint: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
    color: colors.faint,
    fontFamily: fonts.regular,
  },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  containerNote: {
    marginTop: 14,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  linkBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 6 },
  link: { fontSize: 15, color: colors.muted, fontFamily: fonts.medium },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18,30,45,0.28)',
  },
  actions: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 16,
    gap: 8,
  },
  actionGroup: {
    borderRadius: radius.field,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  actionHeader: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.faint,
    fontFamily: fonts.regular,
    padding: 12,
  },
  actionBtn: {
    padding: 15,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  actionText: { fontSize: 17, color: colors.navy, fontFamily: fonts.regular },
});
