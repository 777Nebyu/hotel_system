import * as AuthSession from 'expo-auth-session';
import { getRandomValues } from 'expo-crypto';
import { decodeJwtPayload } from '../utils/jwt';

/**
 * Deep-link scheme the OAuth flow redirects back on.
 *
 * MUST stay in sync with `expo.scheme` in `app.json`: the browser hands the
 * response to `<scheme>://`, so a mismatch fails before `state` or `nonce` can
 * be checked and the failure looks like the user simply closed the browser.
 */
export const OAUTH_SCHEME = 'luxstyhotel';

export type GoogleAuthErrorCode =
  | 'googleConfig'
  | 'googleStateMismatch'
  | 'googleNonceMismatch'
  | 'googleProviderError';

export class GoogleAuthError extends Error {
  readonly code: GoogleAuthErrorCode;

  constructor(code: GoogleAuthErrorCode, message: string) {
    super(message);
    this.name = 'GoogleAuthError';
    this.code = code;
  }
}

type RandomSource = (bytes: Uint8Array) => void;

function randomSources(): RandomSource[] {
  const webCrypto = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  return [
    ...(webCrypto ? [(bytes: Uint8Array) => webCrypto(bytes)] : []),
    (bytes) => {
      getRandomValues(bytes);
    },
  ];
}

function uuidFromBytes(bytes: Uint8Array): string {
  const versioned = new Uint8Array(bytes);
  versioned[6] = (versioned[6] & 0x0f) | 0x40;
  versioned[8] = (versioned[8] & 0x3f) | 0x80;
  const hex = Array.from(versioned, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Generate the OIDC `nonce` that binds an ID token to a single sign-in attempt.
 *
 * Two CSPRNG sources are tried in order because neither covers every runtime:
 * Hermes does not reliably expose `globalThis.crypto`, and `expo-crypto`'s
 * native implementation is a silent no-op under jest. Each source is probed
 * with the very buffer it is asked to fill and discarded when it produced
 * nothing — an all-zero nonce would look valid to `assertIdTokenNonce` while
 * offering no replay protection at all.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  for (const source of randomSources()) {
    try {
      source(bytes);
    } catch {
      continue;
    }
    if (bytes.some((byte) => byte !== 0)) return uuidFromBytes(bytes);
  }
  throw new GoogleAuthError('googleConfig', 'No secure random source is available.');
}

/**
 * Verify that the ID token we received answers *this* sign-in attempt.
 *
 * Rejects malformed tokens, tokens whose `nonce` claim was stripped, and tokens
 * minted for a different attempt (replay). The backend independently verifies
 * the signature and audience — this check is what ties the token to us.
 */
export function assertIdTokenNonce(idToken: string, expectedNonce: string): void {
  if (!expectedNonce) {
    throw new GoogleAuthError('googleConfig', 'Google sign-in is not configured for this build.');
  }
  if (decodeJwtPayload(idToken).nonce !== expectedNonce) {
    throw new GoogleAuthError(
      'googleNonceMismatch',
      'Google did not return the token for this sign-in attempt.',
    );
  }
}

export function extractIdToken(result: AuthSession.AuthSessionResult): string | null {
  if (result.type !== 'success') return null;
  return result.authentication?.idToken ?? result.params.id_token ?? null;
}
