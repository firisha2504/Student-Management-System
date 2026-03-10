import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get teacher assignments
router.get('/:teacherId', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Get assigned subjects
    const [subjects] = await pool.query(
      'SELECT subject_id FROM teacher_subject_assignments WHERE teacher_id = ?',
      [teacherId]
    );

    // Get assigned grades
    const [grades] = await pool.query(
      'SELECT DISTINCT grade_level FROM teacher_subject_assignments WHERE teacher_id = ?',
      [teacherId]
    );

    // Get assigned sections
    const [sections] = await pool.query(
      'SELECT DISTINCT section FROM teacher_subject_assignments WHERE teacher_id = ? AND section IS NOT NULL',
      [teacherId]
    );

    // Get assigned sub-sections
    const [subSections] = await pool.query(
      'SELECT DISTINCT sub_section FROM teacher_subject_assignments WHERE teacher_id = ? AND sub_section IS NOT NULL',
      [teacherId]
    );

    res.json({
      subjects: subjects.map(s => s.subject_id),
      grades: grades.map(g => g.grade_level),
      sections: sections.map(s => s.section),
      subSections: subSections.map(s => s.sub_section)
    });
  } catch (error) {
    console.error('Get teacher assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch teacher assignments' });
  }
});

// Save teacher assignments
router.post('/:teacherId', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { teacherId } = req.params;
    const { subjects, grades, sections, subSections } = req.body;

    await connection.beginTransaction();

    // Delete existing assignments
    await connection.query(
      'DELETE FROM teacher_subject_assignments WHERE teacher_id = ?',
      [teacherId]
    );

    // Insert new assignments
    if (subjects && subjects.length > 0 && grades && grades.length > 0) {
      const assignments = [];
      
      for (const subjectId of subjects) {
        for (const gradeLevel of grades) {
          // If sections specified, create assignment for each section
          if (sections && sections.length > 0) {
            for (const section of sections) {
              // If sub-sections specified, create assignment for each sub-section
              if (subSections && subSections.length > 0) {
                for (const subSection of subSections) {
                  assignments.push([teacherId, subjectId, gradeLevel, section, subSection]);
                }
              } else {
                assignments.push([teacherId, subjectId, gradeLevel, section, null]);
              }
            }
          } else {
            // No sections specified
            assignments.push([teacherId, subjectId, gradeLevel, null, null]);
          }
        }
      }

      if (assignments.length > 0) {
        await connection.query(
          'INSERT INTO teacher_subject_assignments (teacher_id, subject_id, grade_level, section, sub_section) VALUES ?',
          [assignments]
        );
      }
    }

    await connection.commit();
    res.json({ message: 'Teacher assignments saved successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Save teacher assignments error:', error);
    res.status(500).json({ error: 'Failed to save teacher assignments' });
  } finally {
    connection.release();
  }
});

// Get all teachers with their assignments
router.get('/', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const [teachers] = await pool.query(`
      SELECT 
        u.id as teacher_id,
        p.full_name,
        p.username,
        COUNT(DISTINCT tsa.subject_id) as subject_count,
        COUNT(DISTINCT tsa.grade_level) as grade_count
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN user_roles r ON u.id = r.user_id
      LEFT JOIN teacher_subject_assignments tsa ON u.id = tsa.teacher_id
      WHERE r.role = 'teacher' AND p.is_active = 1
      GROUP BY u.id, p.full_name, p.username
      ORDER BY p.full_name
    `);

    res.json(teachers);
  } catch (error) {
    console.error('Get teachers with assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

export default router;
