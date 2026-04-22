import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get assessment types for a subject
router.get('/types', authenticate, authorize('teacher', 'admin', 'student'), async (req, res) => {
  try {
    const { subject_id, grade_level, stream, section, sub_section } = req.query;
    const userRole = req.userRole;
    const userId = req.userId;

    let query = `
      SELECT 
        at.*,
        p.full_name as teacher_name
      FROM assessment_types at
      LEFT JOIN profiles p ON at.teacher_id = p.user_id
      WHERE at.subject_id = ? AND at.grade_level = ?
    `;
    const params = [subject_id, grade_level];

    // If teacher, only show their own assessment types
    if (userRole === 'teacher') {
      query += ' AND at.teacher_id = ?';
      params.push(userId);
    }

    if (stream) {
      query += ' AND (at.stream = ? OR at.stream IS NULL)';
      params.push(stream);
    }

    if (section) {
      query += ' AND (at.section = ? OR at.section IS NULL)';
      params.push(section);
    }

    if (sub_section) {
      query += ' AND (at.sub_section = ? OR at.sub_section IS NULL)';
      params.push(sub_section);
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

    // Use empty string for common subjects (not NULL) to match UNIQUE constraint
    const streamValue = stream || '';

    const [result] = await pool.query(
      `INSERT INTO assessment_types 
       (teacher_id, subject_id, grade_level, stream, section, sub_section, assessment_name, weight) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [teacher_id, subject_id, grade_level, streamValue, section || null, sub_section || null, assessment_name, weight]
    );

    res.status(201).json({ 
      message: 'Assessment type created successfully', 
      id: result.insertId 
    });
  } catch (error) {
    console.error('Create assessment type error:', error);
    
    // Handle duplicate assessment name error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        error: `Assessment "${req.body.assessment_name}" already exists for this subject and grade level. Each assessment name can only be created once.` 
      });
    }
    
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
    const userRole = req.userRole;
    const userId = req.userId;

    console.log('GET /scores - Role:', userRole, 'User ID:', userId);

    let query = `
      SELECT 
        s.*,
        at.assessment_name,
        at.weight,
        at.teacher_id,
        sub.subject_name,
        p.full_name,
        u.username,
        sp.admission_number
      FROM assessment_scores s
      INNER JOIN assessment_types at ON s.assessment_type_id = at.id
      INNER JOIN subjects sub ON at.subject_id = sub.id
      INNER JOIN users u ON s.student_id = u.id
      INNER JOIN profiles p ON u.id = p.user_id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE 1=1
    `;
    const params = [];

    // If teacher, only show scores for their own assessment types
    if (userRole === 'teacher') {
      console.log('Filtering by teacher_id:', userId);
      query += ' AND at.teacher_id = ?';
      params.push(userId);
    }

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

    console.log('Query:', query);
    console.log('Params:', params);

    const [scores] = await pool.query(query, params);
    console.log(`Found ${scores.length} scores`);
    
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
  body('academic_year').matches(/^\d{4}-\d{4}(\s*E\.C\.?)?$/i)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { student_id, assessment_type_id, score, term, academic_year, remarks, published } = req.body;
    const userRole = req.userRole;
    const userId = req.userId;

    // If teacher, verify they own this assessment type
    if (userRole === 'teacher') {
      const [assessmentType] = await pool.query(
        'SELECT teacher_id FROM assessment_types WHERE id = ?',
        [assessment_type_id]
      );
      
      if (assessmentType.length === 0) {
        return res.status(404).json({ error: 'Assessment type not found' });
      }
      
      if (assessmentType[0].teacher_id !== userId) {
        return res.status(403).json({ error: 'You can only upload scores for your own assessments' });
      }
    }

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
  body('academic_year').matches(/^\d{4}-\d{4}(\s*E\.C\.?)?$/i)
], async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { scores, term, academic_year } = req.body;
    const userRole = req.userRole;
    const userId = req.userId;

    // If teacher, verify they own all assessment types in the bulk upload
    if (userRole === 'teacher') {
      const assessmentTypeIds = [...new Set(scores.map(s => s.assessment_type_id))];
      const [assessmentTypes] = await connection.query(
        `SELECT id, teacher_id FROM assessment_types WHERE id IN (?)`,
        [assessmentTypeIds]
      );
      
      const unauthorized = assessmentTypes.find(at => at.teacher_id !== userId);
      if (unauthorized) {
        return res.status(403).json({ error: 'You can only upload scores for your own assessments' });
      }
    }

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
    const userRole = req.userRole;
    const userId = req.userId;

    // If teacher, verify they own the assessment type for this score
    if (userRole === 'teacher') {
      const [score] = await pool.query(`
        SELECT s.id, at.teacher_id 
        FROM assessment_scores s
        JOIN assessment_types at ON s.assessment_type_id = at.id
        WHERE s.id = ?
      `, [id]);
      
      if (score.length === 0) {
        return res.status(404).json({ error: 'Score not found' });
      }
      
      if (score[0].teacher_id !== userId) {
        return res.status(403).json({ error: 'You can only delete your own assessment scores' });
      }
    }

    await pool.query('DELETE FROM assessment_scores WHERE id = ?', [id]);

    res.json({ message: 'Score deleted successfully' });
  } catch (error) {
    console.error('Delete score error:', error);
    res.status(500).json({ error: 'Failed to delete score' });
  }
});

export default router;
