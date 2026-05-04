import { Router, Response } from 'express';
import { body } from 'express-validator';
import { db } from '../db/supabase';
import { mapUser } from '../db/mappers';
import type { UserRow } from '../db/types';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

// camelCase API field -> snake_case column
const FIELD_MAP: Record<string, string> = {
  fullName: 'full_name',
  avatarUrl: 'avatar_url',
  dateOfBirth: 'date_of_birth',
  checkinTimes: 'checkin_times',
  checkinFrequency: 'checkin_frequency',
  timezone: 'timezone',
};

// GET /api/profile
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await db()
      .from('users')
      .select('*')
      .eq('id', req.userId!)
      .maybeSingle();

    if (error) {
      console.error('Profile get error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(mapUser(data as UserRow));
  } catch (err) {
    console.error('Profile get error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/profile
router.put(
  '/',
  auth,
  [
    body('fullName').optional().trim().notEmpty(),
    body('checkinTimes').optional().isArray(),
    body('checkinFrequency').optional().isInt({ min: 1, max: 5 }),
    body('timezone').optional().isString(),
    body('dateOfBirth').optional().isISO8601(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const updates: Record<string, unknown> = {};
      for (const [apiKey, dbKey] of Object.entries(FIELD_MAP)) {
        if (req.body[apiKey] !== undefined) {
          updates[dbKey] = req.body[apiKey];
        }
      }

      if (Object.keys(updates).length === 0) {
        // Nothing to update — just return the current row.
        const { data } = await db()
          .from('users')
          .select('*')
          .eq('id', req.userId!)
          .maybeSingle();
        if (!data) {
          res.status(404).json({ error: 'User not found' });
          return;
        }
        res.json(mapUser(data as UserRow));
        return;
      }

      const { data, error } = await db()
        .from('users')
        .update(updates)
        .eq('id', req.userId!)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Server error' });
        return;
      }
      if (!data) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(mapUser(data as UserRow));
    } catch (err) {
      console.error('Profile update error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;