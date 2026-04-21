import pool from '../config/database.js';

/**
 * Fix ALL stream ENUM columns to use 'natural' and 'social' instead of 'Science', 'Arts', 'Commerce'
 */
async function fixAllStreamEnums() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔧 Fixing ALL stream ENUM values across database...\n');
    
    // 1. Fix student_profiles table
    console.log('1. Updating student_profiles.stream column...');
    await connection.query(`
      ALTER TABLE student_profiles 
      MODIFY COLUMN stream ENUM('natural', 'social') NULL
    `);
    console.log('✅ student_profiles.stream updated\n');
    
    // 2. Fix subjects table
    console.log('2. Updating subjects.stream column...');
    await connection.query(`
      ALTER TABLE subjects 
      MODIFY COLUMN stream ENUM('natural', 'social', 'Common') DEFAULT NULL
    `);
    console.log('✅ subjects.stream updated\n');
    
    // 3. Fix teacher_subjects table
    console.log('3. Updating teacher_subjects.stream column...');
    await connection.query(`
      ALTER TABLE teacher_subjects 
      MODIFY COLUMN stream ENUM('natural', 'social') NULL
    `);
    console.log('✅ teacher_subjects.stream updated\n');
    
    // 4. Update any existing 'Science' values to 'natural' in subjects
    console.log('4. Migrating existing data...');
    const [scienceSubjects] = await connection.query(`
      SELECT id, subject_name FROM subjects WHERE stream = 'Science'
    `);
    if (scienceSubjects.length > 0) {
      await connection.query(`UPDATE subjects SET stream = 'natural' WHERE stream = 'Science'`);
      console.log(`   ✅ Updated ${scienceSubjects.length} subjects from 'Science' to 'natural'`);
    }
    
    const [artsSubjects] = await connection.query(`
      SELECT id, subject_name FROM subjects WHERE stream = 'Arts'
    `);
    if (artsSubjects.length > 0) {
      await connection.query(`UPDATE subjects SET stream = 'social' WHERE stream = 'Arts'`);
      console.log(`   ✅ Updated ${artsSubjects.length} subjects from 'Arts' to 'social'`);
    }
    
    const [commerceSubjects] = await connection.query(`
      SELECT id, subject_name FROM subjects WHERE stream = 'Commerce'
    `);
    if (commerceSubjects.length > 0) {
      await connection.query(`UPDATE subjects SET stream = 'Common' WHERE stream = 'Commerce'`);
      console.log(`   ✅ Updated ${commerceSubjects.length} subjects from 'Commerce' to 'Common'`);
    }
    
    console.log('\n✅ All stream ENUMs fixed successfully!');
    console.log('\nStream values are now:');
    console.log('  - natural (Natural Science stream)');
    console.log('  - social (Social Science stream)');
    console.log('  - Common (Available to all streams)\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

fixAllStreamEnums()
  .then(() => {
    console.log('✅ Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
