export class EarningsTracker {
  constructor(db) {
    this.db = db;
  }

  async getSummary(userId, filters = {}) {
    const period = filters.period || '30d';
    const platform = filters.platform;
    
    let dateFilter = '';
    switch (period) {
      case '7d':
        dateFilter = "AND e.earned_at >= datetime('now', '-7 days')";
        break;
      case '30d':
        dateFilter = "AND e.earned_at >= datetime('now', '-30 days')";
        break;
      case '90d':
        dateFilter = "AND e.earned_at >= datetime('now', '-90 days')";
        break;
      case 'all':
      default:
        dateFilter = '';
    }
    
    const platformFilter = platform ? 'AND e.platform = ?' : '';
    const params = [userId];
    if (platform) params.push(platform);
    
    const summary = this.db.prepare(`
      SELECT 
        SUM(e.amount) as total_earnings,
        SUM(CASE WHEN e.status = 'paid' THEN e.amount ELSE 0 END) as paid_earnings,
        SUM(CASE WHEN e.status = 'pending' THEN e.amount ELSE 0 END) as pending_earnings,
        SUM(CASE WHEN e.status = 'disputed' THEN e.amount ELSE 0 END) as disputed_earnings,
        COUNT(*) as total_transactions,
        AVG(e.cpm) as avg_cpm,
        SUM(e.verified_views) as total_verified_views,
        COUNT(DISTINCT e.campaign_id) as campaigns_count,
        COUNT(DISTINCT e.platform) as platforms_count
      FROM earnings e
      WHERE e.user_id = ? ${this.db ? 'AND 1=1' : ''} 
    `).get(userId);
    
    // Platform breakdown
    const byPlatform = this.db.prepare(`
      SELECT 
        e.platform,
        SUM(e.amount) as total_earnings,
        COUNT(*) as transactions,
        AVG(e.cpm) as avg_cpm,
        SUM(e.verified_views) as total_views
      FROM earnings e
      WHERE e.user_id = ? ${this.db ? 'AND 1=1' : ''}
      GROUP BY e.platform
    `).all(userId);
    
    // Daily earnings for chart
    const dailyEarnings = this.db.prepare(`
      SELECT 
        DATE(e.earned_at) as date,
        SUM(e.amount) as daily_earnings,
        SUM(e.verified_views) as daily_views,
        COUNT(*) as transactions
      FROM earnings e
      WHERE e.user_id = ? AND e.earned_at >= datetime('now', '-30 days')
      GROUP BY DATE(e.earned_at)
      ORDER BY date ASC
    `).all(userId);
    
    return {
      summary: {
        totalEarnings: summary.total_earnings || 0,
        paidEarnings: summary.paid_earnings || 0,
        pendingEarnings: summary.pending_earnings || 0,
        disputedEarnings: summary.disputed_earnings || 0,
        totalTransactions: summary.total_transactions || 0,
        avgCPM: summary.avg_cpm || 0,
        totalViews: summary.total_verified_views || 0,
        campaignsCount: summary.campaigns_count || 0,
        platformsCount: summary.platforms_count || 0
      },
      byPlatform: byPlatform || [],
      dailyEarnings: dailyEarnings || []
    };
  }

