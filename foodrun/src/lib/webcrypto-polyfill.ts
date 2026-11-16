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
 * expo-crypto has a real SHA-256, so this hands supabase-js the one method
 * it looks for. Imported for its side effect by `@/lib/supabase`, before any
 * client is constructed.
 */
const existing = (globalThis as { crypto?: Partial<Crypto> }).crypto;

if (existing && typeof existing.subtle === 'undefined') {
  Object.defineProperty(existing, 'subtle', {
    configurable: true,
    value: {
      async digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
        const map: Record<string, Crypto.CryptoDigestAlgorithm> = {
          'SHA-1': Crypto.CryptoDigestAlgorithm.SHA1,
          'SHA-256': Crypto.CryptoDigestAlgorithm.SHA256,
          'SHA-384': Crypto.CryptoDigestAlgorithm.SHA384,
          'SHA-512': Crypto.CryptoDigestAlgorithm.SHA512,
        };
        const picked = map[name.toUpperCase()];
        if (!picked) throw new Error(`Unsupported digest algorithm: ${name}`);
        return Crypto.digest(picked, data);
      },
    },
  });
}

/** True when PKCE can use S256. Read by the sign-in screen in development. */
export const webCryptoReady =
  typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined';
