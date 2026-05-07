import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { db } from '../db/supabase';
import { mapUser } from '../db/mappers';
import type { UserRow } from '../db/types';
import { config } from '../config/env';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

const validate = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
};

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('fullName').trim().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    try {
      const { email, password, fullName } = req.body;

      const { data: existing } = await db()
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existing) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const { data, error } = await db()
        .from('users')
        .insert({ email, password_hash: passwordHash, full_name: fullName })
        .select('*')
        .single();

      if (error || !data) {
        console.error('Register insert error:', error);
        res.status(500).json({ error: 'Server error' });
        return;
      }

      const user = data as UserRow;
      const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
      });

      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, fullName: user.full_name },
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req: Request, res: Response) => {
    if (!validate(req, res)) return;

    try {
      const { email, password } = req.body;

      const { data, error } = await db()
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('Login lookup error:', error);
        res.status(500).json({ error: 'Server error' });
        return;
      }

      const user = data as UserRow | null;
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
      });

      res.json({
        token,
        user: { id: user.id, email: user.email, fullName: user.full_name },
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/auth/me
router.get('/me', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await db()
      .from('users')
      .select('*')
      .eq('id', req.userId!)
      .maybeSingle();

    if (error) {
      console.error('Me lookup error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(mapUser(data as UserRow));
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/auth/account
// Permanently deletes the authenticated user and all their data.
// ON DELETE CASCADE in the schema handles checkins, contacts, alerts, push_tokens.
router.delete('/account', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { error } = await db()
      .from('users')
      .delete()
      .eq('id', req.userId!);

    if (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;