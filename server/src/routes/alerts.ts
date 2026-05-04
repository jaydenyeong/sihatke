import { Router, Response } from 'express';
import { db } from '../db/supabase';
import { mapAlert } from '../db/mappers';
import type { AlertRow } from '../db/types';
import { auth, AuthRequest } from '../middleware/auth';

const router = Router();

// Supabase nested-select shape for the joined contact.
interface AlertWithContact extends AlertRow {
  contact: { id: string; name: string; relationship: string | null } | null;
}

// GET /api/alerts
router.get('/', auth, async (req: AuthRequest, res: Response) => {
  try {
    const { data, error } = await db()
      .from('alerts')
      .select('*, contact:contacts(id, name, relationship)')
      .eq('user_id', req.userId!)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Alerts list error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    res.json((data as AlertWithContact[]).map(mapAlert));
  } catch (err) {
    console.error('Alerts list error:', err);
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

    const { data, error } = await db()
      .from('alerts')
      .update({ status })
      .eq('id', req.params.id)
      .eq('user_id', req.userId!)
      .select('*, contact:contacts(id, name, relationship)')
      .maybeSingle();

    if (error) {
      console.error('Alert update error:', error);
      res.status(500).json({ error: 'Server error' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    res.json(mapAlert(data as AlertWithContact));
  } catch (err) {
    console.error('Alert update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;