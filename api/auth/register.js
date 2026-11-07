import { sql, initializeDatabase } from '../../lib/database-vercel.js';
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

    await initializeDatabase();

    // Check if user exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email} OR username = ${username}
    `;

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userId = generateUUID();
    await sql`
      INSERT INTO users (id, email, username, password_hash, created_at)
      VALUES (${userId}, ${email}, ${username}, ${passwordHash}, CURRENT_TIMESTAMP)
    `;

    // Create default settings
    await sql`
      INSERT INTO user_settings (id, user_id) VALUES (${generateUUID()}, ${userId})
    `;

    // Get the created user
    const user = await sql`
      SELECT id, email, username, created_at FROM users WHERE email = ${email}
    `;

    // Generate tokens
    const accessToken = generateAccessToken(user.rows[0].id);
    const refreshToken = generateRefreshToken(user.rows[0].id);

    // Store session
    const expiresAt = generateSessionExpiry();
    await sql`
      INSERT INTO sessions (id, user_id, token, expires_at)
      VALUES (${generateUUID()}, ${user.rows[0].id}, ${refreshToken}, ${expiresAt})
    `;

    return res.status(201).json({
      user: { id: user.rows[0].id, email: user.rows[0].email, username: user.rows[0].username },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: error.message });
  }
}