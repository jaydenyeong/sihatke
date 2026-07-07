import { Router, Response } from 'express';
import { db } from '../db/supabase';
import { mapCheckin } from '../db/mappers';
import type { CheckinRow, SunshineRow, UserRow } from '../db/types';
import { canSendSunshine, nextAllowedAt } from '../services/treeService';
import { sendPushToUsers } from '../services/notificationService';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/circle
 *
 * Returns the list of users who have added the current user as a contact
 * (i.e. users this user is a "receiver" for), along with each sender's
 * latest check-in so the receiver can see their status at a glance.
 */
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    // 1. Find all contacts where contact_user_id = me (I am someone's receiver)
    const { data: links, error: linksErr } = await db()
      .from('contacts')
      .select('user_id')
      .eq('contact_user_id', req.userId!);

    if (linksErr) {
      console.error('Circle links error:', linksErr);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    if (!links || links.length === 0) {
      res.json([]);
      return;
    }

    // Deduplicate sender IDs (a user may have added me as multiple contact entries)
    const senderIds = [...new Set((links as { user_id: string }[]).map((l) => l.user_id))];

    // 2. Fetch sender profiles
    const { data: users, error: usersErr } = await db()
      .from('users')
      .select('id, full_name')
      .in('id', senderIds);

    if (usersErr || !users) {
      console.error('Circle users error:', usersErr);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    // 3. Fetch latest check-in for each sender
    const results = await Promise.all(
      (users as Pick<UserRow, 'id' | 'full_name'>[]).map(async (user) => {
        const { data: checkin } = await db()
          .from('checkins')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          _id: user.id,
          fullName: user.full_name,
          latestCheckin: checkin ? mapCheckin(checkin as CheckinRow) : null,
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error('Circle error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/circle/:userId/sunshine
 * Send a sunshine reaction to a sender I watch. The sender must have
 * added me as an active contact. Max one per sender→recipient per 20h.
 */
router.post('/:userId/sunshine', auth, async (req: AuthRequest, res: Response) => {
  try {
    const toUserId = req.params.userId as string;

    const { data: link, error: linkErr } = await db()
      .from('contacts')
      .select('id')
      .eq('user_id', toUserId)
      .eq('contact_user_id', req.userId!)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (linkErr) {
      console.error('Sunshine contact lookup error:', linkErr);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    if (!link) {
      res.status(404).json({ error: 'This person is not in your circle' });
      return;
    }

    const { data: last, error: lastErr } = await db()
      .from('sunshines')
      .select('created_at')
      .eq('from_user_id', req.userId!)
      .eq('to_user_id', toUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      console.error('Sunshine cooldown lookup error:', lastErr);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    const lastSentAt = (last as Pick<SunshineRow, 'created_at'> | null)?.created_at ?? null;
    if (!canSendSunshine(lastSentAt)) {
      res.status(409).json({
        error: 'You already sent sunshine recently',
        nextAllowedAt: nextAllowedAt(lastSentAt!),
      });
      return;
    }

    const { error } = await db()
      .from('sunshines')
      .insert({ from_user_id: req.userId!, to_user_id: toUserId });

    if (error) {
      console.error('Sunshine insert error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    // Fire-and-forget push to the recipient
    (async () => {
      try {
        const { data: me } = await db()
          .from('users')
          .select('full_name')
          .eq('id', req.userId!)
          .maybeSingle();
        const firstName =
          ((me as Pick<UserRow, 'full_name'> | null)?.full_name ?? 'Someone').split(' ')[0];
        await sendPushToUsers(
          [toUserId],
          'Sunshine for you ☀️',
          `${firstName} sent you sunshine ☀️`,
          { kind: 'sunshine' }
        );
      } catch (err) {
        console.error('Sunshine push failed:', err);
      }
    })();

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Sunshine error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
