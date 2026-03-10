import pool from './src/config/database.js';

async function addMissingColumns() {
  try {
    console.log('🔧 Adding missing columns...\n');

    // Add sub_section to student_profiles
    try {
      await pool.query(`
        ALTER TABLE student_profiles 
        ADD COLUMN sub_section VARCHAR(10) AFTER stream
      `);
      console.log('✅ Added sub_section column to student_profiles');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  sub_section column already exists in student_profiles');
      } else {
        throw error;
      }
    }

    // Add columns to subjects table
    const subjectColumns = [
      { name: 'credit_hours', definition: 'INT DEFAULT 3 AFTER description' },
      { name: 'ects', definition: 'INT DEFAULT 5 AFTER credit_hours' },
      { name: 'grade_level', definition: 'INT AFTER ects' },
      { name: 'stream', definition: "ENUM('Science', 'Arts', 'Commerce', 'Common') DEFAULT 'Common' AFTER grade_level" }
    ];

    for (const col of subjectColumns) {
      try {
        await pool.query(`ALTER TABLE subjects ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`✅ Added ${col.name} column to subjects`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  ${col.name} column already exists in subjects`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✨ Column additions complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding columns:', error.message);
    process.exit(1);
  }
}

addMissingColumns();
