import { Router, Response } from 'express';
import { body } from 'express-validator';
import { User } from '../models';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/profile
router.get('/', auth, async (req: AuthRequest, res: Response) => {
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
      const allowed = ['fullName', 'checkinTimes', 'checkinFrequency', 'timezone', 'dateOfBirth', 'avatarUrl'];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }

      const user = await User.findByIdAndUpdate(req.userId, updates, {
        new: true,
        runValidators: true,
      }).select('-password');

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;
