import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const [users] = await pool.query(
      'SELECT id, username, email FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get user role
    const [userRoles] = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = ?',
      [decoded.userId]
    );

    req.user = users[0];
    req.userId = decoded.userId;
    req.userRole = userRoles.length > 0 ? userRoles[0].role : null;
    req.userRoles = userRoles.map(r => r.role);
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...roles) => {
  return async (req, res, next) => {
    try {
      const [userRoles] = await pool.query(
        'SELECT role FROM user_roles WHERE user_id = ?',
        [req.userId]
      );

      const userRolesList = userRoles.map(r => r.role);
      const hasPermission = roles.some(role => userRolesList.includes(role));

      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: roles,
          current: userRolesList
        });
      }

      req.userRoles = userRolesList;
      next();
    } catch (error) {
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};
