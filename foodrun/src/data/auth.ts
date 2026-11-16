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
