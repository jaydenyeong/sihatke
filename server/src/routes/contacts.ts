import { Router, Response } from 'express';
import { body } from 'express-validator';
import { db } from '../db/supabase';
import { mapContact } from '../db/mappers';
import type { ContactRow, UserRow } from '../db/types';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

const FIELD_MAP: Record<string, string> = {
  name: 'name',
  phone: 'phone',
  email: 'email',
  relationship: 'relationship',
  notifyOnHelp: 'notify_on_help',
  notifyOnMissed: 'notify_on_missed',
  notifyOnDecline: 'notify_on_decline',
  isEmergency: 'is_emergency',
  sortOrder: 'sort_order',
};

/**
 * If a non-empty email is provided and matches a registered Sihaty user
 * (other than the current user), return that user's id. Otherwise null.
 */
async function lookupContactUserId(
  email: string | undefined,
  selfId: string
): Promise<string | null> {
  if (!email) return null;
  const { data } = await db()
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .neq('id', selfId)
    .maybeSingle();
  return data ? (data as Pick<UserRow, 'id'>).id : null;
}

// GET /api/contacts
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await db()
      .from('contacts')
      .select('*')
      .eq('user_id', req.userId!)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Contacts list error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    res.json((data as ContactRow[]).map(mapContact));
  } catch (err) {
    console.error('Contacts list error:', err);
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
      const contactUserId = await lookupContactUserId(req.body.email, req.userId!);

      // Get the next sort_order for this user (new contacts go to the bottom)
      const { data: maxRow } = await db()
        .from('contacts')
        .select('sort_order')
        .eq('user_id', req.userId!)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSortOrder = maxRow
        ? (maxRow as { sort_order: number }).sort_order + 1
        : 0;

      const insert: Record<string, unknown> = {
        user_id: req.userId!,
        name: req.body.name,
        contact_user_id: contactUserId,
        sort_order: nextSortOrder,
      };
      if (req.body.phone !== undefined) insert.phone = req.body.phone;
      if (req.body.email !== undefined) insert.email = req.body.email;
      if (req.body.relationship !== undefined) insert.relationship = req.body.relationship;
      if (req.body.isEmergency !== undefined) insert.is_emergency = req.body.isEmergency;
      if (req.body.notifyOnHelp !== undefined) insert.notify_on_help = req.body.notifyOnHelp;
      if (req.body.notifyOnMissed !== undefined) insert.notify_on_missed = req.body.notifyOnMissed;
      if (req.body.notifyOnDecline !== undefined) insert.notify_on_decline = req.body.notifyOnDecline;

      const { data, error } = await db()
        .from('contacts')
        .insert(insert)
        .select('*')
        .single();

      if (error || !data) {
        console.error('Contact insert error:', error);
        res.status(500).json({ error: 'Server error' });
        return;
      }

      res.status(201).json(mapContact(data as ContactRow));
    } catch (err) {
      console.error('Contact insert error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /api/contacts/:id
router.put('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const updates: Record<string, unknown> = {};
    for (const [apiKey, dbKey] of Object.entries(FIELD_MAP)) {
      if (req.body[apiKey] !== undefined) updates[dbKey] = req.body[apiKey];
    }

    // Re-resolve contact_user_id whenever email changes
    if (req.body.email !== undefined) {
      updates.contact_user_id = await lookupContactUserId(req.body.email, req.userId!);
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No updatable fields' });
      return;
    }

    const { data, error } = await db()
      .from('contacts')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.userId!)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Contact update error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    res.json(mapContact(data as ContactRow));
  } catch (err) {
    console.error('Contact update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await db()
      .from('contacts')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId!)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Contact delete error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    res.json({ message: 'Contact removed' });
  } catch (err) {
    console.error('Contact delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
