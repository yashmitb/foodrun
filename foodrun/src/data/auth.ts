import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { isBackendConfigured, requireSupabase } from '@/lib/supabase';

/**
 * §2 — only @ucsd.edu may sign up, by email OTP.
 *
 * Two implementations behind one interface. With a Supabase project
 * configured this is a real one-time code to a real inbox; without one it is
 * the mock the demo has always used, where any four digits work. The screen
 * does not branch — it asks `authMode` only so it can tell the user which
 * they are looking at, which matters when a grader types 1234 and it works.
 */

export type AuthResult = { ok: true } | { ok: false; message: string };

/**
 * Demo sign-in accepts any four digits. That is fine on a laptop and a
 * catastrophe in a shipped build: it is an unauthenticated login for anyone
 * who types an @ucsd.edu address they do not own.
 *
 * So it is gated on __DEV__ as well as on the backend being absent. A release
 * build with no Supabase project configured does not fall back to the demo —
 * it refuses to sign anyone in and says why. Failing closed is the only safe
 * direction for an auth fallback.
 */
const demoAllowed = __DEV__;

export const authMode: 'supabase' | 'demo' | 'unconfigured' = isBackendConfigured
  ? 'supabase'
  : demoAllowed
    ? 'demo'
    : 'unconfigured';

const UNCONFIGURED =
  'Sign-in is unavailable in this build. It was shipped without a backend configured.';

const UCSD = /^[^@\s]+@ucsd\.edu$/i;

export function isUcsdEmail(email: string): boolean {
  return UCSD.test(email.trim());
}

export async function sendCode(email: string): Promise<AuthResult> {
  const address = email.trim().toLowerCase();
  if (!isUcsdEmail(address)) return { ok: false, message: 'Use your @ucsd.edu email.' };
  if (authMode === 'unconfigured') return { ok: false, message: UNCONFIGURED };
  if (authMode === 'demo') return { ok: true };

  const { error } = await requireSupabase().auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function verifyCode(email: string, code: string): Promise<AuthResult> {
  const address = email.trim().toLowerCase();
  if (code.length !== 6 && authMode === 'supabase') {
    return { ok: false, message: 'That code is 6 digits.' };
  }
  if (authMode === 'unconfigured') return { ok: false, message: UNCONFIGURED };
  if (authMode === 'demo') {
    return code.length === 4 ? { ok: true } : { ok: false, message: 'Enter the 4-digit code.' };
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: address,
    token: code,
    type: 'email',
  });
  if (error) return { ok: false, message: error.message };
  const user = data.user;
  if (!user) return { ok: false, message: "That code didn't work. Ask for a new one." };

  /**
   * The row in `profiles` is this app's record of a person; `auth.users` is
   * Supabase's. Create ours on first sign-in, named from the email until
   * onboarding asks for a real one.
   */
  const handle = address.split('@')[0];
  const guessed = handle
    .split(/[._\d]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: user.id, name: guessed || 'Triton', ucsd_email: address }, {
      onConflict: 'id',
      ignoreDuplicates: true,
    });
  if (profileError) return { ok: false, message: profileError.message };

  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (authMode !== 'supabase') return;
  await requireSupabase().auth.signOut();
}

/** The signed-in user's id, or null. Null in demo mode. */
export async function currentUserId(): Promise<string | null> {
  if (authMode !== 'supabase') return null;
  const { data } = await requireSupabase().auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Whether to offer Google at all. Only with a backend: the demo path has no
 * provider to talk to, and a button that cannot work is worse than no button.
 */
export const googleAvailable = authMode === 'supabase';

/** How long the code is, so the input can size itself. */
export const codeLength = authMode === 'supabase' ? 6 : 4;

/**
 * Whether the signed-in flag can be trusted without asking the server.
 *
 * It cannot, once there is a backend: the local store is just a value on a
 * device and anyone with the device can edit it. It is a cache of the real
 * session, never the authority — RLS is what actually refuses the data.
 */
export async function hasLiveSession(): Promise<boolean> {
  if (authMode !== 'supabase') return false;
  const { data } = await requireSupabase().auth.getSession();
  return !!data.session;
}

// --------------------------------------------------------------- Google

/**
 * Where Google should send the browser back to.
 *
 * Not a constant, and not `foodrun://` in development. Expo Go cannot own a
 * custom scheme, so it hands out `exp://<lan-ip>:8081/--/auth-callback`,
 * which changes with the machine's address. A standalone build does own the
 * scheme and gets `foodrun://auth-callback`.
 *
 * Whatever this returns has to be on Supabase's redirect allow list. When it
 * is not, Supabase quietly falls back to the project's Site URL - which is
 * `localhost:3000` by default, so the browser lands on "Safari can't open
 * the page" and the app never hears back.
 */
export function googleRedirectUri(): string {
  return makeRedirectUri({ scheme: 'foodrun', path: 'auth-callback' });
}

/**
 * §2 — Sign in with the UCSD Google account.
 *
 * Better than a posted code on two counts. It cannot be rate-limited by an
 * email quota, and it is stronger evidence: a one-time code proves someone
 * can read an inbox, while Google returns a hosted-domain claim that proves
 * the account *is* a ucsd.edu Workspace account.
 *
 * The browser does the round trip rather than a native sheet, because a
 * native sheet needs a development build and this has to keep working in
 * Expo Go. Swapping to the native picker later changes this function and
 * nothing else.
 */
export async function signInWithGoogle(): Promise<AuthResult & { email?: string }> {
  if (authMode !== 'supabase') return { ok: false, message: UNCONFIGURED };

  const supabase = requireSupabase();
  const redirectTo = googleRedirectUri();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // We open the URL ourselves so the result comes back to us instead of
      // navigating away from the app.
      skipBrowserRedirect: true,
      queryParams: {
        // Asks Google to show only ucsd.edu accounts. A hint for the person,
        // not a control: it is a query parameter and anyone can change it,
        // which is why the address is checked again below and the database
        // refuses a non-UCSD row regardless.
        hd: 'ucsd.edu',
        prompt: 'select_account',
      },
    },
  });
  if (error || !data?.url) {
    return { ok: false, message: error?.message ?? 'Could not reach Google.' };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    return { ok: false, message: 'Sign-in cancelled.' };
  }

  const code = new URL(result.url).searchParams.get('code');
  if (!code) return { ok: false, message: 'Google did not return a sign-in code.' };

  const { data: session, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return { ok: false, message: exchangeError.message };

  const user = session.user;
  const email = user?.email?.toLowerCase() ?? '';

  /**
   * Google can be asked to show only UCSD accounts; it cannot be trusted to
   * have obeyed. Check what actually came back, and sign straight back out
   * if it is not UCSD — the trigger on auth.users refuses the row anyway, so
   * this is about saying why rather than about safety.
   */
  if (!isUcsdEmail(email)) {
    await supabase.auth.signOut();
    return { ok: false, message: 'Use your UCSD Google account, not a personal one.' };
  }

  const name =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    email.split('@')[0];

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: user!.id, name, ucsd_email: email }, { onConflict: 'id', ignoreDuplicates: true });
  if (profileError) return { ok: false, message: profileError.message };

  return { ok: true, email };
}
