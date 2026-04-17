import { Router, Response } from 'express';
import { body } from 'express-validator';
import { Contact } from '../models';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/contacts
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const contacts = await Contact.find({ userId: req.userId });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/contacts
router.post(
  '/',
  auth,
  [
    body('name').trim().notEmpty(),
    body('phone').optional().isString(),
    body('email').optional().isEmail(),
    body('relationship').optional().isString(),
    body('isEmergency').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const contact = await Contact.create({
        userId: req.userId,
        name: req.body.name,
        phone: req.body.phone,
        email: req.body.email,
        relationship: req.body.relationship,
        isEmergency: req.body.isEmergency,
      });
      res.status(201).json(contact);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /api/contacts/:id
router.put('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.json(contact);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const contact = await Contact.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }
    res.json({ message: 'Contact removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
