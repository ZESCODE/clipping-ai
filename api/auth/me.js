import { sql, initializeDatabase } from '../../lib/database-vercel.js';
import { verifyToken, extractTokenFromHeader } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = verifyToken(token);
    await initializeDatabase();

    const user = await sql`
      SELECT id, email, username, avatar_url, created_at, subscription_tier FROM users WHERE id = ${decoded.userId}
    `;

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: user.rows[0] });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.error('Get user error:', error);
    return res.status(500).json({ error: error.message });
  }
}