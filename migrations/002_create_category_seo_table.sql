-- Category SEO metadata table
CREATE TABLE IF NOT EXISTS category_seo (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES category(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    seo_title VARCHAR(70),
    seo_description VARCHAR(160),
    seo_keywords TEXT,
    h1_tag VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(category_id, language)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_category_seo_cat_lang ON category_seo(category_id, language);
CREATE INDEX IF NOT EXISTS idx_category_seo_lang ON category_seo(language);

-- Image SEO metadata table
CREATE TABLE IF NOT EXISTS image_seo (
    id SERIAL PRIMARY KEY,
    image_id INTEGER NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    seo_title VARCHAR(70),
    seo_description VARCHAR(160),
    alt_text VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(image_id, language)
);

CREATE INDEX IF NOT EXISTS idx_image_seo_img_lang ON image_seo(image_id, language);

-- SEO audit log
CREATE TABLE IF NOT EXISTS seo_audit_log (
    id SERIAL PRIMARY KEY,
    audit_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    issue_type VARCHAR(100),
    severity VARCHAR(20),
    details JSONB,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seo_audit_type ON seo_audit_log(audit_type);
CREATE INDEX IF NOT EXISTS idx_seo_audit_resolved ON seo_audit_log(resolved);
