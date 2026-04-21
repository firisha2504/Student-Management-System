import pool from '../config/database.js';

/**
 * Prevent duplicate assessment names for the same subject/grade/stream
 * For example: Only ONE "Mid Exam" per subject per grade level
 */
async function preventDuplicateAssessments() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔧 Adding constraint to prevent duplicate assessment names...\n');
    
    // Step 1: Check for existing duplicates
    console.log('1. Checking for existing duplicates...');
    const [duplicates] = await connection.query(`
      SELECT 
        at.subject_id,
        at.grade_level,
        COALESCE(at.stream, '') as stream,
        at.assessment_name,
        COUNT(*) as count,
        GROUP_CONCAT(at.id) as ids,
        GROUP_CONCAT(CONCAT(p.full_name, ' (', at.weight, '%)') SEPARATOR ', ') as teachers
      FROM assessment_types at
      JOIN profiles p ON at.teacher_id = p.user_id
      GROUP BY at.subject_id, at.grade_level, COALESCE(at.stream, ''), at.assessment_name
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.length > 0) {
      console.log('\n⚠️  Found duplicate assessment names:');
      console.table(duplicates);
      console.log('\n❌ Please resolve these duplicates first.');
      console.log('You can either:');
      console.log('  1. Rename one of the assessments (e.g., "Mid Exam 1", "Mid Exam 2")');
      console.log('  2. Delete the duplicate assessment\n');
      
      console.log('To delete an assessment:');
      console.log('DELETE FROM assessment_types WHERE id = ?;\n');
      
      process.exit(1);
    }
    
    console.log('✅ No duplicates found\n');
    
    // Step 2: Convert NULL stream values to empty string for consistency
    console.log('2. Converting NULL stream values...');
    const [result] = await connection.query(`
      UPDATE assessment_types 
      SET stream = '' 
      WHERE stream IS NULL
    `);
    console.log(`   ✅ Updated ${result.affectedRows} rows\n`);
    
    // Step 3: Add UNIQUE constraint
    console.log('3. Adding UNIQUE constraint...');
    await connection.query(`
      ALTER TABLE assessment_types 
      ADD UNIQUE KEY unique_assessment_per_subject (
        subject_id, 
        grade_level, 
        stream, 
        assessment_name
      )
    `);
    console.log('✅ Constraint added\n');
    
    console.log('✅ Migration completed successfully!');
    console.log('\nNew behavior:');
    console.log('  - Each assessment name can only be created ONCE per subject/grade/stream');
    console.log('  - Example: Only ONE "Mid Exam" for Mathematics Grade 12');
    console.log('  - Example: Only ONE "Final Exam" for Physics Grade 11');
    console.log('  - Teachers cannot create duplicate assessment names\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

preventDuplicateAssessments()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
