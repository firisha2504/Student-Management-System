import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get current academic year and term
router.get('/current-period', authenticate, async (req, res) => {
  try {
    const [settings] = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key IN ('current_academic_year', 'current_term')"
    );
    
    const academicYear = settings.find(s => s.setting_key === 'current_academic_year')?.setting_value || '2025-2026';
    const term = settings.find(s => s.setting_key === 'current_term')?.setting_value || 'Fall';
    
    res.json({ academicYear, term });
  } catch (error) {
    console.error('Get current period error:', error);
    res.status(500).json({ error: 'Failed to fetch current period' });
  }
});

// Get student's registration status for current year
router.get('/my-status', authenticate, authorize('student'), async (req, res) => {
  try {
    // Get current academic year
    const [settings] = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'current_academic_year'"
    );
    const academicYear = settings[0]?.setting_value || '2025-2026';
    
    // Check if student has registered
    const [registrations] = await pool.query(
      `SELECT * FROM student_registrations 
       WHERE student_id = ? AND academic_year = ?`,
      [req.userId, academicYear]
    );
    
    if (registrations.length === 0) {
      return res.json({ registered: false, academicYear });
    }
    
    const registration = registrations[0];
    
    // Get enrolled courses
    const [courses] = await pool.query(
      `SELECT ce.*, s.subject_name, s.subject_code
       FROM course_enrollments ce
       JOIN subjects s ON ce.subject_id = s.id
       WHERE ce.registration_id = ?`,
      [registration.id]
    );
    
    res.json({
      registered: true,
      academicYear,
      registration,
      courses
    });
  } catch (error) {
    console.error('Get registration status error:', error);
    res.status(500).json({ error: 'Failed to fetch registration status' });
  }
});

// Get available courses for student's grade and stream
router.get('/available-courses', authenticate, authorize('student'), async (req, res) => {
  try {
    // Get student's grade and stream
    const [students] = await pool.query(
      `SELECT sp.grade_level, sp.stream
       FROM student_profiles sp
       WHERE sp.user_id = ?`,
      [req.userId]
    );
    
    if (students.length === 0) {
      return res.status(404).json({ error: 'Student profile not found' });
    }
    
    const { grade_level, stream } = students[0];
    
    // Get all subjects (in a real system, you'd filter by grade/stream)
    const [subjects] = await pool.query(
      `SELECT * FROM subjects ORDER BY subject_name`
    );
    
    res.json({ subjects, grade_level, stream });
  } catch (error) {
    console.error('Get available courses error:', error);
    res.status(500).json({ error: 'Failed to fetch available courses' });
  }
});

// Register for courses
router.post('/register', authenticate, authorize('student'), [
  body('courses').isArray().notEmpty(),
  body('courses.*.subject_id').isInt(),
  body('courses.*.credit_hours').isInt(),
  body('courses.*.ects').isInt()
], async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { courses } = req.body;
    
    // Get current academic year
    const [settings] = await connection.query(
      "SELECT setting_value FROM system_settings WHERE setting_key IN ('current_academic_year', 'current_term')"
    );
    const academicYear = settings.find(s => s.setting_key === 'current_academic_year')?.setting_value || '2025-2026';
    const term = settings.find(s => s.setting_key === 'current_term')?.setting_value || 'Fall';
    
    await connection.beginTransaction();
    
    // Check if already registered
    const [existing] = await connection.query(
      `SELECT id FROM student_registrations 
       WHERE student_id = ? AND academic_year = ? AND term = ?`,
      [req.userId, academicYear, term]
    );
    
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Already registered for this period' });
    }
    
    // Calculate totals
    const totalCreditHours = courses.reduce((sum, c) => sum + c.credit_hours, 0);
    const totalEcts = courses.reduce((sum, c) => sum + c.ects, 0);
    
    // Create registration record
    const [regResult] = await connection.query(
      `INSERT INTO student_registrations 
       (student_id, academic_year, term, total_credit_hours, total_ects, status) 
       VALUES (?, ?, ?, ?, ?, 'registered')`,
      [req.userId, academicYear, term, totalCreditHours, totalEcts]
    );
    
    const registrationId = regResult.insertId;
    
    // Enroll in courses
    for (const course of courses) {
      await connection.query(
        `INSERT INTO course_enrollments 
         (registration_id, subject_id, credit_hours, ects, instructor) 
         VALUES (?, ?, ?, ?, ?)`,
        [registrationId, course.subject_id, course.credit_hours, course.ects, course.instructor || 'TBA']
      );
    }
    
    await connection.commit();
    
    res.json({ 
      message: 'Registration successful',
      registrationId,
      totalCreditHours,
      totalEcts
    });
  } catch (error) {
    await connection.rollback();
    console.error('Register courses error:', error);
    res.status(500).json({ error: 'Failed to register courses' });
  } finally {
    connection.release();
  }
});

