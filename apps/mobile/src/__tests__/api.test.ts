import { request, setAuthExpiredCallback, NetworkError, ApiError } from '../api';
import * as SecureStore from 'expo-secure-store';

type FetchLike = (url: string, init?: RequestInit) => Promise<any>;

function jsonResponse(body: unknown, status: number) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe('api: 401 refresh handling', () => {
  const originalFetch = global.fetch;
  const onExpired = jest.fn();

  beforeAll(() => setAuthExpiredCallback(onExpired));

  beforeEach(() => {
    onExpired.mockClear();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(
      JSON.stringify({ accessToken: 'old', refreshToken: 'refresh-1' }),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('does NOT sign the user out when token refresh fails offline', async () => {
    let call = 0;
    global.fetch = (jest.fn(async () => {
      call += 1;
      if (call === 1) return jsonResponse({ message: 'Unauthorized' }, 401);
      throw new TypeError('Network request failed');
    }) as unknown) as FetchLike as typeof fetch;

    await expect(request('/bookings/my', { token: 'stale' })).rejects.toThrow(NetworkError);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('does NOT sign the user out when token refresh times out', async () => {
    let call = 0;
    global.fetch = (jest.fn(async () => {
      call += 1;
      if (call === 1) return jsonResponse({ message: 'Unauthorized' }, 401);
      const err = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    }) as unknown) as FetchLike as typeof fetch;

    await expect(request('/bookings/my', { token: 'stale' })).rejects.toThrow(NetworkError);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('signs the user out when the server rejects the refresh token', async () => {
    let call = 0;
    global.fetch = (jest.fn(async () => {
      call += 1;
      if (call === 1) return jsonResponse({ message: 'Unauthorized' }, 401);
      return jsonResponse({ message: 'Session expired' }, 401);
    }) as unknown) as FetchLike as typeof fetch;

    await expect(request('/bookings/my', { token: 'stale' })).rejects.toThrow(ApiError);
    expect(onExpired).toHaveBeenCalled();
  });

  it('retries with the refreshed token on success', async () => {
    let call = 0;
    global.fetch = (jest.fn(async () => {
      call += 1;
      if (call === 1) return jsonResponse({ message: 'Unauthorized' }, 401);
      if (call === 2) return jsonResponse({ accessToken: 'new-token' }, 200);
      return jsonResponse({ data: [{ id: 'b1' }] }, 200);
    }) as unknown) as FetchLike as typeof fetch;

    const result = await request<{ data: { id: string }[] }>('/bookings/my', { token: 'stale' });
    expect(result.data[0].id).toBe('b1');
    expect(onExpired).not.toHaveBeenCalled();
    // 3 calls: original 401, refresh, retried request
    expect(call).toBe(3);
  });
});
