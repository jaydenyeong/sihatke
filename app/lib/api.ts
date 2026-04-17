import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getToken } from './auth';

const IPV4 = /^\d+\.\d+\.\d+\.\d+$/;

function resolveBaseUrl(): string {
  // 1. Explicit override via app/.env — create the file with:
  //    EXPO_PUBLIC_API_URL=https://your-ngrok-url.ngrok-free.app/api
  //    Only needed when LAN is blocked (public Wi-Fi, AP isolation).
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  // 2. Auto-detect from Expo dev server's LAN IP (works at home / same Wi-Fi).
  const hostUri = (Constants.expoConfig as any)?.hostUri;
  const debuggerHost = (Constants.manifest as any)?.debuggerHost;

  for (const raw of [hostUri, debuggerHost]) {
    if (!raw) continue;
    const host = String(raw).split(':')[0];
    if (IPV4.test(host)) {
      return `http://${host}:3000/api`;
    }
  }

  // 3. Fallback: emulator loopback (Android) or localhost (iOS simulator).
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }
  return 'http://localhost:3000/api';
}

export const API_BASE_URL = resolveBaseUrl();
console.log('[Sihaty] API base URL:', API_BASE_URL);

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  auth?: boolean;
}

export async function apiRequest<T = unknown>(
  path: string,
  { method = 'GET', body, auth = true }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error).name === 'AbortError') {
      throw new ApiError(`Can't reach server at ${API_BASE_URL}`, 0);
    }
    throw new ApiError(`Network error: ${(err as Error).message}`, 0);
  }
  clearTimeout(timeoutId);

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message =
      data?.error ||
      data?.errors?.[0]?.msg ||
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}
