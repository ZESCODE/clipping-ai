import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'data', 'clipping-ai.db');

// Enable verbose mode for debugging
sqlite3.verbose();

class ClippingDatabase {
  constructor() {
    this.db = null;
  }

  async initialize() {
    // Ensure data directory exists
    const dataDir = join(dirname(__filename), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new sqlite3.Database(dbPath);
    
    // Enable WAL mode and foreign keys
    await this.run("PRAGMA journal_mode = WAL");
    await this.run("PRAGMA foreign_keys = ON");
    
    await this.createTables();
    console.log('Database initialized');
  }

  // Promise-based helpers
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // better-sqlite3 compatible API
  prepare(sql) {
    const db = this.db;
    return {
      run: (...params) => new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
        });
      }),
      get: (...params) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }),
      all: (...params) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }),
      iterate: function* (...params) {
        // Generator not easily supported, return empty for now
        return;
      }
    };
  }

  async createTables() {
    const tables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        subscription_tier TEXT DEFAULT 'free',
        subscription_expires DATETIME,
        settings TEXT DEFAULT '{}'
      )`,

      // Sessions table
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // Campaigns table
      `CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        external_id TEXT,
        platform TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        source_url TEXT,
        source_type TEXT,
        cpm REAL NOT NULL,
        budget_total REAL,
        budget_remaining REAL,
        min_views_per_clip INTEGER DEFAULT 1000,
        max_payout_per_clip REAL,
        platforms TEXT,
        required_hashtags TEXT,
        required_mentions TEXT,
        min_clip_length INTEGER DEFAULT 15,
        max_clip_length INTEGER DEFAULT 60,
        required_language TEXT DEFAULT 'en',
        status TEXT DEFAULT 'active',
        budget_spent REAL DEFAULT 0,
        views_total INTEGER DEFAULT 0,
        clips_submitted INTEGER DEFAULT 0,
        clips_approved INTEGER DEFAULT 0,
        start_date DATETIME,
        end_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // User Campaigns
      `CREATE TABLE IF NOT EXISTS user_campaigns (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        campaign_id TEXT NOT NULL,
        status TEXT DEFAULT 'joined',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        clips_submitted INTEGER DEFAULT 0,
        clips_approved INTEGER DEFAULT 0,
        earnings REAL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        UNIQUE(user_id, campaign_id)
      )`,

      // Videos table
      `CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        campaign_id TEXT,
        original_filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        duration REAL,
        width INTEGER,
        height INTEGER,
        fps REAL,
        codec TEXT,
        source_url TEXT,
        source_type TEXT,
        source_metadata TEXT,
        status TEXT DEFAULT 'uploaded',
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
      )`,

      // Analysis jobs
      `CREATE TABLE IF NOT EXISTS analysis_jobs (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        input_data TEXT,
        output_data TEXT,
        error_message TEXT,
        started_at DATETIME,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // Detected moments
      `CREATE TABLE IF NOT EXISTS moments (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        analysis_job_id TEXT,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        duration REAL NOT NULL,
        hook_score REAL DEFAULT 0,
        viral_potential REAL DEFAULT 0,
        engagement_prediction REAL DEFAULT 0,
        transcript_segment TEXT,
        keywords TEXT,
        categories TEXT,
        recommended_platforms TEXT,
        ai_notes TEXT,
        status TEXT DEFAULT 'detected',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
      )`,

      // Generated clips
      `CREATE TABLE IF NOT EXISTS clips (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        campaign_id TEXT,
        moment_id TEXT,
        file_path TEXT NOT NULL,
        thumbnail_path TEXT,
        start_time REAL NOT NULL,
        end_time REAL NOT NULL,
        duration REAL NOT NULL,
        width INTEGER,
        height INTEGER,
        file_size INTEGER,
        title TEXT,
        description TEXT,
        hashtags TEXT,
        mentions TEXT,
        caption TEXT,
        platform_versions TEXT,
        status TEXT DEFAULT 'generated',
        ai_score REAL DEFAULT 0,
        hook_score REAL DEFAULT 0,
        viral_potential REAL DEFAULT 0,
        variation_of TEXT,
        variation_index INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
      )`,

      // Clip variations
      `CREATE TABLE IF NOT EXISTS clip_variations (
        id TEXT PRIMARY KEY,
        parent_clip_id TEXT NOT NULL,
        clip_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        variation_type TEXT,
        changes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_clip_id) REFERENCES clips(id) ON DELETE CASCADE,
        FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
      )`,

      // Captions
      `CREATE TABLE IF NOT EXISTS captions (
        id TEXT PRIMARY KEY,
        clip_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        style TEXT,
        text TEXT NOT NULL,
        word_timestamps TEXT,
        burned_in BOOLEAN DEFAULT FALSE,
        font_settings TEXT,
        position TEXT,
        language TEXT DEFAULT 'en',
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // Connected platforms
      `CREATE TABLE IF NOT EXISTS connected_platforms (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        platform_user_id TEXT,
        username TEXT,
        display_name TEXT,
        avatar_url TEXT,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at DATETIME,
        scopes TEXT,
        follower_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, platform)
      )`,

      // Posts
      `CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        clip_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        campaign_id TEXT,
        platform TEXT NOT NULL,
        platform_post_id TEXT,
        platform_url TEXT,
        caption TEXT,
        hashtags TEXT,
        mentions TEXT,
        scheduled_at DATETIME,
        posted_at DATETIME,
        status TEXT DEFAULT 'draft',
        error_message TEXT,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        engagement_rate REAL DEFAULT 0,
        earnings REAL DEFAULT 0,
        cpm REAL,
        verified_views INTEGER DEFAULT 0,
        approved_views INTEGER DEFAULT 0,
        payout_status TEXT DEFAULT 'pending',
        payout_amount REAL DEFAULT 0,
        paid_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
      )`,

      // Earnings
      `CREATE TABLE IF NOT EXISTS earnings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        campaign_id TEXT,
        platform TEXT NOT NULL,
        clip_id TEXT,
        post_id TEXT,
        amount REAL NOT NULL,
        cpm REAL,
        views INTEGER DEFAULT 0,
        verified_views INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'pending',
        campaign_payout_id TEXT,
        platform_payout_id TEXT,
        earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME,
        paid_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // Withdrawals
      `CREATE TABLE IF NOT EXISTS withdrawals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        method TEXT,
        destination TEXT,
        status TEXT DEFAULT 'pending',
        fee REAL DEFAULT 0,
        net_amount REAL,
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        completed_at DATETIME,
        failure_reason TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // Scheduled posts
      `CREATE TABLE IF NOT EXISTS scheduled_posts (
        id TEXT PRIMARY KEY,
        clip_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        campaign_id TEXT,
        platform TEXT NOT NULL,
        caption TEXT,
        hashtags TEXT,
        mentions TEXT,
        scheduled_at DATETIME NOT NULL,
        recurrence TEXT,
        recurrence_end DATETIME,
        status TEXT DEFAULT 'scheduled',
        last_run DATETIME,
        next_run DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
      )`,

      // Account analytics
      `CREATE TABLE IF NOT EXISTS account_analytics (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        platform_user_id TEXT,
        date DATE NOT NULL,
        followers INTEGER DEFAULT 0,
        following INTEGER DEFAULT 0,
        posts INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        profile_visits INTEGER DEFAULT 0,
        reach INTEGER DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        engagement_rate REAL DEFAULT 0,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // Earnings projections scenarios
      `CREATE TABLE IF NOT EXISTS projection_scenarios (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        cpm REAL NOT NULL,
        posts_per_day INTEGER NOT NULL,
        avg_views INTEGER NOT NULL,
        days INTEGER NOT NULL,
        failure_rate REAL DEFAULT 0.25,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // API keys for external services
      `CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        service TEXT NOT NULL,
        api_key_encrypted TEXT NOT NULL,
        metadata TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, service)
      )`,

      // Settings
      `CREATE TABLE IF NOT EXISTS user_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        default_cpm REAL DEFAULT 1.0,
        default_posts_per_day INTEGER DEFAULT 10,
        default_avg_views INTEGER DEFAULT 8000,
        default_failure_rate REAL DEFAULT 0.25,
        auto_analyze BOOLEAN DEFAULT TRUE,
        auto_generate_captions BOOLEAN DEFAULT TRUE,
        auto_post BOOLEAN DEFAULT FALSE,
        preferred_platforms TEXT,
        caption_style TEXT DEFAULT 'tiktok',
        caption_font TEXT DEFAULT 'Arial',
        caption_size INTEGER DEFAULT 48,
        caption_color TEXT DEFAULT '#FFFFFF',
        caption_outline_color TEXT DEFAULT '#000000',
        caption_position TEXT DEFAULT 'bottom',
        watermark_enabled BOOLEAN DEFAULT FALSE,
        watermark_text TEXT,
        watermark_opacity REAL DEFAULT 0.5,
        notification_email BOOLEAN DEFAULT TRUE,
        notification_push BOOLEAN DEFAULT TRUE,
        notification_earnings BOOLEAN DEFAULT TRUE,
        notification_campaigns BOOLEAN DEFAULT TRUE,
        timezone TEXT DEFAULT 'UTC',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      )`,

      // Webhooks
      `CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        url TEXT NOT NULL,
        events TEXT,
        secret TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // Job queue for background processing
      `CREATE TABLE IF NOT EXISTS job_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT,
        priority INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        scheduled_at DATETIME,
        started_at DATETIME,
        completed_at DATETIME,
        failed_at DATETIME,
        error_message TEXT,
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.exec(table);
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(platform)',
      'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)',
      'CREATE INDEX IF NOT EXISTS idx_user_campaigns_user ON user_campaigns(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_videos_campaign ON videos(campaign_id)',
      'CREATE INDEX IF NOT EXISTS idx_moments_video ON moments(video_id)',
      'CREATE INDEX IF NOT EXISTS idx_clips_video ON clips(video_id)',
      'CREATE INDEX IF NOT EXISTS idx_clips_user ON clips(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_clips_campaign ON clips(campaign_id)',
      'CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform)',
      'CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)',
      'CREATE INDEX IF NOT EXISTS idx_earnings_user ON earnings(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_earnings_campaign ON earnings(campaign_id)',
      'CREATE INDEX IF NOT EXISTS idx_posts_user_platform ON posts(user_id, platform)',
      'CREATE INDEX IF NOT EXISTS idx_earnings_user_platform ON earnings(user_id, platform)',
      'CREATE INDEX IF NOT EXISTS idx_jobs_status ON job_queue(status)',
      'CREATE INDEX IF NOT EXISTS idx_moments_video_status ON moments(video_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_clips_status ON clips(status)',
    ];

    for (const index of indexes) {
      await this.exec(index);
    }
  }

  getDb() {
    return this.db;
  }

  // Transaction helper - simplified for sqlite3
  transaction(fn) {
    return async (...args) => {
      await this.run('BEGIN TRANSACTION');
      try {
        const result = await fn(...args);
        await this.run('COMMIT');
        return result;
      } catch (err) {
        await this.run('ROLLBACK');
        throw err;
      }
    };
  }

  close() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
}

export default ClippingDatabase;
export { ClippingDatabase as Database };