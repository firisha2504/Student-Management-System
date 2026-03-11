import pool from '../config/database.js';

/**
 * Clear all data from database tables
 * This script removes all data but keeps the table structure
 * WARNING: This action cannot be undone!
 */

async function clearAllData() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🗑️  Starting database cleanup...\n');
    
    // Disable foreign key checks temporarily
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // List of tables to clear (in order to avoid foreign key issues)
    const tablesToClear = [
      // Dependent tables first
      'assessment_scores',
      'grades',
      'assessment_types',
      'teacher_subjects',
      'teacher_sections',
      'teacher_sub_sections',
      'teacher_requests',
      'parent_students',
      'course_enrollments',
      'student_registrations',
      'ranking_approvals',
      'academic_year_results',
      'academic_year_summaries',
      'credentials_log',
      
      // Profile tables
      'student_profiles',
      'profiles',
      
      // Core tables
      'subjects',
      'user_roles',
      'users',
      
      // System settings (optional - comment out if you want to keep settings)
      // 'system_settings',
    ];
    
    console.log('📋 Tables to clear:');
    tablesToClear.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table}`);
    });
    console.log('');
    
    // Clear each table
    for (const table of tablesToClear) {
      try {
        const [result] = await connection.query(`DELETE FROM ${table}`);
        console.log(`✅ Cleared ${table} - ${result.affectedRows} rows deleted`);
      } catch (error) {
        console.log(`⚠️  Warning: Could not clear ${table} - ${error.message}`);
      }
    }
    
    // Reset auto-increment counters
    console.log('\n🔄 Resetting auto-increment counters...');
    for (const table of tablesToClear) {
      try {
        await connection.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
        console.log(`✅ Reset ${table} counter`);
      } catch (error) {
        // Some tables might not have auto-increment, ignore errors
      }
    }
    
    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\n✅ Database cleanup completed successfully!');
    console.log('\n📝 Note: System settings were preserved (if uncommented)');
    console.log('📝 Note: Table structure remains intact');
    console.log('📝 Note: You can now start fresh with an empty database\n');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// Confirmation prompt
console.log('⚠️  WARNING: This will delete ALL data from the database!');
console.log('⚠️  This action CANNOT be undone!');
console.log('⚠️  Table structure will be preserved.\n');

// Run the cleanup
clearAllData()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
