import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { PrimaryButton } from '@/components/buttons';
import { GlassCard } from '@/components/GlassCard';
import { DESTINATIONS } from '@/data/dining';
import { useStore } from '@/data/store';
import { colors, fonts, layout, type } from '@/theme';

/** §6.0 — one-sentence cards that define a "run", then pick a usual spot. */
const CARDS = [
  'A run is a student already walking from a dining hall to your building.',
  'Join their run, and they carry your Triton2Go order to your table.',
  'Running? Grab orders on your way and earn the delivery fee.',
];

export default function Onboarding() {
  const me = useStore((s) => s.me);
  const complete = useStore((s) => s.completeOnboarding);
  /**
   * The name from sign-in is guessed from the email handle, so it is offered
   * as a suggestion and selected on focus: typing replaces it. Previously it
   * was prefilled as if the user had typed it, and typing a real name
   * appended to the guess ("Demo" + "Demo" = "DemoDemo").
   */
  const nameIsGuess = useStore((s) => s.nameIsGuess);
  const [name, setName] = useState(nameIsGuess ? '' : (me?.name ?? ''));
  const [dest, setDest] = useState('geisel');

  const ready = name.trim().length >= 2;

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
          <Text style={[type.eyebrow as object, { fontFamily: fonts.semiBold }]}>
            How FoodRun works
          </Text>
          <Text style={[type.largeTitle as object, { fontFamily: fonts.bold, marginTop: 4 }]}>
            Three things{'\n'}to know
          </Text>

          {CARDS.map((c, i) => (
            <GlassCard key={i} style={{ marginTop: 14 }} padding={18}>
              <View style={styles.cardRow}>
                <View style={styles.num}>
                  <Text style={styles.numText}>{i + 1}</Text>
                </View>
                <Text style={styles.cardText}>{c}</Text>
              </View>
            </GlassCard>
          ))}

          <GlassCard style={{ marginTop: 24 }}>
            <Text style={styles.label}>YOUR NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={nameIsGuess && me?.name ? me.name : 'First Last'}
              placeholderTextColor="#A6AFBC"
              autoCapitalize="words"
              autoComplete="name"
              style={styles.input}
            />
            <Text style={[styles.label, { marginTop: 18 }]}>YOUR USUAL SPOT</Text>
            <View style={styles.chips}>
              {DESTINATIONS.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => setDest(d.id)}
                  style={[styles.chip, dest === d.id && styles.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: dest === d.id }}
                >
                  <Text style={[styles.chipText, dest === d.id && styles.chipTextOn]}>
                    {d.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton
              label={ready ? "Let's eat" : 'Add your name'}
              disabled={!ready}
              onPress={() => {
                complete(name.trim(), dest);
                router.replace('/home');
              }}
              style={{ marginTop: 20 }}
            />
          </GlassCard>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: layout.screenMargin, paddingTop: 24 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  num: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  cardText: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.ink, fontFamily: fonts.regular },
  label: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.faint, letterSpacing: 0.5 },
  input: {
    marginTop: 8,
    fontSize: 17,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(18,53,91,0.08)',
  },
  chipOn: { backgroundColor: colors.navy },
  chipText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.navy },
  chipTextOn: { color: colors.white },
});
