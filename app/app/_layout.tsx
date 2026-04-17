import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { getToken } from '@/lib/auth';
import { useNotifications } from '@/lib/useNotifications';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const PUBLIC_ROUTES = new Set(['login', 'register']);

function useAuthGuard(ready: boolean) {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    // Re-read the token on every navigation so the guard sees fresh
    // tokens written by register/login before deciding to redirect.
    getToken().then((token) => {
      if (cancelled) return;
      const first = segments[0] ?? '';
      const isPublic = PUBLIC_ROUTES.has(first);
      if (!token && !isPublic) {
        router.replace('/login');
      } else if (token && isPublic) {
        router.replace('/');
      }
      setAuthed(!!token);
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, segments, router]);

  return { checked, authed };
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const { checked: authChecked, authed } = useAuthGuard(loaded);
  useNotifications(authed);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && authChecked) {
      SplashScreen.hideAsync();
    }
  }, [loaded, authChecked]);

  if (!loaded || !authChecked) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        <Stack.Screen name="register" options={{ presentation: 'modal' }} />
        <Stack.Screen name="profile-setup" />
      </Stack>
    </>
  );
}
