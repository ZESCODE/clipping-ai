import { getDatabase } from '../../lib/database.js';
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
    const db = await getDatabase();

    const { platform, status, minCPM, maxCPM, sort } = req.query;

    let query = `
      SELECT c.*,
             uc.status as user_status,
             uc.clips_submitted,
             uc.clips_approved,
             uc.earnings
      FROM campaigns c
      LEFT JOIN user_campaigns uc ON c.id = uc.campaign_id AND uc.user_id = ?
      WHERE 1=1
    `;
    const params = [decoded.userId];

    if (platform) {
      query += ' AND c.platform = ?';
      params.push(platform);
    }
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    if (minCPM) {
      query += ' AND c.cpm >= ?';
      params.push(parseFloat(minCPM));
    }
    if (maxCPM) {
      query += ' AND c.cpm <= ?';
      params.push(parseFloat(maxCPM));
    }

    // Add sorting
    const sortField = sort === 'cpm' ? 'c.cpm' :
                      sort === 'newest' ? 'c.created_at' :
                      sort === 'budget' ? 'c.budget_remaining' :
                      'c.created_at';
    const sortOrder = sort === 'cpm' || sort === 'budget' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    const campaigns = await db.all(query, params);

    return res.json({ campaigns });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.error('Get campaigns error:', error);
    return res.status(500).json({ error: error.message });
  }
}