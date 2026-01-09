/**
 * Authentication Middleware
 * Validates Clerk JWT tokens and extracts userId
 */

import { clerkMiddleware, requireAuth } from '@clerk/express';

/**
 * Middleware to require authentication
 * Extracts userId from Clerk session and attaches to req.auth.userId
 */
export const requireAuthMiddleware = requireAuth({
  // Clerk will automatically validate the token
  // and attach user info to req.auth
});

/**
 * Helper to get userId from request
 * Use this after requireAuthMiddleware
 */
export const getUserId = (req) => {
  if (!req.auth || !req.auth.userId) {
    throw new Error('User not authenticated');
  }
  return req.auth.userId;
};

/**
 * Optional: Create a wrapper that adds userId to req object
 */
export const authMiddleware = (req, res, next) => {
  // requireAuthMiddleware already validates and adds req.auth
  // This is just a convenience wrapper
  try {
    if (!req.auth || !req.auth.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // Attach userId directly to req for convenience
    req.userId = req.auth.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};
