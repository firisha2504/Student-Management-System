import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Login
router.post('/login', [
  body('username').notEmpty().trim(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Check system lock
    const [settings] = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'system_locked'"
    );
    
    if (settings[0]?.setting_value === 'true') {
      return res.status(403).json({ error: 'System is currently locked by administrator' });
    }

    // Get user by username
    const [users] = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check if user is active
    const [profiles] = await pool.query(
      'SELECT is_active FROM profiles WHERE user_id = ?',
      [user.id]
    );

    if (profiles[0] && !profiles[0].is_active) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact your administrator.' });
    }

    // Get user role
    const [roles] = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = ?',
      [user.id]
    );

    // Generate token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: roles[0]?.role || null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const [profiles] = await pool.query(`
      SELECT 
        p.*,
        u.username,
        sp.admission_number,
        sp.grade_level,
        sp.stream,
        sp.section,
        sp.sub_section
      FROM profiles p
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN student_profiles sp ON p.user_id = sp.user_id
      WHERE p.user_id = ?
    `, [req.userId]);

    const [roles] = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = ?',
      [req.userId]
    );

    const profile = profiles[0] || null;
    
    // Add full URL for profile image if it exists
    if (profile && profile.profile_image) {
      profile.profile_image = `http://localhost:${process.env.PORT || 5000}${profile.profile_image}`;
    }

    // Add id_number field: 
    // - For students: use admission_number
    // - For staff: use staff_id
    // - Fallback: use username
    const user = {
      ...req.user,
      id_number: profile?.admission_number || profile?.staff_id || req.user.username
    };

    res.json({
      user,
      profile,
      role: roles[0]?.role || null
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Logout (client-side token removal, but we can log it)
router.post('/logout', authenticate, async (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
