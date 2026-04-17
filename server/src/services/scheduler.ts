import cron from 'node-cron';
import { User, Checkin } from '../models';
import { sendPushToUsers } from './notificationService';
import { triggerMissedCheckinAlert } from './alertService';

// Window sizes (minutes)
const REMINDER_LEAD_MIN = 0;   // fire at or after scheduled time
const REMINDER_LAG_MAX = 15;   // within 15 min past the scheduled time
const MISSED_THRESHOLD_MIN = 30; // flag missed after 30 min past scheduled time

/**
 * Return the current time in the user's timezone as { h, m }.
 * Uses Intl.DateTimeFormat which works without any tz library.
 */
function nowInTimezone(tz: string): { h: number; m: number; dayKey: string } {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
    return {
      h: parseInt(get('hour'), 10),
      m: parseInt(get('minute'), 10),
      dayKey: `${get('year')}-${get('month')}-${get('day')}`,
    };
  } catch {
    const d = new Date();
    return {
      h: d.getUTCHours(),
      m: d.getUTCMinutes(),
      dayKey: d.toISOString().slice(0, 10),
    };
  }
}

function parseHHMM(s: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
}

function diffMinutes(a: { h: number; m: number }, b: { h: number; m: number }): number {
  return (a.h - b.h) * 60 + (a.m - b.m);
}

/**
 * Check if a check-in exists for this user for the given scheduled time today.
 * We match "today" by the user's timezone day, and "at that time" by looking
 * for any check-in within ±60 min of the scheduled time.
 */
async function hasCheckinForSlot(
  userId: string,
  tz: string,
  slot: { h: number; m: number }
): Promise<boolean> {
  // Build the start/end of today in the user's tz, then find any checkin in that day.
  // Simple approach: fetch today's check-ins for the user and match slot by local time.
  const now = new Date();
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const checkins = await Checkin.find({
    userId,
    createdAt: { $gte: twelveHoursAgo },
  }).select('createdAt').lean();

  for (const c of checkins) {
    const local = nowInTimezoneAt(tz, c.createdAt);
    const diff = Math.abs(diffMinutes(local, slot));
    if (diff <= 60) return true;
  }
  return false;
}

function nowInTimezoneAt(tz: string, date: Date): { h: number; m: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
    return { h: parseInt(get('hour'), 10), m: parseInt(get('minute'), 10) };
  } catch {
    return { h: date.getUTCHours(), m: date.getUTCMinutes() };
  }
}

/**
 * Send a reminder push if the user is within their check-in window
 * and hasn't checked in yet for this slot.
 */
async function runReminderJob(): Promise<void> {
  try {
    const users = await User.find({}).select('_id checkinTimes timezone').lean();
    for (const user of users) {
      const tz = user.timezone || 'UTC';
      const now = nowInTimezone(tz);

      for (const timeStr of user.checkinTimes ?? []) {
        const slot = parseHHMM(timeStr);
        if (!slot) continue;
        const diff = diffMinutes(now, slot);
        if (diff < REMINDER_LEAD_MIN || diff > REMINDER_LAG_MAX) continue;

        const already = await hasCheckinForSlot(user._id.toString(), tz, slot);
        if (already) continue;

        sendPushToUsers(
          [user._id.toString()],
          'Time for your check-in',
          `Tap to do your ${timeStr} check-in.`,
          { kind: 'reminder', time: timeStr }
        ).catch((err) => console.error('Reminder push failed:', err));
      }
    }
  } catch (err) {
    console.error('Reminder job error:', err);
  }
}

/**
 * For any slot that was >= MISSED_THRESHOLD_MIN past its scheduled time today
 * with no check-in, trigger the missed-checkin alert for the user's contacts.
 * We use an in-memory Set to avoid firing the same alert twice per day.
 */
const notifiedMissed = new Set<string>();

async function runMissedJob(): Promise<void> {
  try {
    const users = await User.find({}).select('_id checkinTimes timezone').lean();
    for (const user of users) {
      const tz = user.timezone || 'UTC';
      const now = nowInTimezone(tz);

      for (const timeStr of user.checkinTimes ?? []) {
        const slot = parseHHMM(timeStr);
        if (!slot) continue;
        const diff = diffMinutes(now, slot);
        if (diff < MISSED_THRESHOLD_MIN) continue;
        // Don't flag as missed if too far past (e.g. 5+ hours)
        if (diff > 5 * 60) continue;

        const key = `${user._id.toString()}|${now.dayKey}|${timeStr}`;
        if (notifiedMissed.has(key)) continue;

        const already = await hasCheckinForSlot(user._id.toString(), tz, slot);
        if (already) continue;

        notifiedMissed.add(key);
        triggerMissedCheckinAlert(user._id.toString(), timeStr).catch((err) =>
          console.error('Missed alert failed:', err)
        );
      }
    }

    // Prune old entries (keep last 7 days worth by day key)
    if (notifiedMissed.size > 5000) {
      notifiedMissed.clear();
    }
  } catch (err) {
    console.error('Missed job error:', err);
  }
}

export function startSchedulers(): void {
  // Every 15 minutes
  cron.schedule('*/15 * * * *', runReminderJob);
  // Every hour on the :05
  cron.schedule('5 * * * *', runMissedJob);
  console.log('Schedulers started: reminders (15m), missed check-ins (1h)');
}
