-- fans.boyvue.com - Hybrid Streaming Aggregator Tables
-- Migration 003: Create all tables for affiliate management, performers, themes, galleries

-- ============================================================================
-- AFFILIATE PLATFORMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliate_platforms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    platform_type VARCHAR(50) NOT NULL, -- 'subscription', 'cam_site', 'gay_specific'
    base_url VARCHAR(500) NOT NULL,
    affiliate_program_url VARCHAR(500),
    api_endpoint VARCHAR(500),
    api_type VARCHAR(50), -- 'rest', 'rss', 'scrape', 'webhook', 'manual'
    api_docs_url VARCHAR(500),
    commission_rate DECIMAL(5,2),
    cookie_duration_days INTEGER,
    requires_approval BOOLEAN DEFAULT false,
    supports_deep_linking BOOLEAN DEFAULT true,
    logo_url VARCHAR(500),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_platforms_slug ON affiliate_platforms(slug);
CREATE INDEX IF NOT EXISTS idx_affiliate_platforms_type ON affiliate_platforms(platform_type);
CREATE INDEX IF NOT EXISTS idx_affiliate_platforms_active ON affiliate_platforms(is_active);

-- ============================================================================
-- AFFILIATE ACCOUNTS (our credentials per platform)
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliate_accounts (
    id SERIAL PRIMARY KEY,
    platform_id INTEGER REFERENCES affiliate_platforms(id) ON DELETE CASCADE,
    account_name VARCHAR(100) NOT NULL,
    affiliate_id VARCHAR(255), -- our affiliate/webmaster ID on the platform
    bitwarden_item_id VARCHAR(100), -- reference to Bitwarden vault item for credentials
    api_key VARCHAR(500),
    api_secret VARCHAR(500),
    tracking_code VARCHAR(255),
    webhook_url VARCHAR(500),
    last_api_call TIMESTAMP WITH TIME ZONE,
    api_calls_today INTEGER DEFAULT 0,
    rate_limit_per_day INTEGER DEFAULT 1000,
    account_status VARCHAR(50) DEFAULT 'active', -- 'active', 'pending', 'suspended', 'revoked'
    earnings_total DECIMAL(12,2) DEFAULT 0,
    earnings_this_month DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform_id, affiliate_id)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_accounts_platform ON affiliate_accounts(platform_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_accounts_status ON affiliate_accounts(account_status);

-- ============================================================================
-- PERFORMERS (spidered from platforms)
-- ============================================================================
CREATE TABLE IF NOT EXISTS performers (
    id SERIAL PRIMARY KEY,
    platform_id INTEGER REFERENCES affiliate_platforms(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL, -- platform's ID for this performer
    username VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    profile_url VARCHAR(500),
    avatar_url VARCHAR(500),
    cover_photo_url VARCHAR(500),
    bio TEXT,
    categories TEXT[], -- array of tags/categories from platform
    gender VARCHAR(50),
    body_type VARCHAR(100),
    ethnicity VARCHAR(100),
    age INTEGER,
    location VARCHAR(255),
    is_verified BOOLEAN DEFAULT false,
    is_online BOOLEAN DEFAULT false,
    last_online TIMESTAMP WITH TIME ZONE,
    follower_count INTEGER,
    subscriber_count INTEGER,
    media_count INTEGER,
    video_count INTEGER,
    photo_count INTEGER,
    subscription_price DECIMAL(10,2),
    subscription_currency VARCHAR(10) DEFAULT 'USD',
    free_trial_days INTEGER,
    languages TEXT[],
    social_links JSONB, -- {"twitter": "...", "instagram": "..."}
    last_active TIMESTAMP WITH TIME ZONE,
    last_spidered TIMESTAMP WITH TIME ZONE,
    spider_frequency_hours INTEGER DEFAULT 24,
    raw_data JSONB, -- full API response for reference
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_performers_platform ON performers(platform_id);
CREATE INDEX IF NOT EXISTS idx_performers_username ON performers(username);
CREATE INDEX IF NOT EXISTS idx_performers_external ON performers(external_id);
CREATE INDEX IF NOT EXISTS idx_performers_online ON performers(is_online);
CREATE INDEX IF NOT EXISTS idx_performers_verified ON performers(is_verified);
CREATE INDEX IF NOT EXISTS idx_performers_last_spidered ON performers(last_spidered);
CREATE INDEX IF NOT EXISTS idx_performers_categories ON performers USING GIN(categories);

-- ============================================================================
-- PERFORMER CONTENT (photos/videos spidered)
-- ============================================================================
CREATE TABLE IF NOT EXISTS performer_content (
    id SERIAL PRIMARY KEY,
    performer_id INTEGER REFERENCES performers(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    content_type VARCHAR(50) NOT NULL, -- 'photo', 'video', 'preview', 'promo', 'stream_clip'
    title VARCHAR(500),
    description TEXT,
    thumbnail_url VARCHAR(500),
    media_url VARCHAR(500),
    preview_url VARCHAR(500),
    embed_url VARCHAR(500),
    duration_seconds INTEGER,
    width INTEGER,
    height INTEGER,
    is_free BOOLEAN DEFAULT false,
    is_preview BOOLEAN DEFAULT false,
    is_promotional BOOLEAN DEFAULT false,
    view_count INTEGER,
    like_count INTEGER,
    comment_count INTEGER,
    tags TEXT[],
    posted_at TIMESTAMP WITH TIME ZONE,
    last_spidered TIMESTAMP WITH TIME ZONE,
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(performer_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_performer_content_performer ON performer_content(performer_id);
CREATE INDEX IF NOT EXISTS idx_performer_content_type ON performer_content(content_type);
CREATE INDEX IF NOT EXISTS idx_performer_content_free ON performer_content(is_free);
CREATE INDEX IF NOT EXISTS idx_performer_content_posted ON performer_content(posted_at DESC);

-- ============================================================================
-- PERFORMER SELECTIONS (which models we want to promote - curation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS performer_selections (
    id SERIAL PRIMARY KEY,
    performer_id INTEGER REFERENCES performers(id) ON DELETE CASCADE UNIQUE,
    is_promoted BOOLEAN DEFAULT false, -- actively promote on site
    is_featured BOOLEAN DEFAULT false, -- show on homepage/featured sections
    priority INTEGER DEFAULT 0, -- higher = more prominent placement
    custom_headline VARCHAR(255), -- our own headline for this performer
    custom_description TEXT, -- our own marketing copy
    custom_tags TEXT[], -- our own categorization
    promo_image_url VARCHAR(500), -- custom promotional image
    promotion_start TIMESTAMP WITH TIME ZONE,
    promotion_end TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    selected_by VARCHAR(100), -- admin who selected
    selected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performer_selections_promoted ON performer_selections(is_promoted) WHERE is_promoted = true;
CREATE INDEX IF NOT EXISTS idx_performer_selections_featured ON performer_selections(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_performer_selections_priority ON performer_selections(priority DESC);

-- ============================================================================
-- AFFILIATE LINKS (generated tracking URLs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliate_links (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES affiliate_accounts(id) ON DELETE CASCADE,
    performer_id INTEGER REFERENCES performers(id) ON DELETE SET NULL,
    link_type VARCHAR(50) NOT NULL, -- 'profile', 'content', 'signup', 'promo', 'live'
    original_url VARCHAR(1000) NOT NULL,
    affiliate_url VARCHAR(1000) NOT NULL,
    short_code VARCHAR(50) UNIQUE, -- for short URLs like fans.boyvue.com/go/abc123
    utm_source VARCHAR(100) DEFAULT 'creatives',
    utm_medium VARCHAR(100) DEFAULT 'affiliate',
    utm_campaign VARCHAR(255),
    utm_content VARCHAR(255),
    click_count INTEGER DEFAULT 0,
    unique_click_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    revenue_generated DECIMAL(12,2) DEFAULT 0,
    last_clicked TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_links_account ON affiliate_links(account_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_performer ON affiliate_links(performer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_short_code ON affiliate_links(short_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_active ON affiliate_links(is_active);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_type ON affiliate_links(link_type);

-- ============================================================================
-- AFFILIATE LINK CLICKS (tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliate_link_clicks (
    id SERIAL PRIMARY KEY,
    link_id INTEGER REFERENCES affiliate_links(id) ON DELETE CASCADE,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    ip_hash VARCHAR(64), -- hashed IP for privacy
    user_agent TEXT,
    referer TEXT,
    country VARCHAR(10),
    region VARCHAR(100),
    city VARCHAR(100),
    device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
    browser VARCHAR(100),
    os VARCHAR(100),
    is_unique BOOLEAN DEFAULT true, -- first click from this IP/user-agent combo
    converted BOOLEAN DEFAULT false,
    conversion_value DECIMAL(10,2),
    conversion_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_link_clicks_link ON affiliate_link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_date ON affiliate_link_clicks(clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_link_clicks_country ON affiliate_link_clicks(country);
CREATE INDEX IF NOT EXISTS idx_link_clicks_converted ON affiliate_link_clicks(converted) WHERE converted = true;

-- ============================================================================
-- SPIDER JOBS (crawler status tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS spider_jobs (
    id SERIAL PRIMARY KEY,
    platform_id INTEGER REFERENCES affiliate_platforms(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL, -- 'full_sync', 'incremental', 'performer', 'content', 'live_status'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    items_processed INTEGER DEFAULT 0,
    items_added INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    error_log TEXT,
    progress_percent INTEGER DEFAULT 0,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    triggered_by VARCHAR(100), -- 'manual', 'cron', 'webhook'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spider_jobs_platform ON spider_jobs(platform_id);
CREATE INDEX IF NOT EXISTS idx_spider_jobs_status ON spider_jobs(status);
CREATE INDEX IF NOT EXISTS idx_spider_jobs_scheduled ON spider_jobs(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_spider_jobs_created ON spider_jobs(created_at DESC);

-- ============================================================================
-- PLATFORM API CONFIGS (platform-specific settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_api_configs (
    id SERIAL PRIMARY KEY,
    platform_id INTEGER REFERENCES affiliate_platforms(id) ON DELETE CASCADE,
    config_key VARCHAR(100) NOT NULL,
    config_value TEXT,
    is_secret BOOLEAN DEFAULT false,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform_id, config_key)
);

CREATE INDEX IF NOT EXISTS idx_platform_configs_platform ON platform_api_configs(platform_id);

-- ============================================================================
-- THEMES (custom collections - Twinks, Muscle, Latino, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS themes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    short_description VARCHAR(255),
    cover_image_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    icon VARCHAR(50), -- emoji or icon class
    color VARCHAR(20), -- hex color for UI
    display_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    performer_count INTEGER DEFAULT 0, -- cached count
    seo_title VARCHAR(70),
    seo_description VARCHAR(160),
    seo_keywords TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_themes_slug ON themes(slug);
CREATE INDEX IF NOT EXISTS idx_themes_featured ON themes(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_themes_active ON themes(is_active);
CREATE INDEX IF NOT EXISTS idx_themes_order ON themes(display_order);

-- ============================================================================
-- THEME PERFORMERS (many-to-many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS theme_performers (
    id SERIAL PRIMARY KEY,
    theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
    performer_id INTEGER REFERENCES performers(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    added_by VARCHAR(100),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(theme_id, performer_id)
);

CREATE INDEX IF NOT EXISTS idx_theme_performers_theme ON theme_performers(theme_id);
CREATE INDEX IF NOT EXISTS idx_theme_performers_performer ON theme_performers(performer_id);

-- ============================================================================
-- GALLERIES (curated content collections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS galleries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    short_description VARCHAR(255),
    cover_image_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    gallery_type VARCHAR(50) DEFAULT 'mixed', -- 'photos', 'videos', 'mixed', 'live'
    theme_id INTEGER REFERENCES themes(id) ON DELETE SET NULL,
    performer_id INTEGER REFERENCES performers(id) ON DELETE SET NULL, -- if single-performer gallery
    display_order INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    item_count INTEGER DEFAULT 0, -- cached count
    view_count INTEGER DEFAULT 0,
    seo_title VARCHAR(70),
    seo_description VARCHAR(160),
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_galleries_slug ON galleries(slug);
CREATE INDEX IF NOT EXISTS idx_galleries_theme ON galleries(theme_id);
CREATE INDEX IF NOT EXISTS idx_galleries_performer ON galleries(performer_id);
CREATE INDEX IF NOT EXISTS idx_galleries_featured ON galleries(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_galleries_type ON galleries(gallery_type);

-- ============================================================================
-- GALLERY ITEMS (content in galleries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS gallery_items (
    id SERIAL PRIMARY KEY,
    gallery_id INTEGER REFERENCES galleries(id) ON DELETE CASCADE,
    content_id INTEGER REFERENCES performer_content(id) ON DELETE CASCADE,
    performer_id INTEGER REFERENCES performers(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    custom_caption VARCHAR(500),
    added_by VARCHAR(100),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(gallery_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_gallery_items_gallery ON gallery_items(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_content ON gallery_items(content_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_performer ON gallery_items(performer_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_order ON gallery_items(gallery_id, display_order);

-- ============================================================================
-- FEATURED SECTIONS (homepage layout sections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS featured_sections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    section_type VARCHAR(50) NOT NULL, -- 'carousel', 'grid', 'hero', 'banner', 'live_now'
    title VARCHAR(255),
    subtitle VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    items_to_show INTEGER DEFAULT 10,
    auto_rotate BOOLEAN DEFAULT false,
    rotate_interval_seconds INTEGER DEFAULT 5,
    filter_criteria JSONB, -- {"platform": "chaturbate", "is_online": true, "theme": "twinks"}
    is_active BOOLEAN DEFAULT true,
    show_on_homepage BOOLEAN DEFAULT true,
    background_color VARCHAR(20),
    background_image_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_featured_sections_active ON featured_sections(is_active);
CREATE INDEX IF NOT EXISTS idx_featured_sections_homepage ON featured_sections(show_on_homepage) WHERE show_on_homepage = true;
CREATE INDEX IF NOT EXISTS idx_featured_sections_order ON featured_sections(display_order);

-- ============================================================================
-- FEATURED SECTION ITEMS (manual items for sections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS featured_section_items (
    id SERIAL PRIMARY KEY,
    section_id INTEGER REFERENCES featured_sections(id) ON DELETE CASCADE,
    performer_id INTEGER REFERENCES performers(id) ON DELETE CASCADE,
    gallery_id INTEGER REFERENCES galleries(id) ON DELETE CASCADE,
    theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
    custom_image_url VARCHAR(500),
    custom_title VARCHAR(255),
    custom_link VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT featured_item_type CHECK (
        (performer_id IS NOT NULL)::int +
        (gallery_id IS NOT NULL)::int +
        (theme_id IS NOT NULL)::int +
        (custom_link IS NOT NULL)::int = 1
    )
);

CREATE INDEX IF NOT EXISTS idx_featured_items_section ON featured_section_items(section_id);
CREATE INDEX IF NOT EXISTS idx_featured_items_order ON featured_section_items(section_id, display_order);

-- ============================================================================
-- CREATIVES SEO (separate SEO for creatives subdomain)
-- ============================================================================
CREATE TABLE IF NOT EXISTS creatives_seo_pages (
    id SERIAL PRIMARY KEY,
    page_type VARCHAR(50) NOT NULL, -- 'home', 'theme', 'gallery', 'performer', 'platform'
    entity_id INTEGER, -- ID of theme/gallery/performer/platform
    language VARCHAR(10) DEFAULT 'en',
    seo_title VARCHAR(70),
    seo_description VARCHAR(160),
    seo_keywords TEXT,
    og_image_url VARCHAR(500),
    canonical_url VARCHAR(500),
    structured_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(page_type, entity_id, language)
);

CREATE INDEX IF NOT EXISTS idx_creatives_seo_page ON creatives_seo_pages(page_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_creatives_seo_lang ON creatives_seo_pages(language);

-- ============================================================================
-- SEED DATA: Initial Platforms
-- ============================================================================
INSERT INTO affiliate_platforms (name, slug, platform_type, base_url, affiliate_program_url, api_type, notes) VALUES
-- Subscription Platforms
('OnlyFans', 'onlyfans', 'subscription', 'https://onlyfans.com', 'https://onlyfans.com/referral', 'manual', 'Limited API, manual import may be needed'),
('Fansly', 'fansly', 'subscription', 'https://fansly.com', 'https://fansly.com/affiliates', 'rest', 'Check affiliate program API docs'),
('JustFor.Fans', 'justforfans', 'subscription', 'https://justfor.fans', 'https://justfor.fans/Webmasters', 'rest', 'Gay-focused subscription platform'),
('4my.fans', '4myfans', 'subscription', 'https://4my.fans', 'https://4my.fans/webmasters', 'rest', 'Webmaster program available'),
('Unlockd', 'unlockd', 'subscription', 'https://unlockd.me', NULL, 'manual', 'Newer platform, check for affiliate program'),
-- Cam Sites
('Chaturbate', 'chaturbate', 'cam_site', 'https://chaturbate.com', 'https://chaturbate.com/affiliates/', 'rest', 'Well-documented affiliate API'),
('BongaCams', 'bongacams', 'cam_site', 'https://bongacams.com', 'https://bongacash.com', 'rest', 'BongaCash affiliate program'),
('Flirt4Free', 'flirt4free', 'cam_site', 'https://flirt4free.com', 'https://www.flirt4free.com/affiliates/', 'rest', 'Established affiliate program'),
('CamSoda', 'camsoda', 'cam_site', 'https://camsoda.com', 'https://camsoda.com/affiliates', 'rest', 'Affiliate API available'),
('Stripchat', 'stripchat', 'cam_site', 'https://stripchat.com', 'https://stripchat.com/affiliates', 'rest', 'Similar API to Chaturbate'),
('Cam4', 'cam4', 'cam_site', 'https://cam4.com', 'https://www.cam4.com/affiliate', 'rest', 'One of the older cam platforms'),
-- Gay-Specific
('Gay.Flirt4Free', 'gay-flirt4free', 'gay_specific', 'https://gay.flirt4free.com', 'https://www.flirt4free.com/affiliates/', 'rest', 'Dedicated gay cam site, same affiliate as Flirt4Free'),
('Supermen.com', 'supermen', 'gay_specific', 'https://supermen.com', NULL, 'rest', 'Gay-focused cam platform'),
('MenLive', 'menlive', 'gay_specific', 'https://menlive.com', NULL, 'rest', 'Gay cam site')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SEED DATA: Default Themes
-- ============================================================================
INSERT INTO themes (name, slug, description, icon, color, display_order, is_featured) VALUES
('Twinks', 'twinks', 'Young, slim performers with smooth bodies', '🧑', '#FF6B6B', 1, true),
('Muscle', 'muscle', 'Muscular and athletic performers', '💪', '#4ECDC4', 2, true),
('Bears', 'bears', 'Larger, hairier performers', '🐻', '#95E1D3', 3, true),
('Latino', 'latino', 'Latin performers', '🌶️', '#F38181', 4, true),
('Asian', 'asian', 'Asian performers', '🌸', '#FCE38A', 5, true),
('Black', 'black', 'Black performers', '👑', '#AA96DA', 6, true),
('Daddy', 'daddy', 'Mature, older performers', '👨', '#95E1D3', 7, false),
('Jocks', 'jocks', 'Athletic, sporty performers', '⚽', '#45B7D1', 8, false),
('College', 'college', 'College-age performers', '🎓', '#FF8B94', 9, false),
('Couples', 'couples', 'Duo and couple performers', '💕', '#DDA0DD', 10, false)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SEED DATA: Default Featured Sections
-- ============================================================================
INSERT INTO featured_sections (name, slug, section_type, title, subtitle, display_order, items_to_show, is_active) VALUES
('Live Now', 'live-now', 'carousel', 'Live Now', 'Watch these performers streaming right now', 1, 12, true),
('Featured Creatives', 'featured-creatives', 'grid', 'Featured Creatives', 'Our hand-picked top performers', 2, 8, true),
('New Arrivals', 'new-arrivals', 'carousel', 'New Arrivals', 'Recently added to our network', 3, 10, true),
('Popular This Week', 'popular-week', 'grid', 'Popular This Week', 'Trending performers', 4, 6, true),
('Browse by Theme', 'browse-themes', 'grid', 'Browse by Theme', 'Explore our curated collections', 5, 10, true)
ON CONFLICT (slug) DO NOTHING;
