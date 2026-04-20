import pool from './src/config/database.js';
import bcrypt from 'bcryptjs';

async function testLogin(username, password) {
  try {
    console.log(`\n🔐 Testing login for: ${username}\n`);
    
    // Get user
    const [users] = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = ?',
      [username]
    );
    
    if (users.length === 0) {
      console.log('❌ User not found!');
      await pool.end();
      return;
    }
    
    const user = users[0];
    console.log(`✅ User found: ${user.username} (ID: ${user.id})`);
    
    // Test password
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (isValid) {
      console.log(`✅ Password is CORRECT!`);
      console.log(`\n✅ Login should work with:`);
      console.log(`   Username: ${username}`);
      console.log(`   Password: ${password}`);
    } else {
      console.log(`❌ Password is INCORRECT!`);
      console.log(`\n💡 The password you're using doesn't match.`);
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Test with command line arguments
const username = process.argv[2] || 'MJA001';
const password = process.argv[3] || 'admin123';

testLogin(username, password);
