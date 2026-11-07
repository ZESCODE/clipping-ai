import { sql } from '@vercel/postgres';

export async function initializeDatabase() {
  try {
    // Create tables if they don't exist
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        subscription_tier TEXT DEFAULT 'free',
        subscription_expires TIMESTAMP,
        settings JSONB DEFAULT '{}'
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS campaigns (
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
        platforms JSONB,
        required_hashtags JSONB,
        required_mentions JSONB,
        min_clip_length INTEGER DEFAULT 15,
        max_clip_length INTEGER DEFAULT 60,
        required_language TEXT DEFAULT 'en',
        status TEXT DEFAULT 'active',
        budget_spent REAL DEFAULT 0,
        views_total INTEGER DEFAULT 0,
        clips_submitted INTEGER DEFAULT 0,
        clips_approved INTEGER DEFAULT 0,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_campaigns (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'joined',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        clips_submitted INTEGER DEFAULT 0,
        clips_approved INTEGER DEFAULT 0,
        earnings REAL DEFAULT 0,
        UNIQUE(user_id, campaign_id)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
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
        source_metadata JSONB,
        status TEXT DEFAULT 'uploaded',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS clips (
        id TEXT PRIMARY KEY,
        video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
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
        hashtags JSONB,
        mentions JSONB,
        caption TEXT,
        platform_versions JSONB,
        status TEXT DEFAULT 'generated',
        ai_score REAL DEFAULT 0,
        hook_score REAL DEFAULT 0,
        viral_potential REAL DEFAULT 0,
        variation_of TEXT,
        variation_index INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
        platform TEXT NOT NULL,
        platform_post_id TEXT,
        platform_url TEXT,
        caption TEXT,
        hashtags JSONB,
        mentions JSONB,
        scheduled_at TIMESTAMP,
        posted_at TIMESTAMP,
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
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS earnings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
        platform TEXT NOT NULL,
        clip_id TEXT REFERENCES clips(id) ON DELETE SET NULL,
        post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
        amount REAL NOT NULL,
        cpm REAL,
        views INTEGER DEFAULT 0,
        verified_views INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        status TEXT DEFAULT 'pending',
        campaign_payout_id TEXT,
        platform_payout_id TEXT,
        earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        paid_at TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        default_cpm REAL DEFAULT 1.0,
        default_posts_per_day INTEGER DEFAULT 10,
        default_avg_views INTEGER DEFAULT 8000,
        default_failure_rate REAL DEFAULT 0.25,
        auto_analyze BOOLEAN DEFAULT TRUE,
        auto_generate_captions BOOLEAN DEFAULT TRUE,
        auto_post BOOLEAN DEFAULT FALSE,
        preferred_platforms JSONB,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS connected_platforms (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        platform_user_id TEXT,
        username TEXT,
        display_name TEXT,
        avatar_url TEXT,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP,
        scopes JSONB,
        follower_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        last_sync TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, platform)
      )
    `;

    console.log('Database tables initialized successfully');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export { sql };