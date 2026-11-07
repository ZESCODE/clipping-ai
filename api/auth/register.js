import { getDatabase } from '../../lib/database.js';
import { hashPassword, generateAccessToken, generateRefreshToken, generateUUID, generateSessionExpiry } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password, and username are required' });
    }

    const db = await getDatabase();

    // Check if user exists
    const existingUser = await db.get(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUser) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = generateUUID();
    await db.run(
      `INSERT INTO users (id, email, username, password_hash, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [userId, email, username, passwordHash]
    );

    // Create default settings
    await db.run(
      `INSERT INTO user_settings (id, user_id) VALUES (?, ?)`,
      [generateUUID(), userId]
    );

    // Get the created user
    const user = await db.get(
      'SELECT id, email, username, created_at FROM users WHERE email = ?',
      [email]
    );

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Store session
    const expiresAt = generateSessionExpiry();
    await db.run(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES (?, ?, ?, ?)`,
      [generateUUID(), user.id, refreshToken, expiresAt]
    );

    return res.status(201).json({
      user: { id: user.id, email: user.email, username: user.username },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: error.message });
  }
}