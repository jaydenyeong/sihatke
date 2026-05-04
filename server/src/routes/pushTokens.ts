import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../db/supabase';
import { mapPushToken } from '../db/mappers';
import type { PushTokenRow } from '../db/types';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/push-tokens
router.post(
  '/',
  auth,
  [body('token').notEmpty(), body('platform').isIn(['ios', 'android'])],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      // Token has UNIQUE constraint, so upsert by token works idempotently.
      const { data, error } = await db()
        .from('push_tokens')
        .upsert(
          {
            user_id: req.userId!,
            token: req.body.token,
            platform: req.body.platform,
          },
          { onConflict: 'token' }
        )
        .select('*')
        .single();

      if (error || !data) {
        console.error('Push token upsert error:', error);
        res.status(500).json({ error: 'Server error' });
        return;
      }

      res.json(mapPushToken(data as PushTokenRow));
    } catch (err) {
      console.error('Push token error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;