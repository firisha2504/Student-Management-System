import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get current teacher's assignments (for teachers to see their own)
router.get('/me', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const teacherId = req.userId;

    // Get assigned subjects
    const [subjects] = await pool.query(
      'SELECT subject_id FROM teacher_subjects WHERE teacher_id = ?',
      [teacherId]
    );

    // Get assigned grades
    const [grades] = await pool.query(
      'SELECT DISTINCT grade_level FROM teacher_subjects WHERE teacher_id = ?',
      [teacherId]
    );

    // Get assigned sections
    const [sections] = await pool.query(
      'SELECT section FROM teacher_sections WHERE teacher_id = ?',
      [teacherId]
    );

    // Get assigned sub-sections
    const [subSections] = await pool.query(
      'SELECT sub_section FROM teacher_sub_sections WHERE teacher_id = ?',
      [teacherId]
    );

    res.json({
      subjects: subjects.map(s => s.subject_id),
      grades: grades.map(g => g.grade_level),
      sections: sections.map(s => s.section),
      subSections: subSections.map(s => s.sub_section)
    });
  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Get teacher assignments
router.get('/:teacherId', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Get assigned subjects
    const [subjects] = await pool.query(
      'SELECT subject_id FROM teacher_subjects WHERE teacher_id = ?',
      [teacherId]
    );

    // Get assigned grades
    const [grades] = await pool.query(
      'SELECT DISTINCT grade_level FROM teacher_subjects WHERE teacher_id = ?',
      [teacherId]
    );

    // Get assigned sections
    const [sections] = await pool.query(
      'SELECT section FROM teacher_sections WHERE teacher_id = ?',
      [teacherId]
    );

    // Get assigned sub-sections
    const [subSections] = await pool.query(
      'SELECT sub_section FROM teacher_sub_sections WHERE teacher_id = ?',
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
      'DELETE FROM teacher_subjects WHERE teacher_id = ?',
      [teacherId]
    );
    await connection.query(
      'DELETE FROM teacher_sections WHERE teacher_id = ?',
      [teacherId]
    );
    await connection.query(
      'DELETE FROM teacher_sub_sections WHERE teacher_id = ?',
      [teacherId]
    );

    // Insert new subject and grade assignments
    if (subjects && subjects.length > 0 && grades && grades.length > 0) {
      const subjectAssignments = [];
      
      for (const subjectId of subjects) {
        for (const gradeLevel of grades) {
          // Get the stream for this subject and grade
          const [subjectInfo] = await connection.query(
            'SELECT stream FROM subjects WHERE id = ? AND grade_level = ?',
            [subjectId, gradeLevel]
          );
          
          const stream = subjectInfo[0]?.stream || null;
          subjectAssignments.push([teacherId, subjectId, gradeLevel, stream]);
        }
      }

      if (subjectAssignments.length > 0) {
        await connection.query(
          'INSERT INTO teacher_subjects (teacher_id, subject_id, grade_level, stream) VALUES ?',
          [subjectAssignments]
        );
      }
    }

    // Insert section assignments
    if (sections && sections.length > 0) {
      const sectionAssignments = sections.map(section => [teacherId, section]);
      await connection.query(
        'INSERT INTO teacher_sections (teacher_id, section) VALUES ?',
        [sectionAssignments]
      );
    }

    // Insert sub-section assignments
    if (subSections && subSections.length > 0) {
      const subSectionAssignments = subSections.map(subSection => [teacherId, subSection]);
      await connection.query(
        'INSERT INTO teacher_sub_sections (teacher_id, sub_section) VALUES ?',
        [subSectionAssignments]
      );
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
        u.username,
        COUNT(DISTINCT ts.subject_id) as subject_count,
        COUNT(DISTINCT ts.grade_level) as grade_count
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN user_roles r ON u.id = r.user_id
      LEFT JOIN teacher_subjects ts ON u.id = ts.teacher_id
      WHERE r.role = 'teacher' AND p.is_active = 1
      GROUP BY u.id, p.full_name, u.username
      ORDER BY p.full_name
    `);

    res.json(teachers);
  } catch (error) {
    console.error('Get teachers with assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

export default router;
