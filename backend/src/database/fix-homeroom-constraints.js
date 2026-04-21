import pool from '../config/database.js';

async function fixHomeroomConstraints() {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('Fixing homeroom constraints...');
    
    // Drop existing unique constraint if it exists
    console.log('1. Dropping existing unique constraint...');
    try {
      await connection.query(`
        ALTER TABLE homeroom_assignments 
        DROP INDEX unique_homeroom
      `);
    } catch (error) {
      console.log('No existing unique_homeroom constraint found (this is okay)');
    }
    
    // Add constraint: one teacher per academic year
    console.log('2. Adding constraint: one teacher per academic year...');
    await connection.query(`
      ALTER TABLE homeroom_assignments
      ADD CONSTRAINT unique_teacher_per_year 
        UNIQUE (teacher_id, academic_year)
    `);
    
    // Add constraint: one homeroom teacher per class
    console.log('3. Adding constraint: one homeroom teacher per class...');
    await connection.query(`
      ALTER TABLE homeroom_assignments
      ADD CONSTRAINT unique_class_homeroom 
        UNIQUE (grade_level, section, sub_section, stream, academic_year)
    `);
    
    await connection.commit();
    console.log('✅ Homeroom constraints fixed successfully!');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error fixing homeroom constraints:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the migration
fixHomeroomConstraints()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });