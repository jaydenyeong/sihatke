import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import { db } from '../db/supabase';
import type { PushTokenRow } from '../db/types';

const expo = new Expo();

export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    if (userIds.length === 0) return;

    const { data: rows, error } = await db()
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', userIds);

    if (error) {
      console.error('Push token lookup error:', error);
      return;
    }

    const messages: ExpoPushMessage[] = [];
    for (const row of (rows ?? []) as Pick<PushTokenRow, 'user_id' | 'token'>[]) {
      if (!Expo.isExpoPushToken(row.token)) {
        console.warn(`Invalid push token for user ${row.user_id}: ${row.token}`);
        continue;
      }
      messages.push({ to: row.token, title, body, data, sound: 'default' });
    }

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (err) {
    console.error('Push notification error:', err);
  }
}