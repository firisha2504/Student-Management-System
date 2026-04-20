import pool from './src/config/database.js';

async function checkUsers() {
  try {
    console.log('🔍 Checking users in database...\n');
    
    const [users] = await pool.query(`
      SELECT u.id, u.username, u.email, r.role
      FROM users u
      LEFT JOIN user_roles r ON u.id = r.user_id
      ORDER BY u.id
    `);
    
    if (users.length === 0) {
      console.log('❌ No users found in database!');
      console.log('💡 Run: node src/database/drop-and-init.js');
    } else {
      console.log(`✅ Found ${users.length} user(s):\n`);
      users.forEach(user => {
        console.log(`ID: ${user.id}`);
        console.log(`Username: ${user.username}`);
        console.log(`Email: ${user.email}`);
        console.log(`Role: ${user.role || 'No role assigned'}`);
        console.log('---');
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUsers();
