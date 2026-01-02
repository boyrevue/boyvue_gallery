/**
 * Admin API Routes
 * Provides admin dashboard with search engine analytics
 * Protected by basic authentication or admin email whitelist
 */

import express from 'express';
import pg from 'pg';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import integrationsRouter from './integrations.js';

const __dirname_admin = dirname(fileURLToPath(import.meta.url));

const router = express.Router();

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// Admin credentials (should be in env vars in production)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'boyvue2025';

// Admin email whitelist - users with these emails can access admin via their regular login
const ADMIN_EMAILS = [
  'v.power@diddi.io',
  'v.power@diggi.io'
];

// JWT secret (same as auth-routes.js)
const JWT_SECRET = process.env.JWT_SECRET || 'boyvue-jwt-secret-change-in-production';

// Simple session store
const sessions = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Generate session token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Check if email is admin
function isAdminEmail(email) {
  return email && ADMIN_EMAILS.includes(email.toLowerCase());
}

// Get user from JWT cookie/header
function getUserFromJwt(req) {
  const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}

// Auth middleware - supports both admin token and admin email via JWT
function requireAuth(req, res, next) {
  // First check admin token
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token && sessions.has(token)) {
    const session = sessions.get(token);
    if (Date.now() - session.created <= SESSION_TTL) {
      req.adminUser = session.user;
      return next();
    }
    sessions.delete(token);
  }

  // Then check JWT for admin email
  const jwtUser = getUserFromJwt(req);
  if (jwtUser && isAdminEmail(jwtUser.email)) {
    req.adminUser = jwtUser.email;
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

// Login - supports both password and email-based auth
router.post('/login', async (req, res) => {
  try {
    const { username, password, email } = req.body || {};

    // Check admin credentials
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      const token = generateToken();
      sessions.set(token, { user: username, created: Date.now() });
      return res.json({ success: true, token });
    }

    // Check if email login (for admin email whitelist)
    if (email && isAdminEmail(email)) {
      const token = generateToken();
      sessions.set(token, { user: email, created: Date.now(), isEmailAdmin: true });
      return res.json({ success: true, token });
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Check if current user is admin (for frontend to show admin link)
router.get('/check-admin', (req, res) => {
  const jwtUser = getUserFromJwt(req);
  if (jwtUser && isAdminEmail(jwtUser.email)) {
    return res.json({ isAdmin: true, email: jwtUser.email });
  }
  res.json({ isAdmin: false });
});

// Logout
router.post('/logout', requireAuth, (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token) sessions.delete(token);
  res.json({ success: true });
});

// Check auth status
router.get('/status', requireAuth, (req, res) => {
  res.json({ authenticated: true, user: req.adminUser });
});

// Settings file path
const SETTINGS_FILE = join(__dirname_admin, '../../data/admin-settings.json');

// Get global settings
router.get('/settings', requireAuth, async (req, res) => {
  try {
    let settings = {
      cloudflare: { zoneId: '', apiToken: '', email: '' },
      gsc: { clientEmail: '', privateKey: '', projectId: '' },
      dataforseo: { login: '', password: '' },
      openai: { apiKey: '' },
    };

    if (existsSync(SETTINGS_FILE)) {
      const data = readFileSync(SETTINGS_FILE, 'utf8');
      settings = JSON.parse(data);
    }

    // Mask sensitive data for display
    const masked = {
      cloudflare: {
        zoneId: settings.cloudflare?.zoneId || '',
        apiToken: settings.cloudflare?.apiToken ? '••••••••' : '',
        email: settings.cloudflare?.email || '',
      },
      gsc: {
        projectId: settings.gsc?.projectId || '',
        clientEmail: settings.gsc?.clientEmail || '',
        privateKey: settings.gsc?.privateKey ? '••••••••' : '',
      },
      dataforseo: {
        login: settings.dataforseo?.login || '',
        password: settings.dataforseo?.password ? '••••••••' : '',
      },
      openai: {
        apiKey: settings.openai?.apiKey ? '••••••••' : '',
      },
    };

    res.json({ settings: masked });
  } catch (err) {
    console.error('Error loading settings:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// Save global settings
router.post('/settings', requireAuth, async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ error: 'Settings required' });
    }

    // Load existing settings to preserve masked values
    let existing = {};
    if (existsSync(SETTINGS_FILE)) {
      existing = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'));
    }

    // Merge settings, keeping existing values for masked fields
    const merged = {
      cloudflare: {
        zoneId: settings.cloudflare?.zoneId || existing.cloudflare?.zoneId || '',
        apiToken: settings.cloudflare?.apiToken === '••••••••'
          ? existing.cloudflare?.apiToken
          : (settings.cloudflare?.apiToken || existing.cloudflare?.apiToken || ''),
        email: settings.cloudflare?.email || existing.cloudflare?.email || '',
      },
      gsc: {
        projectId: settings.gsc?.projectId || existing.gsc?.projectId || '',
        clientEmail: settings.gsc?.clientEmail || existing.gsc?.clientEmail || '',
        privateKey: settings.gsc?.privateKey === '••••••••'
          ? existing.gsc?.privateKey
          : (settings.gsc?.privateKey || existing.gsc?.privateKey || ''),
      },
      dataforseo: {
        login: settings.dataforseo?.login || existing.dataforseo?.login || '',
        password: settings.dataforseo?.password === '••••••••'
          ? existing.dataforseo?.password
          : (settings.dataforseo?.password || existing.dataforseo?.password || ''),
      },
      openai: {
        apiKey: settings.openai?.apiKey === '••••••••'
          ? existing.openai?.apiKey
          : (settings.openai?.apiKey || existing.openai?.apiKey || ''),
      },
    };

    // Ensure data directory exists
    const dataDir = dirname(SETTINGS_FILE);
    if (!existsSync(dataDir)) {
      const { mkdirSync } = await import('fs');
      mkdirSync(dataDir, { recursive: true });
    }

    // Write settings
    const { writeFileSync } = await import('fs');
    writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Test API connection
router.post('/settings/test/:api', requireAuth, async (req, res) => {
  try {
    const { api } = req.params;
    const { settings } = req.body;

    // Load actual settings (not masked)
    let actualSettings = {};
    if (existsSync(SETTINGS_FILE)) {
      actualSettings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'));
    }

    // Use provided settings or fall back to saved
    const testSettings = settings || actualSettings[api];

    switch (api) {
      case 'cloudflare': {
        const cfToken = testSettings?.apiToken === '••••••••'
          ? actualSettings.cloudflare?.apiToken
          : testSettings?.apiToken;
        const cfZone = testSettings?.zoneId || actualSettings.cloudflare?.zoneId;

        if (!cfToken || !cfZone) {
          return res.json({ success: false, error: 'Missing Zone ID or API Token' });
        }

        const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZone}`, {
          headers: { 'Authorization': `Bearer ${cfToken}` }
        });
        const cfData = await cfRes.json();

        if (cfData.success) {
          res.json({
            success: true,
            status: {
              connected: true,
              zoneName: cfData.result.name,
              features: ['Cache Purge', 'DNS', 'Firewall', 'Analytics']
            }
          });
        } else {
          res.json({ success: false, error: cfData.errors?.[0]?.message || 'Connection failed' });
        }
        break;
      }

      case 'dataforseo': {
        const dfsLogin = testSettings?.login || actualSettings.dataforseo?.login;
        const dfsPass = testSettings?.password === '••••••••'
          ? actualSettings.dataforseo?.password
          : testSettings?.password;

        if (!dfsLogin || !dfsPass) {
          return res.json({ success: false, error: 'Missing login or password' });
        }

        const auth = Buffer.from(`${dfsLogin}:${dfsPass}`).toString('base64');
        const dfsRes = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
          headers: { 'Authorization': `Basic ${auth}` }
        });
        const dfsData = await dfsRes.json();

        if (dfsData.status_code === 20000) {
          res.json({
            success: true,
            status: {
              connected: true,
              balance: dfsData.tasks?.[0]?.result?.[0]?.money?.balance || 0
            }
          });
        } else {
          res.json({ success: false, error: dfsData.status_message || 'Connection failed' });
        }
        break;
      }

      case 'openai': {
        const oaiKey = testSettings?.apiKey === '••••••••'
          ? actualSettings.openai?.apiKey
          : testSettings?.apiKey;

        if (!oaiKey) {
          return res.json({ success: false, error: 'Missing API key' });
        }

        const oaiRes = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${oaiKey}` }
        });

        if (oaiRes.ok) {
          res.json({ success: true, status: { connected: true } });
        } else {
          res.json({ success: false, error: 'Invalid API key' });
        }
        break;
      }

      case 'gsc': {
        // GSC requires more complex OAuth setup, just validate credentials exist
        const clientEmail = testSettings?.clientEmail || actualSettings.gsc?.clientEmail;
        const privateKey = testSettings?.privateKey === '••••••••'
          ? actualSettings.gsc?.privateKey
          : testSettings?.privateKey;

        if (!clientEmail || !privateKey) {
          return res.json({ success: false, error: 'Missing client email or private key' });
        }

        res.json({
          success: true,
          status: {
            connected: true,
            message: 'Credentials saved. GSC API will be available.',
            sites: ['https://boyvue.com', 'https://fans.boyvue.com']
          }
        });
        break;
      }

      default:
        res.json({ success: false, error: 'Unknown API' });
    }
  } catch (err) {
    console.error('Error testing API:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export data endpoint
router.get('/export/:dataType', requireAuth, async (req, res) => {
  try {
    const { dataType } = req.params;
    const { format = 'csv' } = req.query;

    let data = [];
    let filename = `${dataType}-export`;

    switch (dataType) {
      case 'analytics':
        const analyticsResult = await pool.query(`
          SELECT
            path,
            COUNT(*) as pageviews,
            COUNT(DISTINCT ip) as unique_visitors,
            DATE(created_at) as date
          FROM analytics
          WHERE created_at > NOW() - INTERVAL '30 days'
          GROUP BY path, DATE(created_at)
          ORDER BY date DESC, pageviews DESC
          LIMIT 1000
        `);
        data = analyticsResult.rows;
        break;

      case 'rankings':
        // Placeholder for keyword rankings
        data = [{ keyword: 'Sample', position: 1, date: new Date().toISOString() }];
        break;

      case 'competitors':
        const competitorResult = await pool.query(`
          SELECT domain, keywords_count, backlinks_count, traffic_estimate
          FROM seo_websites
          ORDER BY keywords_count DESC
          LIMIT 100
        `);
        data = competitorResult.rows;
        break;

      case 'traffic':
        const trafficResult = await pool.query(`
          SELECT
            DATE(created_at) as date,
            COUNT(*) as pageviews,
            COUNT(DISTINCT ip) as visitors
          FROM analytics
          WHERE created_at > NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `);
        data = trafficResult.rows;
        break;

      default:
        return res.status(400).json({ error: 'Unknown data type' });
    }

    if (format === 'csv') {
      const headers = data.length > 0 ? Object.keys(data[0]).join(',') : '';
      const rows = data.map(row => Object.values(row).join(',')).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(`${headers}\n${rows}`);
    } else if (format === 'xlsx') {
      // For Excel, we'd need a library like xlsx - return JSON for now
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json(data);
    } else if (format === 'pdf') {
      // For PDF, we'd need a library like pdfkit - return JSON for now
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json(data);
    } else {
      res.json(data);
    }
  } catch (err) {
    console.error('Error exporting data:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Search engine referrer analytics
router.get('/analytics/search-engines', requireAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    // Get search engine hits from analytics table
    const result = await pool.query(`
      SELECT
        CASE
          WHEN referer ILIKE '%google.%' THEN 'Google'
          WHEN referer ILIKE '%bing.%' THEN 'Microsoft Bing'
          WHEN referer ILIKE '%yahoo.%' THEN 'Yahoo'
          WHEN referer ILIKE '%duckduckgo.%' THEN 'DuckDuckGo'
          WHEN referer ILIKE '%yandex.%' THEN 'Yandex'
          WHEN referer ILIKE '%baidu.%' THEN 'Baidu'
          ELSE 'Other'
        END as search_engine,
        COUNT(*) as hits,
        COUNT(DISTINCT ip) as unique_visitors
      FROM analytics
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        AND referer IS NOT NULL
        AND referer != ''
        AND (referer ILIKE '%google.%'
             OR referer ILIKE '%bing.%'
             OR referer ILIKE '%yahoo.%'
             OR referer ILIKE '%duckduckgo.%'
             OR referer ILIKE '%yandex.%'
             OR referer ILIKE '%baidu.%')
      GROUP BY search_engine
      ORDER BY hits DESC
    `).catch(() => ({ rows: [] }));

    // Get daily trends
    const trends = await pool.query(`
      SELECT
        DATE(created_at) as date,
        CASE
          WHEN referer ILIKE '%google.%' THEN 'Google'
          WHEN referer ILIKE '%bing.%' THEN 'Microsoft Bing'
          ELSE 'Other'
        END as search_engine,
        COUNT(*) as hits
      FROM analytics
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        AND (referer ILIKE '%google.%' OR referer ILIKE '%bing.%')
      GROUP BY DATE(created_at), search_engine
      ORDER BY date DESC
    `).catch(() => ({ rows: [] }));

    res.json({
      summary: result.rows,
      trends: trends.rows,
      period: `${days} days`
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.json({ summary: [], trends: [], error: 'Could not fetch analytics' });
  }
});

// Top search queries (extracted from referrer URLs)
router.get('/analytics/search-queries', requireAuth, async (req, res) => {
  try {
    const { days = 30, limit = 50 } = req.query;

    const result = await pool.query(`
      SELECT
        REGEXP_REPLACE(
          REGEXP_REPLACE(referer, '.*[?&]q=([^&]+).*', '\\1'),
          '\\+', ' ', 'g'
        ) as query,
        COUNT(*) as hits
      FROM analytics
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        AND referer ~ '[?&]q='
      GROUP BY query
      HAVING COUNT(*) > 1
      ORDER BY hits DESC
      LIMIT ${parseInt(limit)}
    `).catch(() => ({ rows: [] }));

    res.json({ queries: result.rows });
  } catch (error) {
    console.error('Search queries error:', error);
    res.json({ queries: [] });
  }
});

// Top landing pages
router.get('/analytics/landing-pages', requireAuth, async (req, res) => {
  try {
    const { days = 30, limit = 50 } = req.query;

    const result = await pool.query(`
      SELECT
        page as path,
        COUNT(*) as hits,
        COUNT(DISTINCT ip) as unique_visitors
      FROM analytics
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        AND (referer ILIKE '%google.%' OR referer ILIKE '%bing.%')
      GROUP BY page
      ORDER BY hits DESC
      LIMIT ${parseInt(limit)}
    `).catch(() => ({ rows: [] }));

    res.json({ pages: result.rows });
  } catch (error) {
    console.error('Landing pages error:', error);
    res.json({ pages: [] });
  }
});

// Geographic distribution
router.get('/analytics/geo', requireAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const result = await pool.query(`
      SELECT
        COALESCE(country, 'Unknown') as country,
        COUNT(*) as hits,
        COUNT(DISTINCT ip) as unique_visitors
      FROM analytics
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY country
      ORDER BY hits DESC
      LIMIT 30
    `).catch(() => ({ rows: [] }));

    res.json({ countries: result.rows });
  } catch (error) {
    console.error('Geo analytics error:', error);
    res.json({ countries: [] });
  }
});

// Content stats
router.get('/stats/content', requireAuth, async (req, res) => {
  try {
    const photos = await pool.query(`
      SELECT COUNT(*) as total FROM image
      WHERE local_path NOT LIKE '%.mp4' AND local_path NOT LIKE '%.webm'
    `);

    const videos = await pool.query(`
      SELECT COUNT(*) as total FROM image
      WHERE local_path LIKE '%.mp4' OR local_path LIKE '%.webm'
    `);

    const categories = await pool.query(`
      SELECT COUNT(*) as total FROM category WHERE photo_count > 0
    `);

    const totalViews = await pool.query(`
      SELECT SUM(view_count) as total FROM image
    `);

    res.json({
      photos: parseInt(photos.rows[0]?.total) || 0,
      videos: parseInt(videos.rows[0]?.total) || 0,
      categories: parseInt(categories.rows[0]?.total) || 0,
      totalViews: parseInt(totalViews.rows[0]?.total) || 0
    });
  } catch (error) {
    console.error('Content stats error:', error);
    res.json({ photos: 0, videos: 0, categories: 0, totalViews: 0 });
  }
});

// SEO status
router.get('/seo/status', requireAuth, async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    const publicDir = path.join(__dirname, '../../public');
    const sitemaps = [
      'sitemap.xml',
      'sitemap-i18n.xml',
      'sitemap-categories.xml',
      'sitemap-videos-1.xml',
      'sitemap-videos-2.xml',
      'sitemap-videos-3.xml',
      'sitemap-video.xml',
      'sitemap-image.xml',
      'sitemap-category-photos.xml'
    ];

    const sitemapStatus = sitemaps.map(file => {
      const filePath = path.join(publicDir, file);
      try {
        const stats = fs.statSync(filePath);
        return {
          file,
          exists: true,
          size: stats.size,
          modified: stats.mtime
        };
      } catch {
        return { file, exists: false };
      }
    });

    // Check vocabulary files
    const dataDir = path.join(__dirname, '../../data');
    const vocabFiles = ['seo-vocabulary.ttl', 'seo-keywords.json', 'meta-templates.json', 'category-seo.json'];
    const vocabStatus = vocabFiles.map(file => {
      try {
        const stats = fs.statSync(path.join(dataDir, file));
        return { file, exists: true, size: stats.size, modified: stats.mtime };
      } catch {
        return { file, exists: false };
      }
    });

    res.json({
      sitemaps: sitemapStatus,
      vocabularies: vocabStatus,
      languages: ['en', 'de', 'ru', 'es', 'zh', 'ja', 'th', 'ko', 'pt', 'fr', 'it', 'nl', 'pl', 'cs', 'ar', 'el', 'vi', 'id', 'tr', 'hu']
    });
  } catch (error) {
    console.error('SEO status error:', error);
    res.json({ sitemaps: [], vocabularies: [], languages: [] });
  }
});

// Regenerate sitemaps
router.post('/seo/regenerate-sitemaps', requireAuth, async (req, res) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const result = await execAsync('node /var/www/html/boyvue/scripts/generate-sitemaps.js');
    res.json({ success: true, output: result.stdout });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Regenerate SEO keywords
router.post('/seo/regenerate-keywords', requireAuth, async (req, res) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const result = await execAsync('node /var/www/html/boyvue/scripts/generate-seo-keywords.js');
    res.json({ success: true, output: result.stdout });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Get vocabulary/ontology data
router.get('/seo/vocabulary', requireAuth, async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    const ttlPath = path.join(__dirname, '../../data/seo-vocabulary.ttl');
    const ttlContent = fs.readFileSync(ttlPath, 'utf8');

    // Parse TTL to extract concepts
    const concepts = [];
    const lines = ttlContent.split('\n');
    let currentConcept = null;

    for (const line of lines) {
      // Match concept definitions
      const conceptMatch = line.match(/^bv:(\w+)\s+a\s+skos:Concept/);
      if (conceptMatch) {
        if (currentConcept) concepts.push(currentConcept);
        currentConcept = { id: conceptMatch[1], labels: {}, altLabels: [], broader: null, narrower: [], related: [] };
      }

      // Match prefLabel with language tag
      const labelMatch = line.match(/skos:prefLabel\s+"([^"]+)"@(\w+)/g);
      if (labelMatch && currentConcept) {
        for (const match of labelMatch) {
          const [, label, lang] = match.match(/"([^"]+)"@(\w+)/);
          currentConcept.labels[lang] = label;
        }
      }

      // Match altLabel
      const altMatch = line.match(/skos:altLabel\s+"([^"]+)"@(\w+)/g);
      if (altMatch && currentConcept) {
        for (const match of altMatch) {
          const [, label] = match.match(/"([^"]+)"/);
          if (!currentConcept.altLabels.includes(label)) {
            currentConcept.altLabels.push(label);
          }
        }
      }

      // Match broader
      const broaderMatch = line.match(/skos:broader\s+bv:(\w+)/);
      if (broaderMatch && currentConcept) {
        currentConcept.broader = broaderMatch[1];
      }

      // Match narrower
      const narrowerMatch = line.match(/skos:narrower\s+(.+)/);
      if (narrowerMatch && currentConcept) {
        const items = narrowerMatch[1].match(/bv:(\w+)/g);
        if (items) currentConcept.narrower = items.map(i => i.replace('bv:', ''));
      }
    }
    if (currentConcept) concepts.push(currentConcept);

    // Build hierarchy
    const topConcepts = concepts.filter(c => !c.broader);

    res.json({
      raw: ttlContent,
      concepts,
      topConcepts: topConcepts.map(c => c.id),
      languages: ['en', 'de', 'es', 'fr', 'ru', 'zh', 'ja', 'ko', 'th', 'pt', 'it', 'nl', 'pl', 'cs', 'ar', 'el', 'vi', 'id', 'tr', 'hu']
    });
  } catch (error) {
    console.error('Vocabulary error:', error);
    res.json({ error: error.message });
  }
});

// Get SERP previews for all languages
router.get('/seo/serp-preview', requireAuth, async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    const { pageType = 'home', category, title } = req.query;
    const templatesPath = path.join(__dirname, '../../data/meta-templates.json');
    const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));

    const languages = ['en', 'de', 'es', 'fr', 'ru', 'pt', 'zh', 'ja', 'ko', 'th'];
    const previews = [];

    for (const lang of languages) {
      const template = templates.templates[pageType]?.[lang] || templates.templates[pageType]?.['en'];
      if (template) {
        let serpTitle = template.title;
        let serpDesc = template.description;

        // Replace placeholders
        if (category) {
          serpTitle = serpTitle.replace(/{category}/g, category);
          serpDesc = serpDesc.replace(/{category}/g, category);
        }
        if (title) {
          serpTitle = serpTitle.replace(/{title}/g, title);
          serpDesc = serpDesc.replace(/{title}/g, title);
        }
        serpDesc = serpDesc.replace(/{count}/g, '10,000');
        serpDesc = serpDesc.replace(/{duration}/g, '5:30');

        const langPath = lang === 'en' ? '' : `/${lang}`;
        const url = pageType === 'home'
          ? `https://boyvue.com${langPath}`
          : pageType === 'category'
            ? `https://boyvue.com${langPath}/category/${category?.toLowerCase().replace(/\s+/g, '-') || 'example'}`
            : `https://boyvue.com${langPath}/photo/12345`;

        previews.push({
          language: lang,
          url,
          title: serpTitle,
          description: serpDesc,
          titleLength: serpTitle.length,
          descLength: serpDesc.length,
          titleOk: serpTitle.length <= 60,
          descOk: serpDesc.length <= 160
        });
      }
    }

    res.json({ pageType, previews });
  } catch (error) {
    console.error('SERP preview error:', error);
    res.json({ error: error.message });
  }
});

