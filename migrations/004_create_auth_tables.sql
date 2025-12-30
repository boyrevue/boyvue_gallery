-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  display_name VARCHAR(255),
  avatar_url TEXT,
  oauth_provider VARCHAR(50), -- 'google', 'reddit', 'twitter', 'email'
  oauth_id VARCHAR(255),
  password_hash VARCHAR(255), -- For email/password auth
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(oauth_provider, oauth_id)
);

-- User favorites (hot or not selections)
CREATE TABLE IF NOT EXISTS user_favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  performer_id INTEGER REFERENCES performers(id) ON DELETE CASCADE,
  is_hot BOOLEAN NOT NULL, -- true = hot (favorited), false = not (skipped)
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, performer_id)
);

-- User sessions for JWT refresh tokens
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(255) UNIQUE NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(45),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_performer ON user_favorites(performer_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

