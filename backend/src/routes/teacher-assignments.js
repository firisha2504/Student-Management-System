import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get current teacher's assignments (for teachers to see their own)
router.get('/me', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const teacherId = req.userId;

    // Get assigned subjects (distinct to avoid duplicates from stream variations)
    const [subjects] = await pool.query(
      'SELECT DISTINCT subject_id FROM teacher_subjects WHERE teacher_id = ?',
      [teacherId]
    );

    // Get assigned grades
    const [grades] = await pool.query(
      'SELECT grade_level FROM teacher_grades WHERE teacher_id = ?',
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

// Get teacher assignments (for admin/director)
router.get('/:teacherId', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const { teacherId } = req.params;

    const [subjects] = await pool.query('SELECT DISTINCT subject_id FROM teacher_subjects WHERE teacher_id = ?', [teacherId]);
    const [grades] = await pool.query('SELECT grade_level FROM teacher_grades WHERE teacher_id = ?', [teacherId]);
    const [sections] = await pool.query('SELECT section FROM teacher_sections WHERE teacher_id = ?', [teacherId]);
    const [subSections] = await pool.query('SELECT sub_section FROM teacher_sub_sections WHERE teacher_id = ?', [teacherId]);

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
    await connection.query('DELETE FROM teacher_subjects WHERE teacher_id = ?', [teacherId]);
    await connection.query('DELETE FROM teacher_sections WHERE teacher_id = ?', [teacherId]);
    await connection.query('DELETE FROM teacher_sub_sections WHERE teacher_id = ?', [teacherId]);
    await connection.query('DELETE FROM teacher_grades WHERE teacher_id = ?', [teacherId]);

    // Save grade assignments independently
    if (grades && grades.length > 0) {
      const gradeAssignments = grades.map(g => [teacherId, g]);
      await connection.query('INSERT INTO teacher_grades (teacher_id, grade_level) VALUES ?', [gradeAssignments]);
    }

    // Insert new subject and grade assignments
    if (subjects && subjects.length > 0 && grades && grades.length > 0) {
      const seen = new Set();
      const subjectAssignments = [];
      
      for (const subjectId of subjects) {
        for (const gradeLevel of grades) {
          // Get the stream for this subject and grade
          const [subjectInfo] = await connection.query(
            'SELECT stream FROM subjects WHERE id = ? AND grade_level = ?',
            [subjectId, gradeLevel]
          );
          
          // Use empty string for common subjects (not NULL) to match UNIQUE constraint
          const stream = subjectInfo[0]?.stream || '';
          const key = `${subjectId}-${gradeLevel}-${stream}`;
          if (!seen.has(key)) {
            seen.add(key);
            subjectAssignments.push([teacherId, subjectId, gradeLevel, stream]);
          }
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
    
    // Handle duplicate entry error with user-friendly message
    if (error.code === 'ER_DUP_ENTRY') {
      // Extract subject info from error message
      const match = error.sqlMessage.match(/Duplicate entry '(\d+)-(\d+)-(.*)'/);
      if (match) {
        const [, subjectId, gradeLevel, stream] = match;
        
        // Get subject name and current teacher
        try {
          const [subjectInfo] = await pool.query(
            'SELECT s.subject_name FROM subjects s WHERE s.id = ?',
            [subjectId]
          );
          
          const [currentTeacher] = await pool.query(
            `SELECT p.full_name 
             FROM teacher_subjects ts 
             JOIN profiles p ON ts.teacher_id = p.user_id 
             WHERE ts.subject_id = ? AND ts.grade_level = ? AND ts.stream = ?`,
            [subjectId, gradeLevel, stream || '']
          );
          
          const subjectName = subjectInfo[0]?.subject_name || 'Unknown Subject';
          const teacherName = currentTeacher[0]?.full_name || 'another teacher';
          const streamText = stream ? ` (${stream} stream)` : '';
          
          return res.status(400).json({ 
            error: `${subjectName} Grade ${gradeLevel}${streamText} is already assigned to ${teacherName}. Only one teacher can teach each subject per grade level.` 
          });
        } catch (lookupError) {
          console.error('Error looking up subject info:', lookupError);
        }
      }
      
      return res.status(400).json({ 
        error: 'One or more subjects are already assigned to another teacher. Only one teacher can teach each subject per grade level.' 
      });
    }
    
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
