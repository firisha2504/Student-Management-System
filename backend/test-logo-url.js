import pool from './src/config/database.js';

async function checkLogoUrl() {
  try {
    const [rows] = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'school_logo'"
    );
    
    if (rows.length > 0) {
      console.log('Logo URL in database:', rows[0].setting_value);
    } else {
      console.log('No logo URL found in database');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkLogoUrl();
