import { sql, initializeDatabase } from '../../lib/database-vercel.js';
import { verifyPassword, generateAccessToken, generateRefreshToken, generateUUID, generateSessionExpiry } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    await initializeDatabase();

    const user = await sql`
      SELECT * FROM users WHERE email = ${email}
    `;

    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await verifyPassword(password, user.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await sql`
      UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ${user.rows[0].id}
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

    return res.json({
      user: { id: user.rows[0].id, email: user.rows[0].email, username: user.rows[0].username },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: error.message });
  }
}