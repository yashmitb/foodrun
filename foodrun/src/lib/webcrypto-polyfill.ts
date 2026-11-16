import * as Crypto from 'expo-crypto';

/**
 * Enough of WebCrypto for supabase-js to do PKCE properly.
 *
 * Hermes has no `crypto.subtle`, and supabase-js reacts to that by falling
 * back to `code_challenge_method=plain` with a console warning. Plain means
 * the challenge *is* the verifier, sent in the clear in the authorize URL —
 * which removes the whole point of PKCE. Anyone who sees that URL can
 * complete the exchange with the code.
 *
 * That is not academic here. The redirect comes back through `exp://` or
 * `foodrun://`, schemes any app on the device can also register, which is
 * precisely the interception PKCE exists to defeat.
 *
 * The first attempt at this only patched an existing `globalThis.crypto`.
 * Depending on the runtime there may be no such object at all, in which case
 * nothing happened and PKCE stayed on plain — so this creates the object
 * when it is missing, and fills in whichever pieces are absent.
 *
 * Imported for its side effect by `@/lib/supabase`, before any client is
 * constructed.
 */

type SubtleLike = { digest(algorithm: unknown, data: BufferSource): Promise<ArrayBuffer> };
type CryptoLike = {
  subtle?: SubtleLike;
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
};

const ALGORITHMS: Record<string, Crypto.CryptoDigestAlgorithm> = {
  'SHA-1': Crypto.CryptoDigestAlgorithm.SHA1,
  'SHA-256': Crypto.CryptoDigestAlgorithm.SHA256,
  'SHA-384': Crypto.CryptoDigestAlgorithm.SHA384,
  'SHA-512': Crypto.CryptoDigestAlgorithm.SHA512,
};

const subtle: SubtleLike = {
  async digest(algorithm: unknown, data: BufferSource): Promise<ArrayBuffer> {
    const name =
      typeof algorithm === 'string'
        ? algorithm
        : ((algorithm as { name?: string })?.name ?? '');
    const picked = ALGORITHMS[name.toUpperCase()];
    if (!picked) throw new Error(`Unsupported digest algorithm: ${name}`);
    return Crypto.digest(picked, data);
  },
};

const target = globalThis as typeof globalThis & { crypto?: CryptoLike };

if (!target.crypto) {
  Object.defineProperty(target, 'crypto', { configurable: true, writable: true, value: {} });
}

const cryptoObj = target.crypto as CryptoLike;

if (typeof cryptoObj.subtle === 'undefined') {
  try {
    Object.defineProperty(cryptoObj, 'subtle', { configurable: true, value: subtle });
  } catch {
    // Some runtimes hand back a frozen object; replacing it wholesale is the
    // only way in, and is safe because we copy what was already there.
    Object.defineProperty(target, 'crypto', {
      configurable: true,
      writable: true,
      value: { ...cryptoObj, subtle },
    });
  }
}

// supabase-js also uses this to build the verifier, and falls back to
// Math.random without it. Math.random is not a source of secrets.
const withCrypto = target.crypto as CryptoLike;
if (typeof withCrypto.getRandomValues === 'undefined') {
  withCrypto.getRandomValues = (<T extends ArrayBufferView | null>(array: T): T => {
    if (!array) return array;
    const bytes = Crypto.getRandomBytes(array.byteLength);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(bytes);
    return array;
  }) as CryptoLike['getRandomValues'];
}

/** True when PKCE can use S256. Shown on the sign-in screen in development. */
export const webCryptoReady =
  typeof (globalThis as { crypto?: CryptoLike }).crypto?.subtle !== 'undefined' &&
  typeof TextEncoder !== 'undefined';
