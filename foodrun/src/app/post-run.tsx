import { router } from 'expo-router';
import { ChevronLeft, Minus, Plus } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { PrimaryButton } from '@/components/buttons';
import { GlassCard } from '@/components/GlassCard';
import { DESTINATIONS, HALLS, isOpenNow } from '@/data/dining';
import { useStore } from '@/data/store';
import { money } from '@/lib/format';
import { colors, fonts, layout, type } from '@/theme';

const FEE_OPTIONS = [100, 150, 200, 300, 400];
const LEAVE_OPTIONS = [
  { label: 'Now', mins: 5 },
  { label: 'In 15 min', mins: 15 },
  { label: 'In 30 min', mins: 30 },
  { label: 'In 1 hour', mins: 60 },
  { label: 'Tonight 9:30', mins: null as number | null },
];

/** §6.6 — Post a Run. Live "You'll earn about $X" (P7). Scheduled runs (P6). */
export default function PostRun() {
  const destinationId = useStore((s) => s.destinationId);
  const postRun = useStore((s) => s.postRun);
  const myRun = useStore((s) => s.myRun);

  const openHalls = useMemo(() => HALLS.filter((h) => isOpenNow(h)), []);
  const halls = openHalls.length ? openHalls : HALLS;
  const [hallId, setHallId] = useState(halls[0]?.id ?? 'pines');
  const [destId, setDestId] = useState(destinationId);
  const [leaveIdx, setLeaveIdx] = useState(0);
  const [spots, setSpots] = useState(3);
  const [feeCents, setFeeCents] = useState(200);

  if (myRun) {
    router.replace('/active-run');
    return null;
  }

  const leaveAt = () => {
    const opt = LEAVE_OPTIONS[leaveIdx];
    if (opt.mins != null) return new Date(Date.now() + opt.mins * 60_000).toISOString();
    const d = new Date();
    d.setHours(21, 30, 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    return d.toISOString();
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
            <View style={styles.chips}>
              {halls.map((h) => (
                <Pressable
                  key={h.id}
                  onPress={() => setHallId(h.id)}
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
              {LEAVE_OPTIONS.map((o, i) => (
                <Pressable
                  key={o.label}
                  onPress={() => setLeaveIdx(i)}
                  style={[styles.chip, leaveIdx === i && styles.chipOn]}
                >
                  <Text style={[styles.chipText, leaveIdx === i && styles.chipTextOn]}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
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
              label="Post run"
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
});
