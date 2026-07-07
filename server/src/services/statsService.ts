import { db } from '../db/supabase';

export function localDateString(tz: string, date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Consecutive-day streak ending today or yesterday, given local date strings. */
export function streakFromDates(checkinDates: Set<string>, tz: string): number {
  const todayLocal = localDateString(tz, new Date());
  const yesterdayLocal = localDateString(tz, new Date(Date.now() - 86400000));
  const startOffset = checkinDates.has(todayLocal) ? 0
    : checkinDates.has(yesterdayLocal) ? 1
    : -1;
  if (startOffset < 0) return 0;

  let streak = 0;
  for (let i = startOffset; i < 35; i++) {
    const day = localDateString(tz, new Date(Date.now() - i * 86400000));
    if (checkinDates.has(day)) streak++;
    else break;
  }
  return streak;
}

export async function computeStreak(userId: string, tz: string): Promise<number> {
  const windowStart = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db()
    .from('checkins')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', windowStart);

  const checkinDates = new Set<string>();
  for (const c of (data ?? []) as { created_at: string }[]) {
    checkinDates.add(localDateString(tz, new Date(c.created_at)));
  }
  return streakFromDates(checkinDates, tz);
}