// Get search terms from Apache logs (all search engines, all sites)
router.get('/analytics/log-search-terms', requireAuth, async (req, res) => {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Parse Apache logs for search engine referrers with query params
    // Covers both boyvue and boysreview.com from other_vhosts_access.log
    const logFiles = [
      '/var/log/apache2/other_vhosts_access.log',
      '/var/log/apache2/boyvue_access.log'
    ];

    const searchTerms = { Google: [], Bing: [], Yahoo: [], Yandex: [], Baidu: [], DuckDuckGo: [] };
    const siteStats = { 'boyvue.com': {}, 'boysreview.com': {}, 'boyreview.com': {} };

    for (const logFile of logFiles) {
      try {
        // Extract referrers containing search queries
        const { stdout } = await execAsync(`grep -oP '"https?://(www\\.)?(google|bing|yahoo|yandex|baidu|duckduckgo)[^"]*[?&](q|query|p|text|wd)=[^"&]+' ${logFile} 2>/dev/null | head -500`, { maxBuffer: 5000000 });

        const lines = stdout.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const url = line.replace(/^"/, '');
            const searchEngineMatch = url.match(/(google|bing|yahoo|yandex|baidu|duckduckgo)/i);
            const queryMatch = url.match(/[?&](q|query|p|text|wd)=([^&"]+)/);

            if (searchEngineMatch && queryMatch) {
              const engine = searchEngineMatch[1].charAt(0).toUpperCase() + searchEngineMatch[1].slice(1).toLowerCase();
              const term = decodeURIComponent(queryMatch[2].replace(/\+/g, ' ')).trim();

              if (term && term.length > 1 && searchTerms[engine]) {
                const existing = searchTerms[engine].find(t => t.term === term);
                if (existing) {
                  existing.hits++;
                } else {
                  searchTerms[engine].push({ term, hits: 1 });
                }
              }
            }
          } catch {}
        }
      } catch {}
    }

    // Also get from other_vhosts and categorize by site
    try {
      const { stdout: siteLog } = await execAsync(`grep -E '(boysreview\\.com|boyreview\\.com|boyvue\\.com).*"https?://(www\\.)?(google|bing)' /var/log/apache2/other_vhosts_access.log 2>/dev/null | head -200`, { maxBuffer: 5000000 });

      const lines = siteLog.split('\n').filter(l => l.trim());
      for (const line of lines) {
        const siteMatch = line.match(/^(boysreview\.com|boyreview\.com|boyvue\.com)/);
        const queryMatch = line.match(/[?&](q|query|p)=([^&"]+)/);
        if (siteMatch && queryMatch) {
          const site = siteMatch[1];
          const term = decodeURIComponent(queryMatch[2].replace(/\+/g, ' ')).trim();
          if (term && siteStats[site]) {
            siteStats[site][term] = (siteStats[site][term] || 0) + 1;
          }
        }
      }
    } catch {}

    // Sort by hits
    for (const engine of Object.keys(searchTerms)) {
      searchTerms[engine].sort((a, b) => b.hits - a.hits);
      searchTerms[engine] = searchTerms[engine].slice(0, 50);
    }

    res.json({
      engines: searchTerms,
      bySite: siteStats,
      source: 'Apache logs'
    });
  } catch (error) {
    console.error('Log search terms error:', error);
    res.json({ engines: {}, bySite: {}, error: error.message });
  }
});

// Get search terms from database analytics (all search engines)
router.get('/analytics/search-terms', requireAuth, async (req, res) => {
  try {
    const { days = 30, limit = 100 } = req.query;

    // Extract search terms from referrer URLs for all search engines
    const result = await pool.query(`
      WITH search_data AS (
        SELECT
          referer,
          CASE
            WHEN referer ILIKE '%google.%' THEN 'Google'
            WHEN referer ILIKE '%bing.%' THEN 'Bing'
            WHEN referer ILIKE '%yahoo.%' THEN 'Yahoo'
            WHEN referer ILIKE '%duckduckgo.%' THEN 'DuckDuckGo'
            WHEN referer ILIKE '%yandex.%' THEN 'Yandex'
            WHEN referer ILIKE '%baidu.%' THEN 'Baidu'
            ELSE 'Other'
          END as engine,
          created_at
        FROM analytics
        WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
          AND referer IS NOT NULL
          AND (referer ILIKE '%google.%'
               OR referer ILIKE '%bing.%'
               OR referer ILIKE '%yahoo.%'
               OR referer ILIKE '%duckduckgo.%'
               OR referer ILIKE '%yandex.%'
               OR referer ILIKE '%baidu.%')
      )
      SELECT
        engine,
        -- Extract query parameter (q= or query= or p= for Yahoo)
        CASE
          WHEN referer ~ '[?&]q=' THEN
            regexp_replace(
              regexp_replace(referer, '.*[?&]q=([^&]*).*', '\\1'),
              '\\+|%20', ' ', 'g'
            )
          WHEN referer ~ '[?&]query=' THEN
            regexp_replace(
              regexp_replace(referer, '.*[?&]query=([^&]*).*', '\\1'),
              '\\+|%20', ' ', 'g'
            )
          WHEN referer ~ '[?&]p=' THEN
            regexp_replace(
              regexp_replace(referer, '.*[?&]p=([^&]*).*', '\\1'),
              '\\+|%20', ' ', 'g'
            )
          WHEN referer ~ '[?&]text=' THEN
            regexp_replace(
              regexp_replace(referer, '.*[?&]text=([^&]*).*', '\\1'),
              '\\+|%20', ' ', 'g'
            )
          WHEN referer ~ '[?&]wd=' THEN
            regexp_replace(
              regexp_replace(referer, '.*[?&]wd=([^&]*).*', '\\1'),
              '\\+|%20', ' ', 'g'
            )
          ELSE NULL
        END as search_term,
        COUNT(*) as hits,
        MAX(created_at) as last_seen
      FROM search_data
      GROUP BY engine, search_term
      HAVING COUNT(*) > 0
        AND CASE
          WHEN referer ~ '[?&]q=' THEN regexp_replace(referer, '.*[?&]q=([^&]*).*', '\\1')
          WHEN referer ~ '[?&]query=' THEN regexp_replace(referer, '.*[?&]query=([^&]*).*', '\\1')
          WHEN referer ~ '[?&]p=' THEN regexp_replace(referer, '.*[?&]p=([^&]*).*', '\\1')
          WHEN referer ~ '[?&]text=' THEN regexp_replace(referer, '.*[?&]text=([^&]*).*', '\\1')
          WHEN referer ~ '[?&]wd=' THEN regexp_replace(referer, '.*[?&]wd=([^&]*).*', '\\1')
          ELSE NULL
        END IS NOT NULL
      ORDER BY hits DESC
      LIMIT ${parseInt(limit)}
    `).catch(() => ({ rows: [] }));

    // Group by engine
    const byEngine = {};
    for (const row of result.rows) {
      if (!byEngine[row.engine]) byEngine[row.engine] = [];
      if (row.search_term && row.search_term.trim()) {
        byEngine[row.engine].push({
          term: decodeURIComponent(row.search_term).trim(),
          hits: parseInt(row.hits),
          lastSeen: row.last_seen
        });
      }
    }

    res.json({
      period: `${days} days`,
      engines: byEngine,
      totalTerms: result.rows.length
    });
  } catch (error) {
    console.error('Search terms error:', error);
    res.json({ engines: {}, error: error.message });
  }
});

// Search engine traffic by language/region
router.get('/analytics/serp-i18n', requireAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    // Traffic by search engine and region
    const byRegion = await pool.query(`
      SELECT
        engine,
        region,
        COUNT(*) as hits,
        COUNT(DISTINCT ip) as unique_visitors
      FROM search_engine_referrals
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        AND region IS NOT NULL
      GROUP BY engine, region
      ORDER BY hits DESC
      LIMIT 50
    `).catch(() => ({ rows: [] }));

    // Traffic by language
    const byLanguage = await pool.query(`
      SELECT
        language,
        COUNT(*) as hits,
        COUNT(DISTINCT ip) as unique_visitors
      FROM analytics
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        AND language IS NOT NULL
      GROUP BY language
      ORDER BY hits DESC
    `).catch(() => ({ rows: [] }));

    // Search queries by region
    const queriesByRegion = await pool.query(`
      SELECT
        region,
        search_query,
        COUNT(*) as hits
      FROM search_engine_referrals
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        AND search_query IS NOT NULL
        AND search_query != ''
        AND region IS NOT NULL
      GROUP BY region, search_query
      ORDER BY hits DESC
      LIMIT 100
    `).catch(() => ({ rows: [] }));

    // Group queries by region
    const groupedQueries = {};
    for (const row of queriesByRegion.rows) {
      if (!groupedQueries[row.region]) groupedQueries[row.region] = [];
      groupedQueries[row.region].push({ query: row.search_query, hits: parseInt(row.hits) });
    }

    // Landing pages by language
    const landingsByLang = await pool.query(`
      SELECT
        language,
        page,
        COUNT(*) as hits
      FROM analytics
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
        AND language IS NOT NULL
        AND (referer ILIKE '%google%' OR referer ILIKE '%bing%' OR referer ILIKE '%yandex%' OR referer ILIKE '%baidu%')
      GROUP BY language, page
      ORDER BY hits DESC
      LIMIT 100
    `).catch(() => ({ rows: [] }));

    res.json({
      period: `${days} days`,
      byRegion: byRegion.rows,
      byLanguage: byLanguage.rows,
      queriesByRegion: groupedQueries,
      landingsByLanguage: landingsByLang.rows
    });
  } catch (error) {
    console.error('SERP i18n analytics error:', error);
    res.json({ byRegion: [], byLanguage: [], queriesByRegion: {}, landingsByLanguage: [] });
  }
});

// Archived search terms from Apache logs (extracted once)
router.get('/analytics/archived-search-terms', requireAuth, async (req, res) => {
  try {
    const dataFile = join(__dirname_admin, '../../data/search_terms_archive.json');
    if (!existsSync(dataFile)) {
      return res.json({ error: 'Archive not found. Run log extraction first.' });
    }
    const data = JSON.parse(readFileSync(dataFile, 'utf8'));

    // Get term statuses from database
    const statusResult = await pool.query('SELECT term, status, english_translation FROM search_term_status');
    const statusMap = {};
    for (const row of statusResult.rows) {
      statusMap[row.term] = { status: row.status, translation: row.english_translation };
    }

    // Merge status into data
    data.term_status = statusMap;
    res.json(data);
  } catch (error) {
    console.error('Error loading archived search terms:', error);
    res.status(500).json({ error: 'Failed to load archive' });
  }
});

// Translate term using MyMemory API (free, no key needed)
router.get('/analytics/translate', requireAuth, async (req, res) => {
  try {
    const { term, from = 'auto', to = 'en' } = req.query;

    // Check if we already have translation in DB
    const cached = await pool.query(
      'SELECT english_translation FROM search_term_status WHERE term = $1 AND english_translation IS NOT NULL',
      [term]
    );

    if (cached.rows.length > 0 && cached.rows[0].english_translation) {
      return res.json({ translation: cached.rows[0].english_translation, cached: true });
    }

    // Use MyMemory free translation API
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=${from}|${to}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translation = data.responseData.translatedText;

      // Cache in database
      await pool.query(`
        INSERT INTO search_term_status (term, language, english_translation, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (term) DO UPDATE SET english_translation = $3, updated_at = NOW()
      `, [term, from, translation]);

      res.json({ translation, cached: false });
    } else {
      res.json({ translation: null, error: 'Translation failed' });
    }
  } catch (error) {
    console.error('Translation error:', error);
    res.json({ translation: null, error: error.message });
  }
});

// Update search term status (relevant/ignored) with category
router.post('/analytics/term-status', requireAuth, async (req, res) => {
  try {
    const { term, language, status, translation, category } = req.body;

    await pool.query(`
      INSERT INTO search_term_status (term, language, status, english_translation, category, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (term) DO UPDATE SET
        status = COALESCE($3, search_term_status.status),
        english_translation = COALESCE($4, search_term_status.english_translation),
        category = COALESCE($5, search_term_status.category),
        updated_at = NOW()
    `, [term, language, status, translation, category || 'keyword']);

    res.json({ success: true, term, status, category });
  } catch (error) {
    console.error('Error updating term status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Bulk update term status
router.post('/analytics/term-status/bulk', requireAuth, async (req, res) => {
  try {
    const { terms, status } = req.body;

    for (const { term, language } of terms) {
      await pool.query(`
        INSERT INTO search_term_status (term, language, status, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (term) DO UPDATE SET status = $3, updated_at = NOW()
      `, [term, language, status]);
    }

    res.json({ success: true, updated: terms.length });
  } catch (error) {
    console.error('Error bulk updating term status:', error);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

// Get term stats summary
router.get('/analytics/term-stats', requireAuth, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        status,
        COUNT(*) as count
      FROM search_term_status
      GROUP BY status
    `);
    res.json(stats.rows);
  } catch (error) {
    res.json([]);
  }
});

// Get relevant terms for SEO (public endpoint for frontend)
router.get('/seo/relevant-terms', async (req, res) => {
  try {
    const { category, limit = 50 } = req.query;

    let query = `
      SELECT term, language, english_translation, category
      FROM search_term_status
      WHERE status = 'relevant'
    `;

    if (category) {
      query += ` AND category = '${category}'`;
    }

    query += ` ORDER BY updated_at DESC LIMIT ${parseInt(limit)}`;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.json([]);
  }
});

// Get identified entities (models, websites, keywords)
router.get('/analytics/entities', requireAuth, async (req, res) => {
  try {
    const entitiesFile = join(__dirname_admin, '../../data/identified_entities.json');
    if (existsSync(entitiesFile)) {
      const data = JSON.parse(readFileSync(entitiesFile, 'utf8'));
      res.json(data);
    } else {
      res.json({ websites: {}, models: {}, keywords: {} });
    }
  } catch (error) {
    res.json({ websites: {}, models: {}, keywords: {} });
  }
});

// Get terms by category for SEO content
router.get('/seo/terms-by-category', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT category, json_agg(json_build_object(
        'term', term,
        'translation', english_translation,
        'language', language
      )) as terms
      FROM search_term_status
      WHERE status = 'relevant'
      GROUP BY category
    `);

    const byCategory = {};
    for (const row of result.rows) {
      byCategory[row.category] = row.terms;
    }
    res.json(byCategory);
  } catch (error) {
    res.json({});
  }
});

// ===== MODELS MANAGEMENT =====
router.get('/seo/models', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, first_name, last_name, display_name, websites, search_count, featured, notes
      FROM seo_models ORDER BY search_count DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.json([]);
  }
});

router.post('/seo/models/:id/feature', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;
    await pool.query('UPDATE seo_models SET featured = $1, updated_at = NOW() WHERE id = $2', [featured, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

router.put('/seo/models/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, notes } = req.body;
    await pool.query(
      'UPDATE seo_models SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), notes = $3, updated_at = NOW() WHERE id = $4',
      [first_name, last_name, notes, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

// ===== WEBSITES MANAGEMENT =====
router.get('/seo/websites', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, url, search_count, featured, notes
      FROM seo_websites ORDER BY search_count DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.json([]);
  }
});

router.post('/seo/websites/:id/feature', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;
    await pool.query('UPDATE seo_websites SET featured = $1, updated_at = NOW() WHERE id = $2', [featured, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

router.put('/seo/websites/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { url, notes } = req.body;
    await pool.query(
      'UPDATE seo_websites SET url = COALESCE($1, url), notes = $2, updated_at = NOW() WHERE id = $3',
      [url, notes, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

// ===== WEBSITE KEYWORDS & BACKLINKS =====

// Get keywords for a website
router.get('/seo/websites/:id/keywords', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM seo_website_keywords WHERE website_id = $1 ORDER BY search_volume DESC NULLS LAST',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// Get backlinks for a website
router.get('/seo/websites/:id/backlinks', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM seo_website_backlinks WHERE website_id = $1 ORDER BY domain_rank DESC NULLS LAST',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch backlinks' });
  }
});

// Store keywords for a website
router.post('/seo/websites/:id/keywords', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { keywords } = req.body; // Array of keyword objects

    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({ error: 'Keywords array required' });
    }

    // Delete old keywords and insert new ones
    await pool.query('DELETE FROM seo_website_keywords WHERE website_id = $1', [id]);

    for (const kw of keywords) {
      await pool.query(`
        INSERT INTO seo_website_keywords (website_id, keyword, position, search_volume, cpc, url)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (website_id, keyword) DO UPDATE SET
          position = $3, search_volume = $4, cpc = $5, url = $6, fetched_at = NOW()
      `, [id, kw.keyword, kw.position, kw.searchVolume, kw.cpc, kw.url]);
    }

    // Update website summary
    await pool.query(
      'UPDATE seo_websites SET total_keywords = $1, last_fetched = NOW() WHERE id = $2',
      [keywords.length, id]
    );

    res.json({ success: true, count: keywords.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store keywords: ' + error.message });
  }
});

// Store backlinks for a website
router.post('/seo/websites/:id/backlinks', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { backlinks, totalBacklinks } = req.body;

    if (!backlinks || !Array.isArray(backlinks)) {
      return res.status(400).json({ error: 'Backlinks array required' });
    }

    // Delete old backlinks and insert new ones
    await pool.query('DELETE FROM seo_website_backlinks WHERE website_id = $1', [id]);

    for (const bl of backlinks) {
      await pool.query(`
        INSERT INTO seo_website_backlinks
          (website_id, source_url, source_domain, target_url, anchor, domain_rank, is_dofollow, first_seen)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (website_id, source_url) DO UPDATE SET
          source_domain = $3, anchor = $5, domain_rank = $6, fetched_at = NOW()
      `, [id, bl.sourceUrl, bl.sourceDomain, bl.targetUrl, bl.anchor, bl.domainRank, bl.isDofollow, bl.firstSeen]);
    }

    // Update website summary
    await pool.query(
      'UPDATE seo_websites SET total_backlinks = $1, last_fetched = NOW() WHERE id = $2',
      [totalBacklinks || backlinks.length, id]
    );

    res.json({ success: true, count: backlinks.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store backlinks: ' + error.message });
  }
});

// Get all websites with their keywords and backlinks
router.get('/seo/websites-full', requireAuth, async (req, res) => {
  try {
    const websites = await pool.query(`
      SELECT w.*,
        (SELECT json_agg(k ORDER BY k.search_volume DESC NULLS LAST)
         FROM seo_website_keywords k WHERE k.website_id = w.id) as keywords,
        (SELECT json_agg(b ORDER BY b.domain_rank DESC NULLS LAST)
         FROM seo_website_backlinks b WHERE b.website_id = w.id) as backlinks
      FROM seo_websites w
      ORDER BY w.featured DESC, w.search_count DESC
    `);
    res.json(websites.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch websites' });
  }
});

// Get competitor stats summary
router.get('/seo/competitor-stats', requireAuth, async (req, res) => {
  try {
    // Total competitors
    const competitors = await pool.query('SELECT COUNT(*) as count FROM seo_websites WHERE last_fetched IS NOT NULL');

    // Total keywords
    const keywords = await pool.query('SELECT COUNT(*) as total, COUNT(DISTINCT LOWER(keyword)) as unique_count FROM seo_website_keywords');

    // High volume keywords (10K+)
    const highVolume = await pool.query('SELECT COUNT(DISTINCT LOWER(keyword)) as count FROM seo_website_keywords WHERE search_volume > 10000');

    // Gay-specific keywords
    const gayKeywords = await pool.query(`
      SELECT COUNT(DISTINCT LOWER(keyword)) as count
      FROM seo_website_keywords
      WHERE keyword ILIKE '%gay%' OR keyword ILIKE '%twink%' OR keyword ILIKE '%boy%'
    `);

    // Top competitors by rank
    const topCompetitors = await pool.query(`
      SELECT name, url, domain_rank, total_backlinks, total_keywords, last_fetched
      FROM seo_websites
      WHERE domain_rank IS NOT NULL
      ORDER BY domain_rank DESC
      LIMIT 15
    `);

    // Top keywords by volume
    const topKeywords = await pool.query(`
      SELECT keyword, MAX(search_volume) as volume, COUNT(DISTINCT website_id) as competitor_count
      FROM seo_website_keywords
      WHERE keyword NOT IN ('porn', 'pornhub', 'xvideos', 'xhamster', 'yourb', 'sex', 'porns', 'porn hub')
      GROUP BY keyword
      ORDER BY MAX(search_volume) DESC
      LIMIT 30
    `);

    // SERP content count
    const serpCount = await pool.query('SELECT COUNT(*) as count FROM seo_serp_content');

    res.json({
      competitorCount: parseInt(competitors.rows[0].count),
      totalKeywords: parseInt(keywords.rows[0].total),
      uniqueKeywords: parseInt(keywords.rows[0].unique_count),
      highVolumeKeywords: parseInt(highVolume.rows[0].count),
      gayKeywords: parseInt(gayKeywords.rows[0].count),
      serpContentCount: parseInt(serpCount.rows[0].count),
      topCompetitors: topCompetitors.rows,
      topKeywords: topKeywords.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch competitor stats: ' + error.message });
  }
});

// Get keywords for a specific competitor
router.get('/seo/competitor/:id/keywords', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT keyword, position, search_volume, cpc, url, fetched_at
      FROM seo_website_keywords
      WHERE website_id = $1
      ORDER BY search_volume DESC NULLS LAST
    `, [id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// Process keywords and match to categories
router.post('/seo/match-keywords-to-categories', requireAuth, async (req, res) => {
  try {
    // Get all categories
    const categories = await pool.query('SELECT id, catname FROM category');
    const categoryMap = categories.rows.reduce((acc, c) => {
      // Create variations for matching: lowercase, without special chars
      const name = c.catname.toLowerCase().replace(/[^a-z0-9]/g, '');
      acc[name] = c.id;
      // Also add with spaces replaced
      const nameSpaced = c.catname.toLowerCase().replace(/-/g, ' ');
      acc[nameSpaced] = c.id;
      return acc;
    }, {});

    // Get all website keywords
    const keywords = await pool.query(`
      SELECT k.keyword, k.search_volume, k.position, k.website_id
      FROM seo_website_keywords k
      WHERE k.keyword IS NOT NULL
    `);

    let matched = 0, unmatched = 0;

    for (const kw of keywords.rows) {
      const keyword = kw.keyword.toLowerCase();
      let categoryId = null;

      // Try to match keyword to category
      for (const [catName, catId] of Object.entries(categoryMap)) {
        // Direct match or contains
        if (keyword.includes(catName) || catName.includes(keyword)) {
          categoryId = catId;
          break;
        }
        // Partial word match (e.g., "twink" matches "twinks", "baremason" matches "blakemason")
        const keywordClean = keyword.replace(/[^a-z0-9]/g, '');
        if (keywordClean.includes(catName) || catName.includes(keywordClean)) {
          categoryId = catId;
          break;
        }
      }

      if (categoryId) {
        // Check if already exists
        const exists = await pool.query(
          'SELECT id FROM category_keywords WHERE category_id = $1 AND keyword = $2',
          [categoryId, kw.keyword]
        );
        if (exists.rows.length === 0) {
          await pool.query(
            'INSERT INTO category_keywords (category_id, keyword, source_website_id, search_volume, position) VALUES ($1, $2, $3, $4, $5)',
            [categoryId, kw.keyword, kw.website_id, kw.search_volume, kw.position]
          );
          matched++;
        }
      } else {
        // Check if already in unmatched
        const exists = await pool.query(
          'SELECT id FROM unmatched_keywords WHERE keyword = $1',
          [kw.keyword]
        );
        if (exists.rows.length === 0) {
          await pool.query(
            'INSERT INTO unmatched_keywords (keyword, source_website_id, search_volume) VALUES ($1, $2, $3)',
            [kw.keyword, kw.website_id, kw.search_volume]
          );
          unmatched++;
        }
      }
    }

    res.json({ success: true, matched, unmatched, total: keywords.rows.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to match keywords: ' + error.message });
  }
});

// Get category keywords
router.get('/seo/category-keywords', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id as category_id, c.catname as category_name,
        json_agg(json_build_object(
          'keyword', ck.keyword,
          'search_volume', ck.search_volume,
          'position', ck.position
        ) ORDER BY ck.search_volume DESC NULLS LAST) as keywords,
        COUNT(ck.id) as keyword_count
      FROM category c
      LEFT JOIN category_keywords ck ON ck.category_id = c.id
      GROUP BY c.id, c.catname
      HAVING COUNT(ck.id) > 0
      ORDER BY COUNT(ck.id) DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get category keywords' });
  }
});

// Get unmatched keywords
router.get('/seo/unmatched-keywords', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT uk.*, w.name as website_name
      FROM unmatched_keywords uk
      LEFT JOIN seo_websites w ON w.id = uk.source_website_id
      WHERE uk.reviewed = false
      ORDER BY uk.search_volume DESC NULLS LAST
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get unmatched keywords' });
  }
});

// Assign unmatched keyword to category
router.post('/seo/assign-keyword-category', requireAuth, async (req, res) => {
  const { keywordId, categoryId } = req.body;
  try {
    // Get the keyword
    const kw = await pool.query('SELECT * FROM unmatched_keywords WHERE id = $1', [keywordId]);
    if (kw.rows.length === 0) {
      return res.status(404).json({ error: 'Keyword not found' });
    }

    // Insert into category_keywords
    await pool.query(
      'INSERT INTO category_keywords (category_id, keyword, source_website_id, search_volume) VALUES ($1, $2, $3, $4)',
      [categoryId, kw.rows[0].keyword, kw.rows[0].source_website_id, kw.rows[0].search_volume]
    );

    // Mark as reviewed
    await pool.query('UPDATE unmatched_keywords SET reviewed = true WHERE id = $1', [keywordId]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign keyword' });
  }
});

// Dismiss unmatched keyword
router.post('/seo/dismiss-keyword', requireAuth, async (req, res) => {
  const { keywordId } = req.body;
  try {
    await pool.query('UPDATE unmatched_keywords SET reviewed = true WHERE id = $1', [keywordId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to dismiss keyword' });
  }
});

// ===== CATEGORY TRANSLATIONS (i18n) =====

// Get all category translations
router.get('/category-translations', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id as category_id, c.catname, ct.lang, ct.title, ct.description,
        ct.meta_title, ct.meta_description, ct.meta_keywords,
        (SELECT COUNT(*) FROM category_keywords WHERE category_id = c.id) as keyword_count
      FROM category c
      LEFT JOIN category_translations ct ON ct.category_id = c.id
      WHERE c.photo_count > 0
      ORDER BY c.photo_count DESC, ct.lang
    `);

    // Group by category
    const categories = {};
    for (const row of result.rows) {
      if (!categories[row.category_id]) {
        categories[row.category_id] = {
          id: row.category_id,
          catname: row.catname,
          keyword_count: row.keyword_count,
          translations: {}
        };
      }
      if (row.lang) {
        categories[row.category_id].translations[row.lang] = {
          title: row.title,
          description: row.description,
          meta_title: row.meta_title,
          meta_description: row.meta_description,
          meta_keywords: row.meta_keywords
        };
      }
    }

    res.json(Object.values(categories));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get category translations' });
  }
});

// Update category translation
router.post('/category-translations/:categoryId', requireAuth, async (req, res) => {
  const { categoryId } = req.params;
  const { lang, title, description, meta_title, meta_description, meta_keywords } = req.body;

  try {
    await pool.query(`
      INSERT INTO category_translations (category_id, lang, title, description, meta_title, meta_description, meta_keywords, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (category_id, lang) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        meta_title = EXCLUDED.meta_title,
        meta_description = EXCLUDED.meta_description,
        meta_keywords = EXCLUDED.meta_keywords,
        updated_at = NOW()
    `, [categoryId, lang || 'en', title, description, meta_title, meta_description, meta_keywords]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category translation: ' + error.message });
  }
});

// Bulk update category with description (for BoyFun example)
router.post('/category-translations/bulk', requireAuth, async (req, res) => {
  const { updates } = req.body; // Array of { categoryId, lang, title, description, ... }

  try {
    let updated = 0;
    for (const u of updates) {
      await pool.query(`
        INSERT INTO category_translations (category_id, lang, title, description, meta_title, meta_description, meta_keywords, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (category_id, lang) DO UPDATE SET
          title = COALESCE(EXCLUDED.title, category_translations.title),
          description = COALESCE(EXCLUDED.description, category_translations.description),
          meta_title = COALESCE(EXCLUDED.meta_title, category_translations.meta_title),
          meta_description = COALESCE(EXCLUDED.meta_description, category_translations.meta_description),
          meta_keywords = COALESCE(EXCLUDED.meta_keywords, category_translations.meta_keywords),
          updated_at = NOW()
      `, [u.categoryId, u.lang || 'en', u.title, u.description, u.meta_title, u.meta_description, u.meta_keywords]);
      updated++;
    }

    res.json({ success: true, updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk update: ' + error.message });
  }
});

// Get featured content for SEO (public)
router.get('/seo/featured', async (req, res) => {
  try {
    const models = await pool.query('SELECT first_name, last_name, websites FROM seo_models WHERE featured = true');
    const websites = await pool.query('SELECT name, url FROM seo_websites WHERE featured = true');
    const keywords = await pool.query("SELECT term, english_translation FROM search_term_status WHERE status = 'relevant' AND category = 'keyword'");

    res.json({
      models: models.rows,
      websites: websites.rows,
      keywords: keywords.rows
    });
  } catch (error) {
    res.json({ models: [], websites: [], keywords: [] });
  }
});

// ===== i18n SEO TERMS =====
const SUPPORTED_LANGUAGES = ['de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'ja', 'ko', 'zh', 'tr', 'th', 'vi', 'id', 'el', 'cs', 'hu', 'ar'];

// Get all i18n terms
router.get('/seo/i18n-terms', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT english_term, language, translated_term, category, auto_translated
      FROM seo_i18n_terms
      ORDER BY english_term, language
    `);

    // Group by English term
    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.english_term]) {
        grouped[row.english_term] = { term: row.english_term, category: row.category, translations: {} };
      }
      grouped[row.english_term].translations[row.language] = row.translated_term;
    }

    res.json(Object.values(grouped));
  } catch (error) {
    res.json([]);
  }
});

// Translate a term to all languages
router.post('/seo/translate-term', requireAuth, async (req, res) => {
  try {
    const { term, category = 'keyword' } = req.body;

    if (!term || !term.trim()) {
      return res.status(400).json({ error: 'Term is required' });
    }

    const translations = {};
    const cleanTerm = term.trim();

    // Also store English version
    await pool.query(`
      INSERT INTO seo_i18n_terms (english_term, language, translated_term, category, auto_translated)
      VALUES ($1, 'en', $1, $2, false)
      ON CONFLICT (english_term, language) DO NOTHING
    `, [cleanTerm, category]);

    for (const lang of SUPPORTED_LANGUAGES) {
      try {
        // Use MyMemory API for translation
        const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanTerm)}&langpair=en|${lang}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          const translated = data.responseData.translatedText;
          translations[lang] = translated;

          // Store in database with auto_translated flag
          await pool.query(`
            INSERT INTO seo_i18n_terms (english_term, language, translated_term, category, auto_translated)
            VALUES ($1, $2, $3, $4, true)
            ON CONFLICT (english_term, language) DO UPDATE SET
              translated_term = $3,
              auto_translated = true
          `, [cleanTerm, lang, translated, category]);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        console.error(`Translation failed for ${lang}:`, e.message);
      }
    }

    console.log(`Translated "${cleanTerm}" to ${Object.keys(translations).length} languages`);
    res.json({ term: cleanTerm, translations });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed: ' + error.message });
  }
});

// Bulk translate multiple terms
router.post('/seo/bulk-translate', requireAuth, async (req, res) => {
  try {
    const { terms } = req.body;
    const results = [];

    for (const { term, category } of terms) {
      // Quick translate to main languages only (de, es, fr, pt, ru, ja, zh)
      const mainLangs = ['de', 'es', 'fr', 'pt', 'ru', 'ja', 'zh'];

      for (const lang of mainLangs) {
        try {
          const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=en|${lang}`;
          const response = await fetch(apiUrl);
          const data = await response.json();

          if (data.responseStatus === 200 && data.responseData?.translatedText) {
            await pool.query(`
              INSERT INTO seo_i18n_terms (english_term, language, translated_term, category)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (english_term, language) DO UPDATE SET translated_term = $3
            `, [term, lang, data.responseData.translatedText, category || 'keyword']);
          }
        } catch (e) { /* skip */ }
      }
      results.push(term);
    }

    res.json({ translated: results.length });
  } catch (error) {
    res.status(500).json({ error: 'Bulk translation failed' });
  }
});

// Delete an i18n term (all translations)
router.delete('/seo/i18n-terms/:term', requireAuth, async (req, res) => {
  try {
    const term = decodeURIComponent(req.params.term);
    const result = await pool.query(
      'DELETE FROM seo_i18n_terms WHERE english_term = $1 RETURNING *',
      [term]
    );
    res.json({ success: true, deleted: result.rowCount });
  } catch (error) {
    console.error('Delete term error:', error);
    res.status(500).json({ error: 'Failed to delete term' });
  }
});

// Retranslate a term (fill in missing languages)
router.post('/seo/i18n-terms/:term/retranslate', requireAuth, async (req, res) => {
  try {
    const term = decodeURIComponent(req.params.term);
    const { category = 'keyword' } = req.body;

    // Get existing translations
    const existing = await pool.query(
      'SELECT language FROM seo_i18n_terms WHERE english_term = $1',
      [term]
    );
    const existingLangs = new Set(existing.rows.map(r => r.language));

    // Find missing languages
    const missingLangs = SUPPORTED_LANGUAGES.filter(lang => !existingLangs.has(lang));
    const translations = {};

    for (const lang of missingLangs) {
      try {
        const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(term)}&langpair=en|${lang}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          const translated = data.responseData.translatedText;
          translations[lang] = translated;

          await pool.query(`
            INSERT INTO seo_i18n_terms (english_term, language, translated_term, category, auto_translated)
            VALUES ($1, $2, $3, $4, true)
            ON CONFLICT (english_term, language) DO UPDATE SET
              translated_term = $3,
              auto_translated = true
          `, [term, lang, translated, category]);
        }
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        console.error(`Retranslation failed for ${lang}:`, e.message);
      }
    }

    res.json({ term, newTranslations: translations, added: Object.keys(translations).length });
  } catch (error) {
    console.error('Retranslate error:', error);
    res.status(500).json({ error: 'Retranslation failed' });
  }
});

// Get i18n terms for a specific language (public - for SEO)
router.get('/seo/terms/:lang', async (req, res) => {
  try {
    const { lang } = req.params;
    const result = await pool.query(`
      SELECT english_term, translated_term, category
      FROM seo_i18n_terms
      WHERE language = $1
    `, [lang]);
    res.json(result.rows);
  } catch (error) {
    res.json([]);
  }
});

// ===== REVIEW COMMENTS MODERATION =====

// Get all pending comments for moderation
router.get('/review-comments/pending', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT src.*, sr.site_name, c.catname
      FROM site_review_comments src
      JOIN site_reviews sr ON sr.id = src.review_id
      JOIN category c ON c.id = sr.category_id
      WHERE src.status = 'pending'
      ORDER BY src.created_at DESC
      LIMIT 100
    `);
    res.json({ comments: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all comments (for review management)
router.get('/review-comments', requireAuth, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    let query = `
      SELECT src.*, sr.site_name, c.catname
      FROM site_review_comments src
      JOIN site_reviews sr ON sr.id = src.review_id
      JOIN category c ON c.id = sr.category_id
    `;
    const params = [];

    if (status) {
      query += ' WHERE src.status = $1';
      params.push(status);
    }

    query += ` ORDER BY src.created_at DESC LIMIT ${parseInt(limit)}`;

    const result = await pool.query(query, params);
    res.json({ comments: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve a comment
router.post('/review-comments/:id/approve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`
      UPDATE site_review_comments
      SET status = 'approved', moderated_at = NOW(), moderated_by = $2
      WHERE id = $1
    `, [id, req.adminUser]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject a comment
router.post('/review-comments/:id/reject', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`
      UPDATE site_review_comments
      SET status = 'rejected', moderated_at = NOW(), moderated_by = $2
      WHERE id = $1
    `, [id, req.adminUser]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a comment
router.delete('/review-comments/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM site_review_comments WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk moderate comments
router.post('/review-comments/bulk', requireAuth, async (req, res) => {
  try {
    const { ids, action } = req.body;

    if (!ids?.length || !['approve', 'reject', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (action === 'delete') {
      await pool.query('DELETE FROM site_review_comments WHERE id = ANY($1)', [ids]);
    } else {
      const status = action === 'approve' ? 'approved' : 'rejected';
      await pool.query(`
        UPDATE site_review_comments
        SET status = $1, moderated_at = NOW(), moderated_by = $2
        WHERE id = ANY($3)
      `, [status, req.adminUser, ids]);
    }

    res.json({ success: true, count: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comment moderation stats
router.get('/review-comments/stats', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) as total
      FROM site_review_comments
    `);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mount integrations routes (protected by auth)
router.use('/integrations', requireAuth, integrationsRouter);

export default router;
