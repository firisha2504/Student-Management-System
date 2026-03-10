import fs from 'fs';
import path from 'path';
import pool from './src/config/database.js';
import { spawn } from 'child_process';

async function runCompleteSetup() {
  try {
    console.log('🚀 Starting complete database setup...\n');

    // Step 1: Add missing columns
    console.log('📝 Step 1: Adding missing columns...\n');
    
    await new Promise((resolve, reject) => {
      const addColumns = spawn('node', ['add-columns.js'], {
        stdio: 'inherit',
        shell: true
      });

      addColumns.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('Failed to add columns'));
        }
      });
    });

    // Step 2: Create missing tables
    console.log('\n📝 Step 2: Creating missing tables...\n');

    // Read the SQL file
    const sqlFile = fs.readFileSync(
      path.join(process.cwd(), 'complete-database-setup.sql'),
      'utf8'
    );

    // Split by semicolons and filter out empty statements
    const statements = sqlFile
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Extract table/operation name for logging
      const match = statement.match(/(?:CREATE TABLE|ALTER TABLE|UPDATE|INSERT INTO)\s+(?:IF NOT EXISTS\s+)?(\w+)/i);
      const operation = match ? match[0] : 'SQL operation';
      const tableName = match ? match[1] : '';

      try {
        await pool.query(statement);
        successCount++;
        console.log(`✅ [${i + 1}/${statements.length}] ${operation} ${tableName}`);
      } catch (error) {
        // Ignore "already exists" errors
        if (error.code === 'ER_DUP_FIELDNAME' || 
            error.code === 'ER_TABLE_EXISTS_ERROR' ||
            error.message.includes('Duplicate column name') ||
            error.message.includes('already exists')) {
          console.log(`⚠️  [${i + 1}/${statements.length}] ${operation} ${tableName} (already exists, skipped)`);
          successCount++;
        } else {
          errorCount++;
          console.error(`❌ [${i + 1}/${statements.length}] ${operation} ${tableName}`);
          console.error(`   Error: ${error.message}\n`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✨ Setup complete!`);
    console.log(`   Success: ${successCount}/${statements.length}`);
    console.log(`   Errors: ${errorCount}/${statements.length}`);
    console.log('='.repeat(60) + '\n');

    // Verify tables exist
    console.log('🔍 Verifying database tables...\n');
    const [tables] = await pool.query('SHOW TABLES');
    console.log(`📊 Total tables in database: ${tables.length}`);
    
    const expectedTables = [
      'users', 'user_roles', 'profiles', 'student_profiles',
      'subjects', 'teacher_subjects', 'grades', 'parent_students',
      'teacher_requests', 'system_settings', 'credentials_log',
      'ranking_approvals', 'student_registrations', 'course_enrollments',
      'assessment_types', 'assessment_scores', 'academic_year_results',
      'academic_year_summaries', 'teacher_sections', 'teacher_sub_sections'
    ];

    const existingTables = tables.map(t => Object.values(t)[0]);
    const missingTables = expectedTables.filter(t => !existingTables.includes(t));

    if (missingTables.length === 0) {
      console.log('✅ All required tables exist!\n');
    } else {
      console.log('⚠️  Missing tables:', missingTables.join(', '), '\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

runCompleteSetup();
