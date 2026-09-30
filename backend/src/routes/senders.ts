import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import pool from '../config/db';
import { createEtherealAccount } from '../services/emailService';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/senders
 * List all senders for the current user.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId;
    const result = await pool.query(
      'SELECT id, email, name, created_at FROM senders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get senders error:', err);
    res.status(500).json({ error: 'Failed to fetch senders' });
  }
});

/**
 * POST /api/senders
 * Create a new Ethereal email sender account.
 * Each sender gets a fresh Ethereal account automatically.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId;

    // Create new Ethereal test account
    const { email, name, smtp_user, smtp_pass } = await createEtherealAccount();

    const result = await pool.query(
      `INSERT INTO senders (user_id, email, name, smtp_user, smtp_pass)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, email) DO NOTHING
       RETURNING id, email, name, created_at`,
      [userId, email, name, smtp_user, smtp_pass]
    );

    if (!result.rows.length) {
      return res.status(409).json({ error: 'Sender already exists' });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create sender error:', err);
    res.status(500).json({ error: 'Failed to create sender' });
  }
});

/**
 * DELETE /api/senders/:id
 * Delete a sender (and its email jobs).
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId;
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM senders WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    res.json({ message: 'Sender deleted' });
  } catch (err) {
    console.error('Delete sender error:', err);
    res.status(500).json({ error: 'Failed to delete sender' });
  }
});

export default router;
