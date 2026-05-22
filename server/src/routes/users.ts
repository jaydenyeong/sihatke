import { Router, Response } from 'express';
import { db } from '../db/supabase';
import type { UserRow } from '../db/types';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/users/lookup?email=
// Returns { id, fullName } if a registered user exists with that email,
// excluding the requesting user. Used by the contact form to verify
// that an email belongs to a Sihaty account before adding them.
router.get('/lookup', auth, async (req: AuthRequest, res: Response) => {
  const email = (req.query.email as string | undefined)?.toLowerCase().trim();
  if (!email) {
    res.status(400).json({ error: 'email query param required' });
    return;
  }

  try {
    const { data, error } = await db()
      .from('users')
      .select('id, full_name')
      .eq('email', email)
      .neq('id', req.userId!)
      .maybeSingle();

    if (error) {
      console.error('User lookup error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'No Sihaty account found with this email' });
      return;
    }

    const user = data as Pick<UserRow, 'id' | 'full_name'>;
    res.json({ id: user.id, fullName: user.full_name });
  } catch (err) {
    console.error('User lookup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
