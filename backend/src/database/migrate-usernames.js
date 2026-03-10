import pool from '../config/database.js';

/**
 * Migration script to update existing usernames to new format
 * Old format: s1.001, s2.002, etc.
 * New format: firstname.lastname.MJ001
 */

async function migrateUsernames() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔄 Starting username migration...\n');
    
    await connection.beginTransaction();
    
    // Get all users with their current usernames and profiles
    const [users] = await connection.query(`
      SELECT 
        u.id as user_id,
        u.username as old_username,
        p.full_name,
        r.role,
        sp.admission_number
      FROM users u
      INNER JOIN profiles p ON u.id = p.user_id
      INNER JOIN user_roles r ON u.id = r.user_id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE u.username NOT LIKE '%.%.%'
      ORDER BY r.role, u.id
    `);
    
    if (users.length === 0) {
      console.log('✅ No users need migration. All usernames are already in the new format.\n');
      await connection.commit();
      return;
    }
    
    console.log(`📋 Found ${users.length} user(s) to migrate:\n`);
    
    const updates = [];
    
    for (const user of users) {
      // Generate new username: firstname.lastname.ID
      const nameParts = user.full_name.trim().toLowerCase().split(/\s+/);
      const nameSlug = nameParts.join('.');
      
      // Use admission_number as ID if available, otherwise use old username
      const userId = user.admission_number || user.old_username;
      const newUsername = `${nameSlug}.${userId}`;
      
      // Generate new password: pass + ID
      const newPassword = `pass${userId}`;
      
      updates.push({
        user_id: user.user_id,
        old_username: user.old_username,
        new_username: newUsername,
        new_password: newPassword,
        full_name: user.full_name,
        role: user.role,
        id: userId
      });
      
      console.log(`  ${user.role.toUpperCase()}: ${user.full_name}`);
      console.log(`    Old: ${user.old_username}`);
      console.log(`    New: ${newUsername}`);
      console.log(`    Password: ${newPassword}\n`);
    }
    
    // Ask for confirmation
    console.log('⚠️  WARNING: This will update usernames and passwords for all listed users.');
    console.log('   Users will need to use their new credentials to login.\n');
    
    // In a real scenario, you'd want to prompt for confirmation
    // For now, we'll just proceed (comment out the next line to enable auto-migration)
    throw new Error('Migration paused. Review the changes above and uncomment the migration code to proceed.');
    
    // Uncomment below to enable actual migration:
    /*
    const bcrypt = await import('bcryptjs');
    
    for (const update of updates) {
      // Update username
      await connection.query(
        'UPDATE users SET username = ? WHERE id = ?',
        [update.new_username, update.user_id]
      );
      
      // Update password
      const passwordHash = await bcrypt.hash(update.new_password, 10);
      await connection.query(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [passwordHash, update.user_id]
      );
      
      // Update credentials log
      await connection.query(
        'UPDATE credentials_log SET username = ?, password = ? WHERE user_id = ?',
        [update.new_username, update.new_password, update.user_id]
      );
    }
    
    await connection.commit();
    
    console.log('✅ Migration completed successfully!\n');
    console.log('📝 Updated credentials:');
    updates.forEach(u => {
      console.log(`   ${u.full_name}: ${u.new_username} / ${u.new_password}`);
    });
    console.log('\n⚠️  Make sure to inform users of their new credentials!\n');
    */
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// Run migration
migrateUsernames()
  .then(() => {
    console.log('Migration script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
