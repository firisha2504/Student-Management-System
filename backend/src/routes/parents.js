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

// Get parent's linked children (for logged-in parent)
router.get('/me/children', authenticate, authorize('parent'), async (req, res) => {
  try {
    const parentId = req.userId;

    const [children] = await pool.query(`
      SELECT 
        u.id as user_id,
        p.full_name,
        sp.grade_level,
        sp.stream,
        sp.section,
        sp.sub_section,
        p.profile_image
      FROM parent_students ps
      INNER JOIN users u ON ps.student_id = u.id
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN student_profiles sp ON u.id = sp.user_id
      WHERE ps.parent_id = ?
      ORDER BY sp.grade_level DESC, p.full_name
    `, [parentId]);

    res.json(children);
  } catch (error) {
    console.error('Get parent children error:', error);
    res.status(500).json({ error: 'Failed to fetch children' });
  }
});

// Get child's grade breakdown (for logged-in parent)
router.get('/children/:studentId/grades', authenticate, authorize('parent'), async (req, res) => {
  try {
    const parentId = req.userId;
    const { studentId } = req.params;

    // Verify parent has access to this student
    const [access] = await pool.query(
      'SELECT id FROM parent_students WHERE parent_id = ? AND student_id = ?',
      [parentId, studentId]
    );

    if (access.length === 0) {
      return res.status(403).json({ error: 'Access denied to this student' });
    }

    // Get student info
    const [studentInfo] = await pool.query(`
      SELECT sp.grade_level, sp.stream, sp.section
      FROM student_profiles sp
      WHERE sp.user_id = ?
    `, [studentId]);

    if (studentInfo.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentInfo[0];

    // Get subjects for this student
    let subjectQuery = `
      SELECT id, subject_name, credit_hours
      FROM subjects
      WHERE grade_level = ?
    `;
    const subjectParams = [student.grade_level];

    if (student.grade_level >= 11 && student.stream) {
      subjectQuery += " AND (stream = ? OR stream = 'Common' OR stream IS NULL)";
      subjectParams.push(student.stream);
    } else {
      subjectQuery += " AND (stream = 'Common' OR stream IS NULL)";
    }

    const [subjects] = await pool.query(subjectQuery, subjectParams);

    // Get assessment types and scores for each subject
    const breakdowns = [];

    for (const subject of subjects) {
      // Get assessment types for this subject
      const [assessmentTypes] = await pool.query(`
        SELECT 
          at.id,
          at.assessment_name,
          at.weight,
          at.teacher_id,
          p.full_name as teacher_name
        FROM assessment_types at
        LEFT JOIN profiles p ON at.teacher_id = p.user_id
        WHERE at.subject_id = ?
        AND at.grade_level = ?
        ${student.stream ? 'AND (at.stream = ? OR at.stream IS NULL)' : 'AND at.stream IS NULL'}
      `, student.stream ? [subject.id, student.grade_level, student.stream] : [subject.id, student.grade_level]);

      // Get scores for this student
      const [scores] = await pool.query(`
        SELECT assessment_type_id, score, published
        FROM assessment_scores
        WHERE student_id = ?
        AND assessment_type_id IN (?)
        AND published = TRUE
      `, [studentId, assessmentTypes.map(at => at.id)]);

      const scoreMap = {};
      scores.forEach(s => {
        scoreMap[s.assessment_type_id] = s.score;
      });

      // Calculate total score
      let totalScore = 0;
      const assessments = assessmentTypes.map(at => {
        const score = scoreMap[at.id] || 0;
        totalScore += (score * at.weight) / 100;
        return {
          assessment_name: at.assessment_name,
          weight: at.weight,
          score: scoreMap[at.id] || null,
        };
      });

      breakdowns.push({
        subject_id: subject.id,
        subject_name: subject.subject_name,
        credit_hours: subject.credit_hours,
        teacher_name: assessmentTypes[0]?.teacher_name || 'Not assigned',
        assessments,
        totalScore: Math.round(totalScore * 100) / 100,
        hasScores: scores.length > 0,
        hasAssessments: assessmentTypes.length > 0,
      });
    }

    res.json({
      student: {
        grade_level: student.grade_level,
        stream: student.stream,
        section: student.section,
      },
      breakdowns,
    });

  } catch (error) {
    console.error('Get child grades error:', error);
    res.status(500).json({ error: 'Failed to fetch child grades' });
  }
});

// Get child's ranking (for logged-in parent)
router.get('/children/:studentId/ranking', authenticate, authorize('parent'), async (req, res) => {
  try {
    const parentId = req.userId;
    const { studentId } = req.params;
    const { term, academic_year } = req.query;

    // Verify parent has access to this student
    const [access] = await pool.query(
      'SELECT id FROM parent_students WHERE parent_id = ? AND student_id = ?',
      [parentId, studentId]
    );

    if (access.length === 0) {
      return res.status(403).json({ error: 'Access denied to this student' });
    }

    // Get current term and academic year if not provided
    const [settings] = await pool.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('current_term', 'current_academic_year')"
    );
    const currentTerm = term || settings.find(s => s.setting_key === 'current_term')?.setting_value || 'Semester 1';
    const currentYear = academic_year || settings.find(s => s.setting_key === 'current_academic_year')?.setting_value || '2018 E.C.';

    // Get student info
    const [studentInfo] = await pool.query(`
      SELECT sp.grade_level, sp.stream, sp.section
      FROM student_profiles sp
      WHERE sp.user_id = ?
    `, [studentId]);

    if (studentInfo.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentInfo[0];

    // Check if rankings are approved for this group
    const [approval] = await pool.query(
      `SELECT id FROM ranking_approvals 
       WHERE grade_level = ? 
       AND (stream = ? OR (stream IS NULL AND ? IS NULL))
       AND term = ? 
       AND academic_year = ?`,
      [student.grade_level, student.stream || null, student.stream || null, currentTerm, currentYear]
    );

    if (approval.length === 0) {
      return res.json({ 
        approved: false, 
        message: 'Rankings not yet approved by director',
      });
    }

    // Calculate rankings using per-subject weighted totals (same logic as main rankings route)
    let query = `
      SELECT 
        u.id as user_id,
        AVG(subject_totals.subject_score) as average_score
      FROM users u
      INNER JOIN student_profiles sp ON u.id = sp.user_id
      INNER JOIN (
        SELECT s.student_id, at.subject_id, SUM(s.score) as subject_score
        FROM assessment_scores s
        INNER JOIN assessment_types at ON s.assessment_type_id = at.id
        WHERE s.term = ? AND s.academic_year = ? AND s.published = TRUE
        GROUP BY s.student_id, at.subject_id
      ) subject_totals ON u.id = subject_totals.student_id
      WHERE sp.grade_level = ?
    `;
    const params = [currentTerm, currentYear, student.grade_level];

    if (student.stream) {
      query += ' AND sp.stream = ?';
      params.push(student.stream);
    }

    query += `
      GROUP BY u.id
      HAVING COUNT(DISTINCT subject_totals.subject_id) > 0
      ORDER BY average_score DESC
    `;

    const [rankings] = await pool.query(query, params);

    // Find student's rank
    const studentRankIndex = rankings.findIndex(r => r.user_id == studentId);
    const studentAverage = studentRankIndex >= 0 ? rankings[studentRankIndex].average_score : null;

    res.json({
      approved: true,
      rank: studentRankIndex >= 0 ? studentRankIndex + 1 : null,
      total: rankings.length,
      average: studentAverage ? Math.round(Number(studentAverage) * 100) / 100 : 0,
    });

  } catch (error) {
    console.error('Get child ranking error:', error);
    res.status(500).json({ error: 'Failed to fetch child ranking' });
  }
});

export default router;
