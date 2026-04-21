import pool from '../config/database.js';

async function addHomeroomFeature() {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('Adding homeroom feature...');
    
    // Add homeroom_teacher_id to student_profiles table
    console.log('1. Adding homeroom_teacher_id column to student_profiles...');
    await connection.query(`
      ALTER TABLE student_profiles
      ADD COLUMN IF NOT EXISTS homeroom_teacher_id INT NULL,
      ADD CONSTRAINT fk_homeroom_teacher 
        FOREIGN KEY (homeroom_teacher_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL
    `);
    
    // Create homeroom_assignments table for tracking homeroom teacher assignments
    console.log('2. Creating homeroom_assignments table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS homeroom_assignments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        teacher_id INT NOT NULL,
        grade_level INT NOT NULL,
        section VARCHAR(50),
        sub_section VARCHAR(10),
        stream VARCHAR(20),
        academic_year VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_homeroom (teacher_id, grade_level, section, sub_section, stream, academic_year)
      )
    `);
    
    console.log('3. Creating index on homeroom_teacher_id...');
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_homeroom_teacher 
      ON student_profiles(homeroom_teacher_id)
    `);
    
    await connection.commit();
    console.log('✅ Homeroom feature added successfully!');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error adding homeroom feature:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the migration
addHomeroomFeature()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
