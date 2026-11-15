import { router } from 'expo-router';
import { ChevronLeft, Minus, Plus } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { PrimaryButton } from '@/components/buttons';
import { GlassCard } from '@/components/GlassCard';
import { DESTINATIONS, HALLS, isOpenNow } from '@/data/dining';
import { useStore } from '@/data/store';
import { dayClockTime, money } from '@/lib/format';
import { colors, fonts, layout, type } from '@/theme';

const FEE_OPTIONS = [100, 150, 200, 300, 400];
const LEAVE_OPTIONS = [
  { label: 'Now', mins: 5 },
  { label: 'In 15 min', mins: 15 },
  { label: 'In 30 min', mins: 30 },
  { label: 'In 1 hour', mins: 60 },
  { label: null, mins: null as number | null },
];

/** 21:30 today, or tomorrow if that has already passed. */
function nextEvening(): Date {
  const d = new Date();
  d.setHours(21, 30, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

/** §6.6 — Post a Run. Live "You'll earn about $X" (P7). Scheduled runs (P6). */
export default function PostRun() {
  const destinationId = useStore((s) => s.destinationId);
  const postRun = useStore((s) => s.postRun);
  const myRun = useStore((s) => s.myRun);

  /**
   * §8: a closed hall cannot be the start of a run. This used to fall back to
   * every hall when nothing was open, which quietly let you post a run from a
   * hall that was shut — the one case the rule exists for.
   */
  const halls = useMemo(() => HALLS.filter((h) => isOpenNow(h)), []);
  const [hallId, setHallId] = useState(halls[0]?.id ?? '');
  const [destId, setDestId] = useState(destinationId);
  const [leaveIdx, setLeaveIdx] = useState(0);
  const [spots, setSpots] = useState(3);
  const [feeCents, setFeeCents] = useState(200);

  /**
   * Redirecting has to happen after the commit. Calling router.replace() in the
   * render body updates the navigation store while this component is rendering,
   * which React flags as "Cannot update a component while rendering a different
   * component" and which React Compiler is free to run more than once.
   */
  useEffect(() => {
    if (myRun) router.replace('/active-run');
  }, [myRun]);

  if (myRun) return null;

  const leaveAt = () => {
    const opt = LEAVE_OPTIONS[leaveIdx];
    if (opt.mins != null) return new Date(Date.now() + opt.mins * 60_000).toISOString();
    return nextEvening().toISOString();
  };

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
              <ChevronLeft size={20} color={colors.navy} strokeWidth={2} />
            </Pressable>
            <Text style={[type.largeTitle as object, { fontFamily: fonts.bold }]}>Post a Run</Text>
          </View>

          <GlassCard style={{ marginTop: 16 }}>
            <Text style={styles.label}>LEAVING FROM</Text>
            {halls.length === 0 ? (
              <Text style={styles.closedNote}>
                No dining halls are open right now. You can post a run once one opens.
              </Text>
            ) : null}
            <View style={styles.chips}>
              {halls.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => setHallId(h.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: hallId === h.id }}
                  style={[styles.chip, hallId === h.id && styles.chipOn]}
                >
                  <Text style={[styles.chipText, hallId === h.id && styles.chipTextOn]}>
                    {h.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>HEADING TO</Text>
            <View style={styles.chips}>
              {DESTINATIONS.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => setDestId(d.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: destId === d.id }}
                  style={[styles.chip, destId === d.id && styles.chipOn]}
                >
                  <Text style={[styles.chipText, destId === d.id && styles.chipTextOn]}>
                    {d.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>LEAVING AT</Text>
            <View style={styles.chips}>
              {LEAVE_OPTIONS.map((o, i) => {
                // The last option rolls to tomorrow once 21:30 has passed, so
                // the label has to roll with it rather than always say Tonight.
                const label = o.label ?? dayClockTime(nextEvening().toISOString());
                return (
                  <Pressable
                    key={label}
                    onPress={() => setLeaveIdx(i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: leaveIdx === i }}
                    style={[styles.chip, leaveIdx === i && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, leaveIdx === i && styles.chipTextOn]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>SPOTS</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setSpots((s) => Math.max(1, s - 1))}
                style={styles.stepBtn}
                accessibilityLabel="Fewer spots"
              >
                <Minus size={18} color={colors.navy} strokeWidth={2.2} />
              </Pressable>
              <Text style={styles.stepVal}>{spots}</Text>
              <Pressable
                onPress={() => setSpots((s) => Math.min(5, s + 1))}
                style={styles.stepBtn}
                accessibilityLabel="More spots"
              >
                <Plus size={18} color={colors.navy} strokeWidth={2.2} />
              </Pressable>
            </View>

            <Text style={[styles.label, { marginTop: 20 }]}>FEE PER ORDER</Text>
            <View style={styles.chips}>
              {FEE_OPTIONS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFeeCents(f)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: feeCents === f }}
                  style={[styles.chip, feeCents === f && styles.chipOn]}
                >
                  <Text style={[styles.chipText, feeCents === f && styles.chipTextOn]}>
                    {money(f)}
                    {f === 200 ? ' · suggested' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* P7 — pay is explicit */}
            <View style={styles.earnRow}>
              <Text style={styles.earnLabel}>You&apos;ll earn about</Text>
              <Text style={styles.earnVal}>{money(feeCents * spots)}</Text>
            </View>
            <Text style={styles.earnHint}>
              {money(feeCents)} × {spots} spots if they all fill. Runners keep 100% of the fee.
            </Text>

            <PrimaryButton
              label={hallId ? 'Post run' : 'No dining hall is open'}
              disabled={!hallId}
              onPress={() => {
                postRun({ hallId, destinationId: destId, leaveAt: leaveAt(), spots, feeCents });
                router.replace('/active-run');
              }}
              style={{ marginTop: 20 }}
            />
          </GlassCard>
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
  label: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.faint, letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(18,53,91,0.08)',
  },
  chipOn: { backgroundColor: colors.navy },
  chipText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.navy },
  chipTextOn: { color: colors.white },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,53,91,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepVal: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.navy,
    minWidth: 30,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  earnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 22,
  },
  earnLabel: { fontSize: 15, color: colors.muted, fontFamily: fonts.regular },
  earnVal: { fontSize: 28, color: colors.navy, fontFamily: fonts.bold, letterSpacing: -1 },
  earnHint: { marginTop: 4, fontSize: 12, color: colors.faint, fontFamily: fonts.regular },
  closedNote: { marginTop: 8, fontSize: 13, color: colors.muted, fontFamily: fonts.regular },
});
