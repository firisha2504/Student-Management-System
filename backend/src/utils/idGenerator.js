import pool from '../config/database.js';

// Role prefix mapping
const ROLE_PREFIXES = {
  student: 'MJS',
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

  // Get the last generated ID for this prefix from users table
  const [lastUsers] = await pool.query(
    `SELECT u.username FROM users u
     INNER JOIN user_roles r ON u.id = r.user_id
     WHERE r.role = ? AND u.username LIKE ?
     ORDER BY u.id DESC
     LIMIT 1`,
    [role, `%.${prefix}%`]
  );

  let nextNumber = 1;

  if (lastUsers.length > 0) {
    const lastUsername = lastUsers[0].username;
    const match = lastUsername.match(new RegExp(`${prefix}(\\d+)$`));
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
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
