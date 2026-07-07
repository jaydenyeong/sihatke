import { Router, Response } from 'express';
import { body } from 'express-validator';
import { db } from '../db/supabase';
import { mapCheckin } from '../db/mappers';
import type { CheckinRow, UserRow, SunshineRow } from '../db/types';
import { auth, AuthRequest } from '../middleware/auth';
import { triggerNeedHelpAlert } from '../services/alertService';
import { sendPushToUsers } from '../services/notificationService';
import { treeStateFor } from '../services/treeService';

const router = Router();

const MILESTONE_DAYS = [7, 30, 100];
const MILESTONE_MESSAGES: Record<number, string> = {
  7:   'One whole week of check-ins — keep it up! 🌟',
  30:  'A whole month! Your family is so grateful. 🎉',
  100: '100 days strong — you\'re an inspiration! 💪',
};

function localDateString(tz: string, date: Date): string {
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

async function computeStreak(userId: string, tz: string): Promise<number> {
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

  const todayLocal = localDateString(tz, new Date());
  const yesterdayLocal = localDateString(tz, new Date(Date.now() - 86400000));

  // If neither today nor yesterday has a check-in, streak is 0
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

// POST /api/checkins
router.post(
  '/',
  auth,
  [
    body('physicalStatus').isIn(['great', 'okay', 'not_great', 'need_help']),
    body('mentalStatus').isIn(['great', 'okay', 'not_great', 'need_help']),
    body('note').optional().isString(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const { data, error } = await db()
        .from('checkins')
        .insert({
          user_id: req.userId!,
          physical_status: req.body.physicalStatus,
          mental_status: req.body.mentalStatus,
          note: req.body.note ?? null,
        })
        .select('*')
        .single();

      if (error || !data) {
        console.error('Checkin insert error:', error);
        res.status(500).json({ error: 'Server error' });
        return;
      }

      const userId = req.userId!;

      if (
        req.body.physicalStatus === 'need_help' ||
        req.body.mentalStatus === 'need_help'
      ) {
        triggerNeedHelpAlert(userId).catch((err) =>
          console.error('Alert trigger failed:', err)
        );
      }

      // Fire-and-forget: check for milestone streak
      (async () => {
        try {
          const { data: user } = await db()
            .from('users')
            .select('timezone')
            .eq('id', userId)
            .maybeSingle();
          const tz = (user as Pick<UserRow, 'timezone'> | null)?.timezone || 'UTC';
          const streak = await computeStreak(userId, tz);
          if (MILESTONE_DAYS.includes(streak)) {
            await sendPushToUsers(
              [userId],
              `${streak}-Day Streak! 🎉`,
              MILESTONE_MESSAGES[streak],
              { kind: 'milestone', streak }
            );
          }
        } catch (err) {
          console.error('Milestone check failed:', err);
        }
      })();

      res.status(201).json(mapCheckin(data as CheckinRow));
    } catch (err) {
      console.error('Checkin error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/checkins
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await db()
      .from('checkins')
      .select('*', { count: 'exact' })
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Checkins list error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    const checkins = (data as CheckinRow[]).map(mapCheckin);
    const total = count ?? 0;

    res.json({ checkins, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Checkins list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/checkins/latest
router.get('/latest', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await db()
      .from('checkins')
      .select('*')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Latest checkin error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    res.json(data ? mapCheckin(data as CheckinRow) : null);
  } catch (err) {
    console.error('Latest checkin error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/checkins/stats
// Returns currentStreak, weekDots (7 booleans, oldest→today), totalCheckins
router.get('/stats', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { data: user } = await db()
      .from('users')
      .select('timezone')
      .eq('id', req.userId!)
      .maybeSingle();
    const tz = (user as Pick<UserRow, 'timezone'> | null)?.timezone || 'UTC';

    const windowStart = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: checkins }, { count: total }] = await Promise.all([
      db()
        .from('checkins')
        .select('created_at')
        .eq('user_id', req.userId!)
        .gte('created_at', windowStart),
      db()
        .from('checkins')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.userId!),
    ]);

    const checkinDates = new Set<string>();
    for (const c of (checkins ?? []) as { created_at: string }[]) {
      checkinDates.add(localDateString(tz, new Date(c.created_at)));
    }

    // Week dots: 7 days, index 0 = 6 days ago, index 6 = today
    const weekDots = Array.from({ length: 7 }, (_, i) => {
      const day = localDateString(tz, new Date(Date.now() - (6 - i) * 86400000));
      return checkinDates.has(day);
    });

    // Streak
    const todayLocal = localDateString(tz, new Date());
    const yesterdayLocal = localDateString(tz, new Date(Date.now() - 86400000));
    const startOffset = checkinDates.has(todayLocal) ? 0
      : checkinDates.has(yesterdayLocal) ? 1
      : -1;

    let currentStreak = 0;
    if (startOffset >= 0) {
      for (let i = startOffset; i < 35; i++) {
        const day = localDateString(tz, new Date(Date.now() - i * 86400000));
        if (checkinDates.has(day)) currentStreak++;
        else break;
      }
    }

    const tree = treeStateFor(total ?? 0);

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: sunRows, error: sunErr } = await db()
      .from('sunshines')
      .select('from_user_id, created_at')
      .eq('to_user_id', req.userId!)
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (sunErr) {
      console.error('Stats sunshines error:', sunErr);
    }

    let sunshines: { fromName: string; createdAt: string }[] = [];
    const rows = (sunRows ?? []) as Pick<SunshineRow, 'from_user_id' | 'created_at'>[];
    if (rows.length > 0) {
      const senderIds = [...new Set(rows.map((r) => r.from_user_id))];
      const { data: senders, error: sendersErr } = await db()
        .from('users')
        .select('id, full_name')
        .in('id', senderIds);
      if (sendersErr) {
        console.error('Stats senders error:', sendersErr);
      }
      const nameById = new Map(
        ((senders ?? []) as Pick<UserRow, 'id' | 'full_name'>[]).map((u) => [u.id, u.full_name])
      );
      sunshines = rows.map((r) => ({
        fromName: nameById.get(r.from_user_id) ?? 'Someone',
        createdAt: r.created_at,
      }));
    }

    res.json({
      currentStreak,
      weekDots,
      totalCheckins: total ?? 0,
      treeStage: tree.stage,
      toNextStage: tree.toNextStage,
      fruitCount: tree.fruitCount,
      sunshines,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
