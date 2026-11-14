import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  CircleDollarSign,
  CircleUserRound,
  House,
  ReceiptText,
  Search,
} from 'lucide-react-native';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, glass, layout } from '@/theme';

export type TabKey = 'home' | 'find' | 'order' | 'money' | 'account';

/** §4 — tab label is "My Order" everywhere (prototype mismatch fixed). */
const TABS: { key: TabKey; label: string; Icon: typeof House }[] = [
  { key: 'home', label: 'Home', Icon: House },
  { key: 'find', label: 'Find', Icon: Search },
  { key: 'order', label: 'My Order', Icon: ReceiptText },
  { key: 'money', label: 'Money', Icon: CircleDollarSign },
  { key: 'account', label: 'Account', Icon: CircleUserRound },
];

type Props = {
  active: TabKey;
  onChange: (key: TabKey) => void;
};

/**
 * §3.5 — Floating glass pill, 14px from sides, 18px from bottom (+ safe area).
 * Active tab = navy icon + label on navy-8% capsule. Inactive = faint.
 */
export function TabBar({ active, onChange }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.wrap, { bottom: layout.tabBarBottom + insets.bottom }, glass.shadow]}
      accessibilityRole="tablist"
    >
      <BlurView intensity={glass.blurIntensity} tint="light" style={styles.blur}>
        <View style={styles.inner}>
          {TABS.map(({ key, label, Icon }) => {
            const on = key === active;
            const color = on ? colors.navy : colors.faint;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={label}
                onPress={() => {
                  if (Platform.OS !== 'web')
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onChange(key);
                }}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Icon size={22} color={color} strokeWidth={1.9} />
                <Text style={[styles.label, { color }, on && styles.labelOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: layout.tabBarSide,
    right: layout.tabBarSide,
    borderRadius: 32,
    zIndex: 5,
  },
  blur: {
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: glass.fill,
  },
  inner: {
    borderRadius: 32,
    borderWidth: 1,
    borderColor: glass.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tab: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  tabOn: {
    backgroundColor: 'rgba(18,53,91,0.08)',
  },
  label: {
    fontSize: 11,
    fontFamily: fonts.regular,
  },
  labelOn: {
    fontFamily: fonts.semiBold,
  },
});
