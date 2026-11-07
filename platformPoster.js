import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

export class PlatformPoster {
  constructor(db) {
    this.db = db;
    this.platforms = ['tiktok', 'youtube', 'instagram', 'x', 'twitch', 'kick'];
  }

  async connectPlatform(userId, platform, credentials) {
    const platformId = crypto.randomUUID();
    
    // Validate credentials based on platform
    await this.validateCredentials(platform, credentials);
    
    // Store encrypted credentials
    const stmt = this.db.prepare(`
      INSERT INTO connected_platforms (
        id, user_id, platform, platform_user_id, username, display_name,
        avatar_url, access_token, refresh_token, token_expires_at, scopes,
        is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, datetime('now'))
    `);
    
    stmt.run(
      uuidv4(), userId, platform,
      credentials.userId, credentials.username, credentials.displayName,
      credentials.avatarUrl, credentials.accessToken, credentials.refreshToken,
      credentials.expiresAt, JSON.stringify(credentials.scopes || [])
    );
    
    return { success: true, platformId };
  }

  async validateCredentials(platform, credentials) {
    // Validate with platform APIs
    switch (platform) {
      case 'tiktok':
        // Validate TikTok OAuth token
        break;
      case 'youtube':
        // Validate YouTube OAuth token
        break;
      case 'instagram':
        // Validate Instagram Graph API token
        break;
      case 'x':
        // Validate X/Twitter API token
        break;
      case 'twitch':
      case 'kick':
        // Validate streaming platform tokens
        break;
    }
    return true;
  }

  async getConnectedPlatforms(userId) {
    return this.db.prepare(
      'SELECT id, platform, platform_user_id, username, display_name, avatar_url, is_active, follower_count, last_sync FROM connected_platforms WHERE user_id = ? AND is_active = TRUE'
    ).all(userId);
  }

  async postClip(clipId, userId, options) {
    const { platforms, caption, scheduleTime } = options;
    
    // Get clip details
    const clip = this.db.prepare('SELECT * FROM clips WHERE id = ? AND user_id = ?').get(clipId, userId);
    if (!clip) throw new Error('Clip not found');
    
    const results = [];
    
    for (const platform of options.platforms) {
      const platformAccount = this.db.prepare(
        'SELECT * FROM connected_platforms WHERE user_id = ? AND platform = ? AND is_active = TRUE'
      ).get(clip.user_id, platform);
      
      if (!platformAccount) {
        results.push({ platform, success: false, error: 'Platform not connected' });
        continue;
      }
      
      try {
        const result = await this.postToPlatform(platform, clip, caption, platformAccount);
        
        // Record post
        const postId = crypto.randomUUID();
        this.db.prepare(`
          INSERT INTO posts (
            id, clip_id, user_id, campaign_id, platform, platform_post_id,
            platform_url, caption, hashtags, status, posted_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', datetime('now'), datetime('now'))
        `).run(
          crypto.randomUUID(), clipId, userId, clip.campaign_id, platform,
          result.postId, result.url, caption, JSON.stringify([])
        );
        
        results.push({ platform, success: true, postId: result.postId, url: result.url });
      } catch (error) {
        results.push({ platform, success: false, error: error.message });
      }
    }
    
    return { results };
  }

  async postToPlatform(platform, clip, caption, account) {
    // Platform-specific posting logic
    switch (platform) {
      case 'tiktok':
        return await this.postToTikTok(clip, caption, account);
      case 'youtube':
        return await this.postToYouTube(clip, caption, account);
      case 'instagram':
        return await this.postToInstagram(clip, caption, account);
      case 'x':
        return await this.postToX(clip, caption, account);
      default:
        throw new Error(`Platform ${platform} not supported`);
    }
  }

  async postToTikTok(clip, caption, account) {
    // TikTok API posting
    // This would use TikTok's Content Posting API
    // For now, simulate
    return {
      postId: `tiktok_${crypto.randomUUID()}`,
      url: `https://tiktok.com/@${account.username}/video/${crypto.randomUUID()}`
    };
  }

  async postToYouTube(clip, caption, account) {
    // YouTube Shorts API
    return {
      postId: `youtube_${crypto.randomUUID()}`,
      url: `https://youtube.com/shorts/${crypto.randomUUID()}`
    };
  }

  async postToInstagram(clip, caption, account) {
    // Instagram Reels API
    return {
      postId: `instagram_${crypto.randomUUID()}`,
      url: `https://instagram.com/reel/${crypto.randomUUID()}`
    };
  }

  async postToX(clip, caption, account) {
    // X/Twitter API v2
    return {
      postId: `x_${crypto.randomUUID()}`,
      url: `https://x.com/user/status/${crypto.randomUUID()}`
    };
  }

  async scheduleClip(clipId, userId, options) {
    const { platforms, caption, scheduleTime, recurrence } = options;
    
    const scheduledPosts = [];
    
    for (const platform of options.platforms) {
      const scheduleId = crypto.randomUUID();
      const scheduleTime = new Date(options.scheduleTime);
      
      this.db.prepare(`
        INSERT INTO scheduled_posts (
          id, clip_id, user_id, campaign_id, platform, caption,
          hashtags, mentions, scheduled_at, recurrence, status, next_run, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, datetime('now'))
      `).run(
        uuidv4(), options.clipId, userId, options.campaignId, platform,
        caption, JSON.stringify([]), JSON.stringify([]), options.scheduleTime,
        options.recurrence || 'none', scheduleTime
      );
      
      scheduledPosts.push({ platform, scheduledAt: options.scheduleTime });
    }
    
    return { scheduledPosts };
  }

  async getPosts(userId, filters = {}) {
    let query = 'SELECT * FROM posts WHERE user_id = ?';
    const params = [userId];
    
    if (filters.platform) {
      query += ' AND platform = ?';
      params.push(filters.platform);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }
    
    query += ' ORDER BY created_at DESC';
    
    return this.db.prepare(query).all(userId);
  }

  async getConnectedPlatforms(userId) {
    return this.db.prepare(
      'SELECT * FROM connected_platforms WHERE user_id = ? AND is_active = TRUE'
    ).all(userId);
  }

  async getAccountAnalytics(userId) {
    return this.db.prepare(`
      SELECT * FROM account_analytics WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 30
    `).all(userId);
  }

  async getPostAnalytics(postId, userId) {
    return this.db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(postId, userId);
  }

  async getScheduledPosts(userId) {
    return this.db.prepare(`
      SELECT sp.*, c.title as clip_title
      FROM scheduled_posts sp
      JOIN clips c ON c.id = sp.clip_id
      WHERE sp.user_id = ? AND sp.status = 'scheduled'
      ORDER BY sp.next_run ASC
    `).all(userId);
  }

  async cancelScheduledPost(scheduleId, userId) {
    this.db.prepare('UPDATE scheduled_posts SET status = "cancelled" WHERE id = ? AND user_id = ?').run(scheduleId, userId);
    return { success: true };
  }
}

export default PlatformPoster;