// Get all registrations (registrar/admin)
router.get('/all', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const { academic_year, status, grade_level } = req.query;
    
    let query = `
      SELECT 
        sr.*,
        u.username,
        p.full_name,
        sp.grade_level,
        sp.stream,
        COUNT(ce.id) as course_count
      FROM student_registrations sr
      JOIN users u ON sr.student_id = u.id
      JOIN profiles p ON sr.student_id = p.user_id
      LEFT JOIN student_profiles sp ON sr.student_id = sp.user_id
      LEFT JOIN course_enrollments ce ON sr.id = ce.registration_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (academic_year) {
      query += ' AND sr.academic_year = ?';
      params.push(academic_year);
    }
    
    if (status) {
      query += ' AND sr.status = ?';
      params.push(status);
    }
    
    if (grade_level) {
      query += ' AND sp.grade_level = ?';
      params.push(grade_level);
    }
    
    query += ' GROUP BY sr.id ORDER BY sr.registration_date DESC';
    
    const [registrations] = await pool.query(query, params);
    res.json(registrations);
  } catch (error) {
    console.error('Get all registrations error:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Get students who haven't registered yet (registrar/admin)
router.get('/unregistered', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const { academic_year } = req.query;
    
    // Get current academic year if not provided
    let year = academic_year;
    if (!year) {
      const [settings] = await pool.query(
        "SELECT setting_value FROM system_settings WHERE setting_key = 'current_academic_year'"
      );
      year = settings[0]?.setting_value || '2025-2026';
    }
    
    // Get all active students who haven't registered
    const [unregistered] = await pool.query(`
      SELECT 
        u.id as user_id,
        u.username,
        p.full_name,
        p.phone,
        sp.grade_level,
        sp.stream
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN student_registrations sr ON u.id = sr.student_id AND sr.academic_year = ?
      WHERE ur.role = 'student' 
        AND p.is_active = 1
        AND sr.id IS NULL
      ORDER BY sp.grade_level, p.full_name
    `, [year]);
    
    res.json({
      academicYear: year,
      count: unregistered.length,
      students: unregistered
    });
  } catch (error) {
    console.error('Get unregistered students error:', error);
    res.status(500).json({ error: 'Failed to fetch unregistered students' });
  }
});

// Approve/reject registration (registrar)
router.patch('/:id/approve', authenticate, authorize('registrar', 'admin'), [
  body('approved').isBoolean()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    
    await pool.query(
      'UPDATE student_registrations SET registrar_approved = ? WHERE id = ?',
      [approved, id]
    );
    
    res.json({ message: approved ? 'Registration approved' : 'Registration rejected' });
  } catch (error) {
    console.error('Approve registration error:', error);
    res.status(500).json({ error: 'Failed to update registration' });
  }
});

// Get registration period settings (registrar/admin)
router.get('/period-settings', authenticate, authorize('registrar', 'admin', 'director'), async (req, res) => {
  try {
    const [settings] = await pool.query(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE setting_key IN ('registration_open', 'registration_start_date', 'registration_end_date', 'registration_academic_year')
       ORDER BY setting_key`
    );
    
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.setting_key] = setting.setting_value;
    });
    
    res.json(settingsObj);
  } catch (error) {
    console.error('Get registration period settings error:', error);
    res.status(500).json({ error: 'Failed to fetch registration period settings' });
  }
});

// Update registration period settings (registrar/admin)
router.post('/period-settings', authenticate, authorize('registrar', 'admin'), [
  body('registration_open').isBoolean(),
  body('registration_start_date').optional().isISO8601(),
  body('registration_end_date').optional().isISO8601(),
  body('registration_academic_year').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { registration_open, registration_start_date, registration_end_date, registration_academic_year } = req.body;
    
    // Update settings
    const updates = [
      ['registration_open', registration_open.toString()]
    ];
    
    if (registration_start_date) {
      updates.push(['registration_start_date', registration_start_date]);
    }
    
    if (registration_end_date) {
      updates.push(['registration_end_date', registration_end_date]);
    }
    
    if (registration_academic_year) {
      updates.push(['registration_academic_year', registration_academic_year]);
    }
    
    for (const [key, value] of updates) {
      await pool.query(
        'UPDATE system_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?',
        [value, key]
      );
    }
    
    res.json({ message: 'Registration period settings updated successfully' });
  } catch (error) {
    console.error('Update registration period settings error:', error);
    res.status(500).json({ error: 'Failed to update registration period settings' });
  }
});

// Check if registration is currently open
router.get('/is-open', authenticate, async (req, res) => {
  try {
    const [settings] = await pool.query(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE setting_key IN ('registration_open', 'registration_start_date', 'registration_end_date')
       ORDER BY setting_key`
    );
    
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.setting_key] = setting.setting_value;
    });
    
    const isOpen = settingsObj.registration_open === 'true';
    const now = new Date();
    const startDate = settingsObj.registration_start_date ? new Date(settingsObj.registration_start_date) : null;
    const endDate = settingsObj.registration_end_date ? new Date(settingsObj.registration_end_date) : null;
    
    let isInPeriod = true;
    if (startDate && now < startDate) {
      isInPeriod = false;
    }
    if (endDate && now > endDate) {
      isInPeriod = false;
    }
    
    res.json({
      isOpen: isOpen && isInPeriod,
      manuallyOpen: isOpen,
      isInPeriod,
      startDate: settingsObj.registration_start_date,
      endDate: settingsObj.registration_end_date,
      currentDate: now.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Check registration open error:', error);
    res.status(500).json({ error: 'Failed to check registration status' });
  }
});

export default router;
