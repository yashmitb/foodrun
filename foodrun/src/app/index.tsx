import { Redirect } from 'expo-router';
import React from 'react';

import { useStore } from '@/data/store';

export default function Index() {
  // The root layout holds the splash screen until the saved session has been
  // read, so by the time this renders these two flags are trustworthy.
  const signedIn = useStore((s) => s.signedIn);
  const onboarded = useStore((s) => s.onboarded);

  if (!signedIn) return <Redirect href="/auth" />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
