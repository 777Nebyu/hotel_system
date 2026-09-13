import * as SecureStore from 'expo-secure-store';

function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
  const trimmed = configured.replace(/\/$/, '');
  if (!__DEV__ && trimmed.startsWith('http://')) {
    // Automatically upgrade to https in production
    return trimmed.replace(/^http:\/\//, 'https://');
  }
  return trimmed;
}

export const API_URL = resolveApiUrl();

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); }
}

export class NetworkError extends Error {
  constructor(message = 'No internet connection. Please check your network and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

// ─── ERR-010: Global 401 redirect callback ──────────────────────────────────

let onAuthExpired: (() => void) | null = null;
export function setAuthExpiredCallback(cb: () => void) { onAuthExpired = cb; }

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; token?: string | null };

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

const SESSION_KEY = 'yayetech.hotel.session';

async function getRefreshToken(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session?.refreshToken ?? null;
  } catch { return null; }
}

export async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new ApiError('Session expired', 401);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new NetworkError('Request timed out. Please check your connection.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new ApiError('Session expired', 401);

  const data = await response.json() as { accessToken: string; refreshToken?: string };
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (raw) {
    const session = JSON.parse(raw);
    session.accessToken = data.accessToken;
    if (data.refreshToken) session.refreshToken = data.refreshToken;
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  }
  return data.accessToken;
}

function handle401() {
  onAuthExpired?.();
}

async function performRequest<T>(path: string, options: RequestOptions = {}, retryCount = 0): Promise<T> {
  const { body, token, headers, signal, ...init } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: signal ?? controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new NetworkError('Request timed out. Please check your internet connection.');
    }
    if (err instanceof TypeError && (err.message.includes('Network request failed') || err.message.includes('fetch'))) {
      throw new NetworkError(`Cannot reach server at ${API_URL}. Please check your connection.`);
    }
    if (err instanceof NetworkError) throw err;
    throw new NetworkError(`Connection failed: ${err.message ?? 'Unknown error'}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401 && retryCount === 0) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => { isRefreshing = false; });
    }
    try {
      const newToken = await refreshPromise!;
      return performRequest<T>(path, { ...options, token: newToken }, 1);
    } catch {
      handle401();
      throw new ApiError('Session expired. Please sign in again.', 401);
    }
  }

  if (response.status === 401 && retryCount > 0) {
    handle401();
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? Array.isArray(payload.message) ? payload.message.join('\n') : String(payload.message)
      : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return performRequest<T>(path, options);
}

// ─── ERR-010: requestFormData now handles 401 ───────────────────────────────

export async function requestFormData<T>(path: string, formData: FormData, token?: string | null): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new NetworkError('Request timed out. Please check your internet connection.');
    }
    if (err instanceof TypeError && (err.message.includes('Network request failed') || err.message.includes('fetch'))) {
      throw new NetworkError(`Cannot reach server at ${API_URL}. Please check your connection.`);
    }
    if (err instanceof NetworkError) throw err;
    throw new NetworkError(`Connection failed: ${err.message ?? 'Unknown error'}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401) {
    handle401();
    throw new ApiError('Session expired. Please sign in again.', 401);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? Array.isArray(payload.message) ? payload.message.join('\n') : String(payload.message)
      : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

// ─── ERR-010: requestBlob now handles 401 ───────────────────────────────────

export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const { body, token, headers, signal, ...init } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: signal ?? controller.signal,
      headers: {
        Accept: 'application/octet-stream',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new NetworkError('Request timed out. Please check your internet connection.');
    }
    if (err instanceof TypeError && (err.message.includes('Network request failed') || err.message.includes('fetch'))) {
      throw new NetworkError(`Cannot reach server at ${API_URL}. Please check your connection.`);
    }
    if (err instanceof NetworkError) throw err;
    throw new NetworkError(`Connection failed: ${err.message ?? 'Unknown error'}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 401) {
    handle401();
    throw new ApiError('Session expired. Please sign in again.', 401);
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? Array.isArray(payload.message) ? payload.message.join('\n') : String(payload.message)
      : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return response.blob();
}
