import { Router, Response } from 'express';
import { body } from 'express-validator';
import { Checkin } from '../models';
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
      const checkin = await Checkin.create({
        userId: req.userId,
        physicalStatus: req.body.physicalStatus,
        mentalStatus: req.body.mentalStatus,
        note: req.body.note,
      });

      if (
        req.body.physicalStatus === 'need_help' ||
        req.body.mentalStatus === 'need_help'
      ) {
        triggerNeedHelpAlert(req.userId!).catch((err) =>
          console.error('Alert trigger failed:', err)
        );
      }

      res.status(201).json(checkin);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/checkins
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const checkins = await Checkin.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Checkin.countDocuments({ userId: req.userId });

    res.json({ checkins, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/checkins/latest
router.get('/latest', auth, async (req: AuthRequest, res: Response) => {
  try {
    const checkin = await Checkin.findOne({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(checkin);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
