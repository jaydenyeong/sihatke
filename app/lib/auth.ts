import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'sihaty_auth_token';

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getUserId(): Promise<string | null> {
  try {
    const token = await getToken();
    if (!token) return null;
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64)) as { userId?: string };
    return payload.userId ?? null;
  } catch {
    return null;
  }
}
