import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export class WhopAPI {
  constructor() {
    this.baseURL = 'https://api.whop.com/v1';
    this.contentRewardsURL = 'https://api.whop.com/v1/content-rewards';
  }

  async connect(userId, apiKey) {
    // Store API key for user
    // This would be encrypted and stored in database
    return { success: true, connected: true };
  }

  async getCampaigns(userId) {
    try {
      // This would call Whop's Content Rewards API
      // For now, return mock data structure
      return this.getMockCampaigns();
    } catch (error) {
      console.error('Whop API error:', error);
      throw error;
    }
  }

  getMockCampaigns() {
    return [
      {
        id: 'camp_roobet_001',
        title: 'Roobet Casino Clips',
        description: 'Clip the biggest wins and reactions from Roobet streamers',
        platform: 'whop',
        cpm: 1.50,
        budget_total: 250000,
        budget_remaining: 187000,
        min_views_per_clip: 1000,
        max_payout_per_clip: 500,
        platforms: ['tiktok', 'youtube_shorts', 'instagram_reels'],
        required_hashtags: ['#roobet', '#casino', '#bigwin'],
        required_mentions: ['@roobet'],
        min_clip_length: 15,
        max_clip_length: 60,
        required_language: 'en',
        status: 'active',
        budget_spent: 63000,
        views_total: 42000000,
        clips_submitted: 12450,
        clips_approved: 11200,
        start_date: '2025-01-01T00:00:00Z',
        end_date: '2026-12-31T23:59:59Z'
      },
      {
        id: 'camp_mrbeast_feastables',
        title: 'MrBeast Feastables Launch',
        description: 'Promote the new Feastables chocolate bars',
        platform: 'whop',
        cpm: 2.00,
        budget_total: 50000,
        budget_remaining: 32000,
        min_views_per_clip: 5000,
        max_payout_per_clip: 2000,
        platforms: ['tiktok', 'youtube_shorts', 'instagram_reels'],
        required_hashtags: ['#feastables', '#mrbeast', '#chocolate'],
        required_mentions: ['@mrbeast', '@feastables'],
        min_clip_length: 15,
        max_clip_length: 45,
        required_language: 'en',
        status: 'active',
        budget_spent: 18000,
        views_total: 25000000,
        clips_submitted: 890,
        clips_approved: 820,
        start_date: '2025-11-01T00:00:00Z',
        end_date: '2026-01-31T23:59:59Z'
      },
      {
        id: 'camp_lil_baby',
        title: 'Lil Baby New Album Promo',
        description: 'Clip the best moments from Lil Baby\'s new album',
        platform: 'whop',
        cpm: 0.30,
        budget_total: 25000,
        budget_remaining: 18000,
        min_views_per_clip: 1000,
        max_payout_per_clip: 100,
        platforms: ['tiktok', 'instagram_reels'],
        required_hashtags: ['#lilbaby', '#newmusic', '#hiphop'],
        required_mentions: ['@lilbaby'],
        min_clip_length: 15,
        max_clip_length: 60,
        required_language: 'en',
        status: 'active',
        budget_spent: 7000,
        views_total: 15000000,
        clips_submitted: 2100,
        clips_approved: 1850,
        start_date: '2025-10-15T00:00:00Z',
        end_date: '2026-01-15T23:59:59Z'
      },
      {
        id: 'camp_mutuum',
        title: 'MUTUUM DeFi Protocol Launch',
        description: 'Promote the new MUTUUM lending protocol',
        platform: 'whop',
        cpm: 6.00,
        budget_total: 100000,
        budget_remaining: 85000,
        min_views_per_clip: 500,
        max_payout_per_clip: 500,
        platforms: ['tiktok', 'youtube_shorts', 'x'],
        required_hashtags: ['#mutuum', '#defi', '#crypto', '#web3'],
        required_mentions: ['@mutuum_finance'],
        min_clip_length: 15,
        max_clip_length: 60,
        required_language: 'en',
        status: 'active',
        budget_spent: 15000,
        views_total: 8000000,
        clips_submitted: 340,
        clips_approved: 310,
        start_date: '2025-11-20T00:00:00Z',
        end_date: '2026-02-28T23:59:59Z'
      }
    ];
  }

  async getCampaign(campaignId, userId) {
    const campaigns = this.getMockCampaigns();
    return campaigns.find(c => c.id === campaignId) || null;
  }

  async submitClip(userId, campaignId, clipId, postUrl, platform) {
    // Submit clip to Whop Content Rewards
    // This would call Whop's API
    const submissionId = crypto.randomUUID();
    
    // Simulate submission
    return {
      submissionId,
      status: 'submitted',
      message: 'Clip submitted for review',
      estimatedReviewTime: '24-72 hours'
    };
  }

  async getEarnings(userId) {
    // Mock earnings data
    return {
      total_earnings: 12450.50,
      pending: 3420.75,
      paid: 9030.25,
      this_month: 2340.00,
      by_platform: {
        tiktok: 5420.00,
        youtube_shorts: 4100.00,
        instagram_reels: 2830.50,
        x: 100.50
      },
      pending_payouts: 3420.75,
      last_payout: '2025-11-15T10:30:00Z'
    };
  }

  async getCampaignDetails(campaignId) {
    const campaigns = this.getMockCampaigns();
    return campaigns.find(c => c.id === campaignId);
  }

  async getCampaignSubmissions(campaignId, userId) {
    // Mock submissions
    return [
      { id: 'sub_001', clip_id: 'clip_001', status: 'approved', views: 45000, earnings: 67.50, submitted_at: '2025-11-10T14:30:00Z' },
      { id: 'sub_002', clip_id: 'clip_002', status: 'pending', views: 0, earnings: 0, submitted_at: '2025-11-12T09:15:00Z' },
      { id: 'sub_003', clip_id: 'clip_003', status: 'approved', views: 125000, earnings: 187.50, submitted_at: '2025-11-08T16:45:00Z' }
    ];
  }
}

export default WhopAPI;
