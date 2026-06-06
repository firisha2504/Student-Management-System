import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get grades for a student
router.get('/student/:studentId', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { term, academic_year } = req.query;
    
    let query = `
      SELECT 
        g.id, g.score, g.term, g.academic_year, g.remarks, g.created_at,
        s.subject_name, s.subject_code,
        p.full_name as teacher_name
      FROM grades g
      INNER JOIN subjects s ON g.subject_id = s.id
      INNER JOIN users u ON g.teacher_id = u.id
      INNER JOIN profiles p ON u.id = p.user_id
      WHERE g.student_id = ?
    `;
    
    const params = [studentId];
    
    if (term) {
      query += ' AND g.term = ?';
      params.push(term);
    }
    
    if (academic_year) {
      query += ' AND g.academic_year = ?';
      params.push(academic_year);
    }
    
    query += ' ORDER BY g.academic_year DESC, g.term DESC, s.subject_name';
    
    const [grades] = await pool.query(query, params);
    res.json(grades);
  } catch (error) {
    console.error('Get grades error:', error);
    res.status(500).json({ error: 'Failed to fetch grades' });
  }
});

// Upload/Update grades (teacher only)
router.post('/', authenticate, authorize('teacher', 'admin'), [
  body('student_id').isInt(),
  body('subject_id').isInt(),
  body('score').isFloat({ min: 0, max: 100 }),
  body('term').isIn(['Term 1', 'Term 2', 'Term 3']),
  body('academic_year').matches(/^\d{4}\s*E\.C\.?$/i)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { student_id, subject_id, score, term, academic_year, remarks } = req.body;
    const teacher_id = req.userId;

    // Check if grade already exists
    const [existing] = await pool.query(
      'SELECT id FROM grades WHERE student_id = ? AND subject_id = ? AND term = ? AND academic_year = ?',
      [student_id, subject_id, term, academic_year]
    );

    if (existing.length > 0) {
      // Update existing grade
      await pool.query(
        'UPDATE grades SET score = ?, teacher_id = ?, remarks = ? WHERE id = ?',
        [score, teacher_id, remarks, existing[0].id]
      );
      
      res.json({ message: 'Grade updated successfully', gradeId: existing[0].id });
    } else {
      // Insert new grade
      const [result] = await pool.query(
        'INSERT INTO grades (student_id, subject_id, teacher_id, score, term, academic_year, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [student_id, subject_id, teacher_id, score, term, academic_year, remarks]
      );
      
      res.status(201).json({ message: 'Grade created successfully', gradeId: result.insertId });
    }
  } catch (error) {
    console.error('Upload grade error:', error);
    res.status(500).json({ error: 'Failed to upload grade' });
  }
});

// Bulk upload grades
router.post('/bulk', authenticate, authorize('teacher', 'admin'), [
  body('grades').isArray({ min: 1 }),
  body('grades.*.student_id').isInt(),
  body('grades.*.subject_id').isInt(),
  body('grades.*.score').isFloat({ min: 0, max: 100 }),
  body('term').isIn(['Term 1', 'Term 2', 'Term 3']),
  body('academic_year').matches(/^\d{4}\s*E\.C\.?$/i)
], async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { grades, term, academic_year } = req.body;
    const teacher_id = req.userId;

    await connection.beginTransaction();

    let inserted = 0;
    let updated = 0;

    for (const grade of grades) {
      const { student_id, subject_id, score, remarks } = grade;

      const [existing] = await connection.query(
        'SELECT id FROM grades WHERE student_id = ? AND subject_id = ? AND term = ? AND academic_year = ?',
        [student_id, subject_id, term, academic_year]
      );

      if (existing.length > 0) {
        await connection.query(
          'UPDATE grades SET score = ?, teacher_id = ?, remarks = ? WHERE id = ?',
          [score, teacher_id, remarks, existing[0].id]
        );
        updated++;
      } else {
        await connection.query(
          'INSERT INTO grades (student_id, subject_id, teacher_id, score, term, academic_year, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [student_id, subject_id, teacher_id, score, term, academic_year, remarks]
        );
        inserted++;
      }
    }

    await connection.commit();

    res.json({ 
      message: 'Grades uploaded successfully',
      inserted,
      updated,
      total: inserted + updated
    });
  } catch (error) {
    await connection.rollback();
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: 'Failed to upload grades' });
  } finally {
    connection.release();
  }
});

// Delete grade (teacher can only delete their own grades)
router.delete('/:id', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.userRole;
    const userId = req.userId;

    if (userRole === 'teacher') {
      const [existing] = await pool.query(
        'SELECT id FROM grades WHERE id = ? AND teacher_id = ?',
        [id, userId]
      );
      if (existing.length === 0) {
        return res.status(403).json({ error: 'You can only delete grades you created' });
      }
    }

    await pool.query('DELETE FROM grades WHERE id = ?', [id]);

    res.json({ message: 'Grade deleted successfully' });
  } catch (error) {
    console.error('Delete grade error:', error);
    res.status(500).json({ error: 'Failed to delete grade' });
  }
});

// Get statistics
router.get('/stats/overview', authenticate, authorize('admin', 'director'), async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT g.student_id) as total_students,
        COUNT(g.id) as total_grades,
        AVG(g.score) as average_score,
        MIN(g.score) as min_score,
        MAX(g.score) as max_score
      FROM grades g
    `);

    const [subjectAverages] = await pool.query(`
      SELECT 
        s.subject_name,
        AVG(g.score) as average_score,
        COUNT(g.id) as total_grades
      FROM grades g
      INNER JOIN subjects s ON g.subject_id = s.id
      GROUP BY s.id, s.subject_name
      ORDER BY average_score DESC
    `);

    res.json({
      overview: stats[0],
      subjectAverages
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
