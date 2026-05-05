import { Router, Response } from 'express';
import { db } from '../db/supabase';
import { mapCheckin } from '../db/mappers';
import type { CheckinRow, UserRow } from '../db/types';
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

export default router;
