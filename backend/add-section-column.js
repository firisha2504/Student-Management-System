import pool from './src/config/database.js';

async function addSectionColumn() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Adding section column to student_profiles table...');
    
    // Check if column already exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'student_profiles' 
        AND COLUMN_NAME = 'section'
    `);
    
    if (columns.length > 0) {
      console.log('✓ Section column already exists');
      return;
    }
    
    // Add section column after stream
    await connection.query(`
      ALTER TABLE student_profiles 
      ADD COLUMN section ENUM('oromo', 'amharic', 'somali') AFTER stream
    `);
    
    console.log('✓ Section column added successfully');
    
  } catch (error) {
    console.error('Error adding section column:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

addSectionColumn()
  .then(() => {
    console.log('\n✓ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  });
