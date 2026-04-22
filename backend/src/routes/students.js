import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get all students
router.get('/', authenticate, authorize('admin', 'registrar', 'director', 'teacher'), async (req, res) => {
  try {
    const { grade_level, stream, section, sub_section } = req.query;
    
    let query = `
      SELECT 
        u.id as user_id, u.username, u.email,
        p.full_name, p.phone, p.address, p.date_of_birth, p.gender,
        sp.admission_number, sp.grade_level, sp.stream, sp.section, sp.sub_section, sp.enrollment_date,
        COUNT(DISTINCT ps.parent_id) as parent_count
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN profiles p ON u.id = p.user_id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN parent_students ps ON u.id = ps.student_id
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
    
    if (section) {
      query += ' AND sp.section = ?';
      params.push(section);
    }
    
    if (sub_section) {
      query += ' AND sp.sub_section = ?';
      params.push(sub_section);
    }
    
    query += ' GROUP BY u.id, u.username, u.email, p.full_name, p.phone, p.address, p.date_of_birth, p.gender, sp.admission_number, sp.grade_level, sp.stream, sp.section, sp.sub_section, sp.enrollment_date';
    query += ' ORDER BY sp.grade_level, sp.section, sp.sub_section, p.full_name';
    
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
router.put('/:id', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, address, date_of_birth, gender, grade_level, stream, section, sub_section } = req.body;

    console.log('Updating student:', id, 'with data:', { full_name, phone, address, date_of_birth, gender, grade_level, stream, section, sub_section });

    // Update profile
    if (full_name !== undefined || phone !== undefined || address !== undefined || date_of_birth !== undefined || gender !== undefined) {
      const profileUpdates = [];
      const profileValues = [];
      
      if (full_name !== undefined) {
        profileUpdates.push('full_name = ?');
        profileValues.push(full_name);
      }
      if (phone !== undefined) {
        profileUpdates.push('phone = ?');
        profileValues.push(phone);
      }
      if (address !== undefined) {
        profileUpdates.push('address = ?');
        profileValues.push(address);
      }
      if (date_of_birth !== undefined) {
        profileUpdates.push('date_of_birth = ?');
        profileValues.push(date_of_birth);
      }
      if (gender !== undefined) {
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
    if (grade_level !== undefined || stream !== undefined || section !== undefined || sub_section !== undefined) {
      const studentUpdates = [];
      const studentValues = [];
      
      if (grade_level !== undefined) {
        studentUpdates.push('grade_level = ?');
        studentValues.push(grade_level);
      }
      if (stream !== undefined) {
        studentUpdates.push('stream = ?');
        studentValues.push(stream);
      }
      if (section !== undefined) {
        studentUpdates.push('section = ?');
        studentValues.push(section);
      }
      if (sub_section !== undefined) {
        studentUpdates.push('sub_section = ?');
        studentValues.push(sub_section);
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
    const userId = req.userId;
    
    // Get student's profile to check grade level and stream
    const [profile] = await pool.query(`
      SELECT sp.grade_level, sp.stream
      FROM student_profiles sp
      WHERE sp.user_id = ?
    `, [userId]);
    
    if (profile.length === 0) {
      return res.json({
        totalGrades: 0,
        avgScore: 0
      });
    }
    
    const { grade_level, stream } = profile[0];
    
    // Get current academic year and term from system settings
    const [settings] = await pool.query('SELECT setting_key, setting_value FROM system_settings');
    const currentTerm = settings.find(s => s.setting_key === 'current_term')?.setting_value || 'Semester 1';
    const currentYear = settings.find(s => s.setting_key === 'current_academic_year')?.setting_value || '2025-2026';
    
    // Check if rankings are approved for this student's grade/stream
    const [approval] = await pool.query(
      `SELECT id FROM ranking_approvals 
       WHERE grade_level = ? 
       AND (stream = ? OR (stream IS NULL AND ? IS NULL))
       AND term = ? AND academic_year = ?`,
      [grade_level, stream, stream, currentTerm, currentYear]
    );
    
    const isApproved = approval.length > 0;
    
    // Get student's assessment scores count
    const [gradeStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_grades,
        AVG(score) as average_score
      FROM assessment_scores
      WHERE student_id = ?
    `, [userId]);
    
    res.json({
      totalGrades: gradeStats[0]?.total_grades || 0,
      // Only show average score if rankings are approved
      avgScore: isApproved && gradeStats[0]?.average_score ? Math.round(gradeStats[0].average_score) : 0
    });
  } catch (error) {
    console.error('Get student stats error:', error);
    res.status(500).json({ error: 'Failed to fetch student stats' });
  }
});

export default router;
