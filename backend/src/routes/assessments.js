import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get assessment types for a teacher's subject
router.get('/types', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { subject_id, grade_level, stream, section, sub_section } = req.query;
    const teacher_id = req.userId;

    let query = `
      SELECT * FROM assessment_types 
      WHERE teacher_id = ? AND subject_id = ? AND grade_level = ?
    `;
    const params = [teacher_id, subject_id, grade_level];

    if (stream) {
      query += ' AND stream = ?';
      params.push(stream);
    } else {
      query += ' AND stream IS NULL';
    }

    if (section) {
      query += ' AND section = ?';
      params.push(section);
    } else {
      query += ' AND section IS NULL';
    }

    if (sub_section) {
      query += ' AND sub_section = ?';
      params.push(sub_section);
    } else {
      query += ' AND sub_section IS NULL';
    }

    const [types] = await pool.query(query, params);
    res.json(types);
  } catch (error) {
    console.error('Get assessment types error:', error);
    res.status(500).json({ error: 'Failed to fetch assessment types' });
  }
});

// Create assessment type
router.post('/types', authenticate, authorize('teacher', 'admin'), [
  body('subject_id').isInt(),
  body('grade_level').isInt(),
  body('assessment_name').trim().notEmpty(),
  body('weight').isFloat({ min: 0, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { subject_id, grade_level, stream, section, sub_section, assessment_name, weight } = req.body;
    const teacher_id = req.userId;

    const [result] = await pool.query(
      `INSERT INTO assessment_types 
       (teacher_id, subject_id, grade_level, stream, section, sub_section, assessment_name, weight) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [teacher_id, subject_id, grade_level, stream || null, section || null, sub_section || null, assessment_name, weight]
    );

    res.status(201).json({ 
      message: 'Assessment type created successfully', 
      id: result.insertId 
    });
  } catch (error) {
    console.error('Create assessment type error:', error);
    res.status(500).json({ error: 'Failed to create assessment type' });
  }
});

// Update assessment type
router.patch('/types/:id', authenticate, authorize('teacher', 'admin'), [
  body('assessment_name').optional().trim().notEmpty(),
  body('weight').optional().isFloat({ min: 0, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { assessment_name, weight } = req.body;
    const teacher_id = req.userId;

    // Verify ownership
    const [existing] = await pool.query(
      'SELECT id FROM assessment_types WHERE id = ? AND teacher_id = ?',
      [id, teacher_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Assessment type not found or unauthorized' });
    }

    const updates = [];
    const params = [];

    if (assessment_name) {
      updates.push('assessment_name = ?');
      params.push(assessment_name);
    }

    if (weight !== undefined) {
      updates.push('weight = ?');
      params.push(weight);
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE assessment_types SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    res.json({ message: 'Assessment type updated successfully' });
  } catch (error) {
    console.error('Update assessment type error:', error);
    res.status(500).json({ error: 'Failed to update assessment type' });
  }
});

// Delete assessment type
router.delete('/types/:id', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const teacher_id = req.userId;

    // Verify ownership
    const [existing] = await pool.query(
      'SELECT id FROM assessment_types WHERE id = ? AND teacher_id = ?',
      [id, teacher_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Assessment type not found or unauthorized' });
    }

    await pool.query('DELETE FROM assessment_types WHERE id = ?', [id]);

    res.json({ message: 'Assessment type deleted successfully' });
  } catch (error) {
    console.error('Delete assessment type error:', error);
    res.status(500).json({ error: 'Failed to delete assessment type' });
  }
});

// Get assessment scores for students
router.get('/scores', authenticate, async (req, res) => {
  try {
    const { student_id, assessment_type_id, term, academic_year } = req.query;

    let query = `
      SELECT 
        s.*,
        at.assessment_name,
        at.weight,
        sub.subject_name
      FROM assessment_scores s
      INNER JOIN assessment_types at ON s.assessment_type_id = at.id
      INNER JOIN subjects sub ON at.subject_id = sub.id
      WHERE 1=1
    `;
    const params = [];

    if (student_id) {
      query += ' AND s.student_id = ?';
      params.push(student_id);
    }

    if (assessment_type_id) {
      query += ' AND s.assessment_type_id = ?';
      params.push(assessment_type_id);
    }

    if (term) {
      query += ' AND s.term = ?';
      params.push(term);
    }

    if (academic_year) {
      query += ' AND s.academic_year = ?';
      params.push(academic_year);
    }

    query += ' ORDER BY s.created_at DESC';

    const [scores] = await pool.query(query, params);
    res.json(scores);
  } catch (error) {
    console.error('Get assessment scores error:', error);
    res.status(500).json({ error: 'Failed to fetch assessment scores' });
  }
});

// Upload/Update assessment score
router.post('/scores', authenticate, authorize('teacher', 'admin'), [
  body('student_id').isInt(),
  body('assessment_type_id').isInt(),
  body('score').isFloat({ min: 0, max: 100 }),
  body('term').notEmpty(),
  body('academic_year').matches(/^\d{4}-\d{4}$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { student_id, assessment_type_id, score, term, academic_year, remarks, published } = req.body;

    // Check if score already exists
    const [existing] = await pool.query(
      'SELECT id FROM assessment_scores WHERE student_id = ? AND assessment_type_id = ? AND term = ? AND academic_year = ?',
      [student_id, assessment_type_id, term, academic_year]
    );

    if (existing.length > 0) {
      // Update existing score
      await pool.query(
        'UPDATE assessment_scores SET score = ?, remarks = ?, published = ? WHERE id = ?',
        [score, remarks, published !== false, existing[0].id]
      );
      
      res.json({ message: 'Score updated successfully', scoreId: existing[0].id });
    } else {
      // Insert new score
      const [result] = await pool.query(
        'INSERT INTO assessment_scores (student_id, assessment_type_id, score, term, academic_year, remarks, published) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [student_id, assessment_type_id, score, term, academic_year, remarks, published !== false]
      );
      
      res.status(201).json({ message: 'Score created successfully', scoreId: result.insertId });
    }
  } catch (error) {
    console.error('Upload score error:', error);
    res.status(500).json({ error: 'Failed to upload score' });
  }
});

// Bulk upload scores
router.post('/scores/bulk', authenticate, authorize('teacher', 'admin'), [
  body('scores').isArray({ min: 1 }),
  body('scores.*.student_id').isInt(),
  body('scores.*.assessment_type_id').isInt(),
  body('scores.*.score').isFloat({ min: 0, max: 100 }),
  body('term').notEmpty(),
  body('academic_year').matches(/^\d{4}-\d{4}$/)
], async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { scores, term, academic_year } = req.body;

    await connection.beginTransaction();

    let inserted = 0;
    let updated = 0;

    for (const scoreData of scores) {
      const { student_id, assessment_type_id, score, remarks } = scoreData;

      const [existing] = await connection.query(
        'SELECT id FROM assessment_scores WHERE student_id = ? AND assessment_type_id = ? AND term = ? AND academic_year = ?',
        [student_id, assessment_type_id, term, academic_year]
      );

      if (existing.length > 0) {
        await connection.query(
          'UPDATE assessment_scores SET score = ?, remarks = ? WHERE id = ?',
          [score, remarks, existing[0].id]
        );
        updated++;
      } else {
        await connection.query(
          'INSERT INTO assessment_scores (student_id, assessment_type_id, score, term, academic_year, remarks, published) VALUES (?, ?, ?, ?, ?, ?, TRUE)',
          [student_id, assessment_type_id, score, term, academic_year, remarks]
        );
        inserted++;
      }
    }

    await connection.commit();

    res.json({ 
      message: 'Scores uploaded successfully',
      inserted,
      updated,
      total: inserted + updated
    });
  } catch (error) {
    await connection.rollback();
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: 'Failed to upload scores' });
  } finally {
    connection.release();
  }
});

// Delete assessment score
router.delete('/scores/:id', authenticate, authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM assessment_scores WHERE id = ?', [id]);

    res.json({ message: 'Score deleted successfully' });
  } catch (error) {
    console.error('Delete score error:', error);
    res.status(500).json({ error: 'Failed to delete score' });
  }
});

export default router;
