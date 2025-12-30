/**
 * Creatives Public API Routes
 * Public endpoints for fans.boyvue.com
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
// PLATFORMS
// ==========================================

// Get all active platforms
router.get('/platforms', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, slug, platform_type, base_url, logo_url,
             commission_rate, supports_deep_linking
      FROM affiliate_platforms
      WHERE is_active = true
      ORDER BY name
    `);
    res.json({ success: true, platforms: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get platform by slug
router.get('/platforms/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await pool.query(`
      SELECT ap.*,
             COUNT(DISTINCT p.id) as performer_count,
             COUNT(DISTINCT CASE WHEN p.is_online THEN p.id END) as online_count
      FROM affiliate_platforms ap
      LEFT JOIN performers p ON ap.id = p.platform_id
      WHERE ap.slug = $1 AND ap.is_active = true
      GROUP BY ap.id
    `, [slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Platform not found' });
    }
    res.json({ success: true, platform: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// PERFORMERS (Creatives)
// ==========================================

// Get promoted performers with filters
router.get('/performers', async (req, res) => {
  try {
    const {
      platform,
      theme,
      online,
      featured,
      search,
      sort = 'priority',
      limit = 24,
      offset = 0
    } = req.query;

    let whereClause = 'WHERE ps.is_promoted = true';
    const params = [];
    let paramCount = 0;

    if (platform) {
      paramCount++;
      whereClause += ` AND ap.slug = $${paramCount}`;
      params.push(platform);
    }

    if (online === 'true') {
      whereClause += ' AND p.is_online = true';
    }

    if (featured === 'true') {
      whereClause += ' AND ps.is_featured = true';
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (p.username ILIKE $${paramCount} OR p.display_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Sort options
    let orderBy = 'ORDER BY ';
    switch (sort) {
      case 'newest':
        orderBy += 'p.created_at DESC';
        break;
      case 'popular':
        orderBy += 'p.follower_count DESC NULLS LAST';
        break;
      case 'online':
        orderBy += 'p.is_online DESC, ps.priority DESC';
        break;
      default:
        orderBy += 'ps.priority DESC, ps.is_featured DESC';
    }

    paramCount++;
    const limitParam = paramCount;
    params.push(parseInt(limit));

    paramCount++;
    const offsetParam = paramCount;
    params.push(parseInt(offset));

    const query = `
      SELECT
        p.id, p.username, p.display_name, p.profile_url, p.avatar_url,
        p.cover_photo_url, p.bio, p.categories, p.is_verified, p.is_online,
        p.follower_count, p.media_count, p.subscription_price, p.subscription_currency,
        p.last_online,
        ap.name as platform_name, ap.slug as platform_slug, ap.logo_url as platform_logo,
        ps.is_featured, ps.priority, ps.custom_headline, ps.custom_description,
        (SELECT affiliate_url FROM affiliate_links al
         WHERE al.performer_id = p.id AND al.is_active = true
         LIMIT 1) as affiliate_link
      FROM performers p
      JOIN performer_selections ps ON p.id = ps.performer_id
      JOIN affiliate_platforms ap ON p.platform_id = ap.id
      ${whereClause}
      ${orderBy}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM performers p
      JOIN performer_selections ps ON p.id = ps.performer_id
      JOIN affiliate_platforms ap ON p.platform_id = ap.id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params.slice(0, -2));

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

// Get single performer by ID
router.get('/performers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        p.*,
        ap.name as platform_name, ap.slug as platform_slug,
        ap.base_url as platform_url, ap.logo_url as platform_logo,
        ps.is_featured, ps.priority, ps.custom_headline,
        ps.custom_description, ps.custom_tags
      FROM performers p
      JOIN affiliate_platforms ap ON p.platform_id = ap.id
      LEFT JOIN performer_selections ps ON p.id = ps.performer_id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Performer not found' });
    }

    // Get affiliate link
    const linkResult = await pool.query(`
      SELECT affiliate_url, short_code
      FROM affiliate_links
      WHERE performer_id = $1 AND is_active = true
      LIMIT 1
    `, [id]);

    const performer = result.rows[0];
    performer.affiliate_link = linkResult.rows[0]?.affiliate_url || null;
    performer.short_code = linkResult.rows[0]?.short_code || null;

    res.json({ success: true, performer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get performer content
router.get('/performers/:id/content', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, limit = 20, offset = 0 } = req.query;

    let whereClause = 'WHERE performer_id = $1';
    const params = [id];

    if (type) {
      params.push(type);
      whereClause += ` AND content_type = $${params.length}`;
    }

    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(`
      SELECT id, content_type, title, description, thumbnail_url,
             preview_url, duration_seconds, is_free, is_preview,
             view_count, like_count, posted_at
      FROM performer_content
      ${whereClause}
      ORDER BY posted_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ success: true, content: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// FEATURED & LIVE NOW
// ==========================================

// Get featured performers
router.get('/featured', async (req, res) => {
  try {
    const { limit = 12 } = req.query;

    const result = await pool.query(`
      SELECT
        p.id, p.username, p.display_name, p.avatar_url, p.cover_photo_url,
        p.is_verified, p.is_online, p.follower_count,
        ap.name as platform_name, ap.slug as platform_slug, ap.logo_url as platform_logo,
        ps.custom_headline
      FROM performers p
      JOIN performer_selections ps ON p.id = ps.performer_id
      JOIN affiliate_platforms ap ON p.platform_id = ap.id
      WHERE ps.is_featured = true AND ps.is_promoted = true
      ORDER BY ps.priority DESC, p.follower_count DESC NULLS LAST
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({ success: true, featured: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get performers currently online
router.get('/live', async (req, res) => {
  try {
    const { platform, limit = 24 } = req.query;

    let whereClause = 'WHERE p.is_online = true AND ps.is_promoted = true';
    const params = [];

    if (platform) {
      params.push(platform);
      whereClause += ` AND ap.slug = $${params.length}`;
    }

    params.push(parseInt(limit));

    const result = await pool.query(`
      SELECT
        p.id, p.username, p.display_name, p.avatar_url, p.cover_photo_url,
        p.is_verified, p.follower_count, p.last_online,
        ap.name as platform_name, ap.slug as platform_slug, ap.logo_url as platform_logo,
        (SELECT affiliate_url FROM affiliate_links al
         WHERE al.performer_id = p.id AND al.is_active = true
         LIMIT 1) as affiliate_link
      FROM performers p
      JOIN performer_selections ps ON p.id = ps.performer_id
      JOIN affiliate_platforms ap ON p.platform_id = ap.id
      ${whereClause}
      ORDER BY p.last_online DESC NULLS LAST
      LIMIT $${params.length}
    `, params);

    res.json({ success: true, live: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// THEMES (Collections)
// ==========================================

// Get all active themes
router.get('/themes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, slug, description, short_description,
             cover_image_url, thumbnail_url, icon, color,
             performer_count, is_featured
      FROM themes
      WHERE is_active = true
      ORDER BY display_order, name
    `);
    res.json({ success: true, themes: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get theme by slug with performers
router.get('/themes/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { limit = 24, offset = 0 } = req.query;

    // Get theme
    const themeResult = await pool.query(`
      SELECT * FROM themes WHERE slug = $1 AND is_active = true
    `, [slug]);

    if (themeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    // Get performers in this theme
    const performersResult = await pool.query(`
      SELECT
        p.id, p.username, p.display_name, p.avatar_url, p.cover_photo_url,
        p.is_verified, p.is_online, p.follower_count,
        ap.name as platform_name, ap.slug as platform_slug, ap.logo_url as platform_logo
      FROM performers p
      JOIN theme_performers tp ON p.id = tp.performer_id
      JOIN affiliate_platforms ap ON p.platform_id = ap.id
      JOIN performer_selections ps ON p.id = ps.performer_id
      WHERE tp.theme_id = $1 AND ps.is_promoted = true
      ORDER BY tp.display_order, p.follower_count DESC NULLS LAST
      LIMIT $2 OFFSET $3
    `, [themeResult.rows[0].id, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      theme: themeResult.rows[0],
      performers: performersResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GALLERIES
// ==========================================

// Get all galleries
router.get('/galleries', async (req, res) => {
  try {
    const { theme, type, limit = 20, offset = 0 } = req.query;

    let whereClause = 'WHERE g.is_active = true';
    const params = [];

    if (theme) {
      params.push(theme);
      whereClause += ` AND t.slug = $${params.length}`;
    }

    if (type) {
      params.push(type);
      whereClause += ` AND g.gallery_type = $${params.length}`;
    }

    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(`
      SELECT
        g.id, g.name, g.slug, g.description, g.short_description,
        g.cover_image_url, g.thumbnail_url, g.gallery_type,
        g.item_count, g.view_count, g.is_featured,
        t.name as theme_name, t.slug as theme_slug
      FROM galleries g
      LEFT JOIN themes t ON g.theme_id = t.id
      ${whereClause}
      ORDER BY g.is_featured DESC, g.display_order, g.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({ success: true, galleries: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get gallery by slug with items
router.get('/galleries/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Get gallery
    const galleryResult = await pool.query(`
      SELECT g.*, t.name as theme_name, t.slug as theme_slug
      FROM galleries g
      LEFT JOIN themes t ON g.theme_id = t.id
      WHERE g.slug = $1 AND g.is_active = true
    `, [slug]);

    if (galleryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Gallery not found' });
    }

    // Increment view count
    await pool.query('UPDATE galleries SET view_count = view_count + 1 WHERE id = $1',
      [galleryResult.rows[0].id]);

    // Get items
    const itemsResult = await pool.query(`
      SELECT
        gi.id, gi.custom_caption, gi.display_order,
        pc.content_type, pc.title, pc.thumbnail_url, pc.preview_url, pc.duration_seconds,
        p.id as performer_id, p.username, p.display_name, p.avatar_url
      FROM gallery_items gi
      JOIN performer_content pc ON gi.content_id = pc.id
      JOIN performers p ON gi.performer_id = p.id
      WHERE gi.gallery_id = $1
      ORDER BY gi.display_order
    `, [galleryResult.rows[0].id]);

    res.json({
      success: true,
      gallery: galleryResult.rows[0],
      items: itemsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// FEATURED SECTIONS (Homepage)
// ==========================================

// Get homepage sections
router.get('/sections', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, slug, section_type, title, subtitle,
             items_to_show, auto_rotate, rotate_interval_seconds,
             filter_criteria, background_color, background_image_url
      FROM featured_sections
      WHERE is_active = true AND show_on_homepage = true
      ORDER BY display_order
    `);

    // For each section, get the content based on filter_criteria
    const sections = await Promise.all(result.rows.map(async (section) => {
      let items = [];
      const criteria = section.filter_criteria || {};

      if (section.section_type === 'live_now' || criteria.is_online) {
        // Live performers
        items = (await pool.query(`
          SELECT p.id, p.username, p.display_name, p.avatar_url, p.cover_photo_url,
                 p.is_online, ap.slug as platform_slug, ap.logo_url as platform_logo
          FROM performers p
          JOIN performer_selections ps ON p.id = ps.performer_id
          JOIN affiliate_platforms ap ON p.platform_id = ap.id
          WHERE p.is_online = true AND ps.is_promoted = true
          LIMIT $1
        `, [section.items_to_show])).rows;
      } else if (section.slug === 'browse-themes') {
        // Themes
        items = (await pool.query(`
          SELECT id, name, slug, thumbnail_url, icon, color, performer_count
          FROM themes WHERE is_active = true
          ORDER BY display_order LIMIT $1
        `, [section.items_to_show])).rows;
      } else {
        // Featured performers
        items = (await pool.query(`
          SELECT p.id, p.username, p.display_name, p.avatar_url, p.cover_photo_url,
                 p.is_online, p.is_verified, ap.slug as platform_slug, ap.logo_url as platform_logo
          FROM performers p
          JOIN performer_selections ps ON p.id = ps.performer_id
          JOIN affiliate_platforms ap ON p.platform_id = ap.id
          WHERE ps.is_promoted = true ${section.slug === 'featured-creatives' ? 'AND ps.is_featured = true' : ''}
          ORDER BY ${section.slug === 'new-arrivals' ? 'p.created_at DESC' : 'ps.priority DESC'}
          LIMIT $1
        `, [section.items_to_show])).rows;
      }

      return { ...section, items };
    }));

    res.json({ success: true, sections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// AFFILIATE LINK REDIRECT & TRACKING
// ==========================================

// Redirect via short code with tracking
router.get('/go/:code', async (req, res) => {
  try {
    const { code } = req.params;

    // Find link
    const linkResult = await pool.query(`
      SELECT al.*, p.username, p.display_name, ap.name as platform_name
      FROM affiliate_links al
      LEFT JOIN performers p ON al.performer_id = p.id
      LEFT JOIN affiliate_accounts aa ON al.account_id = aa.id
      LEFT JOIN affiliate_platforms ap ON aa.platform_id = ap.id
      WHERE al.short_code = $1 AND al.is_active = true
    `, [code]);

    if (linkResult.rows.length === 0) {
      return res.status(404).send('Link not found');
    }

    const link = linkResult.rows[0];

    // Check expiry
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).send('Link expired');
    }

    // Track click
    const ipHash = crypto.createHash('sha256')
      .update(req.ip + req.headers['user-agent'])
      .digest('hex');

    // Check if unique click
    const uniqueCheck = await pool.query(`
      SELECT id FROM affiliate_link_clicks
      WHERE link_id = $1 AND ip_hash = $2
      AND clicked_at > NOW() - INTERVAL '24 hours'
    `, [link.id, ipHash]);

    const isUnique = uniqueCheck.rows.length === 0;

    // Insert click record
    await pool.query(`
      INSERT INTO affiliate_link_clicks
        (link_id, ip_address, ip_hash, user_agent, referer, is_unique)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      link.id,
      req.ip,
      ipHash,
      req.headers['user-agent'],
      req.headers['referer'],
      isUnique
    ]);

    // Update link stats
    await pool.query(`
      UPDATE affiliate_links
      SET click_count = click_count + 1,
          unique_click_count = unique_click_count + $1,
          last_clicked = NOW()
      WHERE id = $2
    `, [isUnique ? 1 : 0, link.id]);

    // Redirect to affiliate URL
    res.redirect(302, link.affiliate_url);
  } catch (err) {
    console.error('Affiliate redirect error:', err);
    res.status(500).send('Error processing redirect');
  }
});

// ==========================================
// SEARCH
// ==========================================

router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const result = await pool.query(`
      SELECT
        p.id, p.username, p.display_name, p.avatar_url,
        p.is_verified, p.is_online, p.follower_count,
        ap.name as platform_name, ap.slug as platform_slug, ap.logo_url as platform_logo
      FROM performers p
      JOIN performer_selections ps ON p.id = ps.performer_id
      JOIN affiliate_platforms ap ON p.platform_id = ap.id
      WHERE ps.is_promoted = true
        AND (p.username ILIKE $1 OR p.display_name ILIKE $1 OR $2 = ANY(p.categories))
      ORDER BY
        CASE WHEN p.username ILIKE $1 THEN 0 ELSE 1 END,
        p.follower_count DESC NULLS LAST
      LIMIT $3
    `, [`%${q}%`, q.toLowerCase(), parseInt(limit)]);

    res.json({ success: true, results: result.rows, query: q });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// STATS
// ==========================================

router.get('/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM performers p JOIN performer_selections ps ON p.id = ps.performer_id WHERE ps.is_promoted = true) as total_performers,
        (SELECT COUNT(*) FROM performers WHERE is_online = true) as online_now,
        (SELECT COUNT(*) FROM affiliate_platforms WHERE is_active = true) as platforms,
        (SELECT COUNT(*) FROM themes WHERE is_active = true) as themes,
        (SELECT COUNT(*) FROM galleries WHERE is_active = true) as galleries
    `);

    res.json({ success: true, stats: stats.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
