import pool from './src/config/database.js';

async function checkStudentProfiles() {
  try {
    console.log('🔍 Checking student_profiles table...\n');
    
    const [profiles] = await pool.query(`
      SELECT 
        sp.user_id,
        u.username,
        sp.admission_number,
        sp.grade_level,
        sp.stream,
        sp.section,
        sp.sub_section
      FROM student_profiles sp
      INNER JOIN users u ON sp.user_id = u.id
      ORDER BY sp.user_id
    `);
    
    if (profiles.length === 0) {
      console.log('❌ No student profiles found!');
      console.log('💡 Students need to have records in student_profiles table');
    } else {
      console.log(`✅ Found ${profiles.length} student profile(s):\n`);
      profiles.forEach(profile => {
        console.log(`User ID: ${profile.user_id}`);
        console.log(`Username: ${profile.username}`);
        console.log(`Admission #: ${profile.admission_number}`);
        console.log(`Grade: ${profile.grade_level || 'NULL'}`);
        console.log(`Stream: ${profile.stream || 'NULL'}`);
        console.log(`Section: ${profile.section || 'NULL'}`);
        console.log(`Sub-section: ${profile.sub_section || 'NULL'}`);
        console.log('---');
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkStudentProfiles();
