import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PushToken } from '../models';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/push-tokens
router.post(
  '/',
  auth,
  [
    body('token').notEmpty(),
    body('platform').isIn(['ios', 'android']),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const doc = await PushToken.findOneAndUpdate(
        { userId: req.userId, token: req.body.token },
        {
          userId: req.userId,
          token: req.body.token,
          platform: req.body.platform,
        },
        { upsert: true, new: true }
      );
      res.json(doc);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;
