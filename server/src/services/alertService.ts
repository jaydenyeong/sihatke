import { db } from '../db/supabase';
import type { ContactRow, UserRow } from '../db/types';
import { sendPushToUsers } from './notificationService';

export async function triggerNeedHelpAlert(userId: string): Promise<void> {
  const [{ data: user }, { data: contacts }] = await Promise.all([
    db().from('users').select('full_name').eq('id', userId).maybeSingle(),
    db()
      .from('contacts')
      .select('id, contact_user_id')
      .eq('user_id', userId)
      .eq('notify_on_help', true),
  ]);

  if (!user || !contacts || contacts.length === 0) return;

  const fullName = (user as Pick<UserRow, 'full_name'>).full_name;
  const message = `${fullName} has reported they need help`;

  const alertDocs = (contacts as Pick<ContactRow, 'id' | 'contact_user_id'>[]).map((c) => ({
    user_id: userId,
    contact_id: c.id,
    alert_type: 'need_help' as const,
    message,
  }));
  const { error } = await db().from('alerts').insert(alertDocs);
  if (error) {
    console.error('Need-help alert insert error:', error);
    return;
  }

  const contactUserIds = (contacts as Pick<ContactRow, 'id' | 'contact_user_id'>[])
    .map((c) => c.contact_user_id)
    .filter((id): id is string => !!id);

  if (contactUserIds.length > 0) {
    await sendPushToUsers(contactUserIds, 'Help Needed', message, {
      alertType: 'need_help',
    });
  }
}

export async function triggerMissedCheckinAlert(
  userId: string,
  scheduledTime: string
): Promise<void> {
  const [{ data: user }, { data: contacts }] = await Promise.all([
    db().from('users').select('full_name').eq('id', userId).maybeSingle(),
    db()
      .from('contacts')
      .select('id, contact_user_id')
      .eq('user_id', userId)
      .eq('notify_on_missed', true),
  ]);

  if (!user || !contacts || contacts.length === 0) return;

  const fullName = (user as Pick<UserRow, 'full_name'>).full_name;
  const message = `${fullName} missed their ${scheduledTime} check-in`;

  const alertDocs = (contacts as Pick<ContactRow, 'id' | 'contact_user_id'>[]).map((c) => ({
    user_id: userId,
    contact_id: c.id,
    alert_type: 'missed_checkin' as const,
    message,
  }));
  const { error } = await db().from('alerts').insert(alertDocs);
  if (error) {
    console.error('Missed-checkin alert insert error:', error);
    return;
  }

  const contactUserIds = (contacts as Pick<ContactRow, 'id' | 'contact_user_id'>[])
    .map((c) => c.contact_user_id)
    .filter((id): id is string => !!id);

  if (contactUserIds.length > 0) {
    await sendPushToUsers(contactUserIds, 'Missed Check-in', message, {
      alertType: 'missed_checkin',
    });
  }
}

const DECLINE_THRESHOLD = 3;
const DECLINE_WINDOW_DAYS = 7;

/**
 * Scan all users for a declining health pattern:
 * 3+ check-ins with "not_great" or "need_help" (physical OR mental)
 * within the last 7 days triggers a decline_pattern alert to contacts
 * with notifyOnDecline enabled.
 */
export async function runDeclinePatternCheck(): Promise<void> {
  const windowStart = new Date(
    Date.now() - DECLINE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: users, error: userErr } = await db()
    .from('users')
    .select('id, full_name');

  if (userErr || !users) {
    console.error('Decline pattern user fetch error:', userErr);
    return;
  }

  for (const user of users as Pick<UserRow, 'id' | 'full_name'>[]) {
    // Count concerning check-ins in the window
    const { count: badCount, error: countErr } = await db()
      .from('checkins')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', windowStart)
      .or(
        'physical_status.in.(not_great,need_help),mental_status.in.(not_great,need_help)'
      );

    if (countErr) {
      console.error('Decline count error:', countErr);
      continue;
    }
    if ((badCount ?? 0) < DECLINE_THRESHOLD) continue;

    // Skip if a recent decline_pattern alert already exists for this user
    const { data: recentAlert } = await db()
      .from('alerts')
      .select('id')
      .eq('user_id', user.id)
      .eq('alert_type', 'decline_pattern')
      .gte('created_at', windowStart)
      .limit(1)
      .maybeSingle();

    if (recentAlert) continue;

    const { data: contacts } = await db()
      .from('contacts')
      .select('id, contact_user_id')
      .eq('user_id', user.id)
      .eq('notify_on_decline', true);

    if (!contacts || contacts.length === 0) continue;

    const message = `${user.full_name} has been feeling unwell frequently over the past week`;

    const alertDocs = (contacts as Pick<ContactRow, 'id' | 'contact_user_id'>[]).map(
      (c) => ({
        user_id: user.id,
        contact_id: c.id,
        alert_type: 'decline_pattern' as const,
        message,
      })
    );
    const { error: insertErr } = await db().from('alerts').insert(alertDocs);
    if (insertErr) {
      console.error('Decline alert insert error:', insertErr);
      continue;
    }

    const contactUserIds = (contacts as Pick<ContactRow, 'id' | 'contact_user_id'>[])
      .map((c) => c.contact_user_id)
      .filter((id): id is string => !!id);

    if (contactUserIds.length > 0) {
      await sendPushToUsers(contactUserIds, 'Health Concern', message, {
        alertType: 'decline_pattern',
      });
    }
  }
}