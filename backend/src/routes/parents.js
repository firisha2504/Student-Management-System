import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get all parents
router.get('/', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const [parents] = await pool.query(`
      SELECT 
        u.id as user_id,
        p.full_name,
        u.username,
        u.email
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN user_roles r ON u.id = r.user_id
      WHERE r.role = 'parent' AND p.is_active = TRUE
      ORDER BY p.full_name
    `);

    res.json(parents);
  } catch (error) {
    console.error('Get parents error:', error);
    res.status(500).json({ error: 'Failed to fetch parents' });
  }
});

// Get linked parents for a student
router.get('/student/:studentId', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const { studentId } = req.params;

    const [parents] = await pool.query(`
      SELECT 
        u.id as parent_id,
        p.full_name,
        u.username,
        u.email,
        ps.relationship
      FROM parent_students ps
      INNER JOIN users u ON ps.parent_id = u.id
      INNER JOIN profiles p ON u.id = p.user_id
      WHERE ps.student_id = ?
      ORDER BY p.full_name
    `, [studentId]);

    res.json(parents);
  } catch (error) {
    console.error('Get linked parents error:', error);
    res.status(500).json({ error: 'Failed to fetch linked parents' });
  }
});

// Link parent to student
router.post('/link', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const { parent_id, student_id, relationship } = req.body;

    // Check if already linked
    const [existing] = await pool.query(
      'SELECT id FROM parent_students WHERE parent_id = ? AND student_id = ?',
      [parent_id, student_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Parent is already linked to this student' });
    }

    await pool.query(
      'INSERT INTO parent_students (parent_id, student_id, relationship) VALUES (?, ?, ?)',
      [parent_id, student_id, relationship || 'parent']
    );

    res.json({ message: 'Parent linked successfully' });
  } catch (error) {
    console.error('Link parent error:', error);
    res.status(500).json({ error: 'Failed to link parent' });
  }
});

// Unlink parent from student
router.delete('/unlink', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const { parent_id, student_id } = req.body;

    await pool.query(
      'DELETE FROM parent_students WHERE parent_id = ? AND student_id = ?',
      [parent_id, student_id]
    );

    res.json({ message: 'Parent unlinked successfully' });
  } catch (error) {
    console.error('Unlink parent error:', error);
    res.status(500).json({ error: 'Failed to unlink parent' });
  }
});

export default router;
