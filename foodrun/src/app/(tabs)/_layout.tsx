import { Redirect, Tabs, router } from 'expo-router';
import React from 'react';

import { TabBar, TabKey } from '@/components/TabBar';
import { useStore } from '@/data/store';

const ROUTE_TO_KEY: Record<string, TabKey> = {
  home: 'home',
  find: 'find',
  order: 'order',
  money: 'money',
  account: 'account',
};

export default function TabsLayout() {
  const signedIn = useStore((s) => s.signedIn);
  if (!signedIn) return <Redirect href="/auth" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
        /*
          Tab switching was a hard cut: bottom tabs default to
          `animation: 'none'`. 'shift' slides the incoming scene a short
          distance in the direction of travel, which is what tells you the
          tabs are laid out side by side rather than stacked. On a spring, so
          it can be interrupted by another tab press mid-transition.
        */
        animation: 'shift',
        transitionSpec: {
          animation: 'spring',
          config: { mass: 1, stiffness: 157.9, damping: 22.1 },
        },
        /* Don't let a backgrounded tab keep its clock and animations running. */
        freezeOnBlur: true,
      }}
      tabBar={({ state }) => {
        const active = ROUTE_TO_KEY[state.routes[state.index]?.name] ?? 'home';
        return <TabBar active={active} onChange={(key) => router.navigate(`/${key}`)} />;
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="find" />
      <Tabs.Screen name="order" options={{ title: 'My Order' }} />
      <Tabs.Screen name="money" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
