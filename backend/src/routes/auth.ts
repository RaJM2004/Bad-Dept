import { Router } from 'express';
import { googleLogin, login, logout, getProfile } from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// @route   POST /auth/google
// @desc    Authenticate with Google OAuth code
router.post('/google', googleLogin);

// @route   POST /auth/login
// @desc    Developer standard local login
router.post('/login', login);

// @route   POST /auth/logout
// @desc    Logout user
router.post('/logout', logout);

// @route   GET /auth/profile
// @desc    Get authenticated user profile
router.get('/profile', authenticateJWT as any, getProfile);

export default router;
