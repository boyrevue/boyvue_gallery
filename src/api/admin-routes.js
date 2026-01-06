/**
 * Admin API Routes
 * Provides admin dashboard with search engine analytics
 * Protected by basic authentication or admin email whitelist
 */

import express from 'express';
import pg from 'pg';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import integrationsRouter from './integrations.js';
import { getAdminSession } from './auth-routes.js';

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

// Apache access log stats
router.get('/apache-stats', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const { execSync } = await import('child_process');
    const fs = await import('fs');

    // Find the log file
    const logPaths = [
      '/var/log/apache2/access.log',
      '/var/log/httpd/access_log',
      '/var/log/apache2/other_vhosts_access.log'
    ];

    let logPath = null;
    for (const p of logPaths) {
      if (fs.existsSync(p)) {
        logPath = p;
        break;
      }
    }

    if (!logPath) {
      return res.json({
        success: true,
        stats: {
          totalRequests: 0,
          uniqueVisitors: 0,
          totalBandwidth: 0,
          errorCount: 0,
          topPages: [],
          topReferrers: [],
          botTraffic: [],
          statusCodes: [],
          recentErrors: [],
          message: 'No Apache log file found'
        }
      });
    }

    // Calculate date threshold
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Parse logs using shell commands for efficiency
    const stats = {
      totalRequests: 0,
      uniqueVisitors: 0,
      totalBandwidth: 0,
      errorCount: 0,
      topPages: [],
      topReferrers: [],
      botTraffic: [],
      statusCodes: [],
      recentErrors: []
    };

    try {
      // Total requests
      const totalCmd = `wc -l < "${logPath}" 2>/dev/null || echo 0`;
      stats.totalRequests = parseInt(execSync(totalCmd, { encoding: 'utf8' }).trim()) || 0;

      // Unique IPs
      const uniqueCmd = `awk '{print $1}' "${logPath}" 2>/dev/null | sort -u | wc -l || echo 0`;
      stats.uniqueVisitors = parseInt(execSync(uniqueCmd, { encoding: 'utf8' }).trim()) || 0;

      // Top pages (excluding static assets)
      const topPagesCmd = `awk '{print $7}' "${logPath}" 2>/dev/null | grep -v -E '\\.(js|css|png|jpg|jpeg|gif|ico|woff|woff2|svg|webp)' | sort | uniq -c | sort -rn | head -20`;
      const topPagesOutput = execSync(topPagesCmd, { encoding: 'utf8' }).trim();
      stats.topPages = topPagesOutput.split('\n').filter(l => l.trim()).map(line => {
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (match) {
          return { hits: parseInt(match[1]), url: match[2], bytes: 0 };
        }
        return null;
      }).filter(Boolean);

      // Top referrers (excluding self and empty)
      const topRefCmd = `awk -F'"' '{print $4}' "${logPath}" 2>/dev/null | grep -v -E '^-$|boyvue\\.com|boysreview\\.com|^$' | sort | uniq -c | sort -rn | head -15`;
      const topRefOutput = execSync(topRefCmd, { encoding: 'utf8' }).trim();
      stats.topReferrers = topRefOutput.split('\n').filter(l => l.trim()).map(line => {
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (match) {
          return { hits: parseInt(match[1]), referrer: match[2] };
        }
        return null;
      }).filter(Boolean);

      // Bot traffic detection
      const botPatterns = [
        { name: 'Googlebot', pattern: 'Googlebot' },
        { name: 'Bingbot', pattern: 'bingbot' },
        { name: 'Yandex', pattern: 'YandexBot' },
        { name: 'Baidu', pattern: 'Baiduspider' },
        { name: 'DuckDuckBot', pattern: 'DuckDuckBot' },
        { name: 'Semrush', pattern: 'SemrushBot' },
        { name: 'Ahrefs', pattern: 'AhrefsBot' },
        { name: 'Facebook', pattern: 'facebookexternalhit' },
        { name: 'Twitter', pattern: 'Twitterbot' },
        { name: 'Other Bots', pattern: 'bot|crawler|spider' }
      ];

      for (const bot of botPatterns) {
        try {
          const botCmd = `grep -i "${bot.pattern}" "${logPath}" 2>/dev/null | wc -l || echo 0`;
          const count = parseInt(execSync(botCmd, { encoding: 'utf8' }).trim()) || 0;
          if (count > 0) {
            stats.botTraffic.push({ name: bot.name, requests: count });
          }
        } catch (e) {
          // Skip this bot
        }
      }

      // HTTP status codes
      const statusCmd = `awk '{print $9}' "${logPath}" 2>/dev/null | grep -E '^[0-9]{3}$' | sort | uniq -c | sort -rn`;
      const statusOutput = execSync(statusCmd, { encoding: 'utf8' }).trim();
      const statusLabels = {
        200: 'OK', 201: 'Created', 204: 'No Content',
        301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
        400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
        500: 'Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable'
      };
      stats.statusCodes = statusOutput.split('\n').filter(l => l.trim()).map(line => {
        const match = line.trim().match(/^(\d+)\s+(\d+)$/);
        if (match) {
          const count = parseInt(match[1]);
          const code = parseInt(match[2]);
          return { code, count, label: statusLabels[code] || '' };
        }
        return null;
      }).filter(Boolean);

      // Calculate error count (4xx + 5xx)
      stats.errorCount = stats.statusCodes
        .filter(s => s.code >= 400)
        .reduce((sum, s) => sum + s.count, 0);

      // Recent errors (last 20 4xx/5xx)
      const errorsCmd = `grep -E '" [45][0-9]{2} ' "${logPath}" 2>/dev/null | tail -20`;
      const errorsOutput = execSync(errorsCmd, { encoding: 'utf8' }).trim();
      stats.recentErrors = errorsOutput.split('\n').filter(l => l.trim()).map(line => {
        // Parse Apache combined log format
        const match = line.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d+) \S+ "[^"]*" "([^"]*)"/);
        if (match) {
          return {
            ip: match[1],
            time: match[2],
            method: match[3],
            url: match[4],
            status: parseInt(match[5]),
            userAgent: match[6].substring(0, 100)
          };
        }
        return null;
      }).filter(Boolean).reverse();

    } catch (cmdErr) {
      console.error('Error running log commands:', cmdErr.message);
    }

    res.json({ success: true, stats });
  } catch (err) {
    console.error('Apache stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to parse Apache logs' });
  }
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

