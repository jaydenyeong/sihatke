import { Contact, Alert, User, Checkin } from '../models';
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

const DECLINE_THRESHOLD = 3;
const DECLINE_WINDOW_DAYS = 7;

/**
 * Scan all users for a declining health pattern:
 * 3+ check-ins with "not_great" or "need_help" (physical OR mental)
 * within the last 7 days triggers a decline_pattern alert to contacts
 * with notifyOnDecline enabled.
 *
 * Uses a recent-alert check to avoid duplicate alerts within the window.
 */
export async function runDeclinePatternCheck(): Promise<void> {
  const windowStart = new Date(Date.now() - DECLINE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const users = await User.find({}).select('_id fullName').lean();

  for (const user of users) {
    const uid = user._id.toString();

    // Count concerning check-ins in the window
    const badCount = await Checkin.countDocuments({
      userId: uid,
      createdAt: { $gte: windowStart },
      $or: [
        { physicalStatus: { $in: ['not_great', 'need_help'] } },
        { mentalStatus: { $in: ['not_great', 'need_help'] } },
      ],
    });

    if (badCount < DECLINE_THRESHOLD) continue;

    // Skip if we already sent a decline_pattern alert for this user in the window
    const recentAlert = await Alert.findOne({
      userId: uid,
      alertType: 'decline_pattern',
      createdAt: { $gte: windowStart },
    });
    if (recentAlert) continue;

    const contacts = await Contact.find({ userId: uid, notifyOnDecline: true });
    if (contacts.length === 0) continue;

    const message = `${user.fullName} has been feeling unwell frequently over the past week`;

    const alertDocs = contacts.map((c) => ({
      userId: uid,
      contactId: c._id,
      alertType: 'decline_pattern' as const,
      message,
    }));
    await Alert.insertMany(alertDocs);

    const contactUserIds = contacts
      .filter((c) => c.contactUserId)
      .map((c) => c.contactUserId!.toString());

    if (contactUserIds.length > 0) {
      await sendPushToUsers(
        contactUserIds,
        'Health Concern',
        message,
        { alertType: 'decline_pattern' }
      );
    }
  }
}
