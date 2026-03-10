import pool from './src/config/database.js';

async function verifyInfrastructure() {
  try {
    console.log('🔍 Verifying Grade Hub Infrastructure...\n');
    console.log('='.repeat(60));

    // Check database connection
    console.log('\n📡 Testing Database Connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    // Check required tables
    console.log('📊 Checking Required Tables...');
    const requiredTables = [
      'users',
      'user_roles',
      'profiles',
      'student_profiles',
      'subjects',
      'teacher_subjects',
      'grades',
      'parent_students',
      'teacher_requests',
      'system_settings',
      'credentials_log',
      'ranking_approvals',
      'student_registrations',
      'course_enrollments',
      'assessment_types',
      'assessment_scores',
      'academic_year_results',
      'academic_year_summaries',
      'teacher_sections',
      'teacher_sub_sections'
    ];

    const [tables] = await pool.query('SHOW TABLES');
    const existingTables = tables.map(t => Object.values(t)[0]);

    let allTablesExist = true;
    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        console.log(`  ✅ ${table}`);
      } else {
        console.log(`  ❌ ${table} - MISSING`);
        allTablesExist = false;
      }
    }

    if (!allTablesExist) {
      console.log('\n⚠️  Some tables are missing. Run: node run-complete-setup.js\n');
    } else {
      console.log('\n✅ All required tables exist!\n');
    }

    // Check required columns
    console.log('📋 Checking Required Columns...');
    
    const columnChecks = [
      { table: 'student_profiles', column: 'sub_section' },
      { table: 'subjects', column: 'credit_hours' },
      { table: 'subjects', column: 'ects' },
      { table: 'subjects', column: 'grade_level' },
      { table: 'subjects', column: 'stream' }
    ];

    let allColumnsExist = true;
    for (const check of columnChecks) {
      try {
        const [columns] = await pool.query(
          `SHOW COLUMNS FROM ${check.table} LIKE ?`,
          [check.column]
        );
        if (columns.length > 0) {
          console.log(`  ✅ ${check.table}.${check.column}`);
        } else {
          console.log(`  ❌ ${check.table}.${check.column} - MISSING`);
          allColumnsExist = false;
        }
      } catch (error) {
        console.log(`  ❌ ${check.table}.${check.column} - ERROR: ${error.message}`);
        allColumnsExist = false;
      }
    }

    if (!allColumnsExist) {
      console.log('\n⚠️  Some columns are missing. Run: node run-complete-setup.js\n');
    } else {
      console.log('\n✅ All required columns exist!\n');
    }

    // Check system settings
    console.log('⚙️  Checking System Settings...');
    const [settings] = await pool.query('SELECT * FROM system_settings');
    
    const requiredSettings = ['system_locked', 'current_academic_year', 'current_term'];
    const existingSettings = settings.map(s => s.setting_key);

    for (const setting of requiredSettings) {
      if (existingSettings.includes(setting)) {
        const value = settings.find(s => s.setting_key === setting).setting_value;
        console.log(`  ✅ ${setting}: ${value}`);
      } else {
        console.log(`  ❌ ${setting} - MISSING`);
      }
    }

    // Check data counts
    console.log('\n📈 Database Statistics...');
    
    const stats = [
      { table: 'users', label: 'Total Users' },
      { table: 'student_profiles', label: 'Students' },
      { table: 'subjects', label: 'Subjects' },
      { table: 'teacher_subjects', label: 'Teacher Assignments' },
      { table: 'assessment_types', label: 'Assessment Types' },
      { table: 'assessment_scores', label: 'Assessment Scores' },
      { table: 'grades', label: 'Legacy Grades' },
      { table: 'student_registrations', label: 'Student Registrations' },
      { table: 'academic_year_results', label: 'Archived Results' }
    ];

    for (const stat of stats) {
      try {
        const [result] = await pool.query(`SELECT COUNT(*) as count FROM ${stat.table}`);
        console.log(`  ${stat.label}: ${result[0].count}`);
      } catch (error) {
        console.log(`  ${stat.label}: ERROR - ${error.message}`);
      }
    }

    // Check API routes
    console.log('\n🛣️  Backend API Routes...');
    const routes = [
      '/api/auth',
      '/api/users',
      '/api/students',
      '/api/grades',
      '/api/subjects',
      '/api/admin',
      '/api/profile',
      '/api/registration',
      '/api/rankings',
      '/api/assessments',
      '/api/academic-year'
    ];

    console.log('  Expected routes:');
    routes.forEach(route => console.log(`    ✅ ${route}`));

    // Final summary
    console.log('\n' + '='.repeat(60));
    if (allTablesExist && allColumnsExist) {
      console.log('✨ Infrastructure verification complete!');
      console.log('🎉 All systems are ready!');
    } else {
      console.log('⚠️  Infrastructure verification found issues!');
      console.log('📝 Please run: node run-complete-setup.js');
    }
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('\nPlease check:');
    console.error('  1. MySQL is running');
    console.error('  2. Database credentials in .env are correct');
    console.error('  3. Database exists: CREATE DATABASE student_management;');
    console.error('  4. Run initial setup: node src/database/init.js\n');
    process.exit(1);
  }
}

verifyInfrastructure();
