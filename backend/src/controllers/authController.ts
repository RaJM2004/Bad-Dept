import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { getOauth2Client } from '../config/google';
import { google } from 'googleapis';

// Generate JWT Token
const generateToken = (userId: string, email: string, role: string) => {
  const secret = process.env.JWT_SECRET || 'fallback-secret-key-for-jwt';
  return jwt.sign({ id: userId, email, role }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

export const googleLogin = async (req: Request, res: Response) => {
  const { code, developerEmail, developerRole } = req.body;

  // Developer Bypass Mode (for local testing without OAuth setup)
  if (developerEmail) {
    try {
      let user = await User.findOne({ email: developerEmail });
      if (!user) {
        user = await User.create({
          name: developerEmail.split('@')[0],
          email: developerEmail,
          role: developerRole || 'Collection Officer',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
        });
      } else if (developerRole) {
        user.role = developerRole;
        await user.save();
      }

      const token = generateToken(user.id, user.email, user.role);
      return res.status(200).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      });
    } catch (error) {
      console.error('Developer login error:', error);
      return res.status(500).json({ message: 'Developer login failed' });
    }
  }

  if (!code) {
    return res.status(400).json({ message: 'Google Auth code is required' });
  }

  try {
    const oauth2Client = getOauth2Client();
    
    // Exchange auth code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user profile
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      return res.status(400).json({ message: 'Google account does not have an email' });
    }

    // Check if user exists, otherwise create
    let user = await User.findOne({ email: profile.email });
    
    if (!user) {
      // First user is Admin, others are Collection Officers (or use domain rules)
      const count = await User.countDocuments();
      const role = count === 0 ? 'Admin' : 'Collection Officer';

      user = new User({
        name: profile.name || profile.email.split('@')[0],
        email: profile.email,
        googleId: profile.id,
        avatar: profile.picture,
        role,
      });
    }

    // Save/Update tokens
    user.accessToken = tokens.access_token || undefined;
    if (tokens.refresh_token) {
      user.refreshToken = tokens.refresh_token;
    }
    await user.save();

    // Generate JWT
    const token = generateToken(user.id, user.email, user.role);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        hasGoogleIntegration: !!user.accessToken,
      },
    });
  } catch (error) {
    console.error('Google login error:', error);
    return res.status(500).json({ message: 'Google authentication failed', error: (error as Error).message });
  }
};

// Local login for standard users (optional helper)
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Developer bypass/simple login
    // Since we don't store plain passwords in Google OAuth, we'll allow standard password if configured,
    // otherwise verify using default password "admin123" for testing or return error
    if (password === 'admin123' || password === 'officer123') {
      const token = generateToken(user.id, user.email, user.role);
      return res.status(200).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      });
    }

    return res.status(400).json({ message: 'Invalid credentials or login method' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Logout User
export const logout = async (req: Request, res: Response) => {
  // Client side handles deleting the token, but we can do any backend cleanup here if needed.
  return res.status(200).json({ message: 'Logged out successfully' });
};

// Get current profile
export const getProfile = async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user.id).select('-accessToken -refreshToken');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
