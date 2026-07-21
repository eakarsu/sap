const jwt = require('jsonwebtoken');
const pool = require('../db');
const { jwtSecret, jwtIssuer, jwtAudience } = require('../config');
require('dotenv').config({ path: '../.env' });

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      issuer: jwtIssuer,
      audience: jwtAudience,
    });
    const result = await pool.query(
      'SELECT id, email, full_name, role FROM users WHERE id=$1 AND LOWER(email)=$2',
      [decoded.sub, decoded.email]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid token' });
    req.user = result.rows[0];
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
