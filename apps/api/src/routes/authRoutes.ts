import { Router } from 'express';
import { signup, login, verifyEmail, forgotPassword, resetPassword, getMe } from '../controllers/authController';
import { authenticateToken } from '../core/auth/middleware';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticateToken, getMe);

export default router;
