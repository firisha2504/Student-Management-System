import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get all students
router.get('/', authenticate, authorize('admin', 'registrar', 'director', 'teacher'), async (req, res) => {
  try {
    const { grade_level, stream } = req.query;
    
    let query = `
      SELECT 
        u.id, u.email,
        p.full_name, p.phone, p.address, p.date_of_birth, p.gender,
        sp.admission_number, sp.grade_level, sp.stream, sp.enrollment_date
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN profiles p ON u.id = p.user_id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE ur.role = 'student' AND p.is_active = TRUE
    `;
    
    const params = [];
    
    if (grade_level) {
      query += ' AND sp.grade_level = ?';
      params.push(grade_level);
    }
    
    if (stream) {
      query += ' AND sp.stream = ?';
      params.push(stream);
    }
    
    query += ' ORDER BY sp.grade_level, p.full_name';
    
    const [students] = await pool.query(query, params);
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get student by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [students] = await pool.query(`
      SELECT 
        u.id, u.email,
        p.full_name, p.phone, p.address, p.date_of_birth, p.gender, p.profile_image,
        sp.admission_number, sp.grade_level, sp.stream, sp.enrollment_date
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE u.id = ?
    `, [id]);
    
    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json(students[0]);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// Update student profile
router.put('/:id', authenticate, [
  body('full_name').optional().trim(),
  body('grade_level').optional().isInt({ min: 1, max: 12 }),
  body('stream').optional().isIn(['Science', 'Arts', 'Commerce'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { full_name, phone, address, date_of_birth, gender, grade_level, stream } = req.body;

    // Update profile
    if (full_name || phone || address || date_of_birth || gender) {
      const profileUpdates = [];
      const profileValues = [];
      
      if (full_name) {
        profileUpdates.push('full_name = ?');
        profileValues.push(full_name);
      }
      if (phone) {
        profileUpdates.push('phone = ?');
        profileValues.push(phone);
      }
      if (address) {
        profileUpdates.push('address = ?');
        profileValues.push(address);
      }
      if (date_of_birth) {
        profileUpdates.push('date_of_birth = ?');
        profileValues.push(date_of_birth);
      }
      if (gender) {
        profileUpdates.push('gender = ?');
        profileValues.push(gender);
      }
      
      if (profileUpdates.length > 0) {
        profileValues.push(id);
        await pool.query(
          `UPDATE profiles SET ${profileUpdates.join(', ')} WHERE user_id = ?`,
          profileValues
        );
      }
    }

    // Update student profile
    if (grade_level || stream) {
      const studentUpdates = [];
      const studentValues = [];
      
      if (grade_level) {
        studentUpdates.push('grade_level = ?');
        studentValues.push(grade_level);
      }
      if (stream) {
        studentUpdates.push('stream = ?');
        studentValues.push(stream);
      }
      
      if (studentUpdates.length > 0) {
        studentValues.push(id);
        await pool.query(
          `UPDATE student_profiles SET ${studentUpdates.join(', ')} WHERE user_id = ?`,
          studentValues
        );
      }
    }

    res.json({ message: 'Student profile updated successfully' });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Get student rankings
router.get('/rankings/by-grade', authenticate, authorize('admin', 'director', 'teacher'), async (req, res) => {
  try {
    const { grade_level, stream, term, academic_year } = req.query;
    
    let query = `
      SELECT 
        u.id,
        p.full_name,
        sp.admission_number,
        sp.grade_level,
        sp.stream,
        AVG(g.score) as average_score,
        COUNT(g.id) as total_subjects
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN student_profiles sp ON u.id = sp.user_id
      INNER JOIN grades g ON u.id = g.student_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (grade_level) {
      query += ' AND sp.grade_level = ?';
      params.push(grade_level);
    }
    
    if (stream) {
      query += ' AND sp.stream = ?';
      params.push(stream);
    }
    
    if (term) {
      query += ' AND g.term = ?';
      params.push(term);
    }
    
    if (academic_year) {
      query += ' AND g.academic_year = ?';
      params.push(academic_year);
    }
    
    query += `
      GROUP BY u.id, p.full_name, sp.admission_number, sp.grade_level, sp.stream
      ORDER BY average_score DESC
    `;
    
    const [rankings] = await pool.query(query, params);
    res.json(rankings);
  } catch (error) {
    console.error('Get rankings error:', error);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

// Get student's own stats (for student dashboard)
router.get('/me/stats', authenticate, authorize('student'), async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get student's grades count and average
    const [gradeStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_grades,
        AVG(score) as average_score
      FROM grades
      WHERE student_id = ?
    `, [userId]);
    
    res.json({
      totalGrades: gradeStats[0]?.total_grades || 0,
      avgScore: gradeStats[0]?.average_score ? Math.round(gradeStats[0].average_score) : 0
    });
  } catch (error) {
    console.error('Get student stats error:', error);
    res.status(500).json({ error: 'Failed to fetch student stats' });
  }
});

export default router;
