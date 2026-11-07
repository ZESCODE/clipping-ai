import { v4 as uuidv4 } from 'uuid';

export class CampaignManager {
  constructor(db) {
    this.db = db;
  }

  async getCampaigns(userId, filters = {}) {
    let query = `
      SELECT c.*, 
        uc.status as user_status,
        uc.clips_submitted,
        uc.clips_approved,
        uc.earnings
      FROM campaigns c
      LEFT JOIN user_campaigns uc ON uc.campaign_id = c.id AND uc.user_id = ?
      WHERE 1=1
    `;
    const params = [filters.userId || ''];

    if (filters.platform) {
      query += ' AND c.platform = ?';
      params.push(filters.platform);
    }
    if (filters.status) {
      query += ' AND c.status = ?';
      params.push(filters.status);
    }
    if (filters.minCPM) {
      query += ' AND c.cpm >= ?';
      params.push(filters.minCPM);
    }
    if (filters.maxCPM) {
      query += ' AND c.cpm <= ?';
      params.push(filters.maxCPM);
    }

    // Sort
    const sort = filters.sort || 'newest';
    switch (sort) {
      case 'cpm_desc':
        query += ' ORDER BY c.cpm DESC';
        break;
      case 'cpm_asc':
        query += ' ORDER BY c.cpm ASC';
        break;
      case 'budget_desc':
        query += ' ORDER BY c.budget_remaining DESC';
        break;
      case 'newest':
      default:
        query += ' ORDER BY c.created_at DESC';
        break;
    }

    const campaigns = this.db.prepare(query).all(filters.userId);
    return campaigns;
  }

  async getCampaign(campaignId, userId) {
    const campaign = this.db.prepare(`
      SELECT c.*, uc.status as user_status, uc.clips_submitted, uc.clips_approved, uc.earnings
      FROM campaigns c
      LEFT JOIN user_campaigns uc ON uc.campaign_id = c.id AND uc.user_id = ?
      WHERE c.id = ?
    `).get(userId, campaignId);

    if (!campaign) throw new Error('Campaign not found');

    // Parse JSON fields
    if (campaign.platforms) campaign.platforms = JSON.parse(campaign.platforms);
    if (campaign.required_hashtags) campaign.required_hashtags = JSON.parse(campaign.required_hashtags);
    if (campaign.required_mentions) campaign.required_mentions = JSON.parse(campaign.required_mentions);
    if (campaign.source_metadata) campaign.source_metadata = JSON.parse(campaign.source_metadata);

    return campaign;
  }

  async syncCampaigns(userId, platforms = ['whop', 'vyro']) {
    const results = { campaigns: [], count: 0 };

    // Sync from Whop
    if (platforms.includes('whop')) {
      // This would call Whop API - implemented in WhopAPI service
      // For now, return mock data structure
    }

    if (platforms.includes('vyro')) {
      // Sync from Vyro
    }

    return results;
  }

