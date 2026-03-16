import pool from '../config/database.js';
import bcrypt from 'bcryptjs';

/**
 * Setup default admin user and system settings
 * Run this after clearing the database to get started
 */

async function setupDefaultAdmin() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔧 Setting up default admin and system settings...\n');
    
    await connection.beginTransaction();
    
    // 1. Create default admin user
    console.log('👤 Creating default admin user...');
    const passwordHash = await bcrypt.hash('admin123', 10);
    const [adminResult] = await connection.query(
      `INSERT INTO users (username, email, password_hash) 
       VALUES (?, ?, ?)`,
      ['MJA001', 'admin@school.com', passwordHash]
    );
    const adminUserId = adminResult.insertId;
    console.log(`✅ Admin user created (ID: ${adminUserId})`);
    
    // 2. Assign admin role
    console.log('🔑 Assigning admin role...');
    await connection.query(
      `INSERT INTO user_roles (user_id, role) VALUES (?, 'admin')`,
      [adminUserId]
    );
    console.log('✅ Admin role assigned');
    
    // 2. Create admin profile
    console.log('📝 Creating admin profile...');
    await connection.query(
      `INSERT INTO profiles (user_id, full_name, phone) 
       VALUES (?, ?, ?)`,
      [adminUserId, 'System Administrator', null]
    );
    console.log('✅ Admin profile created');
    
    // 3. Set up system settings
    console.log('⚙️  Setting up system settings...');
    
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}-${currentYear + 1}`;
    
    const settings = [
      ['current_academic_year', academicYear],
      ['current_term', 'Term 1'],
      ['school_name', 'Grade Hub School'],
      ['registration_open', 'true'],
    ];
    
    for (const [key, value] of settings) {
      await connection.query(
        `INSERT INTO system_settings (setting_key, setting_value) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [key, value, value]
      );
      console.log(`✅ Set ${key} = ${value}`);
    }
    
    // 4. Log the credentials
    await connection.query(
      `INSERT INTO credentials_log (user_id, full_name, username, password, role) 
       VALUES (?, ?, ?, ?, ?)`,
      [adminUserId, 'System Administrator', 'MJA001', 'admin123', 'admin']
    );
    console.log('✅ Credentials logged');
    
    await connection.commit();
    
    console.log('\n✅ Setup completed successfully!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 DEFAULT ADMIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   Username: MJA001');
    console.log('   Password: admin123');
    console.log('   Role:     Admin');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n💡 You can now login and start using the system!');
    console.log('💡 Remember to change the admin password after first login\n');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Setup failed:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// Run the setup
setupDefaultAdmin()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
