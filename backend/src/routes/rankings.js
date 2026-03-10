import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get rankings for a specific grade/stream (with approval check for students)
router.get('/by-grade', authenticate, async (req, res) => {
  try {
    const { grade_level, stream, term, academic_year } = req.query;
    const userRole = req.user.role;
    const userId = req.user.userId;
    
    if (!grade_level) {
      return res.status(400).json({ error: 'grade_level is required' });
    }
    
    // Get current term and academic year if not provided
    const [settings] = await pool.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('current_term', 'current_academic_year')"
    );
    const currentTerm = term || settings.find(s => s.setting_key === 'current_term')?.setting_value || 'Term 1';
    const currentYear = academic_year || settings.find(s => s.setting_key === 'current_academic_year')?.setting_value || '2024-2025';
    
    // For students, check if rankings are approved
    if (userRole === 'student') {
      const [approval] = await pool.query(
        `SELECT id FROM ranking_approvals 
         WHERE grade_level = ? 
         AND (stream = ? OR (stream IS NULL AND ? IS NULL))
         AND term = ? 
         AND academic_year = ?`,
        [grade_level, stream || null, stream || null, currentTerm, currentYear]
      );
      
      if (approval.length === 0) {
        return res.json({ 
          approved: false, 
          message: 'Rankings not yet approved by director',
          rankings: []
        });
      }
    }
    
    // Build query to calculate rankings
    let query = `
      SELECT 
        u.id as user_id,
        p.full_name,
        sp.grade_level,
        sp.stream,
        AVG(g.score) as average_score,
        COUNT(g.id) as total_subjects
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN student_profiles sp ON u.id = sp.user_id
      INNER JOIN grades g ON u.id = g.student_id
      WHERE sp.grade_level = ?
      AND g.term = ?
      AND g.academic_year = ?
    `;
    
    const params = [grade_level, currentTerm, currentYear];
    
    if (stream) {
      query += ' AND sp.stream = ?';
      params.push(stream);
    }
    
    query += `
      GROUP BY u.id, p.full_name, sp.grade_level, sp.stream
      HAVING COUNT(g.id) > 0
      ORDER BY average_score DESC
    `;
    
    const [students] = await pool.query(query, params);
    
    // Add rank to each student
    const rankings = students.map((student, index) => ({
      ...student,
      rank: index + 1,
      average_score: Math.round(student.average_score * 100) / 100
    }));
    
    // If student, only return their own rank
    if (userRole === 'student') {
      const myRank = rankings.find(r => r.user_id === userId);
      return res.json({
        approved: true,
        myRank: myRank || null,
        totalStudents: rankings.length
      });
    }
    
    // For admin/director/teacher, return all rankings
    res.json({
      approved: true,
      rankings
    });
    
  } catch (error) {
    console.error('Get rankings error:', error);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

// Publish/unpublish rankings (director only)
router.post('/approve', authenticate, authorize('director'), async (req, res) => {
  try {
    const { grade_level, stream, term, academic_year } = req.body;
    
    if (!grade_level || !term || !academic_year) {
      return res.status(400).json({ error: 'grade_level, term, and academic_year are required' });
    }
    
    // Check if already approved
    const [existing] = await pool.query(
      `SELECT id FROM ranking_approvals 
       WHERE grade_level = ? 
       AND (stream = ? OR (stream IS NULL AND ? IS NULL))
       AND term = ? 
       AND academic_year = ?`,
      [grade_level, stream || null, stream || null, term, academic_year]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Rankings already approved for this group' });
    }
    
    // Insert approval
    await pool.query(
      `INSERT INTO ranking_approvals (grade_level, stream, term, academic_year, approved_by)
       VALUES (?, ?, ?, ?, ?)`,
      [grade_level, stream || null, term, academic_year, req.user.userId]
    );
    
    res.json({ message: 'Rankings published successfully' });
    
  } catch (error) {
    console.error('Approve rankings error:', error);
    res.status(500).json({ error: 'Failed to approve rankings' });
  }
});

// Unpublish rankings (director only)
router.delete('/approve', authenticate, authorize('director'), async (req, res) => {
  try {
    const { grade_level, stream, term, academic_year } = req.body;
    
    if (!grade_level || !term || !academic_year) {
      return res.status(400).json({ error: 'grade_level, term, and academic_year are required' });
    }
    
    await pool.query(
      `DELETE FROM ranking_approvals 
       WHERE grade_level = ? 
       AND (stream = ? OR (stream IS NULL AND ? IS NULL))
       AND term = ? 
       AND academic_year = ?`,
      [grade_level, stream || null, stream || null, term, academic_year]
    );
    
    res.json({ message: 'Rankings unpublished successfully' });
    
  } catch (error) {
    console.error('Unpublish rankings error:', error);
    res.status(500).json({ error: 'Failed to unpublish rankings' });
  }
});

// Check if rankings are approved for a specific group
router.get('/approval-status', authenticate, async (req, res) => {
  try {
    const { grade_level, stream, term, academic_year } = req.query;
    
    if (!grade_level) {
      return res.status(400).json({ error: 'grade_level is required' });
    }
    
    // Get current term and academic year if not provided
    const [settings] = await pool.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('current_term', 'current_academic_year')"
    );
    const currentTerm = term || settings.find(s => s.setting_key === 'current_term')?.setting_value || 'Term 1';
    const currentYear = academic_year || settings.find(s => s.setting_key === 'current_academic_year')?.setting_value || '2024-2025';
    
    const [approval] = await pool.query(
      `SELECT id, approved_at, approved_by FROM ranking_approvals 
       WHERE grade_level = ? 
       AND (stream = ? OR (stream IS NULL AND ? IS NULL))
       AND term = ? 
       AND academic_year = ?`,
      [grade_level, stream || null, stream || null, currentTerm, currentYear]
    );
    
    res.json({
      approved: approval.length > 0,
      approval: approval[0] || null
    });
    
  } catch (error) {
    console.error('Check approval status error:', error);
    res.status(500).json({ error: 'Failed to check approval status' });
  }
});

export default router;
