-- Translations table for all UI strings
CREATE TABLE IF NOT EXISTS translations (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL,
    language VARCHAR(10) NOT NULL,
    value TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'ui',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(key, language)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_translations_key_lang ON translations(key, language);
CREATE INDEX IF NOT EXISTS idx_translations_category ON translations(category);

-- Language metadata table
CREATE TABLE IF NOT EXISTS languages (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100),
    flag VARCHAR(10),
    direction VARCHAR(3) DEFAULT 'ltr',
    enabled BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert supported languages
INSERT INTO languages (code, name, native_name, flag, direction, sort_order) VALUES
    ('en', 'English', 'English', '🇬🇧', 'ltr', 1),
    ('de', 'German', 'Deutsch', '🇩🇪', 'ltr', 2),
    ('ru', 'Russian', 'Русский', '🇷🇺', 'ltr', 3),
    ('es', 'Spanish', 'Español', '🇪🇸', 'ltr', 4),
    ('zh', 'Chinese', '中文', '🇨🇳', 'ltr', 5),
    ('ja', 'Japanese', '日本語', '🇯🇵', 'ltr', 6),
    ('th', 'Thai', 'ไทย', '🇹🇭', 'ltr', 7),
    ('ko', 'Korean', '한국어', '🇰🇷', 'ltr', 8),
    ('pt', 'Portuguese', 'Português', '🇧🇷', 'ltr', 9),
    ('fr', 'French', 'Français', '🇫🇷', 'ltr', 10),
    ('it', 'Italian', 'Italiano', '🇮🇹', 'ltr', 11),
    ('nl', 'Dutch', 'Nederlands', '🇳🇱', 'ltr', 12),
    ('pl', 'Polish', 'Polski', '🇵🇱', 'ltr', 13),
    ('cs', 'Czech', 'Čeština', '🇨🇿', 'ltr', 14),
    ('ar', 'Arabic', 'العربية', '🇸🇦', 'rtl', 15),
    ('el', 'Greek', 'Ελληνικά', '🇬🇷', 'ltr', 16),
    ('vi', 'Vietnamese', 'Tiếng Việt', '🇻🇳', 'ltr', 17),
    ('id', 'Indonesian', 'Indonesia', '🇮🇩', 'ltr', 18),
    ('tr', 'Turkish', 'Türkçe', '🇹🇷', 'ltr', 19),
    ('hu', 'Hungarian', 'Magyar', '🇭🇺', 'ltr', 20)
ON CONFLICT (code) DO NOTHING;
