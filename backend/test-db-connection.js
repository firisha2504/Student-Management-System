import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('Testing MySQL connection...\n');
  console.log('Configuration:');
  console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`  User: ${process.env.DB_USER || 'root'}`);
  console.log(`  Password: ${process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-3) : '(empty)'}`);
  console.log(`  Port: ${process.env.DB_PORT || 3306}\n`);

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
    });

    console.log('✅ Connection successful!');
    
    // Test query
    const [rows] = await connection.query('SELECT VERSION() as version');
    console.log(`✅ MySQL Version: ${rows[0].version}`);
    
    // Check if database exists
    const [databases] = await connection.query(
      "SHOW DATABASES LIKE ?",
      [process.env.DB_NAME || 'student_management']
    );
    
    if (databases.length > 0) {
      console.log(`✅ Database '${process.env.DB_NAME}' exists`);
    } else {
      console.log(`ℹ️  Database '${process.env.DB_NAME}' does not exist yet (will be created on init)`);
    }
    
    await connection.end();
    console.log('\n✅ All checks passed! You can now run: npm run init-db');
    
  } catch (error) {
    console.error('\n❌ Connection failed!');
    console.error(`Error: ${error.message}\n`);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('💡 Solutions:');
      console.log('1. Check your MySQL password is correct in .env file');
      console.log('2. If root has no password, set: DB_PASSWORD=');
      console.log('3. Create a new MySQL user:');
      console.log('   mysql> CREATE USER \'student_admin\'@\'localhost\' IDENTIFIED BY \'YourPassword\';');
      console.log('   mysql> GRANT ALL PRIVILEGES ON *.* TO \'student_admin\'@\'localhost\';');
      console.log('   mysql> FLUSH PRIVILEGES;');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 MySQL server is not running. Start MySQL service first.');
    }
    
    process.exit(1);
  }
}

testConnection();
