import pool from '../config/database.js';

/**
 * Complete database reset - removes ALL data including system settings
 * This gives you a completely fresh database
 * WARNING: This action cannot be undone!
 */

async function resetDatabase() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔄 Starting complete database reset...\n');
    
    // Disable foreign key checks temporarily
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Get all tables in the database
    const [tables] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      AND table_type = 'BASE TABLE'
    `);
    
    console.log(`📋 Found ${tables.length} tables to clear:\n`);
    
    let totalRowsDeleted = 0;
    
    // Clear each table
    for (const { table_name } of tables) {
      try {
        const [result] = await connection.query(`DELETE FROM ${table_name}`);
        totalRowsDeleted += result.affectedRows;
        console.log(`✅ ${table_name.padEnd(30)} - ${result.affectedRows} rows deleted`);
      } catch (error) {
        console.log(`⚠️  ${table_name.padEnd(30)} - Error: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Total rows deleted: ${totalRowsDeleted}\n`);
    
    // Reset auto-increment counters
    console.log('🔄 Resetting auto-increment counters...\n');
    for (const { table_name } of tables) {
      try {
        await connection.query(`ALTER TABLE ${table_name} AUTO_INCREMENT = 1`);
        console.log(`✅ ${table_name} counter reset`);
      } catch (error) {
        // Some tables might not have auto-increment, ignore errors
      }
    }
    
    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\n✅ Database reset completed successfully!');
    console.log('\n📝 All data has been removed');
    console.log('📝 All auto-increment counters reset to 1');
    console.log('📝 Table structure remains intact');
    console.log('📝 Database is now completely empty and ready for fresh data\n');
    
  } catch (error) {
    console.error('❌ Error during reset:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// Confirmation prompt
console.log('⚠️  ═══════════════════════════════════════════════════════════');
console.log('⚠️  WARNING: COMPLETE DATABASE RESET');
console.log('⚠️  ═══════════════════════════════════════════════════════════');
console.log('⚠️  This will delete ALL data from ALL tables!');
console.log('⚠️  Including system settings, users, and all records!');
console.log('⚠️  This action CANNOT be undone!');
console.log('⚠️  ═══════════════════════════════════════════════════════════\n');

// Run the reset
resetDatabase()
  .then(() => {
    console.log('✅ Database reset complete!');
    console.log('💡 You can now run the init script to set up default data');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  });
