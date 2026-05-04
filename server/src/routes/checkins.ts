import { Router, Response } from 'express';
import { body } from 'express-validator';
import { db } from '../db/supabase';
import { mapCheckin } from '../db/mappers';
import type { CheckinRow } from '../db/types';
import { auth, AuthRequest } from '../middleware/auth';
import { triggerNeedHelpAlert } from '../services/alertService';

const router = Router();

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

      if (
        req.body.physicalStatus === 'need_help' ||
        req.body.mentalStatus === 'need_help'
      ) {
        triggerNeedHelpAlert(req.userId!).catch((err) =>
          console.error('Alert trigger failed:', err)
        );
      }

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

export default router;