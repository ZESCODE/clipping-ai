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

    const { platform, status, minCPM, maxCPM, sort } = req.query;

    let query = `
      SELECT c.*,
             uc.status as user_status,
             uc.clips_submitted,
             uc.clips_approved,
             uc.earnings
      FROM campaigns c
      LEFT JOIN user_campaigns uc ON c.id = uc.campaign_id AND uc.user_id = $1
      WHERE 1=1
    `;
    const params = [decoded.userId];
    let paramIndex = 2;

    if (platform) {
      query += ` AND c.platform = $${paramIndex}`;
      params.push(platform);
      paramIndex++;
    }
    if (status) {
      query += ` AND c.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (minCPM) {
      query += ` AND c.cpm >= $${paramIndex}`;
      params.push(parseFloat(minCPM));
      paramIndex++;
    }
    if (maxCPM) {
      query += ` AND c.cpm <= $${paramIndex}`;
      params.push(parseFloat(maxCPM));
      paramIndex++;
    }

    // Add sorting
    const sortField = sort === 'cpm' ? 'c.cpm' :
                      sort === 'newest' ? 'c.created_at' :
                      sort === 'budget' ? 'c.budget_remaining' :
                      'c.created_at';
    const sortOrder = sort === 'cpm' || sort === 'budget' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    const campaigns = await sql.query(query, params);

    return res.json({ campaigns: campaigns.rows });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.error('Get campaigns error:', error);
    return res.status(500).json({ error: error.message });
  }
}