import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import { PushToken } from '../models';

const expo = new Expo();

export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    if (userIds.length === 0) return;

    const tokenDocs = await PushToken.find({ userId: { $in: userIds } });
    const messages: ExpoPushMessage[] = [];

    for (const doc of tokenDocs) {
      if (!Expo.isExpoPushToken(doc.token)) {
        console.warn(`Invalid push token for user ${doc.userId}: ${doc.token}`);
        continue;
      }
      messages.push({ to: doc.token, title, body, data, sound: 'default' });
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
