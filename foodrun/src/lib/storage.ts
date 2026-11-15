import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Small typed wrapper over AsyncStorage.
 *
 * Everything here is best-effort: a device can refuse storage, and losing a
 * cached preference is never worth a crash in front of a grader. Reads return
 * the fallback on any failure, writes swallow theirs.
 */
export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignored on purpose — see above
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignored on purpose
  }
}

export const KEYS = {
  /** Who is signed in, where they usually sit, whether onboarding is done. */
  session: 'foodrun.session.v1',
  /** The last few drop spots, so §6.3's fallback can offer them again. */
  recentSpots: 'foodrun.recentSpots.v1',
  /** Supabase's own auth token store. */
  supabaseAuth: 'foodrun.supabase.auth',
} as const;
