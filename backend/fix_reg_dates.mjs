import pool from './src/config/database.js';
import { gregorianToEthiopian } from './src/utils/ethiopianCalendar.js';

const [rows] = await pool.query(
  "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('registration_start_date','registration_end_date')"
);

for (const row of rows) {
  if (!row.setting_value) continue;
  // Try to parse as ISO date (2026-08-01)
  const d = new Date(row.setting_value);
  if (isNaN(d.getTime())) {
    console.log(`Skipping ${row.setting_key}: "${row.setting_value}" (not a valid date)`);
    continue;
  }
  const eth = gregorianToEthiopian(d);
  const ethStr = `${String(eth.day).padStart(2,'0')}/${String(eth.month).padStart(2,'0')}/${eth.year} E.C.`;
  await pool.query("UPDATE system_settings SET setting_value = ? WHERE setting_key = ?", [ethStr, row.setting_key]);
  console.log(`✅ ${row.setting_key}: "${row.setting_value}" → "${ethStr}"`);
}

process.exit(0);
