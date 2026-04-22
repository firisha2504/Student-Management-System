import express from 'express';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get homeroom assignment for a teacher
router.get('/my-homeroom', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const teacherId = req.userId;
    
    // Get current academic year
    const [settings] = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'current_academic_year'"
    );
    const currentYear = settings[0]?.setting_value || new Date().getFullYear().toString();
    
    const [assignments] = await pool.query(
      `SELECT * FROM homeroom_assignments 
       WHERE teacher_id = ? AND academic_year = ?`,
      [teacherId, currentYear]
    );
    
    res.json(assignments);
  } catch (error) {
    console.error('Get my homeroom error:', error);
    res.status(500).json({ error: 'Failed to fetch homeroom assignment' });
  }
});

// Get students in homeroom class
router.get('/my-students', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const teacherId = req.userId;
    
    const [students] = await pool.query(
      `SELECT 
        u.id,
        u.username,
        p.full_name,
        sp.admission_number,
        sp.grade_level,
        sp.section,
        sp.sub_section,
        sp.stream,
        p.gender,
        p.date_of_birth
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN student_profiles sp ON u.id = sp.user_id
      WHERE sp.homeroom_teacher_id = ?
      ORDER BY p.full_name`,
      [teacherId]
    );
    
    res.json(students);
  } catch (error) {
    console.error('Get homeroom students error:', error);
    res.status(500).json({ error: 'Failed to fetch homeroom students' });
  }
});

// Get rankings for homeroom class
router.get('/my-class-rankings', authenticate, authorize('teacher'), async (req, res) => {
  try {
    const teacherId = req.userId;
    const { term, academic_year } = req.query;
    
    // Get current term and academic year if not provided
    const [settings] = await pool.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('current_term', 'current_academic_year')"
    );
    const currentTerm = term || settings.find(s => s.setting_key === 'current_term')?.setting_value || 'Semester 1';
    const currentYear = academic_year || settings.find(s => s.setting_key === 'current_academic_year')?.setting_value || '2024-2025';
    
    // Get rankings for students in this teacher's homeroom
    const [rankings] = await pool.query(
      `SELECT 
        u.id as user_id,
        p.full_name,
        sp.admission_number,
        sp.grade_level,
        sp.section,
        sp.sub_section,
        sp.stream,
        SUM(s.score) as total_score,
        COUNT(DISTINCT at.subject_id) as total_subjects,
        (SUM(s.score) / COUNT(DISTINCT at.subject_id)) as average_score
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN assessment_scores s ON u.id = s.student_id AND s.term = ? AND s.academic_year = ?
      LEFT JOIN assessment_types at ON s.assessment_type_id = at.id
      WHERE sp.homeroom_teacher_id = ?
      GROUP BY u.id, p.full_name, sp.admission_number, sp.grade_level, sp.section, sp.sub_section, sp.stream
      ORDER BY average_score DESC`,
      [currentTerm, currentYear, teacherId]
    );
    
    // Add rank to each student
    const rankedStudents = rankings.map((student, index) => ({
      ...student,
      rank: student.total_subjects > 0 ? index + 1 : null,
      average_score: student.average_score ? Math.round(student.average_score * 100) / 100 : 0
    }));
    
    res.json({ rankings: rankedStudents });
  } catch (error) {
    console.error('Get homeroom rankings error:', error);
    res.status(500).json({ error: 'Failed to fetch homeroom rankings' });
  }
});

