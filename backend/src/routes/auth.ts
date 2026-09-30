import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import pool from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const oauthClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

/**
 * A fixed pool of animal avatars (DiceBear adventurer-neutral style).
 * One is randomly assigned the first time a user signs up.
 * Returning users keep whichever avatar they were assigned.
 */
const ANIMAL_AVATARS = [
  'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Fox&backgroundColor=b6e3f4',
  'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Bear&backgroundColor=ffd5dc',
  'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Wolf&backgroundColor=d1f4d1',
  'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Rabbit&backgroundColor=fde7a0',
  'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Panda&backgroundColor=e8d5f4',
  'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Tiger&backgroundColor=fff3cd',
];

function randomAnimalAvatar(): string {
  return ANIMAL_AVATARS[Math.floor(Math.random() * ANIMAL_AVATARS.length)];
}

/**
 * Step 1: Redirect user to Google OAuth consent screen
 */
router.get('/google', (req: Request, res: Response) => {
  const authUrl = oauthClient.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  });
  res.redirect(authUrl);
});

/**
 * Step 2: Google redirects back here with `code`
 * Exchange code for tokens, get user info, upsert in DB, create session
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
    }

    // Exchange code for tokens
    const { tokens } = await oauthClient.getToken(code as string);
    oauthClient.setCredentials(tokens);

    // Decode the ID token to get user info
    const ticket = await oauthClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_token`);
    }

    const { sub: googleId, email, name } = payload;

    // Pick a random animal avatar for new users.
    // ON CONFLICT: only update name/email — avatar is intentionally kept as-is
    // so the assigned animal avatar persists across logins.
    const animalAvatar = randomAnimalAvatar();
    const result = await pool.query(
      `INSERT INTO users (google_id, email, name, avatar)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id) DO UPDATE
       SET email = EXCLUDED.email,
           name = EXCLUDED.name
       RETURNING *`,
      [googleId, email, name, animalAvatar]
    );
    const user = result.rows[0];

    // Store user in session
    (req.session as any).userId = user.id;
    (req.session as any).userEmail = user.email;
    (req.session as any).userName = user.name;
    (req.session as any).userAvatar = user.avatar;

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
});

/**
 * Get current session user info
 */
router.get('/me', (req: Request, res: Response) => {
  const session = req.session as any;
  if (!session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    id: session.userId,
    email: session.userEmail,
    name: session.userName,
    avatar: session.userAvatar,
  });
});

/**
 * Logout - destroy session
 */
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

export default router;
