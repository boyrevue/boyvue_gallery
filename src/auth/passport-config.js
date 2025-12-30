import 'dotenv/config';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as RedditStrategy } from 'passport-reddit';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// Find or create user from OAuth profile
async function findOrCreateUser(provider, profile) {
  const oauthId = profile.id;
  const email = profile.emails?.[0]?.value || null;
  const displayName = profile.displayName || profile.username || email?.split('@')[0] || 'User';
  const avatarUrl = profile.photos?.[0]?.value || profile._json?.icon_img || null;

  // Check if user exists by OAuth ID
  let result = await pool.query(
    'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
    [provider, oauthId]
  );

  if (result.rows.length > 0) {
    await pool.query(
      'UPDATE users SET last_login = NOW(), avatar_url = COALESCE($1, avatar_url) WHERE id = $2',
      [avatarUrl, result.rows[0].id]
    );
    return result.rows[0];
  }

  // Check if user exists by email (link accounts)
  if (email) {
    result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      await pool.query(
        'UPDATE users SET oauth_provider = $1, oauth_id = $2, avatar_url = COALESCE($3, avatar_url), last_login = NOW() WHERE id = $4',
        [provider, oauthId, avatarUrl, result.rows[0].id]
      );
      return result.rows[0];
    }
  }

  // Create new user
  result = await pool.query(
    `INSERT INTO users (email, display_name, avatar_url, oauth_provider, oauth_id, last_login, is_active)
     VALUES ($1, $2, $3, $4, $5, NOW(), true)
     RETURNING *`,
    [email, displayName, avatarUrl, provider, oauthId]
  );

  return result.rows[0];
}

// Configure Google OAuth
console.log('Google OAuth:', process.env.GOOGLE_CLIENT_ID ? 'Configuring...' : 'No credentials');
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use('google', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await findOrCreateUser('google', profile);
      done(null, user);
    } catch (err) {
      console.error('Google auth error:', err);
      done(err, null);
    }
  }));
  console.log('Google OAuth configured');
}

// Configure Reddit OAuth
if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
  passport.use('reddit', new RedditStrategy({
    clientID: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    callbackURL: '/api/auth/reddit/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await findOrCreateUser('reddit', profile);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }));
}

// Configure Twitter OAuth
if (process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET) {
  passport.use('twitter', new TwitterStrategy({
    consumerKey: process.env.TWITTER_CLIENT_ID,
    consumerSecret: process.env.TWITTER_CLIENT_SECRET,
    callbackURL: '/api/auth/twitter/callback',
    includeEmail: true
  }, async (token, tokenSecret, profile, done) => {
    try {
      const user = await findOrCreateUser('twitter', profile);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err, null);
  }
});

export { passport, pool, findOrCreateUser };
