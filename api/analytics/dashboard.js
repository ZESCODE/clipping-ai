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

    // Summary
    const summary = await sql`
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
      WHERE e.user_id = ${decoded.userId}
    `;

    const byPlatform = await sql`
      SELECT
        e.platform,
        COALESCE(SUM(CASE WHEN e.status = 'paid' THEN e.amount ELSE 0 END), 0) as totalEarnings,
        COALESCE(SUM(CASE WHEN e.status = 'pending' THEN e.amount ELSE 0 END), 0) as pendingEarnings,
        COUNT(*) as transactions,
        COALESCE(AVG(e.cpm), 0) as avgCPM,
        COALESCE(SUM(e.views), 0) as totalViews
      FROM earnings e
      WHERE e.user_id = ${decoded.userId}
      GROUP BY e.platform
    `;

    const dailyEarnings = await sql`
      SELECT
        DATE(e.earned_at) as date,
        COALESCE(SUM(e.amount), 0) as amount,
        COUNT(*) as transactions
      FROM earnings e
      WHERE e.user_id = ${decoded.userId} AND e.earned_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      GROUP BY DATE(e.earned_at)
      ORDER BY DATE(e.earned_at) DESC
    `;

    const topCampaigns = await sql`
      SELECT
        c.id,
        c.title,
        c.platform,
        c.cpm,
        COALESCE(SUM(e.amount), 0) as totalEarnings,
        COUNT(e.id) as transactionCount
      FROM campaigns c
      LEFT JOIN earnings e ON c.id = e.campaign_id AND e.user_id = ${decoded.userId}
      GROUP BY c.id
      ORDER BY totalEarnings DESC
      LIMIT 5
    `;

    const recentEarnings = await sql`
      SELECT
        e.*,
        c.title as campaign_title
      FROM earnings e
      LEFT JOIN campaigns c ON e.campaign_id = c.id
      WHERE e.user_id = ${decoded.userId}
      ORDER BY e.earned_at DESC
      LIMIT 10
    `;

    // Performance metrics
    const performance = await sql`
      SELECT
        COUNT(p.id) as total_posts,
        COALESCE(SUM(p.views), 0) as total_views,
        COALESCE(SUM(p.likes), 0) as total_likes,
        COALESCE(SUM(p.comments), 0) as total_comments,
        COALESCE(SUM(p.shares), 0) as total_shares,
        CASE WHEN SUM(p.views) > 0
          THEN ROUND((SUM(p.likes) + SUM(p.comments) + SUM(p.shares)) * 100.0 / SUM(p.views), 2)
          ELSE 0
        END as avg_engagement_rate,
        COALESCE(SUM(e.amount), 0) as total_earnings,
        COALESCE(AVG(e.cpm), 0) as avg_cpm
      FROM posts p
      LEFT JOIN earnings e ON p.id = e.post_id
      WHERE p.user_id = ${decoded.userId}
    `;

    return res.json({
      dashboard: {
        summary: { summary: summary.rows[0], byPlatform: byPlatform.rows, dailyEarnings: dailyEarnings.rows },
        byPlatform: byPlatform.rows,
        dailyEarnings: dailyEarnings.rows,
        topCampaigns: topCampaigns.rows,
        recentEarnings: recentEarnings.rows,
        performance: { posts: [], metrics: performance.rows[0] }
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.error('Get dashboard error:', error);
    return res.status(500).json({ error: error.message });
  }
}