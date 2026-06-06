import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get current academic year and term from system settings
router.get('/current', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('current_academic_year', 'current_term')"
    );
    const settings = {};
    rows.forEach((r) => { settings[r.setting_key] = r.setting_value; });
    res.json({
      academic_year: settings['current_academic_year'] || null,
      term: settings['current_term'] || null,
    });
  } catch (error) {
    console.error('Get current academic year error:', error);
    res.status(500).json({ error: 'Failed to fetch current academic year' });
  }
});

// Update current academic year / term in system settings
router.patch('/current', authenticate, authorize('registrar', 'admin'), async (req, res) => {
  try {
    const { academic_year, term } = req.body;

    // Validate format - only Ethiopian Calendar single-year format: YYYY E.C.
    if (academic_year && !/^\d{4}\s*E\.C\.?$/i.test(academic_year)) {
      return res.status(400).json({ error: 'Invalid academic_year format. Use Ethiopian Calendar format: YYYY E.C. (e.g. 2018 E.C.)' });
    }

    if (academic_year !== undefined) {
      await pool.query(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('current_academic_year', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
        [academic_year, academic_year]
      );
    }
    if (term !== undefined) {
      await pool.query(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('current_term', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
        [term, term]
      );
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update current academic year error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Archive academic year (Registrar only)
router.post('/archive', authenticate, authorize('registrar', 'admin'), [
  body('academic_year').matches(/^\d{4}\s*E\.C\.?$/i)
], async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { academic_year } = req.body;

    // Check if already archived
    const [existing] = await connection.query(
      'SELECT COUNT(*) as count FROM academic_year_results WHERE academic_year = ?',
      [academic_year]
    );
    if (existing[0].count > 0) {
      return res.status(400).json({ error: 'This academic year has already been archived' });
    }

    // Check that BOTH semesters have published scores — year not complete otherwise
    const [semesterData] = await connection.query(`
      SELECT DISTINCT term FROM assessment_scores
      WHERE academic_year = ? AND published = TRUE
    `, [academic_year]);

    const semestersWithData = semesterData.map(r => r.term);
    const hasSem1 = semestersWithData.includes('Semester 1');
    const hasSem2 = semestersWithData.includes('Semester 2');

    if (!hasSem1 || !hasSem2) {
      const missing = [];
      if (!hasSem1) missing.push('Semester 1');
      if (!hasSem2) missing.push('Semester 2');
      return res.status(400).json({
        error: `Cannot archive: ${missing.join(' and ')} scores are missing. Both semesters must have published scores before archiving the year.`,
        missing_semesters: missing
      });
    }

    await connection.beginTransaction();

    // Get all active students with grade levels
    const [students] = await connection.query(`
      SELECT DISTINCT
        sp.user_id,
        sp.grade_level,
        sp.stream,
        sp.sub_section,
        p.full_name
      FROM student_profiles sp
      INNER JOIN profiles p ON sp.user_id = p.user_id
      WHERE p.is_active = TRUE AND sp.grade_level IS NOT NULL
    `);

    console.log(`Found ${students.length} active students`);

    let archived_students = 0;
    let archived_subjects = 0;

    // Helper: compute per-subject weighted totals for a student/year/term filter
    const getSubjectTotals = async (userId, year, term) => {
      return connection.query(`
        SELECT 
          at.subject_id,
          s.subject_name,
          SUM(ascore.score * at.weight / 100) as weighted_score
        FROM assessment_types at
        INNER JOIN subjects s ON at.subject_id = s.id
        INNER JOIN assessment_scores ascore ON at.id = ascore.assessment_type_id 
          AND ascore.student_id = ? 
          AND ascore.academic_year = ?
          AND ascore.term = ?
          AND ascore.published = TRUE
        WHERE at.grade_level = (
          SELECT grade_level FROM student_profiles WHERE user_id = ?
        )
        GROUP BY at.subject_id, s.subject_name
        HAVING weighted_score IS NOT NULL
      `, [userId, year, term, userId]);
    };

    // Helper: insert per-semester summary
    const insertSemesterSummary = async (student, year, term, subjectScores) => {
      if (subjectScores.length === 0) return;

      const student_total = subjectScores.reduce((s, r) => s + parseFloat(r.weighted_score), 0);
      const subject_count = subjectScores.length;
      const average_score = student_total / subject_count;

      // Rank within group for this semester
      const [groupStudents] = await connection.query(`
        SELECT student_id, SUM(weighted_score) as total
        FROM (
          SELECT ascore.student_id, SUM(ascore.score * at.weight / 100) as weighted_score
          FROM assessment_scores ascore
          INNER JOIN assessment_types at ON ascore.assessment_type_id = at.id
          INNER JOIN student_profiles sp2 ON ascore.student_id = sp2.user_id
          WHERE ascore.academic_year = ? AND ascore.term = ? AND ascore.published = TRUE
            AND sp2.grade_level = ?
            AND (sp2.stream = ? OR ? IS NULL OR ? = '')
            AND (sp2.sub_section = ? OR ? IS NULL)
          GROUP BY ascore.student_id, at.subject_id
        ) t
        GROUP BY student_id
        ORDER BY total DESC
      `, [year, term, student.grade_level,
          student.stream, student.stream, student.stream,
          student.sub_section, student.sub_section]);

      const total_students = groupStudents.length;
      const rank_position = Math.max(1, groupStudents.findIndex(s => s.student_id === student.user_id) + 1);

      await connection.query(
        `INSERT INTO academic_year_summaries 
         (student_id, academic_year, term, grade_level, stream, sub_section, total_score, average_score, rank_position, total_students, subject_count, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
         ON DUPLICATE KEY UPDATE
           total_score = VALUES(total_score),
           average_score = VALUES(average_score),
           rank_position = VALUES(rank_position),
           total_students = VALUES(total_students),
           subject_count = VALUES(subject_count)`,
        [student.user_id, year, term, student.grade_level, student.stream,
         student.sub_section, student_total, average_score, rank_position, total_students, subject_count]
      );
    };

    for (const student of students) {
      console.log(`Processing: ${student.full_name} (Grade ${student.grade_level})`);

      // Get combined (full-year) subject totals across both semesters
      const [fullYearScores] = await connection.query(`
        SELECT 
          at.subject_id,
          s.subject_name,
          SUM(ascore.score * at.weight / 100) as weighted_score
        FROM assessment_types at
        INNER JOIN subjects s ON at.subject_id = s.id
        INNER JOIN assessment_scores ascore ON at.id = ascore.assessment_type_id 
          AND ascore.student_id = ? 
          AND ascore.academic_year = ?
          AND ascore.published = TRUE
        WHERE at.grade_level = ?
          AND (at.stream IS NULL OR at.stream = '' OR at.stream = ?)
          AND (at.sub_section IS NULL OR at.sub_section = ?)
        GROUP BY at.subject_id, s.subject_name
        HAVING weighted_score IS NOT NULL
      `, [student.user_id, academic_year, student.grade_level,
          student.stream || '', student.sub_section || null]);

      if (fullYearScores.length === 0) continue;

      // Archive subject results (full year combined)
      for (const subject of fullYearScores) {
        await connection.query(
          `INSERT INTO academic_year_results 
           (student_id, academic_year, grade_level, stream, sub_section, subject_id, subject_name, total_score) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [student.user_id, academic_year, student.grade_level, student.stream,
           student.sub_section, subject.subject_id, subject.subject_name, subject.weighted_score]
        );
        archived_subjects++;
      }

      // Per-semester summaries
      const [sem1Scores] = await getSubjectTotals(student.user_id, academic_year, 'Semester 1');
      const [sem2Scores] = await getSubjectTotals(student.user_id, academic_year, 'Semester 2');
      await insertSemesterSummary(student, academic_year, 'Semester 1', sem1Scores);
      await insertSemesterSummary(student, academic_year, 'Semester 2', sem2Scores);

      // Full-year combined summary
      const student_total = fullYearScores.reduce((s, r) => s + parseFloat(r.weighted_score), 0);
      const subject_count = fullYearScores.length;
      const average_score = student_total / subject_count;

      // Rank in full-year group
      const [groupStudents] = await connection.query(`
        SELECT 
          ayr.student_id,
          SUM(ayr.total_score) as total_score
        FROM academic_year_results ayr
        WHERE ayr.academic_year = ?
          AND ayr.grade_level = ?
          AND (ayr.stream = ? OR (ayr.stream IS NULL AND ? IS NULL))
          AND (ayr.sub_section = ? OR (ayr.sub_section IS NULL AND ? IS NULL))
        GROUP BY ayr.student_id
        ORDER BY total_score DESC
      `, [academic_year, student.grade_level,
          student.stream, student.stream,
          student.sub_section, student.sub_section]);

      const total_students = groupStudents.length;
      const rank_position = Math.max(1, groupStudents.findIndex(s => s.student_id === student.user_id) + 1);
      const archiveStatus = average_score >= 50
        ? (student.grade_level >= 12 ? 'graduated' : 'promoted')
        : 'retained';

      // term = NULL means full-year combined summary
      await connection.query(
        `INSERT INTO academic_year_summaries 
         (student_id, academic_year, term, grade_level, stream, sub_section, total_score, average_score, rank_position, total_students, subject_count, status)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           total_score = VALUES(total_score),
           average_score = VALUES(average_score),
           rank_position = VALUES(rank_position),
           total_students = VALUES(total_students),
           subject_count = VALUES(subject_count),
           status = VALUES(status)`,
        [student.user_id, academic_year, student.grade_level, student.stream,
         student.sub_section, student_total, average_score, rank_position, total_students,
         subject_count, archiveStatus]
      );

      archived_students++;
    }

    await connection.commit();

    res.json({
      message: 'Academic year archived successfully',
      academic_year,
      archived_students,
      archived_subjects
    });
  } catch (error) {
    await connection.rollback();
    console.error('Archive academic year error:', error);
    res.status(500).json({ error: 'Failed to archive academic year' });
  } finally {
    connection.release();
  }
});

// Get archived academic history for a student
router.get('/history/:studentId', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get full-year summaries (term IS NULL)
    const [summaries] = await pool.query(`
      SELECT * FROM academic_year_summaries
      WHERE student_id = ? AND term IS NULL
      ORDER BY academic_year DESC
    `, [studentId]);

    // For each year, get per-semester summaries and subject results
    const history = [];
    for (const summary of summaries) {
      // Per-semester summaries
      const [semSummaries] = await pool.query(`
        SELECT * FROM academic_year_summaries
        WHERE student_id = ? AND academic_year = ? AND term IS NOT NULL
        ORDER BY term ASC
      `, [studentId, summary.academic_year]);

      // Subject results (full year)
      const [results] = await pool.query(`
        SELECT * FROM academic_year_results
        WHERE student_id = ? AND academic_year = ?
        ORDER BY subject_name
      `, [studentId, summary.academic_year]);

      history.push({
        ...summary,
        subjects: results,
        semesters: semSummaries   // Semester 1 + Semester 2 individual summaries
      });
    }

    res.json(history);
  } catch (error) {
    console.error('Get academic history error:', error);
    res.status(500).json({ error: 'Failed to fetch academic history' });
  }
});

// Get all archived years
router.get('/archived-years', authenticate, authorize('admin', 'registrar', 'director'), async (req, res) => {
  try {
    const [years] = await pool.query(`
      SELECT DISTINCT academic_year, 
        COUNT(DISTINCT student_id) as student_count,
        MIN(archived_at) as archived_at
      FROM academic_year_results
      GROUP BY academic_year
      ORDER BY academic_year DESC
    `);

    res.json(years);
  } catch (error) {
    console.error('Get archived years error:', error);
    res.status(500).json({ error: 'Failed to fetch archived years' });
  }
});

// Delete archived year (Admin or Registrar - for re-archiving)
router.delete('/archive/:academicYear', authenticate, authorize('admin', 'registrar'), async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { academicYear } = req.params;

    await connection.beginTransaction();

    await connection.query('DELETE FROM academic_year_summaries WHERE academic_year = ?', [academicYear]);
    await connection.query('DELETE FROM academic_year_results WHERE academic_year = ?', [academicYear]);

    await connection.commit();

    res.json({ message: 'Archived year deleted successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Delete archived year error:', error);
    res.status(500).json({ error: 'Failed to delete archived year' });
  } finally {
    connection.release();
  }
});

// Year-end promotion (Admin only)
router.post('/promote', authenticate, authorize('admin'), [
  body('current_year').matches(/^\d{4}\s*E\.C\.?$/i),
  body('next_year').matches(/^\d{4}\s*E\.C\.?$/i)
], async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { current_year, next_year } = req.body;

    await connection.beginTransaction();

    // Get all students with their averages
    const [students] = await connection.query(`
      SELECT 
        s.student_id,
        s.grade_level,
        s.average_score
      FROM academic_year_summaries s
      WHERE s.academic_year = ?
    `, [current_year]);

    let promoted = 0;
    let retained = 0;
    let graduated = 0;

    for (const student of students) {
      if (student.average_score >= 50) {
        // Promote or graduate
        if (student.grade_level >= 12) {
          // Graduate - deactivate account
          await connection.query(
            'UPDATE profiles SET is_active = FALSE WHERE user_id = ?',
            [student.student_id]
          );
          await connection.query(
            'UPDATE academic_year_summaries SET status = ? WHERE student_id = ? AND academic_year = ?',
            ['graduated', student.student_id, current_year]
          );
          graduated++;
        } else {
          // Promote to next grade
          await connection.query(
            'UPDATE student_profiles SET grade_level = grade_level + 1 WHERE user_id = ?',
            [student.student_id]
          );
          
          // Reset stream for students moving from grade 10 to 11
          if (student.grade_level === 10) {
            await connection.query(
              'UPDATE student_profiles SET stream = NULL WHERE user_id = ?',
              [student.student_id]
            );
          }
          
          await connection.query(
            'UPDATE academic_year_summaries SET status = ? WHERE student_id = ? AND academic_year = ?',
            ['promoted', student.student_id, current_year]
          );
          promoted++;
        }
      } else {
        // Retain in same grade
        await connection.query(
          'UPDATE academic_year_summaries SET status = ? WHERE student_id = ? AND academic_year = ?',
          ['retained', student.student_id, current_year]
        );
        retained++;
      }
    }

    // Update system academic year
    await connection.query(
      'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
      [next_year, 'current_academic_year']
    );

    await connection.commit();

    res.json({
      message: 'Year-end promotion completed successfully',
      promoted,
      retained,
      graduated,
      total: promoted + retained + graduated
    });
  } catch (error) {
    await connection.rollback();
    console.error('Year-end promotion error:', error);
    res.status(500).json({ error: 'Failed to complete year-end promotion' });
  } finally {
    connection.release();
  }
});

export default router;
