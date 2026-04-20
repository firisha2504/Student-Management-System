import pool from '../config/database.js';

/**
 * Add staff_id column to profiles table for non-student users
 */
async function addStaffIdColumn() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔧 Adding staff_id column to profiles table...\n');
    
    // Check if column already exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'profiles' 
      AND COLUMN_NAME = 'staff_id'
    `);
    
    if (columns.length > 0) {
      console.log('ℹ️  staff_id column already exists');
      return;
    }
    
    // Add staff_id column
    await connection.query(`
      ALTER TABLE profiles 
      ADD COLUMN staff_id VARCHAR(50) UNIQUE NULL AFTER user_id
    `);
    
    console.log('✅ staff_id column added successfully\n');
    
    // Now populate staff_id for existing non-student users
    console.log('🔄 Populating staff_id for existing staff members...\n');
    
    const [staffUsers] = await connection.query(`
      SELECT u.id, u.username, r.role
      FROM users u
      INNER JOIN user_roles r ON u.id = r.user_id
      WHERE r.role IN ('teacher', 'registrar', 'admin', 'director', 'parent')
    `);
    
    console.log(`Found ${staffUsers.length} staff members to update\n`);
    
    for (const user of staffUsers) {
      // Extract the ID part from username (e.g., registrar.MJR001 -> MJR001)
      const match = user.username.match(/\.(MJ[A-Z]\d+)$/);
      const staffId = match ? match[1] : user.username;
      
      await connection.query(
        'UPDATE profiles SET staff_id = ? WHERE user_id = ?',
        [staffId, user.id]
      );
      
      console.log(`✅ ${user.role.padEnd(10)} - User ID: ${user.id} - Staff ID: ${staffId}`);
    }
    
    console.log('\n✅ All staff members updated successfully!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

addStaffIdColumn()
  .then(() => {
    console.log('✅ Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
