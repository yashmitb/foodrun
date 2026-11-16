import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '@/components/Toast';
import { useBackendSync } from '@/data/backend';
import { usePersistedSession } from '@/data/persist';
import { useAppClock } from '@/lib/useAppClock';

SplashScreen.preventAutoHideAsync();

function AppClock() {
  useAppClock();
  // Keeps the store in step with the database and subscribes to the
  // runner's actions (§6.5). A no-op when there is no backend configured.
  useBackendSync();
  return null;
}

export default function RootLayout() {
  /**
   * At the root, not on the entry route: the saved session has to be in place
   * before *any* screen renders, including a deep link straight to /order.
   */
  const sessionReady = usePersistedSession();
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const ready = loaded && sessionReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
        <AppClock />
        <StatusBar style="dark" />
        {/*
          `animation: 'default'` hands pushes back to UINavigationController.
          This was `slide_from_right` with a fixed 300ms duration, which is a
          re-implementation of the iOS push — and a worse one: the real thing
          is driven by the swipe-back gesture, tracks the finger 1:1, parallaxes
          the outgoing screen at a different rate, dims it, and can be released
          or reversed mid-flight. Nothing authored in JS gets that for free, and
          a screen transition is the largest piece of motion in the app.
        */}
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'default',
            gestureEnabled: true,
            contentStyle: { backgroundColor: '#F4F7FB' },
          }}
        >
          <Stack.Screen
            name="join/[runId]"
            options={{
              presentation: 'transparentModal',
              animation: 'none',
              gestureEnabled: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen
            name="scan"
            options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom' }}
          />
          <Stack.Screen
            name="code"
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
        </Stack>
      </ToastProvider>
    </GestureHandlerRootView>
  );
}
