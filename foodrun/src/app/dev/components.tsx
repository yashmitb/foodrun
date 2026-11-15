import { ArrowRight, ChevronLeft, MapPin, Plus } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { Avatar } from '@/components/Avatar';
import { PrimaryButton, SecondaryButton } from '@/components/buttons';
import { CodeTiles } from '@/components/CodeTiles';
import { GlassCard } from '@/components/GlassCard';
import { ProgressSteps } from '@/components/ProgressSteps';
import { TabBar, TabKey } from '@/components/TabBar';
import { useToast } from '@/components/Toast';
import { colors, fonts, layout, radius, type } from '@/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      <Text style={[type.eyebrow as object, { fontFamily: fonts.semiBold, marginBottom: 10 }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** §10.1 — every base component in one place, compared against reference/screens/. */
export default function ComponentsGallery() {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('home');
  const [stage, setStage] = useState(1);

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}>
              <ChevronLeft size={20} color={colors.navy} strokeWidth={2} />
            </Pressable>
            <Text style={[type.largeTitle as object, { fontFamily: fonts.bold }]}>Components</Text>
          </View>

          <Section title="Type scale">
            <GlassCard>
              <Text style={[type.eyebrow as object, { fontFamily: fonts.semiBold }]}>Eyebrow</Text>
              <Text style={[type.largeTitle as object, { fontFamily: fonts.bold }]}>
                Large title
              </Text>
              <Text style={[type.cardHeadline as object, { fontFamily: fonts.bold }]}>
                Card headline
              </Text>
              <Text style={[type.rowTitle as object, { fontFamily: fonts.semiBold }]}>
                Row title 17/600
              </Text>
              <Text style={[type.body as object, { fontFamily: fonts.regular }]}>Body 15</Text>
              <Text style={[type.secondary as object, { fontFamily: fonts.regular }]}>
                Secondary 14 muted
              </Text>
            </GlassCard>
          </Section>

          <Section title="Buttons">
            <PrimaryButton
              label="Find a Run"
              icon={<ArrowRight size={18} color={colors.navy} strokeWidth={2.2} />}
              onPress={() => toast.show({ message: 'Primary tapped.' })}
            />
            <PrimaryButton label="Add your order #" disabled style={{ marginTop: 12 }} />
            <SecondaryButton
              label="Post a run and earn"
              icon={<Plus size={17} color={colors.navy} strokeWidth={2} />}
              onPress={() =>
                toast.show({
                  message: "You joined Marcus's run.",
                  action: { label: 'Undo', onPress: () => {} },
                })
              }
              style={{ marginTop: 12 }}
            />
          </Section>

          <Section title="Avatar">
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Avatar initials="MJ" />
              <Avatar initials="AL" />
              <Avatar initials="P" size={40} />
            </View>
          </Section>

          <Section title="Progress steps (tap to advance)">
            <GlassCard radius={radius.runCard} padding={18} onPress={() => setStage((stage + 1) % 4)}>
              <ProgressSteps current={stage} />
            </GlassCard>
          </Section>

          <Section title="Handoff code">
            <GlassCard>
              <Text
                style={[
                  type.eyebrow as object,
                  { fontFamily: fonts.semiBold, textAlign: 'center', marginBottom: 14 },
                ]}
              >
                Show Marcus this code
              </Text>
              <CodeTiles code="4821" />
            </GlassCard>
            <View style={{ marginTop: 14 }}>
              <CodeTiles code="4821" size="big" />
            </View>
          </Section>

          <Section title="Run card (composite)">
            <GlassCard radius={radius.runCard} padding={18}>
              <View style={styles.runRow}>
                <Avatar initials="MJ" />
                <View style={{ flex: 1 }}>
                  <Text style={[type.rowTitle as object, { fontFamily: fonts.semiBold }]}>
                    Marcus J. <Text style={styles.star}>★ 4.8</Text>
                  </Text>
                  <View style={styles.routeRow}>
                    <View style={[styles.dot, { backgroundColor: colors.orange }]} />
                    <Text style={styles.routeHall}>Pines</Text>
                    <View style={styles.routeLine} />
                    <View style={[styles.dot, { backgroundColor: colors.navy }]} />
                    <Text style={styles.routeHall}>Geisel</Text>
                  </View>
                </View>
                <Text style={styles.price}>$2</Text>
              </View>
              <View style={[styles.runRow, { marginTop: 12 }]}>
                <Text style={[type.secondary as object, { fontFamily: fonts.regular, flex: 1 }]}>
                  9:30 · 3 spots left
                </Text>
                <PrimaryButton
                  label="Join"
                  onPress={() => toast.show({ message: 'Join tapped.' })}
                  contentStyle={styles.joinPill}
                />
              </View>
            </GlassCard>
          </Section>

          <Section title="Location pill">
            <GlassCard radius={radius.pill} padding={0} style={{ alignSelf: 'flex-start' }}>
              <View style={styles.pillInner}>
                <MapPin size={16} color={colors.navy} strokeWidth={1.9} />
                <Text style={[type.secondary as object, { color: colors.navy, fontFamily: fonts.medium }]}>
                  Geisel 2F · Table 14
                </Text>
              </View>
            </GlassCard>
          </Section>

          <View style={{ height: 140 }} />
        </ScrollView>
        <TabBar active={tab} onChange={setTab} />
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: layout.screenMargin, paddingTop: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(18,53,91,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  star: { color: colors.orange, fontSize: 13, fontFamily: fonts.semiBold },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeHall: { fontSize: 14, color: colors.navy, fontFamily: fonts.semiBold },
  routeLine: { flex: 0, width: 36, height: 1.5, backgroundColor: 'rgba(18,53,91,0.25)' },
  price: { fontSize: 20, color: colors.navy, fontFamily: fonts.bold, letterSpacing: -0.5 },
  joinPill: { paddingVertical: 9, paddingHorizontal: 20 },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
});