// Admin/Director: Assign homeroom teacher
router.post('/assign', authenticate, authorize('admin', 'director'), async (req, res) => {
  try {
    const { teacher_id, grade_level, section, sub_section, stream, academic_year } = req.body;
    
    if (!teacher_id || !grade_level || !academic_year) {
      return res.status(400).json({ error: 'teacher_id, grade_level, and academic_year are required' });
    }
    
    // Check if teacher exists and has teacher role
    const [teacher] = await pool.query(
      `SELECT u.id FROM users u
       INNER JOIN user_roles ur ON u.id = ur.user_id
       WHERE u.id = ? AND ur.role = 'teacher'`,
      [teacher_id]
    );
    
    if (teacher.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    // Check if teacher is already assigned as homeroom teacher for this academic year
    const [existingTeacherAssignment] = await pool.query(
      `SELECT id FROM homeroom_assignments 
       WHERE teacher_id = ? AND academic_year = ?`,
      [teacher_id, academic_year]
    );
    
    if (existingTeacherAssignment.length > 0) {
      return res.status(400).json({ 
        error: 'This teacher is already assigned as homeroom teacher for another class this academic year. One teacher can only be homeroom teacher for one class.' 
      });
    }
    
    // Check if this specific class already has a homeroom teacher
    let checkQuery = `
      SELECT id, teacher_id FROM homeroom_assignments 
      WHERE grade_level = ? AND academic_year = ?
    `;
    const checkParams = [grade_level, academic_year];
    
    if (section) {
      checkQuery += ' AND section = ?';
      checkParams.push(section);
    } else {
      checkQuery += ' AND section IS NULL';
    }
    
    if (sub_section) {
      checkQuery += ' AND sub_section = ?';
      checkParams.push(sub_section);
    } else {
      checkQuery += ' AND sub_section IS NULL';
    }
    
    if (stream) {
      checkQuery += ' AND stream = ?';
      checkParams.push(stream);
    } else {
      checkQuery += ' AND stream IS NULL';
    }
    
    const [existingClassAssignment] = await pool.query(checkQuery, checkParams);
    
    if (existingClassAssignment.length > 0) {
      return res.status(400).json({ 
        error: 'This class already has a homeroom teacher assigned. One class can only have one homeroom teacher.' 
      });
    }
    
    // Insert homeroom assignment
    await pool.query(
      `INSERT INTO homeroom_assignments 
       (teacher_id, grade_level, section, sub_section, stream, academic_year)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [teacher_id, grade_level, section || null, sub_section || null, stream || null, academic_year]
    );
    
    // Update student_profiles to set homeroom_teacher_id
    let updateQuery = `
      UPDATE student_profiles 
      SET homeroom_teacher_id = ?
      WHERE grade_level = ?
    `;
    const params = [teacher_id, grade_level];
    
    if (section) {
      updateQuery += ' AND section = ?';
      params.push(section);
    }
    if (sub_section) {
      updateQuery += ' AND sub_section = ?';
      params.push(sub_section);
    }
    if (stream) {
      updateQuery += ' AND stream = ?';
      params.push(stream);
    }
    
    const [updateResult] = await pool.query(updateQuery, params);
    
    res.json({ 
      message: 'Homeroom teacher assigned successfully',
      studentsAssigned: updateResult.affectedRows
    });
  } catch (error) {
    console.error('Assign homeroom error:', error);
    res.status(500).json({ error: 'Failed to assign homeroom teacher' });
  }
});

// Admin/Director: Get all homeroom assignments
router.get('/assignments', authenticate, authorize('admin', 'director'), async (req, res) => {
  try {
    const { academic_year } = req.query;
    
    let query = `
      SELECT 
        ha.*,
        p.full_name as teacher_name,
        u.username as teacher_username,
        COUNT(sp.user_id) as student_count
      FROM homeroom_assignments ha
      INNER JOIN users u ON ha.teacher_id = u.id
      INNER JOIN profiles p ON u.id = p.user_id
      LEFT JOIN student_profiles sp ON 
        sp.homeroom_teacher_id = ha.teacher_id AND
        sp.grade_level = ha.grade_level AND
        (ha.section IS NULL OR sp.section = ha.section) AND
        (ha.sub_section IS NULL OR sp.sub_section = ha.sub_section) AND
        (ha.stream IS NULL OR sp.stream = ha.stream)
    `;
    
    const params = [];
    if (academic_year) {
      query += ' WHERE ha.academic_year = ?';
      params.push(academic_year);
    }
    
    query += ' GROUP BY ha.id, p.full_name, u.username ORDER BY ha.grade_level, ha.section, ha.sub_section';
    
    const [assignments] = await pool.query(query, params);
    res.json(assignments);
  } catch (error) {
    console.error('Get homeroom assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch homeroom assignments' });
  }
});

// Admin/Director: Update homeroom assignment
router.put('/assign/:id', authenticate, authorize('admin', 'director'), async (req, res) => {
  try {
    const { id } = req.params;
    const { teacher_id, grade_level, section, sub_section, stream, academic_year } = req.body;
    
    if (!teacher_id || !grade_level || !academic_year) {
      return res.status(400).json({ error: 'teacher_id, grade_level, and academic_year are required' });
    }
    
    // Get current assignment details
    const [currentAssignment] = await pool.query(
      'SELECT * FROM homeroom_assignments WHERE id = ?',
      [id]
    );
    
    if (currentAssignment.length === 0) {
      return res.status(404).json({ error: 'Homeroom assignment not found' });
    }
    
    const current = currentAssignment[0];
    
    // Check if teacher exists and has teacher role
    const [teacher] = await pool.query(
      `SELECT u.id FROM users u
       INNER JOIN user_roles ur ON u.id = ur.user_id
       WHERE u.id = ? AND ur.role = 'teacher'`,
      [teacher_id]
    );
    
    if (teacher.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    // If changing teacher, check if new teacher is already assigned as homeroom teacher for this academic year
    if (teacher_id !== current.teacher_id) {
      const [existingTeacherAssignment] = await pool.query(
        `SELECT id FROM homeroom_assignments 
         WHERE teacher_id = ? AND academic_year = ? AND id != ?`,
        [teacher_id, academic_year, id]
      );
      
      if (existingTeacherAssignment.length > 0) {
        return res.status(400).json({ 
          error: 'This teacher is already assigned as homeroom teacher for another class this academic year. One teacher can only be homeroom teacher for one class.' 
        });
      }
    }
    
    // Check if this specific class already has a different homeroom teacher
    let checkQuery = `
      SELECT id, teacher_id FROM homeroom_assignments 
      WHERE grade_level = ? AND academic_year = ? AND id != ?
    `;
    const checkParams = [grade_level, academic_year, id];
    
    if (section) {
      checkQuery += ' AND section = ?';
      checkParams.push(section);
    } else {
      checkQuery += ' AND section IS NULL';
    }
    
    if (sub_section) {
      checkQuery += ' AND sub_section = ?';
      checkParams.push(sub_section);
    } else {
      checkQuery += ' AND sub_section IS NULL';
    }
    
    if (stream) {
      checkQuery += ' AND stream = ?';
      checkParams.push(stream);
    } else {
      checkQuery += ' AND stream IS NULL';
    }
    
    const [existingClassAssignment] = await pool.query(checkQuery, checkParams);
    
    if (existingClassAssignment.length > 0) {
      return res.status(400).json({ 
        error: 'This class already has a different homeroom teacher assigned. One class can only have one homeroom teacher.' 
      });
    }
    
    // Remove homeroom_teacher_id from students with old assignment
    let removeQuery = `
      UPDATE student_profiles 
      SET homeroom_teacher_id = NULL
      WHERE homeroom_teacher_id = ? AND grade_level = ?
    `;
    const removeParams = [current.teacher_id, current.grade_level];
    
    if (current.section) {
      removeQuery += ' AND section = ?';
      removeParams.push(current.section);
    }
    if (current.sub_section) {
      removeQuery += ' AND sub_section = ?';
      removeParams.push(current.sub_section);
    }
    if (current.stream) {
      removeQuery += ' AND stream = ?';
      removeParams.push(current.stream);
    }
    
    await pool.query(removeQuery, removeParams);
    
    // Update homeroom assignment
    await pool.query(
      `UPDATE homeroom_assignments 
       SET teacher_id = ?, grade_level = ?, section = ?, sub_section = ?, stream = ?, academic_year = ?
       WHERE id = ?`,
      [teacher_id, grade_level, section || null, sub_section || null, stream || null, academic_year, id]
    );
    
    // Update student_profiles to set new homeroom_teacher_id
    let updateQuery = `
      UPDATE student_profiles 
      SET homeroom_teacher_id = ?
      WHERE grade_level = ?
    `;
    const params = [teacher_id, grade_level];
    
    if (section) {
      updateQuery += ' AND section = ?';
      params.push(section);
    }
    if (sub_section) {
      updateQuery += ' AND sub_section = ?';
      params.push(sub_section);
    }
    if (stream) {
      updateQuery += ' AND stream = ?';
      params.push(stream);
    }
    
    const [updateResult] = await pool.query(updateQuery, params);
    
    res.json({ 
      message: 'Homeroom assignment updated successfully',
      studentsAssigned: updateResult.affectedRows
    });
  } catch (error) {
    console.error('Update homeroom assignment error:', error);
    res.status(500).json({ error: 'Failed to update homeroom assignment' });
  }
});

// Admin/Director: Remove homeroom assignment
router.delete('/assign/:id', authenticate, authorize('admin', 'director'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get assignment details before deleting
    const [assignment] = await pool.query(
      'SELECT teacher_id, grade_level, section, sub_section, stream FROM homeroom_assignments WHERE id = ?',
      [id]
    );
    
    if (assignment.length === 0) {
      return res.status(404).json({ error: 'Homeroom assignment not found' });
    }
    
    const { teacher_id, grade_level, section, sub_section, stream } = assignment[0];
    
    // Remove homeroom_teacher_id from students
    let updateQuery = `
      UPDATE student_profiles 
      SET homeroom_teacher_id = NULL
      WHERE homeroom_teacher_id = ? AND grade_level = ?
    `;
    const params = [teacher_id, grade_level];
    
    if (section) {
      updateQuery += ' AND section = ?';
      params.push(section);
    }
    if (sub_section) {
      updateQuery += ' AND sub_section = ?';
      params.push(sub_section);
    }
    if (stream) {
      updateQuery += ' AND stream = ?';
      params.push(stream);
    }
    
    await pool.query(updateQuery, params);
    
    // Delete assignment
    await pool.query('DELETE FROM homeroom_assignments WHERE id = ?', [id]);
    
    res.json({ message: 'Homeroom assignment removed successfully' });
  } catch (error) {
    console.error('Remove homeroom assignment error:', error);
    res.status(500).json({ error: 'Failed to remove homeroom assignment' });
  }
});

export default router;
