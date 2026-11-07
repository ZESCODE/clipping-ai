import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'clipping-ai-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';
const REFRESH_TOKEN_EXPIRES = '30d';

export class Auth {
  constructor(db) {
    this.db = db;
  }

  async register(email, password, username) {
    // Check if user exists
    const existingUser = await this.db.get('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existingUser) {
      throw new Error('Email or username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userId = crypto.randomUUID();
    await this.db.run(`
      INSERT INTO users (id, email, username, password_hash, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `, [uuidv4(), email, username, passwordHash]);

    const user = await this.db.get('SELECT id, email, username, created_at FROM users WHERE email = ?', [email]);
    
    // Create default settings
    await this.db.run(`
      INSERT INTO user_settings (id, user_id) VALUES (?, ?)
    `, [crypto.randomUUID(), user.id]);

    // Generate tokens
    const accessToken = this.generateAccessToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);
    
    // Store session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.db.run(`
      INSERT INTO sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `, [uuidv4(), user.id, refreshToken, expiresAt]);

    return {
      user: { id: user.id, email: user.email, username: user.username },
      accessToken,
      refreshToken
    };
  }

  async login(email, password) {
    const user = await this.db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await this.db.run("UPDATE users SET updated_at = datetime('now') WHERE id = ?", [user.id]);

    const accessToken = this.generateAccessToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);

    // Store session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await this.db.run(`
      INSERT INTO sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `, [uuidv4(), user.id, refreshToken, expiresAt]);

    return {
      user: { id: user.id, email: user.email, username: user.username },
      accessToken,
      refreshToken
    };
  }

  async getUser(userId) {
    const user = await this.db.get('SELECT id, email, username, avatar_url, created_at, subscription_tier FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  generateAccessToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  generateRefreshToken(userId) {
    return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });
  }

  verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }

  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET);
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const session = await this.db.get('SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")', [refreshToken]);
      if (!session) {
        throw new Error('Invalid or expired refresh token');
      }

      const accessToken = this.generateAccessToken(decoded.userId);
      return { accessToken };
    } catch (err) {
      throw new Error('Invalid refresh token');
    }
  }

  async logout(refreshToken) {
    await this.db.run('DELETE FROM sessions WHERE token = ?', [refreshToken]);
  }

  async logoutAll(userId) {
    await this.db.run('DELETE FROM sessions WHERE user_id = ?', [userId]);
  }

  async updatePassword(userId, currentPassword, newPassword) {
    const user = await this.db.get('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!user) throw new Error('User not found');

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) throw new Error('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.db.run('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [newHash, userId]);

    // Invalidate all sessions
    await this.logoutAll(userId);
  }

  async updateProfile(userId, data) {
    const allowedFields = ['username', 'avatar_url'];
    const updates = [];
    const values = [];

    if (data.username) {
      updates.push('username = ?');
      values.push(data.username);
    }
    if (data.avatar_url) {
      updates.push('avatar_url = ?');
      values.push(data.avatar_url);
    }

    if (updates.length === 0) return;

    values.push(userId);
    await this.db.run(`UPDATE users SET ${updates.join(', ')}, updated_at = datetime("now") WHERE id = ?`, values);
  }
}

export default Auth;