import express from 'express';
import pool from '../config/database.js';
import { SCHOOL_CONFIG } from '../config/school.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get rankings for a specific grade/stream (with approval check for students)
router.get('/by-grade', authenticate, async (req, res) => {
  try {
    const { grade_level, stream, term, academic_year } = req.query;
    const userRole = req.userRole;
    const userId = req.userId;
    
    if (!grade_level) {
      return res.status(400).json({ error: 'grade_level is required' });
    }
    
    // Teachers (non-homeroom) cannot access rankings
    if (userRole === 'teacher') {
      return res.status(403).json({ 
        error: 'Only homeroom teachers can view rankings. Please use the homeroom section if you are a homeroom teacher.' 
      });
    }
    
    // Get current term and academic year if not provided
    const [settings] = await pool.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('current_term', 'current_academic_year')"
    );
    const currentTerm = term || settings.find(s => s.setting_key === 'current_term')?.setting_value || 'Semester 1';
    const currentYear = academic_year || settings.find(s => s.setting_key === 'current_academic_year')?.setting_value || '2025-2026';
    
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
    
    // Build query to calculate rankings using assessment_scores
    // First, get the total number of subjects for this grade level
    let subjectCountQuery = `
      SELECT COUNT(DISTINCT id) as total_subjects
      FROM subjects
      WHERE grade_level = ?
    `;
    const subjectCountParams = [grade_level];
    
    if (stream) {
      subjectCountQuery += ' AND (stream = ? OR stream IS NULL)';
      subjectCountParams.push(stream);
    } else {
      subjectCountQuery += ' AND stream IS NULL';
    }
    
    const [subjectCount] = await pool.query(subjectCountQuery, subjectCountParams);
    const requiredSubjects = subjectCount[0]?.total_subjects || 0;
    
    console.log('Required subjects for grade', grade_level, 'stream', stream, ':', requiredSubjects);
    
    let query = `
      SELECT 
        u.id as user_id,
        p.full_name,
        sp.grade_level,
        sp.stream,
        sp.section,
        sp.sub_section,
        SUM(s.score) as total_score,
        COUNT(DISTINCT at.subject_id) as total_subjects,
        (SUM(s.score) / COUNT(DISTINCT at.subject_id)) as average_score
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN student_profiles sp ON u.id = sp.user_id
      INNER JOIN assessment_scores s ON u.id = s.student_id
      INNER JOIN assessment_types at ON s.assessment_type_id = at.id
      WHERE sp.grade_level = ?
      AND s.term = ?
      AND s.academic_year = ?
    `;
    
    const params = [grade_level, currentTerm, currentYear];
    
    if (stream) {
      query += ' AND sp.stream = ?';
      params.push(stream);
    }
    
    query += `
      GROUP BY u.id, p.full_name, sp.grade_level, sp.stream, sp.section, sp.sub_section
      HAVING COUNT(DISTINCT at.subject_id) >= ?
      ORDER BY average_score DESC
    `;
    
    params.push(requiredSubjects);
    
    const [students] = await pool.query(query, params);
    
    console.log('Rankings query executed - Grade:', grade_level, 'Stream:', stream, 'Term:', currentTerm, 'Year:', currentYear);
    console.log('Required subjects:', requiredSubjects, '- Found students with all subjects:', students.length);
    if (students.length > 0) {
      console.log('Top student:', students[0].full_name, 'Average:', students[0].average_score, 'Subjects:', students[0].total_subjects);
    }
    
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
      [grade_level, stream || null, term, academic_year, req.userId]
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
    const currentTerm = term || settings.find(s => s.setting_key === 'current_term')?.setting_value || 'Semester 1';
    const currentYear = academic_year || settings.find(s => s.setting_key === 'current_academic_year')?.setting_value || '2025-2026';
    
    console.log('Rankings approval check - Grade:', grade_level, 'Stream:', stream, 'Term:', currentTerm, 'Year:', currentYear);
    
    const [approval] = await pool.query(
      `SELECT id, approved_at, approved_by FROM ranking_approvals 
       WHERE grade_level = ? 
       AND (stream = ? OR (stream IS NULL AND ? IS NULL))
       AND term = ? 
       AND academic_year = ?`,
      [grade_level, stream || null, stream || null, currentTerm, currentYear]
    );
    
    console.log('Found approvals:', approval.length);
    
    res.json({
      approved: approval.length > 0,
      approval: approval[0] || null
    });
    
  } catch (error) {
    console.error('Check approval status error:', error);
    res.status(500).json({ error: 'Failed to check approval status' });
  }
});

// Get top 10 students across all grades (director only)
router.get('/top10', authenticate, authorize('director'), async (req, res) => {
  try {
    const { term, academic_year } = req.query;
    
    // Get current term and academic year if not provided
    const [settings] = await pool.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('current_term', 'current_academic_year')"
    );
    const currentTerm = term || settings.find(s => s.setting_key === 'current_term')?.setting_value || 'Semester 1';
    const currentYear = academic_year || settings.find(s => s.setting_key === 'current_academic_year')?.setting_value || '2025-2026';
    
    // Build query to calculate top 10 rankings across all grades using assessment_scores
    const query = `
      SELECT 
        u.id as user_id,
        p.full_name,
        sp.grade_level,
        sp.stream,
        sp.section,
        SUM(s.score) as total_score,
        COUNT(DISTINCT at.subject_id) as total_subjects,
        (SUM(s.score) / COUNT(DISTINCT at.subject_id)) as average_score
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN student_profiles sp ON u.id = sp.user_id
      INNER JOIN assessment_scores s ON u.id = s.student_id
      INNER JOIN assessment_types at ON s.assessment_type_id = at.id
      WHERE sp.grade_level IN (9, 10, 11, 12)
      AND s.term = ?
      AND s.academic_year = ?
      GROUP BY u.id, p.full_name, sp.grade_level, sp.stream, sp.section
      HAVING COUNT(DISTINCT at.subject_id) > 0
      ORDER BY average_score DESC
      LIMIT 10
    `;
    
    const [students] = await pool.query(query, [currentTerm, currentYear]);
    
    console.log('Top 10 query executed - Term:', currentTerm, 'Year:', currentYear);
    console.log('Found students for top 10:', students.length);
    
    // Add rank to each student
    const rankings = students.map((student, index) => ({
      user_id: student.user_id,
      full_name: student.full_name,
      grade_level: student.grade_level,
      stream: student.stream,
      section: student.section,
      average: Math.round(student.average_score * 100) / 100,
      rank: index + 1
    }));
    
    console.log('Top 10 rankings prepared:', rankings.length, 'students');
    
    res.json({ rankings });
    
  } catch (error) {
    console.error('Get top 10 rankings error:', error);
    res.status(500).json({ error: 'Failed to fetch top 10 rankings' });
  }
});

export default router;
