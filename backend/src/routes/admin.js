import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for logo upload
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/logo';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `school-logo${ext}`);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Promote students to next grade
router.post('/promote-students', authenticate, authorize('admin'), [
  body('academic_year').optional().matches(/^\d{4}-\d{4}$/)
], async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let { academic_year } = req.body;
    
    // Get current academic year from system settings
    const [currentYearSettings] = await connection.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'current_academic_year'"
    );
    const currentYear = currentYearSettings[0]?.setting_value;
    
    // Auto-generate new academic year if not provided
    if (!academic_year) {
      const now = new Date();
      const year = now.getFullYear();
      academic_year = `${year}-${year + 1}`;
    }

    await connection.beginTransaction();

    // Get all students with their grades from CURRENT year
    const [students] = await connection.query(`
      SELECT 
        u.id as user_id,
        p.full_name,
        sp.grade_level,
        sp.stream,
        AVG(g.score) as average_score,
        COUNT(g.id) as total_grades
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN student_profiles sp ON u.id = sp.user_id
      LEFT JOIN grades g ON u.id = g.student_id AND g.academic_year = ?
      WHERE ur.role = 'student' AND sp.grade_level IS NOT NULL
      GROUP BY u.id, p.full_name, sp.grade_level, sp.stream
    `, [currentYear]);

    const results = [];
    let promoted = 0;
    let retained = 0;
    let graduated = 0;

    for (const student of students) {
      const gradeLevel = student.grade_level;
      const average = student.average_score || 0;
      
      let status;
      let newGrade;
      let newStream = student.stream;

      // Determine promotion status
      if (gradeLevel >= 12) {
        if (average >= 50) {
          status = 'graduated';
          newGrade = null;
          graduated++;
        } else {
          status = 'retained';
          newGrade = 12;
          retained++;
        }
      } else {
        const passed = average >= 50;
        status = passed ? 'promoted' : 'retained';
        newGrade = passed ? gradeLevel + 1 : gradeLevel;
        
        if (passed) {
          promoted++;
        } else {
          retained++;
        }
        
        // Reset stream when promoting from grade 10 to 11
        if (status === 'promoted' && gradeLevel === 10) {
          newStream = null;
        }
      }

      // Update student profile with new grade
      if (newGrade !== null) {
        await connection.query(
          'UPDATE student_profiles SET grade_level = ?, stream = ? WHERE user_id = ?',
          [newGrade, newStream, student.user_id]
        );
      } else {
        // Graduated - optionally deactivate or mark as alumni
        await connection.query(
          'UPDATE profiles SET is_active = ? WHERE user_id = ?',
          [false, student.user_id]
        );
      }

      results.push({
        user_id: student.user_id,
        full_name: student.full_name,
        old_grade: gradeLevel,
        new_grade: newGrade,
        average: Math.round(average * 100) / 100,
        status
      });
    }

    // Update system settings to new academic year
    await connection.query(
      "UPDATE system_settings SET setting_value = ? WHERE setting_key = 'current_academic_year'",
      [academic_year]
    );

    await connection.commit();

    res.json({
      success: true,
      summary: {
        total: results.length,
        promoted,
        retained,
        graduated
      },
      results,
      message: `Academic year updated to ${academic_year}. Students must now register for the new year.`
    });
  } catch (error) {
    await connection.rollback();
    console.error('Promote students error:', error);
    res.status(500).json({ error: 'Failed to promote students' });
  } finally {
    connection.release();
  }
});

// System lock/unlock
router.patch('/system-lock', authenticate, authorize('admin'), [
  body('locked').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { locked } = req.body;

    await pool.query(
      "UPDATE system_settings SET setting_value = ? WHERE setting_key = 'system_locked'",
      [locked ? 'true' : 'false']
    );

    res.json({ 
      message: `System ${locked ? 'locked' : 'unlocked'} successfully`,
      locked
    });
  } catch (error) {
    console.error('System lock error:', error);
    res.status(500).json({ error: 'Failed to update system lock' });
  }
});

// Get system settings
router.get('/system-settings', authenticate, async (req, res) => {
  try {
    const [settings] = await pool.query('SELECT * FROM system_settings');
    
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.setting_key] = setting.setting_value;
    });

    res.json(settingsObj);
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
});

// Update system settings
router.patch('/system-settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { current_academic_year, current_term } = req.body;

    if (current_academic_year) {
      await pool.query(
        "UPDATE system_settings SET setting_value = ? WHERE setting_key = 'current_academic_year'",
        [current_academic_year]
      );
    }

    if (current_term) {
      await pool.query(
        "UPDATE system_settings SET setting_value = ? WHERE setting_key = 'current_term'",
        [current_term]
      );
    }

    res.json({ message: 'System settings updated successfully' });
  } catch (error) {
    console.error('Update system settings error:', error);
    res.status(500).json({ error: 'Failed to update system settings' });
  }
});

// Get dashboard statistics
router.get('/dashboard-stats', authenticate, authorize('admin', 'director', 'registrar'), async (req, res) => {
  try {
    // Total counts
    const [userCounts] = await pool.query(`
      SELECT 
        role,
        COUNT(*) as count
      FROM user_roles
      GROUP BY role
    `);

    const [gradeStats] = await pool.query(`
      SELECT 
        COUNT(*) as total_grades,
        AVG(score) as average_score,
        MIN(score) as min_score,
        MAX(score) as max_score
      FROM grades
    `);

    const [subjectAverages] = await pool.query(`
      SELECT 
        s.subject_name,
        AVG(g.score) as average_score,
        COUNT(g.id) as total_grades
      FROM grades g
      INNER JOIN subjects s ON g.subject_id = s.id
      GROUP BY s.id, s.subject_name
      ORDER BY average_score DESC
    `);

    const stats = {
      users: {},
      grades: gradeStats[0] || {},
      subjectAverages: subjectAverages || []
    };

    userCounts.forEach(item => {
      stats.users[item.role] = item.count;
    });

    res.json(stats);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Upload school logo
router.post('/upload-logo', authenticate, authorize('admin'), logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const logoUrl = `/uploads/logo/${req.file.filename}`;

    // Update system settings
    await pool.query(
      "INSERT INTO system_settings (setting_key, setting_value) VALUES ('school_logo', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
      [logoUrl, logoUrl]
    );

    res.json({ 
      message: 'Logo uploaded successfully',
      logoUrl
    });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// Delete school logo
router.delete('/delete-logo', authenticate, authorize('admin'), async (req, res) => {
  try {
    // Get current logo
    const [settings] = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'school_logo'"
    );

    if (settings.length > 0 && settings[0].setting_value) {
      const logoPath = path.join(process.cwd(), settings[0].setting_value);
      
      // Delete file if exists
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    // Remove from database
    await pool.query(
      "UPDATE system_settings SET setting_value = NULL WHERE setting_key = 'school_logo'"
    );

    res.json({ message: 'Logo deleted successfully' });
  } catch (error) {
    console.error('Delete logo error:', error);
    res.status(500).json({ error: 'Failed to delete logo' });
  }
});

export default router;
