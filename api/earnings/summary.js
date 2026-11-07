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

    const { period, platform } = req.query;

    let dateFilter = '';
    const params = [decoded.userId];

    if (period) {
      const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'year' ? 365 : 30;
      dateFilter = "AND e.earned_at >= datetime('now', ?)";
      params.push(`-${days} days`);
    }

    if (platform) {
      dateFilter += ' AND e.platform = ?';
      params.push(platform);
    }

    // Summary
    const summary = await db.get(`
      SELECT
        COALESCE(SUM(CASE WHEN e.status = 'paid' THEN e.amount ELSE 0 END), 0) as totalEarnings,
        COALESCE(SUM(CASE WHEN e.status = 'paid' THEN e.amount ELSE 0 END), 0) as paidEarnings,
        COALESCE(SUM(CASE WHEN e.status = 'pending' THEN e.amount ELSE 0 END), 0) as pendingEarnings,
        COALESCE(SUM(CASE WHEN e.status = 'disputed' THEN e.amount ELSE 0 END), 0) as disputedEarnings,
        COUNT(*) as totalTransactions,
        COALESCE(AVG(e.cpm), 0) as avgCPM,
        COALESCE(SUM(e.views), 0) as totalViews,
        COUNT(DISTINCT e.campaign_id) as campaignsCount,
        COUNT(DISTINCT e.platform) as platformsCount
      FROM earnings e
      WHERE e.user_id = ? ${dateFilter}
    `, params);

    // By platform
    const byPlatform = await db.all(`
      SELECT
        e.platform,
        COALESCE(SUM(CASE WHEN e.status = 'paid' THEN e.amount ELSE 0 END), 0) as totalEarnings,
        COALESCE(SUM(CASE WHEN e.status = 'pending' THEN e.amount ELSE 0 END), 0) as pendingEarnings,
        COUNT(*) as transactions,
        COALESCE(AVG(e.cpm), 0) as avgCPM,
        COALESCE(SUM(e.views), 0) as totalViews
      FROM earnings e
      WHERE e.user_id = ? ${dateFilter}
      GROUP BY e.platform
    `, params);

    // Daily earnings (last 30 days)
    const dailyEarnings = await db.all(`
      SELECT
        date(e.earned_at) as date,
        COALESCE(SUM(e.amount), 0) as amount,
        COUNT(*) as transactions
      FROM earnings e
      WHERE e.user_id = ? AND e.earned_at >= datetime('now', '-30 days')
      GROUP BY date(e.earned_at)
      ORDER BY date DESC
    `, [decoded.userId]);

    return res.json({
      summary: {
        summary,
        byPlatform,
        dailyEarnings
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.error('Get earnings summary error:', error);
    return res.status(500).json({ error: error.message });
  }
}