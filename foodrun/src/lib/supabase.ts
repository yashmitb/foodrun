import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { Database } from '@/data/database.types';

/**
 * The backend is optional on purpose.
 *
 * Phase 3 of the build order adds Supabase, but the demo has to keep running
 * on a laptop with no project configured — so the app reads its credentials
 * from the environment and falls back to the in-memory mock store when they
 * are absent. `isBackendConfigured` is the single switch every data path
 * checks; nothing else should read the env vars.
 *
 * Both values are safe to ship in the client. The anon key is designed to be
 * public; it grants nothing on its own, because every table is governed by
 * the RLS policies in supabase/migrations/0002_rls.sql.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isBackendConfigured = url.length > 0 && anonKey.length > 0;

export const supabase: SupabaseClient<Database> | null = isBackendConfigured
  ? createClient<Database>(url, anonKey, {
      auth: {
        // On a phone the session has to outlive the process; on web the
        // browser's own storage is already the right place.
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        /*
         * PKCE, not implicit. The OAuth redirect comes back through a custom
         * URL scheme that any app on the device can claim, so the response
         * must not carry a usable token — with PKCE it carries a code that
         * is worthless without the verifier held in this app.
         */
        flowType: 'pkce',
        // There is no URL to parse a session out of in a native app.
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

/** Throws rather than returning null, for paths that already checked. */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY — see docs/SETUP.md.',
    );
  }
  return supabase;
}
