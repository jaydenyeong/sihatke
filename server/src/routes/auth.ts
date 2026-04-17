import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { User } from '../models';
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

      const existing = await User.findOne({ email });
      if (existing) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }

      const hashed = await bcrypt.hash(password, 12);
      const user = await User.create({ email, password: hashed, fullName });

      const token = jwt.sign({ userId: user._id }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
      });

      res.status(201).json({
        token,
        user: { id: user._id, email: user.email, fullName: user.fullName },
      });
    } catch (err) {
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

      const user = await User.findOne({ email });
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = jwt.sign({ userId: user._id }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
      });

      res.json({
        token,
        user: { id: user._id, email: user.email, fullName: user.fullName },
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/auth/me
router.get('/me', auth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
