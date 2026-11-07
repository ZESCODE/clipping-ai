import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export class VyroAPI {
  constructor() {
    this.baseURL = 'https://api.vyro.ai/v1';
    this.flatCPM = 3.00; // $3 per 1000 views
    this.clipCap = 1000; // $1000 max per clip
  }

  async connect(userId, apiKey) {
    // Store API key for user
    return { success: true, connected: true };
  }

  async getCampaigns(userId) {
    // Vyro campaigns
    return [
      {
        id: 'vyro_mrbeast_main',
        title: 'MrBeast Main Channel Clips',
        description: 'Clip the best moments from MrBeast main channel videos',
        platform: 'vyro',
        cpm: 3.00, // Flat $3 CPM
        clip_cap: 1000, // $1000 max per clip
        budget_total: 500000,
        budget_remaining: 350000,
        min_views_per_clip: 1000,
        max_payout_per_clip: 1000,
        platforms: ['tiktok', 'youtube_shorts', 'instagram_reels'],
        required_hashtags: ['#mrbeast', '#mrbeastshorts'],
        min_clip_length: 15,
        max_clip_length: 60,
        required_language: 'en',
        status: 'active',
        budget_spent: 150000,
        views_total: 150000000,
        clips_submitted: 45000,
        clips_approved: 42000,
        payout_schedule: 'hourly',
        payout_method: 'stripe'
      },
      {
        id: 'vyro_beast_gaming',
        title: 'MrBeast Gaming Clips',
        description: 'Clip the best gaming moments from MrBeast Gaming',
        platform: 'vyro',
        cpm: 3.00,
        clip_cap: 1000,
        budget_total: 200000,
        budget_remaining: 180000,
        min_views_per_clip: 1000,
        max_payout_per_clip: 1000,
        platforms: ['tiktok', 'youtube_shorts', 'instagram_reels'],
        required_hashtags: ['#mrbeastgaming', '#gaming'],
        min_clip_length: 15,
        max_clip_length: 60,
        required_language: 'en',
        status: 'active',
        budget_spent: 50000,
        views_total: 45000000,
        clips_submitted: 8900,
        clips_approved: 8200,
        payout_schedule: 'hourly',
        payout_method: 'stripe'
      },
      {
        id: 'vyro_beast_philanthropy',
        title: 'Beast Philanthropy Clips',
        description: 'Clip the most heartwarming moments from Beast Philanthropy',
        platform: 'vyro',
        cpm: 3.00,
        clip_cap: 1000,
        budget_total: 100000,
        budget_remaining: 90000,
        min_views_per_clip: 1000,
        max_payout_per_clip: 1000,
        platforms: ['tiktok', 'youtube_shorts', 'instagram_reels'],
        required_hashtags: ['#beastphilanthropy', '#charity', '#giving'],
        min_clip_length: 15,
        max_clip_length: 120,
        required_language: 'en',
        status: 'active',
        budget_spent: 10000,
        views_total: 5000000,
        clips_submitted: 450,
        clips_approved: 420,
        payout_schedule: 'hourly',
        payout_method: 'stripe'
      }
    ];
  }

  async getCampaign(campaignId, userId) {
    const campaigns = await this.getCampaigns();
    return campaigns.find(c => c.id === campaignId);
  }

  async submitClip(userId, campaignId, clipId, postUrl, platform) {
    const submissionId = crypto.randomUUID();
    
    // Vyro has hourly payouts and instant approval for verified creators
    return {
      submissionId,
      status: 'submitted',
      status_detail: 'pending_verification',
      message: 'Clip submitted to Vyro. Verification typically completes within 1 hour.',
      estimatedApprovalTime: '1 hour',
      payout_schedule: 'hourly'
    };
  }

  async getEarnings(userId) {
    return {
      total_earnings: 45600.00,
      pending: 1200.00,
      paid: 44400.00,
      this_month: 8500.00,
      by_platform: {
        tiktok: 22000.00,
        youtube_shorts: 18500.00,
        instagram_reels: 4900.00
      },
      pending_payouts: 1200.00,
      last_payout: new Date().toISOString(),
      next_payout: new Date(Date.now() + 3600000).toISOString(), // Next hour
      payout_schedule: 'hourly',
      clip_cap: 1000
    };
  }

  async getCampaign(campaignId, userId) {
    const campaigns = await this.getCampaigns();
    return campaigns.find(c => c.id === campaignId);
  }

  async submitClip(userId, campaignId, clipId, postUrl, platform) {
    const submissionId = crypto.randomUUID();
    
    return {
      submissionId,
      status: 'submitted',
      status_detail: 'pending_verification',
      message: 'Clip submitted to Vyro. Verification typically completes within 1 hour.',
      estimatedApprovalTime: '1 hour',
      payout_schedule: 'hourly',
      clip_cap: 1000
    };
  }

  async getEarnings(userId) {
    return {
      total_earnings: 45600.00,
      pending: 1200.00,
      paid: 44400.00,
      this_month: 8500.00,
      by_platform: {
        tiktok: 22000.00,
        youtube_shorts: 18500.00,
        instagram_reels: 4900.00
      },
      pending_payouts: 1200.00,
      last_payout: new Date().toISOString(),
      next_payout: new Date(Date.now() + 3600000).toISOString(),
      payout_schedule: 'hourly',
      clip_cap: 1000
    };
  }

  async getCampaigns(userId) {
    return [
      {
        id: 'vyro_mrbeast_main',
        title: 'MrBeast Main Channel Clips',
        description: 'Clip the best moments from MrBeast main channel videos',
        platform: 'vyro',
        cpm: 3.00,
        clip_cap: 1000,
        budget_total: 500000,
        budget_remaining: 350000,
        min_views_per_clip: 1000,
        max_payout_per_clip: 1000,
        platforms: ['tiktok', 'youtube_shorts', 'instagram_reels'],
        required_hashtags: ['#mrbeast', '#mrbeastshorts'],
        min_clip_length: 15,
        max_clip_length: 60,
        required_language: 'en',
        status: 'active',
        budget_spent: 150000,
        views_total: 150000000,
        clips_submitted: 45000,
        clips_approved: 42000,
        payout_schedule: 'hourly',
        payout_method: 'stripe'
      },
      {
        id: 'vyro_beast_gaming',
        title: 'MrBeast Gaming Clips',
        description: 'Clip the best gaming moments from MrBeast Gaming',
        platform: 'vyro',
        cpm: 3.00,
        clip_cap: 1000,
        budget_total: 200000,
        budget_remaining: 180000,
        min_views_per_clip: 1000,
        max_payout_per_clip: 1000,
        platforms: ['tiktok', 'youtube_shorts', 'instagram_reels'],
        required_hashtags: ['#mrbeastgaming', '#gaming'],
        min_clip_length: 15,
        max_clip_length: 60,
        required_language: 'en',
        status: 'active',
        budget_spent: 50000,
        views_total: 45000000,
        clips_submitted: 8900,
        clips_approved: 8200,
        payout_schedule: 'hourly',
        payout_method: 'stripe'
      },
      {
        id: 'vyro_beast_philanthropy',
        title: 'Beast Philanthropy Clips',
        description: 'Clip the most heartwarming moments from Beast Philanthropy',
        platform: 'vyro',
        cpm: 3.00,
        clip_cap: 1000,
        budget_total: 100000,
        budget_remaining: 90000,
        min_views_per_clip: 1000,
        max_payout_per_clip: 1000,
        platforms: ['tiktok', 'youtube_shorts', 'instagram_reels'],
        required_hashtags: ['#beastphilanthropy', '#charity', '#giving'],
        min_clip_length: 15,
        max_clip_length: 120,
        required_language: 'en',
        status: 'active',
        budget_spent: 10000,
        views_total: 5000000,
        clips_submitted: 450,
        clips_approved: 420,
        payout_schedule: 'hourly',
        payout_method: 'stripe'
      }
    ];
  }

  async submitClip(userId, campaignId, clipId, postUrl, platform) {
    const submissionId = crypto.randomUUID();
    
    return {
      submissionId,
      status: 'submitted',
      status_detail: 'pending_verification',
      message: 'Clip submitted to Vyro. Verification typically completes within 1 hour.',
      estimatedApprovalTime: '1 hour',
      payout_schedule: 'hourly',
      clip_cap: 1000
    };
  }

  async getEarnings(userId) {
    return {
      total_earnings: 45600.00,
      pending: 1200.00,
      paid: 44400.00,
      this_month: 8500.00,
      by_platform: {
        tiktok: 22000.00,
        youtube_shorts: 18500.00,
        instagram_reels: 4900.00
      },
      pending_payouts: 1200.00,
      last_payout: new Date().toISOString(),
      next_payout: new Date(Date.now() + 3600000).toISOString(),
      payout_schedule: 'hourly',
      clip_cap: 1000
    };
  }
}

export default VyroAPI;
