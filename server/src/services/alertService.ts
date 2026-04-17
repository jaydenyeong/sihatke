import { Contact, Alert, User } from '../models';
import { sendPushToUsers } from './notificationService';

export async function triggerNeedHelpAlert(userId: string): Promise<void> {
  const [user, contacts] = await Promise.all([
    User.findById(userId).select('fullName'),
    Contact.find({ userId, notifyOnHelp: true }),
  ]);

  if (!user || contacts.length === 0) return;

  // Create alert docs
  const alertDocs = contacts.map((c) => ({
    userId,
    contactId: c._id,
    alertType: 'need_help' as const,
    message: `${user.fullName} has reported they need help`,
  }));
  await Alert.insertMany(alertDocs);

  // Push to contacts who are also app users
  const contactUserIds = contacts
    .filter((c) => c.contactUserId)
    .map((c) => c.contactUserId!.toString());

  if (contactUserIds.length > 0) {
    await sendPushToUsers(
      contactUserIds,
      'Help Needed',
      `${user.fullName} has reported they need help`,
      { alertType: 'need_help' }
    );
  }
}

export async function triggerMissedCheckinAlert(
  userId: string,
  scheduledTime: string
): Promise<void> {
  const [user, contacts] = await Promise.all([
    User.findById(userId).select('fullName'),
    Contact.find({ userId, notifyOnMissed: true }),
  ]);

  if (!user || contacts.length === 0) return;

  const message = `${user.fullName} missed their ${scheduledTime} check-in`;

  const alertDocs = contacts.map((c) => ({
    userId,
    contactId: c._id,
    alertType: 'missed_checkin' as const,
    message,
  }));
  await Alert.insertMany(alertDocs);

  const contactUserIds = contacts
    .filter((c) => c.contactUserId)
    .map((c) => c.contactUserId!.toString());

  if (contactUserIds.length > 0) {
    await sendPushToUsers(
      contactUserIds,
      'Missed Check-in',
      message,
      { alertType: 'missed_checkin' }
    );
  }
}
