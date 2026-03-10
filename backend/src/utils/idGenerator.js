import pool from '../config/database.js';

// Role prefix mapping
const ROLE_PREFIXES = {
  student: 'MJ',
  teacher: 'MJT',
  registrar: 'MJR',
  director: 'MJD',
  parent: 'MJP',
  admin: 'MJA'
};

/**
 * Generate unique ID for user based on role
 * @param {string} role - User role (student, teacher, etc.)
 * @returns {Promise<string>} Generated ID (e.g., MJ001, MJT001)
 */
export async function generateUserId(role) {
  const prefix = ROLE_PREFIXES[role];
  
  if (!prefix) {
    throw new Error(`Invalid role: ${role}`);
  }

  // Get the last user with this prefix
  const [lastUsers] = await pool.query(
    `SELECT username FROM users 
     WHERE username LIKE ? 
     ORDER BY username DESC 
     LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNumber = 1;

  if (lastUsers.length > 0) {
    const lastUsername = lastUsers[0].username;
    // Extract number from username (e.g., "MJ001" -> "001")
    const numberPart = lastUsername.replace(prefix, '');
    const lastNumber = parseInt(numberPart, 10);
    
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  // Format number with leading zeros (e.g., 1 -> "001")
  const formattedNumber = String(nextNumber).padStart(3, '0');
  
  return `${prefix}${formattedNumber}`;
}

/**
 * Check if username already exists
 * @param {string} username 
 * @returns {Promise<boolean>}
 */
export async function usernameExists(username) {
  const [users] = await pool.query(
    'SELECT id FROM users WHERE username = ?',
    [username]
  );
  
  return users.length > 0;
}
