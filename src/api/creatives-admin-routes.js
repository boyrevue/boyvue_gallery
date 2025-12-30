/**
 * Creatives Admin API Routes
 * Protected admin endpoints for fans.boyvue.com
 */

import express from 'express';
import pg from 'pg';
import crypto from 'crypto';

const router = express.Router();
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// ==========================================
// PLATFORMS MANAGEMENT
// ==========================================

// Get all platforms (admin view with more details)
router.get('/platforms', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ap.*,
             COUNT(DISTINCT aa.id) as account_count,
             COUNT(DISTINCT p.id) as performer_count
      FROM affiliate_platforms ap
      LEFT JOIN affiliate_accounts aa ON ap.id = aa.platform_id
      LEFT JOIN performers p ON ap.id = p.platform_id
      GROUP BY ap.id
      ORDER BY ap.name
    `);
    res.json({ success: true, platforms: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create platform
router.post('/platforms', async (req, res) => {
  try {
    const {
      name, slug, platform_type, base_url, affiliate_program_url,
      api_endpoint, api_type, api_docs_url, commission_rate,
      cookie_duration_days, requires_approval, supports_deep_linking,
      logo_url, notes
    } = req.body;

    if (!name || !slug || !platform_type || !base_url) {
      return res.status(400).json({ error: 'Name, slug, platform_type, and base_url required' });
    }

    const result = await pool.query(`
      INSERT INTO affiliate_platforms
        (name, slug, platform_type, base_url, affiliate_program_url,
         api_endpoint, api_type, api_docs_url, commission_rate,
         cookie_duration_days, requires_approval, supports_deep_linking,
         logo_url, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [name, slug, platform_type, base_url, affiliate_program_url,
        api_endpoint, api_type, api_docs_url, commission_rate,
        cookie_duration_days, requires_approval, supports_deep_linking,
        logo_url, notes]);

    res.json({ success: true, platform: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update platform
router.put('/platforms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = Object.keys(updates)
      .filter(k => k !== 'id')
      .map((k, i) => `${k} = $${i + 2}`);

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const values = [id, ...Object.values(updates).filter((_, i) =>
      Object.keys(updates)[i] !== 'id')];

    const result = await pool.query(`
      UPDATE affiliate_platforms
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, values);

    res.json({ success: true, platform: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete platform
router.delete('/platforms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM affiliate_platforms WHERE id = $1', [id]);
    res.json({ success: true, message: 'Platform deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// AFFILIATE ACCOUNTS MANAGEMENT
// ==========================================

// Get all accounts
router.get('/accounts', async (req, res) => {
  try {
    const { platform } = req.query;

    let query = `
      SELECT aa.*, ap.name as platform_name, ap.slug as platform_slug
      FROM affiliate_accounts aa
      JOIN affiliate_platforms ap ON aa.platform_id = ap.id
    `;
    const params = [];

    if (platform) {
      query += ' WHERE ap.slug = $1';
      params.push(platform);
    }

    query += ' ORDER BY ap.name, aa.account_name';

    const result = await pool.query(query, params);

    // Mask sensitive data
    const accounts = result.rows.map(acc => ({
      ...acc,
      api_key: acc.api_key ? '***' + acc.api_key.slice(-4) : null,
      api_secret: acc.api_secret ? '****' : null
    }));

    res.json({ success: true, accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create account
router.post('/accounts', async (req, res) => {
  try {
    const {
      platform_id, account_name, affiliate_id, bitwarden_item_id,
      api_key, api_secret, tracking_code, webhook_url,
      rate_limit_per_day, notes
    } = req.body;

    if (!platform_id || !account_name) {
      return res.status(400).json({ error: 'Platform ID and account name required' });
    }

    const result = await pool.query(`
      INSERT INTO affiliate_accounts
        (platform_id, account_name, affiliate_id, bitwarden_item_id,
         api_key, api_secret, tracking_code, webhook_url,
         rate_limit_per_day, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [platform_id, account_name, affiliate_id, bitwarden_item_id,
        api_key, api_secret, tracking_code, webhook_url,
        rate_limit_per_day || 1000, notes]);

    res.json({ success: true, account: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update account
router.put('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates.id;

    const fields = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await pool.query(`
      UPDATE affiliate_accounts
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, ...Object.values(updates)]);

    res.json({ success: true, account: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete account
router.delete('/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM affiliate_accounts WHERE id = $1', [id]);
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PERFORMERS MANAGEMENT
// ==========================================

// Get all performers (admin view)
router.get('/performers', async (req, res) => {
  try {
    const { platform, promoted, search, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (platform) {
      params.push(platform);
      whereClause += ` AND ap.slug = $${params.length}`;
    }

    if (promoted === 'true') {
      whereClause += ' AND ps.is_promoted = true';
    } else if (promoted === 'false') {
      whereClause += ' AND (ps.is_promoted IS NULL OR ps.is_promoted = false)';
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (p.username ILIKE $${params.length} OR p.display_name ILIKE $${params.length})`;
    }

    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(`
      SELECT
        p.*,
        ap.name as platform_name, ap.slug as platform_slug,
        ps.is_promoted, ps.is_featured, ps.priority, ps.selected_at
      FROM performers p
      JOIN affiliate_platforms ap ON p.platform_id = ap.id
      LEFT JOIN performer_selections ps ON p.id = ps.performer_id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    // Get total count
    const countParams = params.slice(0, -2);
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM performers p
      JOIN affiliate_platforms ap ON p.platform_id = ap.id
      LEFT JOIN performer_selections ps ON p.id = ps.performer_id
      ${whereClause}
    `, countParams);

    res.json({
      success: true,
      performers: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Select/promote performer
router.post('/performers/:id/select', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      is_featured = false,
      priority = 0,
      custom_headline,
      custom_description,
      custom_tags
    } = req.body;

    const result = await pool.query(`
      INSERT INTO performer_selections
        (performer_id, is_promoted, is_featured, priority,
         custom_headline, custom_description, custom_tags, selected_by)
      VALUES ($1, true, $2, $3, $4, $5, $6, 'admin')
      ON CONFLICT (performer_id)
      DO UPDATE SET
        is_promoted = true,
        is_featured = $2,
        priority = $3,
        custom_headline = COALESCE($4, performer_selections.custom_headline),
        custom_description = COALESCE($5, performer_selections.custom_description),
        custom_tags = COALESCE($6, performer_selections.custom_tags),
        updated_at = NOW()
      RETURNING *
    `, [id, is_featured, priority, custom_headline, custom_description, custom_tags]);

    res.json({ success: true, selection: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unselect/unpromote performer
router.post('/performers/:id/unselect', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE performer_selections
      SET is_promoted = false, is_featured = false, updated_at = NOW()
      WHERE performer_id = $1
    `, [id]);

    res.json({ success: true, message: 'Performer unpromoted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Feature/unfeature performer
router.post('/performers/:id/feature', async (req, res) => {
  try {
    const { id } = req.params;
    const { featured = true } = req.body;

    await pool.query(`
      UPDATE performer_selections
      SET is_featured = $2, updated_at = NOW()
      WHERE performer_id = $1
    `, [id, featured]);

    res.json({ success: true, featured });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk select performers
router.post('/performers/bulk-select', async (req, res) => {
  try {
    const { performer_ids, is_featured = false, priority = 0 } = req.body;

    if (!performer_ids || !Array.isArray(performer_ids)) {
      return res.status(400).json({ error: 'performer_ids array required' });
    }

    let selected = 0;
    for (const id of performer_ids) {
      await pool.query(`
        INSERT INTO performer_selections (performer_id, is_promoted, is_featured, priority, selected_by)
        VALUES ($1, true, $2, $3, 'admin')
        ON CONFLICT (performer_id) DO UPDATE SET is_promoted = true, updated_at = NOW()
      `, [id, is_featured, priority]);
      selected++;
    }

    res.json({ success: true, selected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// THEMES MANAGEMENT
// ==========================================

// Get all themes
router.get('/themes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*,
             (SELECT COUNT(*) FROM theme_performers WHERE theme_id = t.id) as actual_performer_count
      FROM themes t
      ORDER BY t.display_order, t.name
    `);
    res.json({ success: true, themes: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create theme
router.post('/themes', async (req, res) => {
  try {
    const {
      name, slug, description, short_description, cover_image_url,
      thumbnail_url, icon, color, display_order, is_featured,
      seo_title, seo_description, seo_keywords
    } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug required' });
    }

    const result = await pool.query(`
      INSERT INTO themes
        (name, slug, description, short_description, cover_image_url,
         thumbnail_url, icon, color, display_order, is_featured,
         seo_title, seo_description, seo_keywords)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [name, slug, description, short_description, cover_image_url,
        thumbnail_url, icon, color, display_order || 0, is_featured || false,
        seo_title, seo_description, seo_keywords]);

    res.json({ success: true, theme: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update theme
router.put('/themes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates.id;

    const fields = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await pool.query(`
      UPDATE themes
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, ...Object.values(updates)]);

    res.json({ success: true, theme: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete theme
router.delete('/themes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM themes WHERE id = $1', [id]);
    res.json({ success: true, message: 'Theme deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add performer to theme
router.post('/themes/:id/performers', async (req, res) => {
  try {
    const { id } = req.params;
    const { performer_id, display_order = 0 } = req.body;

    await pool.query(`
      INSERT INTO theme_performers (theme_id, performer_id, display_order, added_by)
      VALUES ($1, $2, $3, 'admin')
      ON CONFLICT (theme_id, performer_id) DO UPDATE SET display_order = $3
    `, [id, performer_id, display_order]);

    // Update theme performer count
    await pool.query(`
      UPDATE themes
      SET performer_count = (SELECT COUNT(*) FROM theme_performers WHERE theme_id = $1)
      WHERE id = $1
    `, [id]);

    res.json({ success: true, message: 'Performer added to theme' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove performer from theme
router.delete('/themes/:id/performers/:performerId', async (req, res) => {
  try {
    const { id, performerId } = req.params;

    await pool.query(`
      DELETE FROM theme_performers WHERE theme_id = $1 AND performer_id = $2
    `, [id, performerId]);

    // Update theme performer count
    await pool.query(`
      UPDATE themes
      SET performer_count = (SELECT COUNT(*) FROM theme_performers WHERE theme_id = $1)
      WHERE id = $1
    `, [id]);

    res.json({ success: true, message: 'Performer removed from theme' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// SPIDER MANAGEMENT
// ==========================================

// Get spider status/jobs
router.get('/spider/jobs', async (req, res) => {
  try {
    const { platform, status, limit = 50 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (platform) {
      params.push(platform);
      whereClause += ` AND ap.slug = $${params.length}`;
    }

    if (status) {
      params.push(status);
      whereClause += ` AND sj.status = $${params.length}`;
    }

    params.push(parseInt(limit));

    const result = await pool.query(`
      SELECT sj.*, ap.name as platform_name, ap.slug as platform_slug
      FROM spider_jobs sj
      JOIN affiliate_platforms ap ON sj.platform_id = ap.id
      ${whereClause}
      ORDER BY sj.created_at DESC
      LIMIT $${params.length}
    `, params);

    res.json({ success: true, jobs: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create spider job (manual trigger)
router.post('/spider/run/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { job_type = 'full_sync' } = req.body;

    // Get platform ID
    const platformResult = await pool.query(
      'SELECT id FROM affiliate_platforms WHERE slug = $1',
      [platform]
    );

    if (platformResult.rows.length === 0) {
      return res.status(404).json({ error: 'Platform not found' });
    }

    // Create job
    const result = await pool.query(`
      INSERT INTO spider_jobs (platform_id, job_type, status, triggered_by)
      VALUES ($1, $2, 'pending', 'manual')
      RETURNING *
    `, [platformResult.rows[0].id, job_type]);

    // In real implementation, this would trigger the actual spider
    // For now, just create the job record

    res.json({
      success: true,
      job: result.rows[0],
      message: `Spider job created for ${platform}. Run 'node scripts/run-spider.js ${platform}' to execute.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel spider job
router.post('/spider/jobs/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`
      UPDATE spider_jobs
      SET status = 'cancelled', completed_at = NOW()
      WHERE id = $1 AND status IN ('pending', 'running')
    `, [id]);

    res.json({ success: true, message: 'Job cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// AFFILIATE LINKS MANAGEMENT
// ==========================================

// Get all links
router.get('/links', async (req, res) => {
  try {
    const { performer_id, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (performer_id) {
      params.push(performer_id);
      whereClause += ` AND al.performer_id = $${params.length}`;
    }

    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(`
      SELECT al.*,
             p.username, p.display_name,
             ap.name as platform_name, ap.slug as platform_slug
      FROM affiliate_links al
      LEFT JOIN performers p ON al.performer_id = p.id
      LEFT JOIN affiliate_accounts aa ON al.account_id = aa.id
      LEFT JOIN affiliate_platforms ap ON aa.platform_id = ap.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ success: true, links: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate affiliate link
router.post('/links/generate', async (req, res) => {
  try {
    const {
      account_id, performer_id, link_type, original_url,
      utm_campaign, utm_content
    } = req.body;

    if (!account_id || !original_url || !link_type) {
      return res.status(400).json({ error: 'account_id, original_url, and link_type required' });
    }

    // Get account details for building affiliate URL
    const accountResult = await pool.query(`
      SELECT aa.*, ap.base_url, ap.slug as platform_slug
      FROM affiliate_accounts aa
      JOIN affiliate_platforms ap ON aa.platform_id = ap.id
      WHERE aa.id = $1
    `, [account_id]);

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accountResult.rows[0];

    // Build affiliate URL based on platform
    let affiliateUrl = original_url;
    if (account.tracking_code) {
      const separator = original_url.includes('?') ? '&' : '?';
      affiliateUrl = `${original_url}${separator}track=${account.tracking_code}`;
    }

    // Generate short code
    const shortCode = crypto.randomBytes(6).toString('base64url');

    const result = await pool.query(`
      INSERT INTO affiliate_links
        (account_id, performer_id, link_type, original_url, affiliate_url,
         short_code, utm_campaign, utm_content)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [account_id, performer_id, link_type, original_url, affiliateUrl,
        shortCode, utm_campaign, utm_content]);

    res.json({
      success: true,
      link: result.rows[0],
      shortUrl: `https://fans.boyvue.com/go/${shortCode}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk generate links for performers
router.post('/links/bulk-generate', async (req, res) => {
  try {
    const { performer_ids, account_id, link_type = 'profile' } = req.body;

    if (!performer_ids || !Array.isArray(performer_ids) || !account_id) {
      return res.status(400).json({ error: 'performer_ids array and account_id required' });
    }

    // Get account
    const accountResult = await pool.query(
      'SELECT * FROM affiliate_accounts WHERE id = $1',
      [account_id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accountResult.rows[0];
    const links = [];

    for (const performerId of performer_ids) {
      // Get performer
      const performerResult = await pool.query(
        'SELECT profile_url FROM performers WHERE id = $1',
        [performerId]
      );

      if (performerResult.rows.length === 0) continue;

      const originalUrl = performerResult.rows[0].profile_url;
      let affiliateUrl = originalUrl;

      if (account.tracking_code) {
        const separator = originalUrl.includes('?') ? '&' : '?';
        affiliateUrl = `${originalUrl}${separator}track=${account.tracking_code}`;
      }

      const shortCode = crypto.randomBytes(6).toString('base64url');

      const result = await pool.query(`
        INSERT INTO affiliate_links
          (account_id, performer_id, link_type, original_url, affiliate_url, short_code)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
        RETURNING *
      `, [account_id, performerId, link_type, originalUrl, affiliateUrl, shortCode]);

      if (result.rows[0]) {
        links.push(result.rows[0]);
      }
    }

    res.json({ success: true, generated: links.length, links });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get link stats
router.get('/links/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;

    // Get link details
    const linkResult = await pool.query(
      'SELECT * FROM affiliate_links WHERE id = $1',
      [id]
    );

    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    // Get daily clicks
    const clicksResult = await pool.query(`
      SELECT DATE(clicked_at) as date, COUNT(*) as clicks, COUNT(DISTINCT ip_hash) as unique_clicks
      FROM affiliate_link_clicks
      WHERE link_id = $1 AND clicked_at > NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(clicked_at)
      ORDER BY date
    `, [id]);

    // Get country breakdown
    const countryResult = await pool.query(`
      SELECT country, COUNT(*) as clicks
      FROM affiliate_link_clicks
      WHERE link_id = $1 AND country IS NOT NULL
      GROUP BY country
      ORDER BY clicks DESC
      LIMIT 10
    `, [id]);

    res.json({
      success: true,
      link: linkResult.rows[0],
      dailyClicks: clicksResult.rows,
      countryBreakdown: countryResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete link
router.delete('/links/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM affiliate_links WHERE id = $1', [id]);
    res.json({ success: true, message: 'Link deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ANALYTICS
// ==========================================

// Get analytics overview
router.get('/analytics/overview', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM affiliate_link_clicks WHERE clicked_at > NOW() - INTERVAL '${parseInt(days)} days') as total_clicks,
        (SELECT COUNT(DISTINCT ip_hash) FROM affiliate_link_clicks WHERE clicked_at > NOW() - INTERVAL '${parseInt(days)} days') as unique_clicks,
        (SELECT COUNT(*) FROM affiliate_link_clicks WHERE converted = true AND clicked_at > NOW() - INTERVAL '${parseInt(days)} days') as conversions,
        (SELECT COALESCE(SUM(conversion_value), 0) FROM affiliate_link_clicks WHERE converted = true AND clicked_at > NOW() - INTERVAL '${parseInt(days)} days') as revenue,
        (SELECT COUNT(*) FROM performers p JOIN performer_selections ps ON p.id = ps.performer_id WHERE ps.is_promoted = true) as promoted_performers,
        (SELECT COUNT(*) FROM performers WHERE is_online = true) as online_now
    `);

    res.json({ success: true, stats: stats.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get clicks by platform
router.get('/analytics/by-platform', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await pool.query(`
      SELECT
        ap.name as platform_name, ap.slug as platform_slug,
        COUNT(alc.id) as clicks,
        COUNT(DISTINCT alc.ip_hash) as unique_clicks,
        COUNT(CASE WHEN alc.converted THEN 1 END) as conversions
      FROM affiliate_link_clicks alc
      JOIN affiliate_links al ON alc.link_id = al.id
      JOIN affiliate_accounts aa ON al.account_id = aa.id
      JOIN affiliate_platforms ap ON aa.platform_id = ap.id
      WHERE alc.clicked_at > NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY ap.id
      ORDER BY clicks DESC
    `);

    res.json({ success: true, platforms: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get top performers by clicks
router.get('/analytics/top-performers', async (req, res) => {
  try {
    const { days = 30, limit = 20 } = req.query;

    const result = await pool.query(`
      SELECT
        p.id, p.username, p.display_name, p.avatar_url,
        ap.name as platform_name, ap.slug as platform_slug,
        COUNT(alc.id) as clicks,
        COUNT(DISTINCT alc.ip_hash) as unique_clicks
      FROM affiliate_link_clicks alc
      JOIN affiliate_links al ON alc.link_id = al.id
      JOIN performers p ON al.performer_id = p.id
      JOIN affiliate_platforms ap ON p.platform_id = ap.id
      WHERE alc.clicked_at > NOW() - INTERVAL '${parseInt(days)} days'
        AND al.performer_id IS NOT NULL
      GROUP BY p.id, ap.id
      ORDER BY clicks DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({ success: true, performers: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
