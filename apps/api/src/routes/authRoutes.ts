import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signup, login, verifyEmail, forgotPassword, resetPassword, getMe } from '../controllers/authController';
import { authenticateToken } from '../core/auth/middleware';

const router = Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Intentional, narrow exception to the AppError/errorHandler convention:
  // express-rate-limit invokes this handler directly (not wrapped in
  // asyncHandler, not part of the normal route-handler promise chain), so it
  // must respond to the request itself rather than throw an AppError.
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
  },
});

router.post('/signup', authRateLimiter, signup);
router.post('/login', authRateLimiter, login);
router.post('/verify-email', authRateLimiter, verifyEmail);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);
router.get('/me', authenticateToken, getMe);

export default router;
