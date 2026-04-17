import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiRequest } from './api';
import { getToken } from './auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotifications(authed: boolean) {
  const registered = useRef(false);

  useEffect(() => {
    // Wait for user to be authenticated — /push-tokens requires a bearer token
    if (!authed || registered.current) return;
    registered.current = true;

    (async () => {
      if (!Device.isDevice) return;

      // Double-check we actually have a token before making the API call
      const token = await getToken();
      if (!token) return;

      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        (Constants as any).easConfig?.projectId;

      // Skip push token registration if no EAS project configured yet.
      // Push notifications will work once `eas init` is run.
      if (!projectId) return;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      await apiRequest('/push-tokens', {
        method: 'POST',
        body: {
          token: tokenData.data,
          platform: Platform.OS as 'ios' | 'android',
        },
      });
    })().catch(console.error);
  }, [authed]);
}