  async getDetails(userId, filters = {}) {
    let query = `
      SELECT e.*, c.title as campaign_title, c.platform as campaign_platform,
        p.platform_url as post_url, p.platform as post_platform
      FROM earnings e
      LEFT JOIN campaigns c ON c.id = e.campaign_id
      LEFT JOIN posts p ON p.id = e.post_id
      WHERE e.user_id = ?
    `;
    const params = [userId];
    
    if (filters.campaignId) {
      query += ' AND e.campaign_id = ?';
      params.push(filters.campaignId);
    }
    if (filters.platform) {
      query += ' AND e.platform = ?';
      params.push(filters.platform);
    }
    if (filters.startDate) {
      query += ' AND e.earned_at >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ' AND e.earned_at <= ?';
      params.push(filters.endDate);
    }
    
    query += ' ORDER BY e.earned_at DESC';
    
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit || 50);
    }
    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset || 0);
    }
    
    return this.db.prepare(query).all(userId);
  }

  async getProjections(userId, scenarios) {
    // Get user's historical data for baseline
    const stats = this.db.prepare(`
      SELECT 
        AVG(e.cpm) as avg_cpm,
        AVG(e.verified_views) as avg_views,
        COUNT(*) as total_posts
      FROM earnings e
      WHERE e.user_id = ? AND e.status IN ('approved', 'paid')
    `).get(userId);
    
    const baseline = {
      avgCPM: stats.avg_cpm || 1.0,
      avgViews: stats.avg_views || 8000,
      postsPerDay: 10
    };
    
    // Default scenarios
    const defaultScenarios = [
      { name: 'Conservative', cpm: 0.5, postsPerDay: 5, avgViews: 3000, failureRate: 0.3 },
      { name: 'Realistic', cpm: 1.0, postsPerDay: 10, avgViews: 8000, failureRate: 0.25 },
      { name: 'Optimistic', cpm: 1.5, postsPerDay: 15, avgViews: 12000, failureRate: 0.2 },
      { name: 'Aggressive', cpm: 2.5, postsPerDay: 20, avgViews: 15000, failureRate: 0.15 }
    ];
    
    const customScenarios = scenarios || defaultScenarios;
    
    return customScenarios.map(scenario => {
      const dailyEarnings = (scenario.postsPerDay * scenario.avgViews / 1000) * scenario.cpm;
      const monthlyGross = dailyEarnings * 30;
      const monthlyNet = monthlyGross * (1 - (scenario.failureRate || 0.25));
      
      return {
        name: scenario.name,
        cpm: scenario.cpm,
        postsPerDay: scenario.postsPerDay,
        avgViews: scenario.avgViews,
        failureRate: scenario.failureRate || 0.25,
        dailyGross: dailyEarnings,
        monthlyGross: dailyEarnings * 30,
        monthlyNet: monthlyNet * (1 - (scenario.failureRate || 0.25)),
        yearlyNet: monthlyNet * 12
      };
    });
  }

  calculateProjection({ cpm = 1, postsPerDay = 10, avgViews = 8000, days = 30, failureRate = 0.25 }) {
    const dailyEarnings = (postsPerDay * avgViews / 1000) * cpm;
    const gross = dailyEarnings * days;
    const net = gross * (1 - 0.25); // 25% failure haircut
    
    return {
      dailyGross: dailyEarnings,
      dailyNet: dailyEarnings * 0.75,
      periodGross: dailyEarnings * days,
      periodNet: dailyEarnings * days * 0.75,
      yearlyGross: dailyEarnings * 365,
      yearlyNet: dailyEarnings * 365 * 0.75,
      breakdown: {
        postsPerDay,
        avgViews,
        cpm,
        days,
        failureRate: 0.25
      }
    };
  }

  async getDashboard(userId) {
    const [summary, byPlatform, dailyEarnings, topCampaigns, recentEarnings] = await Promise.all([
      this.getSummary(userId),
      this.getByPlatform(userId),
      this.getDailyEarnings(userId, 30),
      this.getTopCampaigns(userId, 5),
      this.getRecentEarnings(userId, 10)
    ]);
    
    return {
      summary,
      byPlatform,
      dailyEarnings,
      topCampaigns,
      recentEarnings
    };
  }

  async getByPlatform(userId) {
    return this.db.prepare(`
      SELECT 
        e.platform,
        SUM(e.amount) as total_earnings,
        COUNT(*) as transactions,
        AVG(e.cpm) as avg_cpm,
        SUM(e.verified_views) as total_views,
        SUM(e.amount) / NULLIF(SUM(e.verified_views), 0) * 1000 as effective_cpm
      FROM earnings e
      WHERE e.user_id = ? AND e.status IN ('approved', 'paid')
      GROUP BY e.platform
      ORDER BY total_earnings DESC
    `).all(userId);
  }

  async getDailyEarnings(userId, days = 30) {
    return this.db.prepare(`
      SELECT 
        DATE(e.earned_at) as date,
        SUM(e.amount) as daily_earnings,
        SUM(e.verified_views) as daily_views,
        COUNT(*) as transactions,
        AVG(e.cpm) as avg_cpm
      FROM earnings e
      WHERE e.user_id = ? AND e.earned_at >= datetime('now', '-30 days')
      GROUP BY DATE(e.earned_at)
      ORDER BY date ASC
    `).all(userId);
  }

  async getTopCampaigns(userId, limit = 10) {
    return this.db.prepare(`
      SELECT 
        c.id, c.title, c.platform,
        SUM(e.amount) as earnings,
        SUM(e.verified_views) as views,
        COUNT(e.id) as transactions,
        AVG(e.cpm) as avg_cpm
      FROM earnings e
      JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.user_id = ? AND e.status IN ('approved', 'paid')
      GROUP BY c.id
      ORDER BY earnings DESC
      LIMIT 10
    `).all(userId);
  }

  async getRecentEarnings(userId, limit = 10) {
    return this.db.prepare(`
      SELECT e.*, c.title as campaign_title
      FROM earnings e
      LEFT JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.user_id = ?
      ORDER BY e.earned_at DESC
      LIMIT ?
    `).all(userId, limit);
  }

  async getPerformance(userId, filters = {}) {
    const period = filters.period || '30d';
    const platform = filters.platform;
    
    let dateFilter = '';
    switch (period) {
      case '7d': dateFilter = "AND p.posted_at >= datetime('now', '-7 days')"; break;
      case '30d': dateFilter = "AND p.posted_at >= datetime('now', '-30 days')"; break;
      case '90d': dateFilter = "AND p.posted_at >= datetime('now', '-90 days')"; break;
      default: dateFilter = '';
    }
    
    const platformFilter = platform ? 'AND p.platform = ?' : '';
    const params = [userId];
    if (platform) params.push(platform);
    
    // Post performance
    const posts = this.db.prepare(`
      SELECT p.*, c.title as clip_title
      FROM posts p
      JOIN clips c ON c.id = p.clip_id
      WHERE p.user_id = ? ${dateFilter} ${platform ? 'AND p.platform = ?' : ''}
      ORDER BY p.posted_at DESC
      LIMIT 50
    `).all(userId);
    
    // Aggregate metrics
    const metrics = this.db.prepare(`
      SELECT 
        COUNT(*) as total_posts,
        SUM(p.views) as total_views,
        SUM(p.likes) as total_likes,
        SUM(p.comments) as total_comments,
        SUM(p.shares) as total_shares,
        AVG(p.engagement_rate) as avg_engagement_rate,
        SUM(p.earnings) as total_earnings,
        AVG(p.cpm) as avg_cpm
      FROM posts p
      WHERE p.user_id = ? AND p.status = 'posted' ${dateFilter}
    `).get(userId);
    
    return { posts, metrics };
  }

  async getDashboard(userId) {
    const [summary, byPlatform, dailyEarnings, topCampaigns, recentEarnings, performance] = await Promise.all([
      this.getSummary(userId),
      this.getByPlatform(userId),
      this.getDailyEarnings(userId, 30),
      this.getTopCampaigns(userId, 5),
      this.getRecentEarnings(userId, 10),
      this.getPerformance(userId, { period: '30d' })
    ]);
    
    return {
      summary,
      byPlatform,
      dailyEarnings,
      topCampaigns,
      recentEarnings,
      performance
    };
  }

  async getTopCampaigns(userId, limit = 10) {
    return this.db.prepare(`
      SELECT 
        c.id, c.title, c.platform,
        SUM(e.amount) as earnings,
        SUM(e.verified_views) as views,
        COUNT(e.id) as transactions,
        AVG(e.cpm) as avg_cpm
      FROM earnings e
      JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.user_id = ? AND e.status IN ('approved', 'paid')
      GROUP BY c.id
      ORDER BY earnings DESC
      LIMIT ?
    `).all(userId, 10);
  }

  async getRecentEarnings(userId, limit = 10) {
    return this.db.prepare(`
      SELECT e.*, c.title as campaign_title
      FROM earnings e
      LEFT JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.user_id = ?
      ORDER BY e.earned_at DESC
      LIMIT ?
    `).all(userId, limit);
  }

  async getDashboard(userId) {
    const [summary, byPlatform, dailyEarnings, topCampaigns, recentEarnings, performance] = await Promise.all([
      this.getSummary(userId),
      this.getByPlatform(userId),
      this.getDailyEarnings(userId, 30),
      this.getTopCampaigns(userId, 5),
      this.getRecentEarnings(userId, 10),
      this.getPerformance(userId, { period: '30d' })
    ]);
    
    return {
      summary,
      byPlatform,
      dailyEarnings,
      topCampaigns,
      recentEarnings,
      performance
    };
  }
}

export default EarningsTracker;
