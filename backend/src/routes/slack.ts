import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import pool from '../config/db';
import axios from 'axios';
import dotenv from 'dotenv';
import { randomBytes, timingSafeEqual } from 'crypto';

dotenv.config();

const router = Router();

/**
 * GET /slack/connect
 * Initiate Slack OAuth flow. Requires user to be logged in.
 */
router.get('/connect', requireAuth, (req: Request, res: Response) => {
  const userId = (req.session as any).userId;

  if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_REDIRECT_URI) {
    return res.status(503).send('Slack OAuth is not configured');
  }
  const state = randomBytes(24).toString('hex');
  (req.session as any).slackConnectState = state;
  (req.session as any).slackConnectUserId = userId;

  const scopes = ['chat:write', 'im:write'].join(',');
  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(process.env.SLACK_CLIENT_ID)}&scope=${scopes}&redirect_uri=${encodeURIComponent(process.env.SLACK_REDIRECT_URI)}&state=${state}`;

  res.redirect(slackAuthUrl);
});

/**
 * GET /slack/callback
 * Slack redirects here after OAuth consent.
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    const sessionState = (req.session as any).slackConnectState;
    const userId = (req.session as any).slackConnectUserId;
    delete (req.session as any).slackConnectState;
    delete (req.session as any).slackConnectUserId;

    if (!code || !state || !sessionState || typeof state !== 'string' ||
        !timingSafeEqual(Buffer.from(state), Buffer.from(sessionState)) || !userId) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack=error`);
    }

    // Exchange code for access token
    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      null,
      {
        params: {
          client_id: process.env.SLACK_CLIENT_ID,
          client_secret: process.env.SLACK_CLIENT_SECRET,
          code,
          redirect_uri: process.env.SLACK_REDIRECT_URI,
        },
      }
    );

    const data = response.data;
    if (!data.ok) {
      console.error('Slack OAuth error:', data.error);
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack=error`);
    }

    // Store Slack access token and team info in user record
    const accessToken = data.access_token;
    const teamId = data.team?.id;
    const slackUserId = data.authed_user?.id || null;
    // Use the bot's default channel or user's default DM channel
    const channelId = data.incoming_webhook?.channel_id || null;

    await pool.query(
      `UPDATE users 
       SET slack_access_token = $1, slack_team_id = $2, slack_channel_id = $3, slack_user_id = $4
       WHERE id = $5`,
      [accessToken, teamId, channelId, slackUserId, userId]
    );

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err) {
    console.error('Slack callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack=error`);
  }
});

/**
 * GET /slack/status
 * Check if current user has Slack connected.
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId;
    const result = await pool.query(
      'SELECT slack_access_token, slack_team_id FROM users WHERE id = $1',
      [userId]
    );
    const user = result.rows[0];
    res.json({
      connected: !!user?.slack_access_token,
      team_id: user?.slack_team_id || null,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check Slack status' });
  }
});

/**
 * POST /slack/disconnect
 * Remove Slack token from user.
 */
router.post('/disconnect', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any).userId;
    await pool.query(
      'UPDATE users SET slack_access_token = NULL, slack_team_id = NULL, slack_channel_id = NULL, slack_user_id = NULL WHERE id = $1',
      [userId]
    );
    res.json({ message: 'Slack disconnected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
});

export default router;
