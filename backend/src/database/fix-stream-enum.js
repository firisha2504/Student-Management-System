import pool from '../config/database.js';

/**
 * Fix the stream ENUM to use 'natural' and 'social' instead of 'Science', 'Arts', 'Commerce'
 */
async function fixStreamEnum() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔧 Fixing stream ENUM values...\n');
    
    // Modify student_profiles table
    console.log('Updating student_profiles.stream column...');
    await connection.query(`
      ALTER TABLE student_profiles 
      MODIFY COLUMN stream ENUM('natural', 'social') NULL
    `);
    console.log('✅ student_profiles.stream updated\n');
    
    console.log('✅ Stream ENUM fixed successfully!');
    console.log('Now students can select:');
    console.log('  - natural (Natural Science)');
    console.log('  - social (Social Science)\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

fixStreamEnum()
  .then(() => {
    console.log('✅ Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
