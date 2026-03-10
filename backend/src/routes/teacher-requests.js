import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Submit a teacher request (public endpoint)
router.post('/submit', async (req, res) => {
  try {
    const { full_name, email, phone, subject_specialization, qualifications, experience_years } = req.body;
    
    if (!full_name || !email) {
      return res.status(400).json({ error: 'Full name and email are required' });
    }
    
    // Check if email already exists in requests
    const [existing] = await pool.query(
      'SELECT id FROM teacher_requests WHERE email = ?',
      [email]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'A request with this email already exists' });
    }
    
    // Check if email already exists in users
    const [existingUser] = await pool.query(
      'SELECT id FROM users WHERE username = ?',
      [email]
    );
    
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }
    
    await pool.query(
      `INSERT INTO teacher_requests 
       (full_name, email, phone, subject_specialization, qualifications, experience_years) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [full_name, email, phone || null, subject_specialization || null, qualifications || null, experience_years || null]
    );
    
    res.json({ message: 'Request submitted successfully' });
    
  } catch (error) {
    console.error('Submit teacher request error:', error);
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

// Get all teacher requests (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        tr.*,
        u.username as reviewed_by_username,
        p.full_name as reviewed_by_name
      FROM teacher_requests tr
      LEFT JOIN users u ON tr.reviewed_by = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
    `;
    
    const params = [];
    
    if (status) {
      query += ' WHERE tr.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY tr.created_at DESC';
    
    const [requests] = await pool.query(query, params);
    
    res.json(requests);
    
  } catch (error) {
    console.error('Get teacher requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Approve a teacher request and create account (admin only)
router.post('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const requestId = req.params.id;
    
    // Get the request
    const [requests] = await connection.query(
      'SELECT * FROM teacher_requests WHERE id = ? AND status = ?',
      [requestId, 'pending']
    );
    
    if (requests.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Request not found or already processed' });
    }
    
    const request = requests[0];
    
    // Generate ID number
    const [lastTeacher] = await connection.query(
      "SELECT id_number FROM users WHERE role = 'teacher' AND id_number LIKE 'MJT%' ORDER BY id_number DESC LIMIT 1"
    );
    
    let nextNumber = 1;
    if (lastTeacher.length > 0) {
      const lastNum = parseInt(lastTeacher[0].id_number.replace('MJT', ''));
      nextNumber = lastNum + 1;
    }
    
    const idNumber = `MJT${String(nextNumber).padStart(3, '0')}`;
    
    // Generate username from full name and ID
    const nameParts = request.full_name.toLowerCase().trim().split(/\s+/);
    const firstName = nameParts[0] || 'teacher';
    const lastName = nameParts[nameParts.length - 1] || 'user';
    const username = `${firstName}.${lastName}.${idNumber}`;
    
    // Generate password
    const password = `pass${idNumber}`;
    
    // Create user account
    const [userResult] = await connection.query(
      `INSERT INTO users (username, password, role, id_number, is_active) 
       VALUES (?, ?, 'teacher', ?, TRUE)`,
      [username, password, idNumber]
    );
    
    const userId = userResult.insertId;
    
    // Create profile
    await connection.query(
      `INSERT INTO profiles (user_id, full_name, email, phone) 
       VALUES (?, ?, ?, ?)`,
      [userId, request.full_name, request.email, request.phone]
    );
    
    // Update request status
    await connection.query(
      `UPDATE teacher_requests 
       SET status = 'approved', reviewed_at = NOW(), reviewed_by = ? 
       WHERE id = ?`,
      [req.user.userId, requestId]
    );
    
    await connection.commit();
    
    res.json({ 
      message: 'Teacher account created successfully',
      username,
      password,
      id_number: idNumber
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Approve teacher request error:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  } finally {
    connection.release();
  }
});

// Reject a teacher request (admin only)
router.post('/:id/reject', authenticate, authorize('admin'), async (req, res) => {
  try {
    const requestId = req.params.id;
    
    const [result] = await pool.query(
      `UPDATE teacher_requests 
       SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ? 
       WHERE id = ? AND status = 'pending'`,
      [req.user.userId, requestId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }
    
    res.json({ message: 'Request rejected' });
    
  } catch (error) {
    console.error('Reject teacher request error:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// Delete a teacher request (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const requestId = req.params.id;
    
    const [result] = await pool.query(
      'DELETE FROM teacher_requests WHERE id = ?',
      [requestId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    res.json({ message: 'Request deleted successfully' });
    
  } catch (error) {
    console.error('Delete teacher request error:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

export default router;
