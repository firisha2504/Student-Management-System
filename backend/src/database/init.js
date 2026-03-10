import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function initializeDatabase() {
  let connection;
  
  try {
    // Connect without database first
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });

    console.log('📦 Connected to MySQL server');

    // Create database if it doesn't exist
    const dbName = process.env.DB_NAME || 'student_management';
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    console.log(`✅ Database '${dbName}' created or already exists`);

    // Use the database
    await connection.query(`USE ${dbName}`);

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await connection.query(schema);
    console.log('✅ Database schema initialized successfully');

    // Create default admin user with username MJA001
    const defaultPassword = await bcrypt.hash('admin123', 10);
    
    const [existingAdmin] = await connection.query(
      'SELECT id FROM users WHERE username = ?',
      ['MJA001']
    );

    if (existingAdmin.length === 0) {
      const [userResult] = await connection.query(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        ['MJA001', 'admin@school.com', defaultPassword]
      );
      
      const adminUserId = userResult.insertId;
      
      await connection.query(
        'INSERT INTO user_roles (user_id, role) VALUES (?, ?)',
        [adminUserId, 'admin']
      );
      
      await connection.query(
        'INSERT INTO profiles (user_id, full_name, is_active) VALUES (?, ?, ?)',
        [adminUserId, 'System Administrator', true]
      );
      
      console.log('✅ Default admin user created');
      console.log('   Username: MJA001');
      console.log('   Email: admin@school.com');
      console.log('   Password: admin123');
      console.log('   ⚠️  Please change this password after first login!');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    console.log('\n🎉 Database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initializeDatabase();
