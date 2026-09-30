import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to require authenticated session.
 * Attaches req.user from session.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
}

/**
 * Middleware to attach user info to res.locals from session.
 */
export function attachUser(req: Request, res: Response, next: NextFunction) {
  if (req.session && (req.session as any).userId) {
    res.locals.userId = (req.session as any).userId;
    res.locals.userEmail = (req.session as any).userEmail;
  }
  next();
}
