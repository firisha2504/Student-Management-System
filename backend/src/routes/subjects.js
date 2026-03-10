import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get all subjects with teacher assignments
router.get('/', authenticate, async (req, res) => {
  try {
    const { grade_level, stream } = req.query;
    
    let query = `
      SELECT 
        s.*,
        GROUP_CONCAT(
          CONCAT(p.full_name, '|', ts.grade_level, '|', COALESCE(ts.stream, 'Common'))
          SEPARATOR ';;'
        ) as teacher_assignments
      FROM subjects s
      LEFT JOIN teacher_subjects ts ON s.id = ts.subject_id
      LEFT JOIN profiles p ON ts.teacher_id = p.user_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (grade_level) {
      query += ' AND (s.grade_level = ? OR s.grade_level IS NULL)';
      params.push(grade_level);
    }
    
    if (stream) {
      query += ' AND (s.stream = ? OR s.stream = "Common")';
      params.push(stream);
    }
    
    query += ' GROUP BY s.id ORDER BY s.subject_name';
    
    const [subjects] = await pool.query(query, params);
    
    // Parse teacher assignments
    const formattedSubjects = subjects.map(subject => {
      const teachers = [];
      if (subject.teacher_assignments) {
        const assignments = subject.teacher_assignments.split(';;');
        assignments.forEach(assignment => {
          const [name, grade, stream] = assignment.split('|');
          if (name) {
            teachers.push({ name, grade_level: parseInt(grade), stream });
          }
        });
      }
      
      return {
        ...subject,
        teachers,
        teacher_assignments: undefined
      };
    });

    res.json(formattedSubjects);
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Create subject (admin/registrar)
router.post('/', authenticate, authorize('admin', 'registrar'), [
  body('subject_name').notEmpty().trim(),
  body('subject_code').notEmpty().trim(),
  body('description').optional().trim(),
  body('credit_hours').isInt({ min: 1, max: 10 }),
  body('ects').isInt({ min: 1, max: 20 }),
  body('grade_level').optional().isInt({ min: 9, max: 12 }),
  body('stream').optional({ nullable: true, checkFalsy: true }).isIn(['Science', 'Arts', 'Commerce', 'Common', ''])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array().map(e => `${e.param}: ${e.msg}`).join(', ')
      });
    }

    const { subject_name, subject_code, description, credit_hours, ects, grade_level, stream } = req.body;
    
    console.log('Creating subject:', { subject_name, subject_code, description, credit_hours, ects, grade_level, stream });

    const [result] = await pool.query(
      'INSERT INTO subjects (subject_name, subject_code, description, credit_hours, ects, grade_level, stream) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [subject_name, subject_code, description || null, credit_hours, ects, grade_level || null, stream || null]
    );

    res.status(201).json({
      message: 'Subject created successfully',
      subjectId: result.insertId
    });
  } catch (error) {
    console.error('Create subject error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Subject name or code already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// Assign teacher to subject
router.post('/assign-teacher', authenticate, authorize('admin', 'director'), [
  body('teacher_id').isInt(),
  body('subject_id').isInt(),
  body('grade_level').isInt({ min: 1, max: 12 }),
  body('stream').optional().isIn(['Science', 'Arts', 'Commerce'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { teacher_id, subject_id, grade_level, stream } = req.body;

    const [result] = await pool.query(
      'INSERT INTO teacher_subjects (teacher_id, subject_id, grade_level, stream) VALUES (?, ?, ?, ?)',
      [teacher_id, subject_id, grade_level, stream || null]
    );

    res.status(201).json({
      message: 'Teacher assigned to subject successfully',
      assignmentId: result.insertId
    });
  } catch (error) {
    console.error('Assign teacher error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Teacher already assigned to this subject' });
    }
    
    res.status(500).json({ error: 'Failed to assign teacher' });
  }
});

// Get teacher's assigned subjects
router.get('/teacher/:teacherId', authenticate, async (req, res) => {
  try {
    const { teacherId } = req.params;

    const [assignments] = await pool.query(`
      SELECT 
        ts.id, ts.grade_level, ts.stream, ts.assigned_at,
        s.id as subject_id, s.subject_name, s.subject_code, s.credit_hours, s.ects
      FROM teacher_subjects ts
      INNER JOIN subjects s ON ts.subject_id = s.id
      WHERE ts.teacher_id = ?
      ORDER BY ts.grade_level, s.subject_name
    `, [teacherId]);

    res.json(assignments);
  } catch (error) {
    console.error('Get teacher subjects error:', error);
    res.status(500).json({ error: 'Failed to fetch teacher subjects' });
  }
});

// Update subject
router.patch('/:id', authenticate, authorize('admin', 'registrar'), [
  body('subject_name').optional().notEmpty().trim(),
  body('subject_code').optional().notEmpty().trim(),
  body('description').optional().trim(),
  body('credit_hours').optional().isInt({ min: 1, max: 10 }),
  body('ects').optional().isInt({ min: 1, max: 20 }),
  body('grade_level').optional().isInt({ min: 9, max: 12 }),
  body('stream').optional({ nullable: true, checkFalsy: true }).isIn(['Science', 'Arts', 'Commerce', 'Common', ''])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updates = req.body;
    
    const fields = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    });
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    
    await pool.query(
      `UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: 'Subject updated successfully' });
  } catch (error) {
    console.error('Update subject error:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Subject name or code already exists' });
    }
    
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

// Delete subject
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM subjects WHERE id = ?', [id]);

    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

// Get all teachers (for assignment dropdown)
router.get('/teachers/list', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const [teachers] = await pool.query(`
      SELECT 
        u.id,
        p.full_name,
        u.username,
        u.email
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN profiles p ON u.id = p.user_id
      WHERE ur.role = 'teacher' AND p.is_active = 1
      ORDER BY p.full_name
    `);

    res.json(teachers);
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// Remove teacher assignment
router.delete('/assign-teacher/:id', authenticate, authorize('admin', 'director'), async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM teacher_subjects WHERE id = ?', [id]);

    res.json({ message: 'Teacher assignment removed successfully' });
  } catch (error) {
    console.error('Remove teacher assignment error:', error);
    res.status(500).json({ error: 'Failed to remove teacher assignment' });
  }
});

export default router;
