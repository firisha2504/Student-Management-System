import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateUserId } from '../utils/idGenerator.js';

const router = express.Router();

// Get all users (admin, registrar, director)
router.get('/', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT 
        u.id as user_id, u.username, u.email, u.created_at,
        p.full_name, p.phone, p.is_active,
        r.role,
        sp.grade_level, sp.stream
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN user_roles r ON u.id = r.user_id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      ORDER BY u.created_at DESC
    `);

    // Format username as id_number for compatibility
    const formattedUsers = users.map(user => ({
      ...user,
      id_number: user.username
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user (admin/registrar)
router.post('/', authenticate, authorize('admin', 'registrar'), [
  body('email').isEmail().normalizeEmail(),
  body('full_name').notEmpty().trim(),
  body('role').isIn(['student', 'teacher', 'admin', 'registrar', 'director', 'parent'])
], async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, full_name, role, phone, address } = req.body;

    await connection.beginTransaction();

    // Generate ID based on role (e.g., MJ001, MJT001)
    const generatedId = await generateUserId(role);
    
    // Generate username as firstname.lastname.id
    const nameParts = full_name.trim().toLowerCase().split(/\s+/);
    const username = nameParts.join('.') + '.' + generatedId;
    
    // Generate password as pass + ID (e.g., passMJ001)
    const password = 'pass' + generatedId;
    
    // Check if username already exists
    const [existingUser] = await connection.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    
    if (existingUser.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await connection.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    const userId = userResult.insertId;

    // Create role
    await connection.query(
      'INSERT INTO user_roles (user_id, role) VALUES (?, ?)',
      [userId, role]
    );

    // Create profile
    await connection.query(
      'INSERT INTO profiles (user_id, full_name, phone, address) VALUES (?, ?, ?, ?)',
      [userId, full_name, phone || null, address || null]
    );

    // Create student_profiles record if role is student
    if (role === 'student') {
      const admissionNumber = generatedId; // Use the generated ID (e.g., MJ001)
      const enrollmentDate = new Date().toISOString().split('T')[0];
      
      await connection.query(
        'INSERT INTO student_profiles (user_id, admission_number, enrollment_date) VALUES (?, ?, ?)',
        [userId, admissionNumber, enrollmentDate] // No default grade - student must set it
      );
    }

    // Log credentials for admin reference
    await connection.query(
      'INSERT INTO credentials_log (user_id, full_name, username, password, role) VALUES (?, ?, ?, ?, ?)',
      [userId, full_name, username, password, role]
    );

    await connection.commit();

    res.status(201).json({
      message: 'User created successfully',
      userId,
      username,
      credentials: {
        username,
        password // Return password so admin can give it to user
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create user error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create user' });
  } finally {
    connection.release();
  }
});

// Update user status (activate/deactivate)
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    await pool.query(
      'UPDATE profiles SET is_active = ? WHERE user_id = ?',
      [is_active, id]
    );

    res.json({ message: 'User status updated successfully' });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Delete user
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;


// Get credentials log (admin only)
router.get('/credentials-log', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [credentials] = await pool.query(`
      SELECT 
        cl.id,
        cl.user_id,
        cl.full_name,
        cl.username,
        cl.password,
        cl.role,
        cl.created_at
      FROM credentials_log cl
      ORDER BY cl.created_at DESC
    `);

    res.json(credentials);
  } catch (error) {
    console.error('Get credentials log error:', error);
    res.status(500).json({ error: 'Failed to fetch credentials log' });
  }
});
