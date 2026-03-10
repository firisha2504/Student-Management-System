import pool from './src/config/database.js';

async function createTeacherAssignmentsTable() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Creating teacher_subject_assignments table...');
    
    // Check if table already exists
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'teacher_subject_assignments'
    `);
    
    if (tables.length > 0) {
      console.log('✓ Table already exists');
      return;
    }
    
    // Create unified teacher assignments table
    await connection.query(`
      CREATE TABLE teacher_subject_assignments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        teacher_id INT NOT NULL,
        subject_id INT NOT NULL,
        grade_level INT NOT NULL,
        section ENUM('oromo', 'amharic', 'somali'),
        sub_section VARCHAR(10),
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        UNIQUE KEY unique_assignment (teacher_id, subject_id, grade_level, section, sub_section),
        INDEX idx_teacher_id (teacher_id),
        INDEX idx_subject_id (subject_id),
        INDEX idx_grade_level (grade_level)
      )
    `);
    
    console.log('✓ Table created successfully');
    
    // Migrate data from old tables if they exist
    console.log('\nMigrating data from old tables...');
    
    // Check if old tables exist
    const [oldTables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME IN ('teacher_subjects', 'teacher_sections', 'teacher_sub_sections')
    `);
    
    if (oldTables.length > 0) {
      // Migrate from teacher_subjects
      const [teacherSubjects] = await connection.query(`
        SELECT teacher_id, subject_id, grade_level, stream 
        FROM teacher_subjects
      `);
      
      if (teacherSubjects.length > 0) {
        console.log(`  Migrating ${teacherSubjects.length} records from teacher_subjects...`);
        for (const ts of teacherSubjects) {
          await connection.query(`
            INSERT IGNORE INTO teacher_subject_assignments 
            (teacher_id, subject_id, grade_level) 
            VALUES (?, ?, ?)
          `, [ts.teacher_id, ts.subject_id, ts.grade_level]);
        }
      }
      
      console.log('✓ Data migration completed');
    } else {
      console.log('  No old tables found to migrate');
    }
    
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

createTeacherAssignmentsTable()
  .then(() => {
    console.log('\n✓ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  });
