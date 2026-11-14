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
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
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
