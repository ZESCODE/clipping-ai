import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

let dbInstance = null;

export async function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  // In serverless environments, use in-memory database
  // For production, replace with external database (PlanetScale, Neon, etc.)
  dbInstance = await open({
    filename: process.env.DATABASE_URL || ':memory:',
    driver: sqlite3.Database
  });

  // Enable WAL mode for better concurrency
  await dbInstance.exec('PRAGMA journal_mode = WAL');
  await dbInstance.exec('PRAGMA foreign_keys = ON');

  await initializeTables(dbInstance);
  return dbInstance;
}

async function initializeTables(db) {
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

    // Clips table
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

    // Posts table
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

    // Earnings table
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

    // User Settings
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

    // Connected Platforms
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

    // API Keys
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
    )`
  ];

  for (const table of tables) {
    await db.exec(table);
  }

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(platform)',
    'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)',
    'CREATE INDEX IF NOT EXISTS idx_user_campaigns_user ON user_campaigns(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_videos_campaign ON videos(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_clips_video ON clips(video_id)',
    'CREATE INDEX IF NOT EXISTS idx_clips_user ON clips(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_clips_campaign ON clips(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform)',
    'CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)',
    'CREATE INDEX IF NOT EXISTS idx_earnings_user ON earnings(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_earnings_campaign ON earnings(campaign_id)',
    'CREATE INDEX IF NOT EXISTS idx_posts_user_platform ON posts(user_id, platform)',
    'CREATE INDEX IF NOT EXISTS idx_earnings_user_platform ON earnings(user_id, platform)'
  ];

  for (const index of indexes) {
    await db.exec(index);
  }
}

export default getDatabase;