  async joinCampaign(campaignId, userId) {
    const campaign = this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    if (campaign.status !== 'active') {
      throw new Error('Campaign is not active');
    }

    if (campaign.budget_remaining <= 0) {
      throw new Error('Campaign budget exhausted');
    }

    // Check if already joined
    const existing = this.db.prepare('SELECT * FROM user_campaigns WHERE user_id = ? AND campaign_id = ?').get(userId, campaignId);
    if (existing) {
      if (existing.status === 'left') {
        // Re-join
        this.db.prepare('UPDATE user_campaigns SET status = "joined", joined_at = datetime("now") WHERE user_id = ? AND campaign_id = ?').run(userId, campaignId);
      }
      throw new Error('Already joined this campaign');
    }

    // Join campaign
    const ucId = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO user_campaigns (id, user_id, campaign_id, status, joined_at)
      VALUES (?, ?, ?, 'joined', datetime('now'))
    `).run(uuidv4(), userId, campaignId);

    // Update campaign subscriber count
    this.db.prepare('UPDATE campaigns SET clips_submitted = clips_submitted + 1 WHERE id = ?').run(campaignId);

    return { success: true, message: 'Successfully joined campaign' };
  }

  async leaveCampaign(campaignId, userId) {
    this.db.prepare('UPDATE user_campaigns SET status = "left" WHERE user_id = ? AND campaign_id = ?').run(userId, campaignId);
    return { success: true };
  }

  async getSubmissions(campaignId, userId) {
    const submissions = this.db.prepare(`
      SELECT p.*, c.title as clip_title, c.file_path as clip_path
      FROM posts p
      JOIN clips c ON c.id = p.clip_id
      WHERE p.campaign_id = ? AND p.user_id = ?
      ORDER BY p.created_at DESC
    `).all(campaignId, userId);
    return submissions;
  }

  async submitClip(campaignId, clipId, postUrl, platform, userId) {
    // Verify ownership
    const clip = this.db.prepare('SELECT * FROM clips WHERE id = ? AND user_id = ?').get(clipId, userId);
    if (!clip) throw new Error('Clip not found or unauthorized');

    // Check campaign membership
    const membership = this.db.prepare('SELECT * FROM user_campaigns WHERE user_id = ? AND campaign_id = ?').get(userId, campaignId);
    if (!membership) throw new Error('Not a member of this campaign');

    // Create post record
    const postId = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO posts (id, clip_id, user_id, campaign_id, platform, platform_url, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'submitted', datetime('now'))
    `).run(uuidv4(), clipId, userId, campaignId, platform, postUrl);

    return { success: true, postId };
  }

  // Campaign CRUD for manual campaigns
  async createCampaign(userId, data) {
    const campaignId = uuidv4();
    const {
      title,
      description,
      source_url,
      source_type,
      cpm,
      budget_total,
      min_views_per_clip,
      max_payout_per_clip,
      platforms,
      required_hashtags,
      required_mentions,
      min_clip_length,
      max_clip_length,
      required_language,
      start_date,
      end_date
    } = data;

    this.db.prepare(`
      INSERT INTO campaigns (
        id, platform, title, description, source_url, source_type,
        cpm, budget_total, budget_remaining, min_views_per_clip,
        max_payout_per_clip, platforms, required_hashtags, required_mentions,
        min_clip_length, max_clip_length, required_language,
        start_date, end_date, status, created_at
      ) VALUES (?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
    `).run(
      uuidv4(), data.title, data.description, data.source_url, data.source_type,
      data.cpm, data.budget_total, data.budget_total, data.min_views_per_clip || 1000,
      data.max_payout_per_clip, JSON.stringify(data.platforms || ['tiktok', 'youtube_shorts', 'instagram_reels']),
      JSON.stringify(data.required_hashtags || []), JSON.stringify(data.required_mentions || []),
      data.min_clip_length || 15, data.max_clip_length || 60, data.required_language || 'en',
      data.start_date, data.end_date
    );

    return { campaignId };
  }

  async updateCampaign(campaignId, userId, data) {
    // Verify ownership or admin
    const campaign = this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const allowedFields = ['title', 'description', 'cpm', 'budget_total', 'status', 'end_date'];
    const updates = [];
    const values = [];

    Object.keys(data).forEach(key => {
      if (['title', 'description', 'cpm', 'budget_total', 'status', 'end_date'].includes(key)) {
        updates.push(`${key} = ?`);
        values.push(data[key]);
      }
    });

    if (updates.length > 0) {
      values.push(campaignId);
      this.db.prepare(`UPDATE campaigns SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values, campaignId);
    }

    return { success: true };
  }

  async getCampaignStats(campaignId) {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT uc.user_id) as total_clippers,
        SUM(uc.clips_submitted) as total_submissions,
        SUM(uc.clips_approved) as total_approved,
        SUM(uc.earnings) as total_paid,
        COUNT(p.id) as total_posts,
        SUM(p.views) as total_views,
        SUM(p.earnings) as total_earnings
      FROM campaigns c
      LEFT JOIN user_campaigns uc ON uc.campaign_id = c.id
      LEFT JOIN posts p ON p.campaign_id = c.id
      WHERE c.id = ?
    `).get(campaignId);

    return stats;
  }
}

export default CampaignManager;