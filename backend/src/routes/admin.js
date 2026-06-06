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
  body('next_academic_year').matches(/^\d{4}-\d{4}(\s*E\.C\.?)?$/i).withMessage('next_academic_year is required (e.g. 2019-2020 E.C.)')
], async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { next_academic_year } = req.body;
    
    // Get current academic year from system settings
    const [currentYearSettings] = await connection.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'current_academic_year'"
    );
    const currentYear = currentYearSettings[0]?.setting_value;

    if (!currentYear) {
      return res.status(400).json({ error: 'Current academic year is not set in system settings.' });
    }

    // BLOCK: Year must be archived before promotion (ensures both semesters are done)
    const [archived] = await connection.query(
      'SELECT COUNT(*) as count FROM academic_year_results WHERE academic_year = ?',
      [currentYear]
    );

    if (archived[0].count === 0) {
      return res.status(400).json({
        error: `Cannot run promotion: the year ${currentYear} has not been archived yet. Both semesters must be finished and the year must be archived before promoting students.`,
        requires_archive: true
      });
    }

    // BLOCK: Check both semesters have data
    const [semData] = await connection.query(`
      SELECT DISTINCT term FROM assessment_scores
      WHERE academic_year = ? AND published = TRUE
    `, [currentYear]);

    const terms = semData.map(r => r.term);
    const hasSem1 = terms.includes('Semester 1');
    const hasSem2 = terms.includes('Semester 2');

    if (!hasSem1 || !hasSem2) {
      const missing = [];
      if (!hasSem1) missing.push('Semester 1');
      if (!hasSem2) missing.push('Semester 2');
      return res.status(400).json({
        error: `Cannot run promotion: ${missing.join(' and ')} scores are missing for ${currentYear}. Both semesters must be completed before year-end promotion.`,
        missing_semesters: missing
      });
    }

    await connection.beginTransaction();

    // Use the archived summaries (full-year, term=NULL) for promotion decisions
    const [summaries] = await connection.query(`
      SELECT 
        ays.student_id,
        ays.grade_level,
        ays.average_score,
        sp.stream
      FROM academic_year_summaries ays
      INNER JOIN student_profiles sp ON ays.student_id = sp.user_id
      WHERE ays.academic_year = ? AND ays.term IS NULL
    `, [currentYear]);

    const results = [];
    let promoted = 0;
    let retained = 0;
    let graduated = 0;

    for (const student of summaries) {
      const gradeLevel = student.grade_level;
      const average = parseFloat(student.average_score) || 0;
      
      let status;
      let newGrade;
      let newStream = student.stream;

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
        if (passed) promoted++; else retained++;
        if (status === 'promoted' && gradeLevel === 10) newStream = null;
      }

      if (newGrade !== null) {
        await connection.query(
          'UPDATE student_profiles SET grade_level = ?, stream = ? WHERE user_id = ?',
          [newGrade, newStream, student.student_id]
        );
      } else {
        await connection.query(
          'UPDATE profiles SET is_active = FALSE WHERE user_id = ?',
          [student.student_id]
        );
      }

      // Update summary status
      await connection.query(
        `UPDATE academic_year_summaries SET status = ? WHERE student_id = ? AND academic_year = ?`,
        [status, student.student_id, currentYear]
      );

      results.push({
        user_id: student.student_id,
        old_grade: gradeLevel,
        new_grade: newGrade,
        average: Math.round(average * 100) / 100,
        status
      });
    }

    // Update system academic year to next year, reset to Semester 1
    await connection.query(
      "UPDATE system_settings SET setting_value = ? WHERE setting_key = 'current_academic_year'",
      [next_academic_year]
    );
    await connection.query(
      "UPDATE system_settings SET setting_value = 'Semester 1' WHERE setting_key = 'current_term'"
    );

    await connection.commit();

    res.json({
      success: true,
      summary: { total: results.length, promoted, retained, graduated },
      results,
      previous_year: currentYear,
      new_year: next_academic_year,
      message: `Promotion complete. Academic year advanced to ${next_academic_year} · Semester 1.`
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
    const { grade_level, stream } = req.query;

    // Get current academic year
    const [settings] = await pool.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('current_academic_year', 'current_term')"
    );
    const currentYear = settings.find(s => s.setting_key === 'current_academic_year')?.setting_value;
    const currentTerm = settings.find(s => s.setting_key === 'current_term')?.setting_value;

    // Total user counts by role
    const [userCounts] = await pool.query(`
      SELECT role, COUNT(*) as count FROM user_roles GROUP BY role
    `);

    // Build student filter for grade/stream
    let studentJoinFilter = '';
    const filterParams = [];
    if (grade_level && grade_level !== 'all') {
      studentJoinFilter += ' AND sp.grade_level = ?';
      filterParams.push(parseInt(grade_level));
    }
    if (stream && stream !== 'all') {
      studentJoinFilter += ' AND sp.stream = ?';
      filterParams.push(stream);
    }

    // Gender stats (filtered)
    const [genderStats] = await pool.query(`
      SELECT COALESCE(LOWER(p.gender), 'unknown') as gender, COUNT(*) as count
      FROM profiles p
      INNER JOIN user_roles ur ON p.user_id = ur.user_id
      LEFT JOIN student_profiles sp ON p.user_id = sp.user_id
      WHERE ur.role = 'student' ${studentJoinFilter.replace(/^AND/, 'AND')}
      GROUP BY COALESCE(LOWER(p.gender), 'unknown')
    `, filterParams);

    // Real subject averages from assessment_scores (per-subject weighted totals)
    let subjectAvgFilter = '';
    const subjectAvgParams = [];
    if (currentYear) { subjectAvgFilter += ' AND s_score.academic_year = ?'; subjectAvgParams.push(currentYear); }
    if (grade_level && grade_level !== 'all') { subjectAvgFilter += ' AND at.grade_level = ?'; subjectAvgParams.push(parseInt(grade_level)); }
    if (stream && stream !== 'all') { subjectAvgFilter += " AND (at.stream = ? OR at.stream = 'Common' OR at.stream IS NULL)"; subjectAvgParams.push(stream); }

    const [subjectAverages] = await pool.query(`
      SELECT 
        sub.subject_name,
        ROUND(AVG(subject_totals.subject_score), 1) as average
      FROM (
        SELECT s_score.student_id, at.subject_id, SUM(s_score.score) as subject_score
        FROM assessment_scores s_score
        INNER JOIN assessment_types at ON s_score.assessment_type_id = at.id
        WHERE s_score.published = TRUE ${subjectAvgFilter}
        GROUP BY s_score.student_id, at.subject_id
      ) subject_totals
      INNER JOIN subjects sub ON subject_totals.subject_id = sub.id
      GROUP BY sub.id, sub.subject_name
      ORDER BY average DESC
    `, subjectAvgParams);

    // Real score distribution from per-subject totals
    const [scoreRows] = await pool.query(`
      SELECT subject_totals.subject_score as score
      FROM (
        SELECT s_score.student_id, at.subject_id, SUM(s_score.score) as subject_score
        FROM assessment_scores s_score
        INNER JOIN assessment_types at ON s_score.assessment_type_id = at.id
        INNER JOIN student_profiles sp ON s_score.student_id = sp.user_id
        WHERE s_score.published = TRUE ${subjectAvgFilter}
        GROUP BY s_score.student_id, at.subject_id
      ) subject_totals
    `, subjectAvgParams);

    const ranges = [
      { range: '0-20', min: 0, max: 20 },
      { range: '21-40', min: 21, max: 40 },
      { range: '41-60', min: 41, max: 60 },
      { range: '61-80', min: 61, max: 80 },
      { range: '81-100', min: 81, max: 100 },
    ];
    const scoreDistribution = ranges.map(r => ({
      range: r.range,
      count: scoreRows.filter(s => s.score >= r.min && s.score <= r.max).length
    }));

    // Yearly trends from academic_year_summaries
    const [yearlyTrends] = await pool.query(`
      SELECT academic_year as year, ROUND(AVG(average_score), 1) as average
      FROM academic_year_summaries
      GROUP BY academic_year
      ORDER BY academic_year ASC
      LIMIT 6
    `);

    const stats = {
      users: {},
      totalStudents: 0,
      totalTeachers: 0,
      genderStats: genderStats
        .filter(g => g.gender !== 'unknown')
        .map(g => ({ name: g.gender.charAt(0).toUpperCase() + g.gender.slice(1), value: parseInt(g.count) })),
      subjectAverages: subjectAverages.map(s => ({ name: s.subject_name, average: Number(s.average) })),
      scoreDistribution,
      yearlyTrends: yearlyTrends.map(t => ({ year: t.year, average: Number(t.average) })),
    };

    userCounts.forEach(item => {
      stats.users[item.role] = item.count;
      if (item.role === 'student') stats.totalStudents = item.count;
      if (item.role === 'teacher') stats.totalTeachers = item.count;
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

// Debug endpoint to check student profiles
router.get('/debug/students', authenticate, authorize('admin', 'director'), async (req, res) => {
  try {
    const [students] = await pool.query(`
      SELECT 
        u.id,
        u.username,
        p.full_name,
        p.gender,
        ur.role
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN user_roles ur ON u.id = ur.user_id
      WHERE ur.role = 'student'
      ORDER BY u.id
    `);
    res.json(students);
  } catch (error) {
    console.error('Debug students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Rollback year-end promotion (Admin only)
// Restores student grade levels to what they were in the archived year summary
router.post('/rollback-promotion', authenticate, authorize('admin'), [
  body('academic_year').matches(/^\d{4}-\d{4}(\s*E\.C\.?)?$/i)
], async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { academic_year } = req.body;

    // Get the archived summaries (term=NULL = full year) for this year
    const [summaries] = await connection.query(`
      SELECT student_id, grade_level, status
      FROM academic_year_summaries
      WHERE academic_year = ? AND term IS NULL
    `, [academic_year]);

    if (summaries.length === 0) {
      return res.status(404).json({
        error: `No archived data found for ${academic_year}. Cannot rollback.`
      });
    }

    await connection.beginTransaction();

    let restored = 0;
    let reactivated = 0;

    for (const s of summaries) {
      if (s.status === 'graduated') {
        // Re-activate graduated students and put them back at grade 12
        await connection.query(
          'UPDATE profiles SET is_active = TRUE WHERE user_id = ?',
          [s.student_id]
        );
        await connection.query(
          'UPDATE student_profiles SET grade_level = 12 WHERE user_id = ?',
          [s.student_id]
        );
        reactivated++;
      } else if (s.status === 'promoted') {
        // Demote back: grade_level was archived grade, so current is grade+1
        // Restore to the archived grade
        await connection.query(
          'UPDATE student_profiles SET grade_level = ? WHERE user_id = ?',
          [s.grade_level, s.student_id]
        );
        // Restore stream for grade 10→11 reversal (grade was 10, now back to 10)
        if (s.grade_level === 10) {
          // Stream was cleared when moving to 11 — keep as null; admin can reassign
        }
        restored++;
      }
      // retained students: grade didn't change, nothing to rollback

      // Reset status back to pending so re-promotion can run cleanly
      await connection.query(
        `UPDATE academic_year_summaries SET status = 'pending'
         WHERE student_id = ? AND academic_year = ?`,
        [s.student_id, academic_year]
      );
    }

    await connection.commit();

    res.json({
      message: `Promotion rolled back for ${academic_year}`,
      restored,
      reactivated,
      total: summaries.length
    });
  } catch (error) {
    await connection.rollback();
    console.error('Rollback promotion error:', error);
    res.status(500).json({ error: 'Failed to rollback promotion' });
  } finally {
    connection.release();
  }
});

export default router;
