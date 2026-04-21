import pool from '../config/database.js';

/**
 * Enforce that only ONE teacher can teach a subject per grade level
 * Changes UNIQUE constraint from (teacher_id, subject_id, grade_level, stream)
 * to (subject_id, grade_level, stream)
 */
async function enforceOneTeacherPerSubject() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔧 Enforcing one teacher per subject per grade level...\n');
    
    // Step 1: Check for existing conflicts
    console.log('1. Checking for existing conflicts...');
    const [conflicts] = await connection.query(`
      SELECT 
        s.subject_name,
        ts.grade_level,
        ts.stream,
        GROUP_CONCAT(p.full_name SEPARATOR ', ') as teachers,
        COUNT(*) as teacher_count
      FROM teacher_subjects ts
      JOIN subjects s ON ts.subject_id = s.id
      JOIN profiles p ON ts.teacher_id = p.user_id
      GROUP BY ts.subject_id, ts.grade_level, ts.stream
      HAVING COUNT(*) > 1
    `);
    
    if (conflicts.length > 0) {
      console.log('\n⚠️  Found conflicts (multiple teachers for same subject):');
      console.table(conflicts);
      console.log('\n❌ Please resolve these conflicts first:');
      console.log('   - Keep only ONE teacher per subject per grade');
      console.log('   - Delete the duplicate assignments manually\n');
      
      console.log('SQL to view all assignments:');
      console.log('SELECT ts.id, p.full_name as teacher, s.subject_name, ts.grade_level, ts.stream');
      console.log('FROM teacher_subjects ts');
      console.log('JOIN subjects s ON ts.subject_id = s.id');
      console.log('JOIN profiles p ON ts.teacher_id = p.user_id');
      console.log('ORDER BY s.subject_name, ts.grade_level;\n');
      
      console.log('To delete a specific assignment:');
      console.log('DELETE FROM teacher_subjects WHERE id = ?;\n');
      
      process.exit(1);
    }
    
    console.log('✅ No conflicts found\n');
    
    // Step 2: Drop old constraint
    console.log('2. Dropping old UNIQUE constraint...');
    await connection.query(`
      ALTER TABLE teacher_subjects 
      DROP INDEX unique_teacher_subject
    `);
    console.log('✅ Old constraint removed\n');
    
    // Step 3: Add new constraint (subject_id, grade_level, stream)
    console.log('3. Adding new UNIQUE constraint...');
    await connection.query(`
      ALTER TABLE teacher_subjects 
      ADD UNIQUE KEY unique_subject_grade_stream (subject_id, grade_level, stream)
    `);
    console.log('✅ New constraint added\n');
    
    console.log('✅ Migration completed successfully!');
    console.log('\nNew behavior:');
    console.log('  - Only ONE teacher can teach a subject per grade level');
    console.log('  - Example: English G12 can only be assigned to ONE teacher');
    console.log('  - Attempting to assign a second teacher will be rejected\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

enforceOneTeacherPerSubject()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