// ============================================
// KEYWORD VAULT API - Legacy keyword archive
// ============================================

// Get keyword vault summary
router.get('/keyword-vault/summary', requireAuth, async (req, res) => {
  try {
    const summary = await pool.query(`
      SELECT
        COUNT(*) as total_keywords,
        COUNT(DISTINCT keyword) as unique_keywords,
        COUNT(CASE WHEN is_target THEN 1 END) as target_keywords,
        COUNT(CASE WHEN is_ranking THEN 1 END) as ranking_keywords,
        ROUND(AVG(search_volume)) as avg_volume,
        COUNT(CASE WHEN position <= 10 THEN 1 END) as page1_keywords,
        COUNT(CASE WHEN position BETWEEN 11 AND 20 THEN 1 END) as page2_keywords
      FROM keyword_vault
    `);

    const bySources = await pool.query(`
      SELECT source, COUNT(*) as count, ROUND(AVG(search_volume)) as avg_volume
      FROM keyword_vault
      GROUP BY source
      ORDER BY count DESC
    `);

    const bySite = await pool.query(`
      SELECT site_context, COUNT(*) as count,
             COUNT(CASE WHEN is_target THEN 1 END) as targets
      FROM keyword_vault
      WHERE site_context IS NOT NULL
      GROUP BY site_context
      ORDER BY count DESC
    `);

    res.json({
      ...summary.rows[0],
      by_source: bySources.rows,
      by_site: bySite.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get keyword vault list with filtering
router.get('/keyword-vault', requireAuth, async (req, res) => {
  try {
    const {
      source, site, search, is_target, priority,
      min_volume, max_volume, has_position,
      sort = 'search_volume', order = 'desc',
      page = 1, limit = 50
    } = req.query;

    let where = ['1=1'];
    const params = [];
    let paramIndex = 1;

    if (source) {
      where.push(`source = $${paramIndex++}`);
      params.push(source);
    }
    if (site) {
      where.push(`site_context ILIKE $${paramIndex++}`);
      params.push(`%${site}%`);
    }
    if (search) {
      where.push(`keyword ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }
    if (is_target === 'true') {
      where.push('is_target = true');
    }
    if (priority) {
      where.push(`priority = $${paramIndex++}`);
      params.push(parseInt(priority));
    }
    if (min_volume) {
      where.push(`search_volume >= $${paramIndex++}`);
      params.push(parseInt(min_volume));
    }
    if (max_volume) {
      where.push(`search_volume <= $${paramIndex++}`);
      params.push(parseInt(max_volume));
    }
    if (has_position === 'true') {
      where.push('position IS NOT NULL');
    }

    const validSorts = ['search_volume', 'position', 'keyword', 'first_seen', 'priority'];
    const sortCol = validSorts.includes(sort) ? sort : 'search_volume';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM keyword_vault WHERE ${where.join(' AND ')}`,
      params
    );

    const result = await pool.query(
      `SELECT * FROM keyword_vault
       WHERE ${where.join(' AND ')}
       ORDER BY ${sortCol} ${sortOrder} NULLS LAST
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      keywords: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(countResult.rows[0].count / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update keyword in vault (set priority, target status, notes)
router.put('/keyword-vault/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_target, priority, notes, tags } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (typeof is_target === 'boolean') {
      updates.push(`is_target = $${paramIndex++}`);
      params.push(is_target);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      params.push(priority);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      params.push(tags);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('last_updated = NOW()');
    params.push(id);

    await pool.query(
      `UPDATE keyword_vault SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new keyword to vault
router.post('/keyword-vault', requireAuth, async (req, res) => {
  try {
    const { keyword, source = 'manual', site_context, search_volume, notes, priority, is_target } = req.body;

    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    const result = await pool.query(
      `INSERT INTO keyword_vault (keyword, source, site_context, search_volume, notes, priority, is_target)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (keyword, source, site_context) DO UPDATE SET
         search_volume = COALESCE(EXCLUDED.search_volume, keyword_vault.search_volume),
         notes = COALESCE(EXCLUDED.notes, keyword_vault.notes),
         last_updated = NOW()
       RETURNING *`,
      [keyword, source, site_context, search_volume, notes, priority || 0, is_target || false]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk import keywords to vault
router.post('/keyword-vault/bulk', requireAuth, async (req, res) => {
  try {
    const { keywords, source = 'manual', site_context } = req.body;

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'Keywords array is required' });
    }

    let imported = 0;
    for (const kw of keywords) {
      const keyword = typeof kw === 'string' ? kw : kw.keyword;
      const volume = typeof kw === 'object' ? kw.search_volume : null;

      try {
        await pool.query(
          `INSERT INTO keyword_vault (keyword, source, site_context, search_volume)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (keyword, source, site_context) DO NOTHING`,
          [keyword, source, site_context, volume]
        );
        imported++;
      } catch (e) {}
    }

    res.json({ imported, total: keywords.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get SEO metrics for Grafana/charts
router.get('/seo-metrics', requireAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    // Current metrics
    const current = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM keyword_vault WHERE is_target) as target_keywords,
        (SELECT COUNT(*) FROM keyword_vault WHERE position IS NOT NULL) as ranking_keywords,
        (SELECT COUNT(*) FROM keyword_vault WHERE position <= 10) as page1_keywords,
        (SELECT COUNT(*) FROM keyword_vault WHERE position BETWEEN 11 AND 20) as page2_keywords,
        (SELECT ROUND(AVG(search_volume)) FROM keyword_vault WHERE is_target) as avg_target_volume,
        (SELECT COUNT(*) FROM seo_website_keywords) as total_tracked
    `);

    // History
    const history = await pool.query(`
      SELECT site, metric_name, metric_value, recorded_at
      FROM seo_metrics_history
      WHERE recorded_at > NOW() - INTERVAL '${parseInt(days)} days'
      ORDER BY recorded_at DESC
    `);

    // Top opportunities
    const opportunities = await pool.query(`
      SELECT keyword, site_context, position, search_volume
      FROM keyword_vault
      WHERE position BETWEEN 11 AND 20 AND search_volume > 100
      ORDER BY search_volume DESC
      LIMIT 20
    `);

    res.json({
      current: current.rows[0],
      history: history.rows,
      opportunities: opportunities.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record SEO metrics (for cron job)
router.post('/seo-metrics/record', requireAuth, async (req, res) => {
  try {
    const sites = ['BoyVue Main', 'BoyVue Pics', 'BoyVue Videos', 'BoyVue Fans', 'BoyVue Adult'];

    for (const site of sites) {
      // Get metrics for this site
      const metrics = await pool.query(`
        SELECT
          COUNT(*) as total_keywords,
          COUNT(CASE WHEN position <= 10 THEN 1 END) as page1,
          COUNT(CASE WHEN position BETWEEN 11 AND 20 THEN 1 END) as page2,
          ROUND(AVG(search_volume)) as avg_volume
        FROM keyword_vault
        WHERE site_context = $1
      `, [site]);

      const m = metrics.rows[0];

      // Record each metric
      await pool.query(
        `INSERT INTO seo_metrics_history (site, metric_name, metric_value) VALUES ($1, 'total_keywords', $2)`,
        [site, m.total_keywords]
      );
      await pool.query(
        `INSERT INTO seo_metrics_history (site, metric_name, metric_value) VALUES ($1, 'page1_keywords', $2)`,
        [site, m.page1]
      );
      await pool.query(
        `INSERT INTO seo_metrics_history (site, metric_name, metric_value) VALUES ($1, 'page2_keywords', $2)`,
        [site, m.page2]
      );
    }

    res.json({ success: true, recorded_at: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PHOTO MANAGEMENT ==========

// Delete a photo
router.delete('/photo/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get photo info first
    const photoResult = await pool.query('SELECT * FROM image WHERE id = $1', [id]);
    if (photoResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    const photo = photoResult.rows[0];

    // Delete files from disk
    const fs = await import('fs');
    const path = await import('path');
    const DATA_DIR = '/var/www/html/bp/data';

    // Delete main file
    if (photo.local_path) {
      const filePath = path.join(DATA_DIR, photo.local_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete thumbnail
    if (photo.thumbnail_path) {
      const thumbPath = path.join(DATA_DIR, photo.thumbnail_path);
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }

    // Delete from database
    await pool.query('DELETE FROM image WHERE id = $1', [id]);

    // Update category count if was approved
    if (photo.approved !== false && photo.belongs_to_gallery) {
      await pool.query(
        'UPDATE category SET photo_count = GREATEST(photo_count - 1, 0) WHERE id = $1',
        [photo.belongs_to_gallery]
      );
    }

    res.json({ success: true, message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve a photo
router.post('/photo/:id/approve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE image SET approved = true WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    const photo = result.rows[0];

    // Update category photo count
    if (photo.belongs_to_gallery) {
      await pool.query(
        'UPDATE category SET photo_count = photo_count + 1 WHERE id = $1',
        [photo.belongs_to_gallery]
      );
    }

    res.json({ success: true, message: 'Photo approved', photo });
  } catch (error) {
    console.error('Approve photo error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unapprove a photo (flag for review)
router.post('/photo/:id/unapprove', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE image SET approved = false WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    const photo = result.rows[0];

    // Decrease category photo count since it's no longer approved
    if (photo.belongs_to_gallery) {
      await pool.query(
        'UPDATE category SET photo_count = GREATEST(photo_count - 1, 0) WHERE id = $1',
        [photo.belongs_to_gallery]
      );
    }

    res.json({ success: true, message: 'Photo unapproved', photo });
  } catch (error) {
    console.error('Unapprove photo error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// SEO PAGE SETTINGS (for AdminSEOPage.jsx)
// ============================================================================

// Get all SEO page settings
router.get('/seo-pages', requireDbAuth, async (req, res) => {
  try {
    // Check if table exists, create if not
    await pool.query(`
      CREATE TABLE IF NOT EXISTS seo_page_settings (
        id SERIAL PRIMARY KEY,
        page_key VARCHAR(100) UNIQUE NOT NULL,
        page_name VARCHAR(255),
        title VARCHAR(255),
        description TEXT,
        keywords TEXT,
        og_image VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const result = await pool.query('SELECT * FROM seo_page_settings ORDER BY page_name');
    const settings = result.rows.map(row => ({
      pageKey: row.page_key,
      pageName: row.page_name,
      title: row.title,
      description: row.description,
      keywords: row.keywords,
      ogImage: row.og_image,
      isActive: row.is_active
    }));
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Get SEO pages error:', error);
    res.status(500).json({ error: 'Failed to fetch SEO settings' });
  }
});

// Create SEO page setting
router.post('/seo-pages', requireDbAuth, async (req, res) => {
  try {
    const { pageKey, pageName, title, description, keywords, ogImage, isActive } = req.body;

    if (!pageKey) {
      return res.status(400).json({ error: 'Page key is required' });
    }

    await pool.query(`
      INSERT INTO seo_page_settings (page_key, page_name, title, description, keywords, og_image, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [pageKey, pageName, title, description, keywords, ogImage, isActive !== false]);

    res.json({ success: true, message: 'SEO setting created' });
  } catch (error) {
    console.error('Create SEO page error:', error);
    res.status(500).json({ error: 'Failed to create SEO setting' });
  }
});

// Update SEO page setting
router.put('/seo-pages/:pageKey', requireDbAuth, async (req, res) => {
  try {
    const { pageKey } = req.params;
    const { pageName, title, description, keywords, ogImage, isActive } = req.body;

    await pool.query(`
      UPDATE seo_page_settings
      SET page_name = $1, title = $2, description = $3, keywords = $4, og_image = $5, is_active = $6, updated_at = NOW()
      WHERE page_key = $7
    `, [pageName, title, description, keywords, ogImage, isActive, pageKey]);

    res.json({ success: true, message: 'SEO setting updated' });
  } catch (error) {
    console.error('Update SEO page error:', error);
    res.status(500).json({ error: 'Failed to update SEO setting' });
  }
});

// Delete SEO page setting
router.delete('/seo-pages/:pageKey', requireDbAuth, async (req, res) => {
  try {
    const { pageKey } = req.params;
    await pool.query('DELETE FROM seo_page_settings WHERE page_key = $1', [pageKey]);
    res.json({ success: true, message: 'SEO setting deleted' });
  } catch (error) {
    console.error('Delete SEO page error:', error);
    res.status(500).json({ error: 'Failed to delete SEO setting' });
  }
});

// ============================================================================
// INTERNAL SEO SETTINGS (for comprehensive SEO management)
// ============================================================================

// Get internal SEO settings
router.get('/internal-seo', requireAuth, async (req, res) => {
  try {
    // Create table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS internal_seo_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value JSONB,
        description TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const result = await pool.query('SELECT * FROM internal_seo_settings ORDER BY setting_key');

    // Return settings as key-value map
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    // Return defaults if empty
    if (Object.keys(settings).length === 0) {
      return res.json({
        success: true,
        settings: {
          gscKeywords: ['nude twinks', 'gay boys', 'boys nude', 'nude teen boys 18+', 'gay twink photos', 'twink galleries'],
          internalLinks: {
            sites: { url: '/sites', title: 'All Sites', seoAlt: 'Browse all gay twink photo sites' },
            journey: { url: '/journey', title: 'Discover', seoAlt: 'Discover trending nude twink content' },
            hotornot: { url: '/hotornot.php', title: 'Hot or Not', seoAlt: 'Rate gay twink photos' },
            videos: { url: '/gallery/gay+videos/', title: 'Videos', seoAlt: 'Watch free gay twink videos' },
            models: { url: '/models', title: 'Models', seoAlt: 'Browse gay twink models' }
          },
          altTagTemplates: {
            photo: '{title} from {site} - {keyword}',
            video: '{title} - {site} nude twink video',
            gallery: '{site} - nude twink photos and gay boy galleries',
            model: '{name} nude photos from {site}'
          },
          navigationTitles: {
            prev: 'Previous: {title}',
            next: 'Next: {title}',
            backToGallery: 'Back to {gallery}'
          },
          breadcrumbTitles: {
            home: 'BoyVue - Free Gay Twink Photos',
            sites: 'Browse All Gay Twink Sites',
            gallery: '{site} - Nude Twink Gallery',
            photo: '{title} - {site}'
          }
        }
      });
    }

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Get internal SEO settings error:', error);
    res.status(500).json({ error: 'Failed to fetch internal SEO settings' });
  }
});

// Save internal SEO settings
router.post('/internal-seo', requireAuth, async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object required' });
    }

    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS internal_seo_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value JSONB,
        description TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Upsert each setting
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(`
        INSERT INTO internal_seo_settings (setting_key, setting_value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (setting_key) DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_at = NOW()
      `, [key, JSON.stringify(value)]);
    }

    res.json({ success: true, message: 'Internal SEO settings saved' });
  } catch (error) {
    console.error('Save internal SEO settings error:', error);
    res.status(500).json({ error: 'Failed to save internal SEO settings' });
  }
});

// Get internal SEO keywords from GSC
router.get('/internal-seo/keywords', requireAuth, async (req, res) => {
  try {
    // Get keywords from seo_website_keywords table
    const result = await pool.query(`
      SELECT DISTINCT LOWER(keyword) as keyword, SUM(search_volume) as volume
      FROM seo_website_keywords
      WHERE keyword IS NOT NULL AND keyword != ''
      GROUP BY LOWER(keyword)
      ORDER BY volume DESC NULLS LAST
      LIMIT 100
    `);

    res.json({
      success: true,
      keywords: result.rows.map(r => ({ keyword: r.keyword, volume: parseInt(r.volume) || 0 }))
    });
  } catch (error) {
    console.error('Get SEO keywords error:', error);
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// Get all internal links with SEO data
router.get('/internal-seo/links', requireAuth, async (req, res) => {
  try {
    // Get category counts for internal link suggestions
    const categories = await pool.query(`
      SELECT c.id, c.catname, COUNT(i.id) as photo_count
      FROM category c
      LEFT JOIN image i ON i.belongs_to_gallery = c.id
      GROUP BY c.id, c.catname
      HAVING COUNT(i.id) > 10
      ORDER BY COUNT(i.id) DESC
      LIMIT 50
    `);

    const links = categories.rows.map(cat => ({
      url: `/gallery/${cat.catname.toLowerCase().replace(/\s+/g, '-')}/`,
      title: cat.catname,
      photoCount: parseInt(cat.photo_count),
      seoAlt: `${cat.catname} - nude twink photos and gay boy galleries`,
      seoTitle: `${cat.catname} - Free Gay Twink Photos`
    }));

    res.json({ success: true, links });
  } catch (error) {
    console.error('Get internal links error:', error);
    res.status(500).json({ error: 'Failed to fetch internal links' });
  }
});

// Update banner SEO from admin
router.put('/internal-seo/banner/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { seoAlt, seoTitle, seoKeywords } = req.body;

    await pool.query(`
      UPDATE banners SET
        seo_alt = COALESCE($1, seo_alt),
        seo_title = COALESCE($2, seo_title),
        seo_keywords = COALESCE($3, seo_keywords),
        updated_at = NOW()
      WHERE id = $4
    `, [seoAlt, seoTitle, seoKeywords, id]);

    res.json({ success: true, message: 'Banner SEO updated' });
  } catch (error) {
    console.error('Update banner SEO error:', error);
    res.status(500).json({ error: 'Failed to update banner SEO' });
  }
});

// Get all banners with SEO data for admin
router.get('/internal-seo/banners', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, site_name, banner_url, affiliate_url, best_seller,
             seo_alt, seo_title, seo_keywords, is_active, click_count
      FROM banners
      ORDER BY best_seller DESC, site_name
    `);

    res.json({ success: true, banners: result.rows });
  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

// ============================================================================
// ADMIN USER MANAGEMENT
// ============================================================================

// Database-backed auth middleware for user management
async function requireDbAuth(req, res, next) {
  const sessionId = req.cookies?.admin_session;
  if (!sessionId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const session = await getAdminSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  req.adminSession = session;
  req.isAdmin = session.roles?.includes('super_admin') || session.roles?.includes('admin');
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Get all admin users
router.get('/users', requireDbAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.email, u.is_active, u.created_at, u.last_login,
        ARRAY_AGG(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as roles
      FROM admin_users u
      LEFT JOIN admin_user_roles ur ON u.id = ur.user_id
      LEFT JOIN admin_roles r ON ur.role_id = r.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all roles
router.get('/roles', requireDbAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.name, r.description,
        ARRAY_AGG(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL) as permissions
      FROM admin_roles r
      LEFT JOIN admin_role_permissions rp ON r.id = rp.role_id
      LEFT JOIN admin_permissions p ON rp.permission_id = p.id
      GROUP BY r.id
      ORDER BY r.id
    `);
    res.json({ success: true, roles: result.rows });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Create new admin user
router.post('/users', requireDbAuth, async (req, res) => {
  try {
    const { username, email, password, roles } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Check if username exists
    const existing = await pool.query('SELECT id FROM admin_users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await pool.query(`
      INSERT INTO admin_users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, is_active, created_at
    `, [username, email || null, passwordHash]);

    const user = userResult.rows[0];

    // Assign roles
    if (roles && roles.length > 0) {
      for (const roleName of roles) {
        await pool.query(`
          INSERT INTO admin_user_roles (user_id, role_id)
          SELECT $1, id FROM admin_roles WHERE name = $2
          ON CONFLICT DO NOTHING
        `, [user.id, roleName]);
      }
    }

    res.json({ success: true, user, message: 'User created successfully' });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update admin user
router.put('/users/:id', requireDbAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, is_active, roles } = req.body;

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (username) {
      updates.push(`username = $${paramCount++}`);
      values.push(username);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email || null);
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(passwordHash);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(id);
      await pool.query(
        `UPDATE admin_users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        values
      );
    }

    // Update roles if provided
    if (roles !== undefined) {
      // Remove existing roles
      await pool.query('DELETE FROM admin_user_roles WHERE user_id = $1', [id]);
      // Add new roles
      for (const roleName of roles) {
        await pool.query(`
          INSERT INTO admin_user_roles (user_id, role_id)
          SELECT $1, id FROM admin_roles WHERE name = $2
          ON CONFLICT DO NOTHING
        `, [id, roleName]);
      }
    }

    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete admin user
router.delete('/users/:id', requireDbAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (req.adminSession.user_id === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await pool.query('DELETE FROM admin_users WHERE id = $1', [id]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
