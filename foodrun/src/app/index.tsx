import { Redirect } from 'expo-router';
import React from 'react';

import { useStore } from '@/data/store';

export default function Index() {
  const signedIn = useStore((s) => s.signedIn);
  const onboarded = useStore((s) => s.onboarded);
  if (!signedIn) return <Redirect href="/auth" />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
