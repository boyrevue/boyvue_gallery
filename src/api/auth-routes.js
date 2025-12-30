import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { passport, pool } from '../auth/passport-config.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'boyvue-jwt-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'boyvue-refresh-secret-change-in-production';
const JWT_EXPIRES_IN = '1h';
const REFRESH_EXPIRES_IN = 30 * 24 * 60 * 60 * 1000; // 30 days

// Cookie options for cross-subdomain auth
const cookieOptions = {
  domain: '.boyvue.com', // Works on all subdomains
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: REFRESH_EXPIRES_IN
};

// Generate JWT access token
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, displayName: user.display_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Generate refresh token and store in DB
async function generateRefreshToken(user, req) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN);
  
  await pool.query(
    `INSERT INTO user_sessions (user_id, refresh_token, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, token, req.headers['user-agent'], req.ip, expiresAt]
  );
  
  return token;
}

// Set auth cookies after successful login
async function setAuthCookies(res, user, req) {
  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user, req);
  
  res.cookie('access_token', accessToken, { ...cookieOptions, maxAge: 60 * 60 * 1000 }); // 1 hour
  res.cookie('refresh_token', refreshToken, cookieOptions);
  
  return { accessToken, user: sanitizeUser(user) };
}

// Remove sensitive fields from user object
function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || user.username,
    avatarUrl: user.avatar_url,
    provider: user.oauth_provider
  };
}

// OAuth callback handler
function handleOAuthCallback(req, res) {
  const frontendUrl = req.query.state || 'https://fans.boyvue.com';
  setAuthCookies(res, req.user, req).then(() => {
    res.redirect(frontendUrl + '?auth=success');
  }).catch(err => {
    console.error('Auth cookie error:', err);
    res.redirect(frontendUrl + '?auth=error');
  });
}

// Google OAuth routes
router.get('/google', (req, res, next) => {
  const state = req.query.redirect || req.headers.referer || 'https://fans.boyvue.com';
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    state: state
  })(req, res, next);
});

router.get('/google/callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/?auth=failed' }),
  handleOAuthCallback
);

// Reddit OAuth routes
router.get('/reddit', (req, res, next) => {
  const state = req.query.redirect || req.headers.referer || 'https://fans.boyvue.com';
  passport.authenticate('reddit', { 
    state: state,
    duration: 'permanent'
  })(req, res, next);
});

router.get('/reddit/callback',
  passport.authenticate('reddit', { session: false, failureRedirect: '/?auth=failed' }),
  handleOAuthCallback
);

// Twitter OAuth routes  
router.get('/twitter', (req, res, next) => {
  req.session = req.session || {};
  req.session.oauthRedirect = req.query.redirect || req.headers.referer || 'https://fans.boyvue.com';
  passport.authenticate('twitter')(req, res, next);
});

router.get('/twitter/callback',
  passport.authenticate('twitter', { session: false, failureRedirect: '/?auth=failed' }),
  (req, res) => {
    const frontendUrl = req.session?.oauthRedirect || 'https://fans.boyvue.com';
    handleOAuthCallback(req, res);
  }
);

// Get current user from JWT
router.get('/me', async (req, res) => {
  const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    
    if (!result.rows.length) {
      return res.status(401).json({ authenticated: false });
    }
    
    res.json({ authenticated: true, user: sanitizeUser(result.rows[0]) });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ authenticated: false, expired: true });
    }
    res.status(401).json({ authenticated: false });
  }
});

// Refresh access token
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refresh_token || req.body.refresh_token;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }
  
  try {
    // Find valid session
    const result = await pool.query(
      `SELECT u.* FROM user_sessions s 
       JOIN users u ON s.user_id = u.id 
       WHERE s.refresh_token = $1 AND s.expires_at > NOW()`,
      [refreshToken]
    );
    
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    
    const user = result.rows[0];
    const accessToken = generateAccessToken(user);
    
    res.cookie('access_token', accessToken, { ...cookieOptions, maxAge: 60 * 60 * 1000 });
    res.json({ accessToken, user: sanitizeUser(user) });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  
  if (refreshToken) {
    await pool.query('DELETE FROM user_sessions WHERE refresh_token = $1', [refreshToken]).catch(() => {});
  }
  
  res.clearCookie('access_token', { domain: '.boyvue.com' });
  res.clearCookie('refresh_token', { domain: '.boyvue.com' });
  res.json({ success: true });
});

// Email/password registration (optional)
router.post('/register', async (req, res) => {
  const { email, password, displayName } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  try {
    // Check if email exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, display_name, password_hash, oauth_provider, last_login, is_active)
       VALUES ($1, $2, $3, 'email', NOW(), true)
       RETURNING *`,
      [email, displayName || email.split('@')[0], passwordHash]
    );
    
    const auth = await setAuthCookies(res, result.rows[0], req);
    res.json({ success: true, ...auth });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Email/password login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND password_hash IS NOT NULL',
      [email]
    );
    
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    const auth = await setAuthCookies(res, user, req);
    res.json({ success: true, ...auth });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
