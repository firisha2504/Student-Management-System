import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function dropAndInitialize() {
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

    console.log('📦 Connected to MySQL server\n');

    const dbName = process.env.DB_NAME || 'student_management';
    
    // Drop database if exists
    console.log(`🗑️  Dropping database '${dbName}' if it exists...`);
    await connection.query(`DROP DATABASE IF EXISTS ${dbName}`);
    console.log('✅ Database dropped\n');

    // Create fresh database
    console.log(`📦 Creating fresh database '${dbName}'...`);
    await connection.query(`CREATE DATABASE ${dbName}`);
    console.log('✅ Database created\n');

    // Use the database
    await connection.query(`USE ${dbName}`);

    // Read and execute schema
    console.log('📋 Loading schema...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await connection.query(schema);
    console.log('✅ Database schema initialized successfully\n');

    // Create default admin user with username MJA001
    console.log('👤 Creating default admin user...');
    const defaultPassword = await bcrypt.hash('admin123', 10);
    
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
    
    // Log credentials
    await connection.query(
      'INSERT INTO credentials_log (user_id, full_name, username, password, role) VALUES (?, ?, ?, ?, ?)',
      [adminUserId, 'System Administrator', 'MJA001', 'admin123', 'admin']
    );
    
    console.log('✅ Default admin user created\n');
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 DATABASE INITIALIZATION COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 DEFAULT ADMIN CREDENTIALS:');
    console.log('   Username: MJA001');
    console.log('   Email:    admin@school.com');
    console.log('   Password: admin123');
    console.log('   Role:     Admin');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('⚠️  Please change the admin password after first login!');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

dropAndInitialize();
