import { router } from 'expo-router';
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Flag,
  HelpCircle,
  LogOut,
  Shield,
  SlidersHorizontal,
} from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { Avatar } from '@/components/Avatar';
import { GlassCard } from '@/components/GlassCard';
import { useToast } from '@/components/Toast';
import * as auth from '@/data/auth';
import { useStore } from '@/data/store';
import { colors, fonts, layout, type } from '@/theme';

/** §6.9 — Account: UCSD-verified profile, help, safety, sign out. */
export default function Account() {
  const toast = useToast();
  const me = useStore((s) => s.me);
  const signOut = useStore((s) => s.signOut);

  const rows = [
    {
      icon: HelpCircle,
      label: 'How it works',
      note: 'Fees, handoff code, refunds, containers',
      onPress: () =>
        toast.show({
          message:
            'Runners carry your Triton2Go bag for a small fee, charged after drop-off. Containers: $5 deposit, return with your own ID.',
        }),
    },
    {
      icon: Bell,
      label: 'Notifications',
      note: 'Push lands in Phase 5',
      onPress: () => toast.show({ message: 'Notification settings land with push (Phase 5).' }),
    },
    {
      icon: Shield,
      label: 'Safety & rules',
      note: 'Meet in public spots, codes confirm handoffs',
      onPress: () =>
        toast.show({
          message: 'Handoff codes confirm the right person. Meet at public drop spots.',
        }),
    },
    {
      icon: Flag,
      label: 'Report a problem',
      note: '',
      onPress: () => router.push('/order'),
    },
    {
      icon: SlidersHorizontal,
      label: 'Component gallery (dev)',
      note: 'Phase 1 design system',
      onPress: () => router.push('/dev/components'),
    },
  ];

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.wrap}
          showsVerticalScrollIndicator={false}
          /* Don't rubber-band a screen whose content already fits. */
          alwaysBounceVertical={false}
        >
          <Text style={[type.largeTitle as object, { fontFamily: fonts.bold, marginTop: 6 }]}>
            Account
          </Text>

          <GlassCard style={{ marginTop: 16 }} padding={18}>
            <View style={styles.row}>
              <Avatar initials={me?.initials ?? '?'} size={52} />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{me?.name}</Text>
                  <BadgeCheck size={18} color={colors.success} strokeWidth={2} />
                </View>
                <Text style={styles.sub}>{me?.ucsdEmail} · UCSD verified</Text>
                <Text style={styles.sub}>
                  ★ {me?.ratingAvg.toFixed(1)} · {me?.ratingCount} ratings
                </Text>
              </View>
            </View>
          </GlassCard>

          <GlassCard style={{ marginTop: 14 }} padding={6}>
            {rows.map(({ icon: Icon, label, note, onPress }, i) => (
              <Pressable
                key={label}
                onPress={onPress}
                style={[styles.menuRow, i > 0 && styles.menuRowBorder]}
                accessibilityRole="button"
              >
                <View style={styles.menuIcon}>
                  <Icon size={18} color={colors.navy} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuLabel}>{label}</Text>
                  {note ? <Text style={styles.menuNote}>{note}</Text> : null}
                </View>
                <ChevronRight size={16} color={colors.faint} strokeWidth={2} />
              </Pressable>
            ))}
          </GlassCard>

          <Pressable
            onPress={() => {
              // End the Supabase session too, where there is one. The local
              // store clearing is what wipes the saved session on disk.
              void auth.signOut();
              signOut();
              router.replace('/auth');
            }}
            style={styles.signOut}
            accessibilityRole="button"
          >
            <LogOut size={16} color={colors.danger} strokeWidth={1.8} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>

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
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 19, fontFamily: fonts.bold, color: colors.ink },
  sub: { fontSize: 13, color: colors.muted, fontFamily: fonts.regular, marginTop: 2 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  menuRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(18,53,91,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.ink },
  menuNote: { fontSize: 12, color: colors.faint, fontFamily: fonts.regular, marginTop: 1 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 10,
  },
  signOutText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.danger },
});
