import express from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Archive academic year (Registrar only)
router.post('/archive', authenticate, authorize('registrar', 'admin'), [
  body('academic_year').matches(/^\d{4}-\d{4}$/)
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

    await connection.beginTransaction();

    // Get all active students with their complete assessment scores
    const [students] = await connection.query(`
      SELECT DISTINCT
        sp.user_id,
        sp.grade_level,
        sp.stream,
        sp.sub_section,
        p.full_name
      FROM student_profiles sp
      INNER JOIN profiles p ON sp.user_id = p.user_id
      WHERE p.is_active = TRUE
    `);

    let archived_students = 0;
    let archived_subjects = 0;

    for (const student of students) {
      // Get all subjects with complete assessments for this student
      const [subjectScores] = await connection.query(`
        SELECT 
          at.subject_id,
          s.subject_name,
          COUNT(DISTINCT at.id) as total_assessments,
          COUNT(DISTINCT asc.id) as completed_assessments,
          SUM(asc.score * at.weight / 100) as weighted_score
        FROM assessment_types at
        INNER JOIN subjects s ON at.subject_id = s.id
        LEFT JOIN assessment_scores asc ON at.id = asc.assessment_type_id 
          AND asc.student_id = ? 
          AND asc.academic_year = ?
          AND asc.published = TRUE
        WHERE at.grade_level = ?
          AND (at.stream IS NULL OR at.stream = ? OR ? IS NULL)
          AND (at.sub_section IS NULL OR at.sub_section = ? OR ? IS NULL)
        GROUP BY at.subject_id, s.subject_name
        HAVING total_assessments = completed_assessments AND total_assessments > 0
      `, [
        student.user_id, 
        academic_year, 
        student.grade_level, 
        student.stream, 
        student.stream,
        student.sub_section,
        student.sub_section
      ]);

      if (subjectScores.length > 0) {
        let student_total = 0;
        let subject_count = 0;

        // Archive each subject result
        for (const subject of subjectScores) {
          await connection.query(
            `INSERT INTO academic_year_results 
             (student_id, academic_year, grade_level, stream, sub_section, subject_id, subject_name, total_score) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              student.user_id,
              academic_year,
              student.grade_level,
              student.stream,
              student.sub_section,
              subject.subject_id,
              subject.subject_name,
              subject.weighted_score
            ]
          );

          student_total += parseFloat(subject.weighted_score);
          subject_count++;
          archived_subjects++;
        }

        // Calculate rankings for this grade/stream/sub_section group
        const [groupStudents] = await connection.query(`
          SELECT 
            ayr.student_id,
            SUM(ayr.total_score) as total_score,
            COUNT(DISTINCT ayr.subject_id) as subject_count
          FROM academic_year_results ayr
          WHERE ayr.academic_year = ?
            AND ayr.grade_level = ?
            AND (ayr.stream = ? OR (ayr.stream IS NULL AND ? IS NULL))
            AND (ayr.sub_section = ? OR (ayr.sub_section IS NULL AND ? IS NULL))
          GROUP BY ayr.student_id
          ORDER BY total_score DESC
        `, [
          academic_year,
          student.grade_level,
          student.stream,
          student.stream,
          student.sub_section,
          student.sub_section
        ]);

        const total_students = groupStudents.length;
        const rank_position = groupStudents.findIndex(s => s.student_id === student.user_id) + 1;
        const average_score = student_total / subject_count;

        // Save summary
        await connection.query(
          `INSERT INTO academic_year_summaries 
           (student_id, academic_year, grade_level, stream, sub_section, total_score, average_score, rank_position, total_students, subject_count) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            student.user_id,
            academic_year,
            student.grade_level,
            student.stream,
            student.sub_section,
            student_total,
            average_score,
            rank_position,
            total_students,
            subject_count
          ]
        );

        archived_students++;
      }
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

    // Get summaries
    const [summaries] = await pool.query(`
      SELECT * FROM academic_year_summaries
      WHERE student_id = ?
      ORDER BY academic_year DESC
    `, [studentId]);

    // Get detailed results for each year
    const history = [];
    for (const summary of summaries) {
      const [results] = await pool.query(`
        SELECT * FROM academic_year_results
        WHERE student_id = ? AND academic_year = ?
        ORDER BY subject_name
      `, [studentId, summary.academic_year]);

      history.push({
        ...summary,
        subjects: results
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

// Delete archived year (Admin only - for re-archiving)
router.delete('/archive/:academicYear', authenticate, authorize('admin'), async (req, res) => {
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
  body('current_year').matches(/^\d{4}-\d{4}$/),
  body('next_year').matches(/^\d{4}-\d{4}$/)
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
