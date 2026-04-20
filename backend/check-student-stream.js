import pool from './src/config/database.js';

async function checkStudentStream() {
  try {
    console.log('🔍 Checking student streams...\n');
    
    const [students] = await pool.query(`
      SELECT 
        u.id, 
        u.username, 
        sp.grade_level, 
        sp.stream,
        sp.section
      FROM users u
      INNER JOIN user_roles r ON u.id = r.user_id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE r.role = 'student'
      ORDER BY u.id
    `);
    
    if (students.length === 0) {
      console.log('❌ No students found!');
    } else {
      console.log(`✅ Found ${students.length} student(s):\n`);
      students.forEach(student => {
        console.log(`Username: ${student.username}`);
        console.log(`Grade: ${student.grade_level || 'Not assigned'}`);
        console.log(`Stream: ${student.stream || 'Not assigned'}`);
        console.log(`Section: ${student.section || 'Not assigned'}`);
        console.log('---');
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkStudentStream();
