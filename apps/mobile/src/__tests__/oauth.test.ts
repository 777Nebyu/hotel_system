import * as AuthSession from 'expo-auth-session';
import {
  GoogleAuthError,
  OAUTH_SCHEME,
  assertIdTokenNonce,
  extractIdToken,
  generateNonce,
} from '../lib/oauth';
import { classifyError } from '../errors';
import appJson from '../../app.json';

const b64url = (value: string): string =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fakeIdToken = (payload: Record<string, unknown>): string =>
  [b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })), b64url(JSON.stringify(payload)), 'sig'].join('.');

describe('OAUTH_SCHEME', () => {
  it('matches the scheme registered in app.json', () => {
    expect(OAUTH_SCHEME).toBe(appJson.expo.scheme);
  });
});

describe('generateNonce', () => {
  it('returns an RFC 4122 v4 UUID', () => {
    expect(generateNonce()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('never returns an all-zero nonce', () => {
    const allZero = '00000000-0000-4000-8000-000000000000';
    expect(Array.from({ length: 500 }, () => generateNonce())).not.toContain(allZero);
  });

  it('is unique across many calls', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateNonce()));
    expect(seen.size).toBe(500);
  });
});

describe('assertIdTokenNonce', () => {
  it('accepts a token carrying the expected nonce', () => {
    const nonce = generateNonce();
    expect(() => assertIdTokenNonce(fakeIdToken({ sub: '1', nonce }), nonce)).not.toThrow();
  });

  it('rejects a nonce from a different sign-in attempt', () => {
    const token = fakeIdToken({ nonce: generateNonce() });
    expect(() => assertIdTokenNonce(token, generateNonce())).toThrow(GoogleAuthError);
  });

  it('rejects a token with the nonce claim stripped', () => {
    expect(() => assertIdTokenNonce(fakeIdToken({ sub: '1' }), generateNonce())).toThrow(
      GoogleAuthError,
    );
  });

  it('rejects a malformed token', () => {
    expect(() => assertIdTokenNonce('not-a-jwt', generateNonce())).toThrow(GoogleAuthError);
  });

  it('rejects when no nonce was ever generated', () => {
    expect(() => assertIdTokenNonce(fakeIdToken({ nonce: '' }), '')).toThrow(GoogleAuthError);
  });

  it('reports googleNonceMismatch so the UI can show a specific message', () => {
    try {
      assertIdTokenNonce(fakeIdToken({ sub: '1' }), generateNonce());
      throw new Error('expected assertIdTokenNonce to throw');
    } catch (err) {
      expect((err as GoogleAuthError).code).toBe('googleNonceMismatch');
    }
  });
});

describe('extractIdToken', () => {
  const token = fakeIdToken({ nonce: 'abc' });

  it('reads the token from query params', () => {
    expect(
      extractIdToken({
        type: 'success',
        errorCode: null,
        error: null,
        params: { id_token: token },
        authentication: null,
        url: `${OAUTH_SCHEME}://google-auth`,
      }),
    ).toBe(token);
  });

  it('reads the token from the parsed authentication', () => {
    expect(
      extractIdToken({
        type: 'success',
        errorCode: null,
        error: null,
        params: {},
        authentication: { idToken: token } as never,
        url: `${OAUTH_SCHEME}://google-auth`,
      }),
    ).toBe(token);
  });

  it('returns null when the flow did not succeed', () => {
    expect(extractIdToken({ type: 'cancel' })).toBeNull();
  });
});

describe('classifyError for GoogleAuthError', () => {
  it.each([
    ['googleConfig', 'Google sign-in is not configured for this app.'],
    ['googleStateMismatch', 'Google sign-in could not be verified. Please try again.'],
    ['googleNonceMismatch', 'Google sign-in response was rejected. Please try again.'],
    ['googleProviderError', 'Google sign-in was denied or failed. Please try again.'],
  ] as const)('surfaces the %s message', (code, title) => {
    const classified = classifyError(new GoogleAuthError(code, 'ignored'));
    expect(classified.category).toBe('auth');
    expect(classified.code).toBe(code);
    expect(classified.title).toBe(title);
    expect(classified.retryable).toBe(false);
  });

  it('falls back to the auth default for an unknown code', () => {
    const classified = classifyError(new GoogleAuthError('unknownCode' as never, 'ignored'));
    expect(classified.category).toBe('auth');
    expect(classified.title).toBe('Please sign in to continue.');
  });
});

const AUTH_ENDPOINT = 'https://accounts.example.test/o/oauth2/v2/auth';

const makeAuthRequest = (extraParams: Record<string, string>): AuthSession.AuthRequest =>
  new AuthSession.AuthRequest({
    clientId: 'test-client-id',
    redirectUri: `${OAUTH_SCHEME}://google-auth`,
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: false,
    extraParams,
  });

describe('authorization request', () => {
  it('carries the nonce, state and id_token response type on the authorize URL', async () => {
    const url = await makeAuthRequest({ nonce: 'nonce-value' }).makeAuthUrlAsync({
      authorizationEndpoint: AUTH_ENDPOINT,
    });
    const params = new URL(url).searchParams;

    expect(params.get('nonce')).toBe('nonce-value');
    expect(params.get('response_type')).toBe('id_token');
    expect(params.get('redirect_uri')).toBe(`${OAUTH_SCHEME}://google-auth`);
    expect(params.get('state')).toBeTruthy();
    expect(params.get('scope')).toBe('openid profile email');
  });

  it('omits PKCE parameters — id_token carries no authorization code to bind', async () => {
    const url = await makeAuthRequest({ nonce: 'nonce-value' }).makeAuthUrlAsync({
      authorizationEndpoint: AUTH_ENDPOINT,
    });
    const params = new URL(url).searchParams;

    expect(params.has('code_challenge')).toBe(false);
    expect(params.has('code_challenge_method')).toBe(false);
  });

  it('rejects a response carrying a forged state', () => {
    const result = makeAuthRequest({ nonce: 'nonce-value' }).parseReturnUrl(
      `${OAUTH_SCHEME}://google-auth?state=forged&id_token=${fakeIdToken({ nonce: 'nonce-value' })}`,
    );

    expect(result.type).toBe('error');
    if (result.type === 'error') expect(result.error?.code).toBe('state_mismatch');
  });

  it('accepts a response carrying the state it generated', () => {
    const request = makeAuthRequest({ nonce: 'nonce-value' });
    const result = request.parseReturnUrl(
      `${OAUTH_SCHEME}://google-auth?state=${request.state}&id_token=${fakeIdToken({ nonce: 'nonce-value' })}`,
    );

    expect(result.type).toBe('success');
  });
});
