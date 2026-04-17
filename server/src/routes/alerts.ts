import { Router, Response } from 'express';
import { Alert } from '../models';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/alerts
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const alerts = await Alert.find({ userId: req.userId })
      .populate('contactId', 'name relationship')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/alerts/:id
router.put('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['seen', 'responded'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { status },
      { new: true }
    );
    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
