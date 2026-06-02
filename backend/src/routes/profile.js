import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.userId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const [profiles] = await pool.query(
      'SELECT * FROM profiles WHERE user_id = ?',
      [req.userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profiles[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update profile
router.patch('/me', authenticate, [
  body('full_name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('date_of_birth').optional().isISO8601(),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('grade_level').optional().isInt({ min: 1, max: 12 }),
  body('stream').optional().isIn(['Science', 'Arts', 'Commerce', 'natural', 'social', null]),
  body('section').optional().isIn(['oromo', 'amharic', 'somali', null])
], async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { full_name, phone, address, date_of_birth, gender, grade_level, stream, section } = req.body;
    
    await connection.beginTransaction();
    
    // Update profiles table
    const profileUpdates = {};
    if (full_name !== undefined) profileUpdates.full_name = full_name;
    if (phone !== undefined) profileUpdates.phone = phone;
    if (address !== undefined) profileUpdates.address = address;
    if (date_of_birth !== undefined) profileUpdates.date_of_birth = date_of_birth;
    if (gender !== undefined) profileUpdates.gender = gender;

    if (Object.keys(profileUpdates).length > 0) {
      const setClause = Object.keys(profileUpdates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(profileUpdates), req.userId];
      await connection.query(
        `UPDATE profiles SET ${setClause} WHERE user_id = ?`,
        values
      );
    }

    // Update student_profiles table if grade_level, stream, or section is provided
    if (grade_level !== undefined || stream !== undefined || section !== undefined) {
      const studentUpdates = {};
      if (grade_level !== undefined) studentUpdates.grade_level = grade_level;
      if (stream !== undefined) studentUpdates.stream = stream;
      if (section !== undefined) studentUpdates.section = section;

      if (Object.keys(studentUpdates).length > 0) {
        const setClause = Object.keys(studentUpdates).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(studentUpdates), req.userId];
        await connection.query(
          `UPDATE student_profiles SET ${setClause} WHERE user_id = ?`,
          values
        );
      }
    }

    await connection.commit();
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  } finally {
    connection.release();
  }
});

// Upload profile image
router.post('/me/image', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Get old image path to delete it
    const [profiles] = await pool.query(
      'SELECT profile_image FROM profiles WHERE user_id = ?',
      [req.userId]
    );

    const oldImage = profiles[0]?.profile_image;

    // Update database with new image path
    const imagePath = `/uploads/profiles/${req.file.filename}`;
    await pool.query(
      'UPDATE profiles SET profile_image = ? WHERE user_id = ?',
      [imagePath, req.userId]
    );

    // Delete old image file if it exists
    if (oldImage) {
      const oldImagePath = path.join(process.cwd(), oldImage.replace(/^\//, ''));
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    res.json({ 
      message: 'Profile image uploaded successfully',
      imagePath 
    });
  } catch (error) {
    console.error('Upload image error:', error);
    // Delete uploaded file if database update fails
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Delete profile image
router.delete('/me/image', authenticate, async (req, res) => {
  try {
    // Get current image path
    const [profiles] = await pool.query(
      'SELECT profile_image FROM profiles WHERE user_id = ?',
      [req.userId]
    );

    const imagePath = profiles[0]?.profile_image;

    if (!imagePath) {
      return res.status(404).json({ error: 'No profile image to delete' });
    }

    // Update database
    await pool.query(
      'UPDATE profiles SET profile_image = NULL WHERE user_id = ?',
      [req.userId]
    );

    // Delete file
    const fullPath = path.join(process.cwd(), imagePath.replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    res.json({ message: 'Profile image deleted successfully' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Change password
router.post('/me/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get current password hash
    const [users] = await pool.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and update new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, req.userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Change username (admin, registrar, director only)
router.post('/me/change-username', authenticate, [
  body('newUsername').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user has permission
    const [roles] = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = ?',
      [req.userId]
    );

    const userRole = roles[0]?.role;
    if (!['admin', 'registrar', 'director'].includes(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to change username' });
    }

    const { newUsername } = req.body;

    // Check if username already exists
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [newUsername, req.userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Update username
    await pool.query(
      'UPDATE users SET username = ? WHERE id = ?',
      [newUsername, req.userId]
    );

    // Update credentials log if exists
    await pool.query(
      'UPDATE credentials_log SET username = ? WHERE user_id = ?',
      [newUsername, req.userId]
    );

    res.json({ message: 'Username changed successfully', newUsername });
  } catch (error) {
    console.error('Change username error:', error);
    res.status(500).json({ error: 'Failed to change username' });
  }
});

export default router;
