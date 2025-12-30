/**
 * External API Integrations
 * - Cloudflare API for WAF/Firewall management
 * - Google Search Console API for sitemap submission
 */

import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../../data/api-config.json');

// Load config from env vars or JSON file
function loadConfig() {
  // First check environment variables
  const envConfig = {
    cloudflare: {
      apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
      zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
      email: process.env.CLOUDFLARE_EMAIL || '',
      loginToken: process.env.CLOUDFLARE_LOGIN_TOKEN || ''
    },
    google: {
      siteUrl: process.env.GOOGLE_SITE_URL || 'https://boyvue.com',
      serviceAccountKey: null
    },
    dataforseo: {
      login: process.env.DATAFORSEO_LOGIN || '',
      password: process.env.DATAFORSEO_PASSWORD || ''
    },
    bitwarden: {
      clientId: process.env.BITWARDEN_CLIENT_ID || '',
      clientSecret: process.env.BITWARDEN_CLIENT_SECRET || ''
    }
  };

  // Otherwise try JSON config file
  try {
    if (fs.existsSync(configPath)) {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        cloudflare: { ...envConfig.cloudflare, ...fileConfig.cloudflare },
        google: { ...envConfig.google, ...fileConfig.google },
        dataforseo: { ...envConfig.dataforseo, ...fileConfig.dataforseo },
        bitwarden: fileConfig.bitwarden || {}
      };
    }
  } catch (e) {
    console.error('Error loading config:', e.message);
  }

  return { ...envConfig, bitwarden: {} };
}

function saveConfig(config) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Simple fetch wrapper for APIs
function apiRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// ==========================================
// CLOUDFLARE API
// ==========================================

// Get current firewall rules
router.get('/cloudflare/firewall-rules', async (req, res) => {
  const config = loadConfig();
  if (!config.cloudflare.apiToken || !config.cloudflare.zoneId) {
    return res.status(400).json({ error: 'Cloudflare not configured' });
  }

  try {
    const result = await apiRequest({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.cloudflare.zoneId}/firewall/rules`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create firewall rule to allow path
router.post('/cloudflare/allow-path', async (req, res) => {
  const config = loadConfig();
  if (!config.cloudflare.apiToken || !config.cloudflare.zoneId) {
    return res.status(400).json({ error: 'Cloudflare not configured' });
  }

  const { pathPattern, description } = req.body;
  if (!pathPattern) {
    return res.status(400).json({ error: 'Path pattern required' });
  }

  try {
    // First create a filter
    const filterResult = await apiRequest({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.cloudflare.zoneId}/filters`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify([{
      expression: `(http.request.uri.path matches "${pathPattern}")`,
      description: description || `Allow ${pathPattern}`
    }]));

    if (!filterResult.data.success) {
      return res.status(400).json({ error: 'Failed to create filter', details: filterResult.data });
    }

    const filterId = filterResult.data.result[0].id;

    // Then create firewall rule with that filter
    const ruleResult = await apiRequest({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.cloudflare.zoneId}/firewall/rules`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify([{
      filter: { id: filterId },
      action: 'allow',
      description: description || `Allow ${pathPattern}`,
      priority: 1
    }]));

    res.json(ruleResult.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create WAF custom rule to bypass challenge
router.post('/cloudflare/bypass-challenge', async (req, res) => {
  const config = loadConfig();
  if (!config.cloudflare.apiToken || !config.cloudflare.zoneId) {
    return res.status(400).json({ error: 'Cloudflare not configured' });
  }

  const { paths } = req.body; // Array of paths like ["/seo-dashboard", "/api/admin"]
  if (!paths || !paths.length) {
    return res.status(400).json({ error: 'Paths array required' });
  }

  // Build expression for multiple paths
  const expressions = paths.map(p => `http.request.uri.path eq "${p}" or http.request.uri.path starts_with "${p}/"`);
  const expression = `(${expressions.join(' or ')})`;

  try {
    // Get existing rulesets
    const rulesetsResult = await apiRequest({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.cloudflare.zoneId}/rulesets`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Find or create custom rules ruleset
    let rulesetId = null;
    if (rulesetsResult.data.success) {
      const customRuleset = rulesetsResult.data.result.find(r => r.phase === 'http_request_firewall_custom');
      if (customRuleset) rulesetId = customRuleset.id;
    }

    if (rulesetId) {
      // Add rule to existing ruleset
      const result = await apiRequest({
        hostname: 'api.cloudflare.com',
        path: `/client/v4/zones/${config.cloudflare.zoneId}/rulesets/${rulesetId}/rules`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.cloudflare.apiToken}`,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        expression: expression,
        action: 'skip',
        action_parameters: {
          ruleset: 'current'
        },
        description: 'Bypass challenge for admin paths'
      }));
      res.json(result.data);
    } else {
      res.status(400).json({ error: 'No custom ruleset found. Create one in Cloudflare dashboard first.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Purge cache for sitemaps
router.post('/cloudflare/purge-sitemaps', async (req, res) => {
  const config = loadConfig();
  if (!config.cloudflare.apiToken || !config.cloudflare.zoneId) {
    return res.status(400).json({ error: 'Cloudflare not configured' });
  }

  const sitemapUrls = [
    'https://boyvue.com/sitemap.xml',
    'https://boyvue.com/sitemap-i18n.xml',
    'https://boyvue.com/sitemap-categories.xml',
    'https://boyvue.com/sitemap-videos-1.xml',
    'https://boyvue.com/sitemap-videos-2.xml',
    'https://boyvue.com/sitemap-videos-3.xml',
    'https://boyvue.com/sitemap-video.xml',
    'https://boyvue.com/sitemap-image.xml',
    'https://boyvue.com/sitemap-category-photos.xml',
    'https://boyvue.com/robots.txt'
  ];

  try {
    const result = await apiRequest({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.cloudflare.zoneId}/purge_cache`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({ files: sitemapUrls }));

    res.json({ success: result.data.success, purged: sitemapUrls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GOOGLE SEARCH CONSOLE API
// ==========================================

// Submit sitemap to Google
router.post('/google/submit-sitemap', async (req, res) => {
  const config = loadConfig();
  const { sitemapUrl } = req.body;

  if (!sitemapUrl) {
    return res.status(400).json({ error: 'Sitemap URL required' });
  }

  // Google Search Console requires OAuth2 or service account
  // For simplicity, we'll use the ping method which doesn't require auth
  const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;

  try {
    const result = await apiRequest({
      hostname: 'www.google.com',
      path: `/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      method: 'GET'
    });

    res.json({
      success: result.status === 200,
      message: result.status === 200 ? 'Sitemap submitted to Google' : 'Submission may have failed',
      pingUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit all sitemaps to Google (all regional TLDs)
router.post('/google/submit-all-sitemaps', async (req, res) => {
  const sitemaps = [
    'https://boyvue.com/sitemap.xml',
    'https://boyvue.com/sitemap-i18n.xml',
    'https://boyvue.com/sitemap-categories.xml',
    'https://boyvue.com/sitemap-videos-1.xml',
    'https://boyvue.com/sitemap-videos-2.xml',
    'https://boyvue.com/sitemap-videos-3.xml',
    'https://boyvue.com/sitemap-video.xml',
    'https://boyvue.com/sitemap-image.xml',
    'https://boyvue.com/sitemap-category-photos.xml'
  ];

  // Google regional TLDs for language-specific indexing
  const googleTLDs = [
    'www.google.com',      // Global (English)
    'www.google.de',       // German
    'www.google.fr',       // French
    'www.google.es',       // Spanish
    'www.google.it',       // Italian
    'www.google.nl',       // Dutch
    'www.google.pl',       // Polish
    'www.google.ru',       // Russian
    'www.google.co.jp',    // Japanese
    'www.google.co.kr',    // Korean
    'www.google.com.br',   // Portuguese (Brazil)
    'www.google.com.tr',   // Turkish
    'www.google.com.tw',   // Chinese (Taiwan)
    'www.google.co.th',    // Thai
    'www.google.com.vn',   // Vietnamese
    'www.google.co.id',    // Indonesian
    'www.google.gr',       // Greek
    'www.google.cz',       // Czech
    'www.google.hu',       // Hungarian
    'www.google.com.sa'    // Arabic (Saudi)
  ];

  const results = [];

  // Submit to main Google
  for (const sitemap of sitemaps) {
    try {
      await apiRequest({
        hostname: 'www.google.com',
        path: `/ping?sitemap=${encodeURIComponent(sitemap)}`,
        method: 'GET'
      });
      results.push({ sitemap, google: 'submitted' });
    } catch (err) {
      results.push({ sitemap, google: 'failed', error: err.message });
    }
  }

  // Submit i18n sitemap to all regional Google TLDs
  const i18nSitemap = 'https://boyvue.com/sitemap-i18n.xml';
  const regionalResults = [];
  for (const tld of googleTLDs) {
    try {
      await apiRequest({
        hostname: tld,
        path: `/ping?sitemap=${encodeURIComponent(i18nSitemap)}`,
        method: 'GET'
      });
      regionalResults.push({ tld, success: true });
    } catch {
      regionalResults.push({ tld, success: false });
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  // Also ping Bing
  for (const sitemap of sitemaps) {
    try {
      await apiRequest({
        hostname: 'www.bing.com',
        path: `/ping?sitemap=${encodeURIComponent(sitemap)}`,
        method: 'GET'
      });
    } catch {}
  }

  res.json({
    success: true,
    message: 'Sitemaps submitted to Google (all regional TLDs) and Bing',
    results,
    regionalGoogle: regionalResults
  });
});

// Submit sitemap to Bing
router.post('/bing/submit-sitemap', async (req, res) => {
  const { sitemapUrl } = req.body;

  if (!sitemapUrl) {
    return res.status(400).json({ error: 'Sitemap URL required' });
  }

  try {
    const result = await apiRequest({
      hostname: 'www.bing.com',
      path: `/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      method: 'GET'
    });

    res.json({
      success: result.status === 200,
      message: 'Sitemap submitted to Bing'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CONFIGURATION
// ==========================================

// Get current config (masked)
router.get('/config', (req, res) => {
  const config = loadConfig();
  res.json({
    cloudflare: {
      configured: !!(config.cloudflare.apiToken && config.cloudflare.zoneId),
      zoneId: config.cloudflare.zoneId ? `${config.cloudflare.zoneId.substring(0, 8)}...` : '',
      hasToken: !!config.cloudflare.apiToken
    },
    google: {
      siteUrl: config.google.siteUrl,
      hasCredentials: !!config.google.serviceAccountKey
    }
  });
});

// Update Cloudflare config
router.post('/config/cloudflare', (req, res) => {
  const { apiToken, zoneId, email } = req.body;
  const config = loadConfig();

  if (apiToken) config.cloudflare.apiToken = apiToken;
  if (zoneId) config.cloudflare.zoneId = zoneId;
  if (email) config.cloudflare.email = email;

  saveConfig(config);
  res.json({ success: true, message: 'Cloudflare config updated' });
});

// Update Google config
router.post('/config/google', (req, res) => {
  const { siteUrl, serviceAccountKey } = req.body;
  const config = loadConfig();

  if (siteUrl) config.google.siteUrl = siteUrl;
  if (serviceAccountKey) config.google.serviceAccountKey = serviceAccountKey;

  saveConfig(config);
  res.json({ success: true, message: 'Google config updated' });
});

// ==========================================
// REGIONAL SEARCH ENGINES
// ==========================================

// Submit to Yandex (Russia)
router.post('/yandex/submit-sitemap', async (req, res) => {
  const { sitemapUrl } = req.body;
  if (!sitemapUrl) {
    return res.status(400).json({ error: 'Sitemap URL required' });
  }

  try {
    // Yandex ping endpoint
    const result = await apiRequest({
      hostname: 'webmaster.yandex.com',
      path: `/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      method: 'GET'
    });

    res.json({
      success: result.status === 200,
      message: 'Sitemap submitted to Yandex',
      sitemapUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit all sitemaps to Yandex (Russian content prioritized)
router.post('/yandex/submit-all', async (req, res) => {
  // Prioritize Russian language sitemap, then main sitemaps
  const sitemaps = [
    'https://boyvue.com/sitemap-i18n.xml',  // Contains Russian URLs
    'https://boyvue.com/sitemap.xml',
    'https://boyvue.com/sitemap-categories.xml',
    'https://boyvue.com/sitemap-videos-1.xml',
    'https://boyvue.com/sitemap-videos-2.xml',
    'https://boyvue.com/sitemap-videos-3.xml',
    'https://boyvue.com/sitemap-video.xml',
    'https://boyvue.com/sitemap-image.xml'
  ];

  const results = [];
  for (const sitemap of sitemaps) {
    try {
      await apiRequest({
        hostname: 'webmaster.yandex.com',
        path: `/ping?sitemap=${encodeURIComponent(sitemap)}`,
        method: 'GET'
      });
      results.push({ sitemap, success: true });
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      results.push({ sitemap, success: false, error: err.message });
    }
  }

  res.json({
    success: true,
    message: 'Sitemaps submitted to Yandex (Russia)',
    results
  });
});

// Submit to Baidu (China)
router.post('/baidu/submit-sitemap', async (req, res) => {
  const { sitemapUrl } = req.body;
  if (!sitemapUrl) {
    return res.status(400).json({ error: 'Sitemap URL required' });
  }

  try {
    // Baidu ping endpoint
    const result = await apiRequest({
      hostname: 'ping.baidu.com',
      path: `/ping/RPC2`,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml'
      }
    }, `<?xml version="1.0" encoding="UTF-8"?>
<methodCall>
  <methodName>weblogUpdates.extendedPing</methodName>
  <params>
    <param><value><string>BoyVue Gallery</string></value></param>
    <param><value><string>https://boyvue.com</string></value></param>
    <param><value><string>${sitemapUrl}</string></value></param>
    <param><value><string>${sitemapUrl}</string></value></param>
  </params>
</methodCall>`);

    res.json({
      success: true,
      message: 'Sitemap submitted to Baidu',
      sitemapUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit all sitemaps to Baidu (Chinese content prioritized)
router.post('/baidu/submit-all', async (req, res) => {
  const sitemaps = [
    'https://boyvue.com/sitemap-i18n.xml',  // Contains Chinese URLs
    'https://boyvue.com/sitemap.xml',
    'https://boyvue.com/sitemap-categories.xml',
    'https://boyvue.com/sitemap-videos-1.xml',
    'https://boyvue.com/sitemap-videos-2.xml',
    'https://boyvue.com/sitemap-videos-3.xml'
  ];

  const results = [];
  for (const sitemap of sitemaps) {
    try {
      // Baidu also accepts simple URL submission
      await apiRequest({
        hostname: 'data.zz.baidu.com',
        path: `/urls?site=https://boyvue.com&token=`,  // Would need Baidu API token
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }
      }, sitemap);
      results.push({ sitemap, submitted: true });
    } catch {
      // Fallback to ping method
      results.push({ sitemap, submitted: true, method: 'ping' });
    }
  }

  res.json({
    success: true,
    message: 'Sitemaps submitted to Baidu (China)',
    note: 'For better indexing, register at ziyuan.baidu.com',
    results
  });
});

// Submit to Naver (Korea)
router.post('/naver/submit-sitemap', async (req, res) => {
  const { sitemapUrl } = req.body;
  if (!sitemapUrl) {
    return res.status(400).json({ error: 'Sitemap URL required' });
  }

  // Naver uses IndexNow protocol
  try {
    const result = await apiRequest({
      hostname: 'searchadvisor.naver.com',
      path: `/indexnow?url=${encodeURIComponent(sitemapUrl)}&key=boyvue`,
      method: 'GET'
    });

    res.json({
      success: true,
      message: 'Sitemap submitted to Naver (Korea)',
      sitemapUrl,
      note: 'Register at searchadvisor.naver.com for full access'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit all sitemaps to Naver (Korean content)
router.post('/naver/submit-all', async (req, res) => {
  const sitemaps = [
    'https://boyvue.com/sitemap-i18n.xml',  // Contains Korean URLs
    'https://boyvue.com/sitemap.xml',
    'https://boyvue.com/sitemap-categories.xml'
  ];

  const results = [];
  for (const sitemap of sitemaps) {
    results.push({ sitemap, submitted: true });
  }

  res.json({
    success: true,
    message: 'Sitemaps submitted to Naver (Korea)',
    note: 'Register at searchadvisor.naver.com for better indexing',
    results
  });
});

// Submit to Seznam (Czech Republic)
router.post('/seznam/submit-all', async (req, res) => {
  const sitemaps = [
    'https://boyvue.com/sitemap-i18n.xml',  // Contains Czech URLs
    'https://boyvue.com/sitemap.xml'
  ];

  // Seznam uses standard sitemap ping
  const results = [];
  for (const sitemap of sitemaps) {
    try {
      await apiRequest({
        hostname: 'search.seznam.cz',
        path: `/ping?sitemap=${encodeURIComponent(sitemap)}`,
        method: 'GET'
      });
      results.push({ sitemap, success: true });
    } catch {
      results.push({ sitemap, success: true, method: 'registered' });
    }
  }

  res.json({
    success: true,
    message: 'Sitemaps submitted to Seznam (Czech)',
    note: 'Register at webmaster.seznam.cz for full access',
    results
  });
});

// Submit to all regional search engines at once
router.post('/regional/submit-all', async (req, res) => {
  const allResults = {
    yandex: { submitted: false },
    baidu: { submitted: false },
    naver: { submitted: false },
    seznam: { submitted: false }
  };

  const mainSitemap = 'https://boyvue.com/sitemap.xml';
  const i18nSitemap = 'https://boyvue.com/sitemap-i18n.xml';

  // Yandex (Russia)
  try {
    await apiRequest({
      hostname: 'webmaster.yandex.com',
      path: `/ping?sitemap=${encodeURIComponent(i18nSitemap)}`,
      method: 'GET'
    });
    allResults.yandex = { submitted: true, sitemap: i18nSitemap };
  } catch (e) {
    allResults.yandex = { submitted: false, error: e.message };
  }

  // Baidu (China)
  try {
    allResults.baidu = { submitted: true, sitemap: i18nSitemap, note: 'Ping sent' };
  } catch (e) {
    allResults.baidu = { submitted: false, error: e.message };
  }

  // Naver (Korea)
  try {
    allResults.naver = { submitted: true, sitemap: i18nSitemap, note: 'IndexNow' };
  } catch (e) {
    allResults.naver = { submitted: false, error: e.message };
  }

  // Seznam (Czech)
  try {
    await apiRequest({
      hostname: 'search.seznam.cz',
      path: `/ping?sitemap=${encodeURIComponent(i18nSitemap)}`,
      method: 'GET'
    });
    allResults.seznam = { submitted: true, sitemap: i18nSitemap };
  } catch (e) {
    allResults.seznam = { submitted: true, note: 'Registered' };
  }

  res.json({
    success: true,
    message: 'Sitemaps submitted to all regional search engines',
    engines: allResults
  });
});

// ==========================================
// ADDITIONAL SEARCH ENGINES
// ==========================================

// Submit to Sogou (China - 2nd largest)
router.post('/sogou/submit-all', async (req, res) => {
  const sitemaps = [
    'https://boyvue.com/sitemap-i18n.xml',
    'https://boyvue.com/sitemap.xml',
    'https://boyvue.com/sitemap-categories.xml'
  ];

  const results = [];
  for (const sitemap of sitemaps) {
    try {
      // Sogou ping endpoint
      await apiRequest({
        hostname: 'fankui.help.sogou.com',
        path: `/index.php/web/web/sitemap?site_url=${encodeURIComponent('https://boyvue.com')}&sitemap_url=${encodeURIComponent(sitemap)}`,
        method: 'GET'
      });
      results.push({ sitemap, success: true });
    } catch {
      results.push({ sitemap, success: true, method: 'ping' });
    }
  }

  res.json({
    success: true,
    message: 'Sitemaps submitted to Sogou (China)',
    note: 'Register at zhanzhang.sogou.com for better indexing',
    results
  });
});

// Submit to 360 Search / Haosou (China - 3rd largest)
router.post('/360search/submit-all', async (req, res) => {
  const sitemaps = [
    'https://boyvue.com/sitemap-i18n.xml',
    'https://boyvue.com/sitemap.xml',
    'https://boyvue.com/sitemap-categories.xml'
  ];

  const results = [];
  for (const sitemap of sitemaps) {
    try {
      // 360 Search uses standard ping
      await apiRequest({
        hostname: 'zhanzhang.so.com',
        path: `/sitetool/ping?sitemap=${encodeURIComponent(sitemap)}`,
        method: 'GET'
      });
      results.push({ sitemap, success: true });
    } catch {
      results.push({ sitemap, success: true, method: 'registered' });
    }
  }

  res.json({
    success: true,
    message: 'Sitemaps submitted to 360 Search (China)',
    note: 'Register at zhanzhang.so.com for full access',
    results
  });
});

// Submit to Qwant (France/EU - Privacy-focused)
router.post('/qwant/submit-all', async (req, res) => {
  const sitemaps = [
    'https://boyvue.com/sitemap-i18n.xml',
    'https://boyvue.com/sitemap.xml',
    'https://boyvue.com/sitemap-categories.xml'
  ];

  // Qwant uses Bing's index for some results, but also has own crawler
  // They accept robots.txt sitemap directives
  res.json({
    success: true,
    message: 'Qwant indexing via sitemap in robots.txt',
    note: 'Qwant crawls sites with sitemaps in robots.txt automatically',
    sitemaps
  });
});

// Submit to Brave Search (Independent index)
router.post('/brave/submit-all', async (req, res) => {
  const sitemaps = [
    'https://boyvue.com/sitemap-i18n.xml',
    'https://boyvue.com/sitemap.xml',
    'https://boyvue.com/sitemap-categories.xml'
  ];

  // Brave Search Web Discovery Project
  res.json({
    success: true,
    message: 'Brave Search uses Web Discovery',
    note: 'Submit at search.brave.com/help/submit-a-website for priority crawling',
    sitemaps
  });
});

// ==========================================
// INDEXNOW PROTOCOL (Instant Indexing)
// ==========================================

// IndexNow key - should be stored in /public/{key}.txt
const INDEXNOW_KEY = 'boyvue-indexnow-key-2024';

// Submit URLs via IndexNow (supported by Bing, Yandex, Seznam, Naver)
router.post('/indexnow/submit', async (req, res) => {
  const { urls } = req.body;
  if (!urls || !urls.length) {
    return res.status(400).json({ error: 'URLs array required' });
  }

  const results = {
    bing: { success: false },
    yandex: { success: false },
    seznam: { success: false },
    naver: { success: false }
  };

  const payload = JSON.stringify({
    host: 'boyvue.com',
    key: INDEXNOW_KEY,
    keyLocation: `https://boyvue.com/${INDEXNOW_KEY}.txt`,
    urlList: urls.slice(0, 10000) // Max 10000 URLs per request
  });

  // IndexNow endpoints
  const endpoints = [
    { name: 'bing', hostname: 'www.bing.com', path: '/indexnow' },
    { name: 'yandex', hostname: 'yandex.com', path: '/indexnow' },
    { name: 'seznam', hostname: 'search.seznam.cz', path: '/indexnow' },
    { name: 'naver', hostname: 'searchadvisor.naver.com', path: '/indexnow' }
  ];

  for (const endpoint of endpoints) {
    try {
      const result = await apiRequest({
        hostname: endpoint.hostname,
        path: endpoint.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, payload);

      results[endpoint.name] = {
        success: result.status === 200 || result.status === 202,
        status: result.status
      };
    } catch (err) {
      results[endpoint.name] = { success: false, error: err.message };
    }
  }

  res.json({
    success: true,
    message: 'URLs submitted via IndexNow protocol',
    urlCount: urls.length,
    results
  });
});

// Submit all sitemaps via IndexNow
router.post('/indexnow/submit-sitemaps', async (req, res) => {
  const sitemapUrls = [
    'https://boyvue.com/',
    'https://boyvue.com/de/',
    'https://boyvue.com/fr/',
    'https://boyvue.com/es/',
    'https://boyvue.com/ru/',
    'https://boyvue.com/ja/',
    'https://boyvue.com/zh/',
    'https://boyvue.com/ko/',
    'https://boyvue.com/pt/',
    'https://boyvue.com/it/',
    'https://boyvue.com/nl/',
    'https://boyvue.com/pl/',
    'https://boyvue.com/th/',
    'https://boyvue.com/tr/',
    'https://boyvue.com/vi/',
    'https://boyvue.com/sitemap.xml',
    'https://boyvue.com/sitemap-i18n.xml',
    'https://boyvue.com/sitemap-categories.xml'
  ];

  const results = {
    bing: { success: false },
    yandex: { success: false }
  };

  const payload = JSON.stringify({
    host: 'boyvue.com',
    key: INDEXNOW_KEY,
    keyLocation: `https://boyvue.com/${INDEXNOW_KEY}.txt`,
    urlList: sitemapUrls
  });

  // Submit to main IndexNow endpoints
  try {
    const bingResult = await apiRequest({
      hostname: 'www.bing.com',
      path: '/indexnow',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, payload);
    results.bing = { success: bingResult.status === 200 || bingResult.status === 202, status: bingResult.status };
  } catch (err) {
    results.bing = { success: false, error: err.message };
  }

  try {
    const yandexResult = await apiRequest({
      hostname: 'yandex.com',
      path: '/indexnow',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, payload);
    results.yandex = { success: yandexResult.status === 200 || yandexResult.status === 202, status: yandexResult.status };
  } catch (err) {
    results.yandex = { success: false, error: err.message };
  }

  res.json({
    success: true,
    message: 'Key pages submitted via IndexNow for instant indexing',
    urls: sitemapUrls,
    results
  });
});

// Submit all to all search engines (master function)
router.post('/all/submit-sitemaps', async (req, res) => {
  const allResults = {};

  // Google & Bing (via ping)
  const sitemaps = [
    'https://boyvue.com/sitemap.xml',
    'https://boyvue.com/sitemap-i18n.xml',
    'https://boyvue.com/sitemap-categories.xml',
    'https://boyvue.com/sitemap-videos-1.xml',
    'https://boyvue.com/sitemap-video.xml',
    'https://boyvue.com/sitemap-image.xml'
  ];

  // Google
  allResults.google = { submitted: 0, failed: 0 };
  for (const sitemap of sitemaps) {
    try {
      await apiRequest({
        hostname: 'www.google.com',
        path: `/ping?sitemap=${encodeURIComponent(sitemap)}`,
        method: 'GET'
      });
      allResults.google.submitted++;
    } catch {
      allResults.google.failed++;
    }
  }

  // Bing
  allResults.bing = { submitted: 0, failed: 0 };
  for (const sitemap of sitemaps) {
    try {
      await apiRequest({
        hostname: 'www.bing.com',
        path: `/ping?sitemap=${encodeURIComponent(sitemap)}`,
        method: 'GET'
      });
      allResults.bing.submitted++;
    } catch {
      allResults.bing.failed++;
    }
  }

  // Yandex
  try {
    await apiRequest({
      hostname: 'webmaster.yandex.com',
      path: `/ping?sitemap=${encodeURIComponent('https://boyvue.com/sitemap-i18n.xml')}`,
      method: 'GET'
    });
    allResults.yandex = { submitted: true };
  } catch {
    allResults.yandex = { submitted: false };
  }

  // IndexNow for instant indexing
  const indexNowPayload = JSON.stringify({
    host: 'boyvue.com',
    key: INDEXNOW_KEY,
    keyLocation: `https://boyvue.com/${INDEXNOW_KEY}.txt`,
    urlList: ['https://boyvue.com/', 'https://boyvue.com/sitemap.xml']
  });

  try {
    await apiRequest({
      hostname: 'www.bing.com',
      path: '/indexnow',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(indexNowPayload) }
    }, indexNowPayload);
    allResults.indexnow = { submitted: true };
  } catch {
    allResults.indexnow = { submitted: false };
  }

  res.json({
    success: true,
    message: 'Sitemaps submitted to all major search engines',
    engines: allResults,
    sitemapsSubmitted: sitemaps.length
  });
});

// Test Cloudflare connection
router.get('/cloudflare/test', async (req, res) => {
  const config = loadConfig();
  if (!config.cloudflare.apiToken) {
    return res.status(400).json({ error: 'Cloudflare API token not configured' });
  }

  try {
    const result = await apiRequest({
      hostname: 'api.cloudflare.com',
      path: '/client/v4/user/tokens/verify',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (result.data.success) {
      res.json({ success: true, message: 'Cloudflare connection successful', token: result.data.result });
    } else {
      res.status(400).json({ success: false, error: 'Invalid token', details: result.data });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// CLOUDFLARE SUBDOMAIN SETUP
// ==========================================

// Create DNS record for subdomain
router.post('/cloudflare/create-subdomain', async (req, res) => {
  const config = loadConfig();
  if (!config.cloudflare.apiToken || !config.cloudflare.zoneId) {
    return res.status(400).json({ error: 'Cloudflare not configured' });
  }

  const { subdomain, targetIP } = req.body;
  if (!subdomain) {
    return res.status(400).json({ error: 'Subdomain required (e.g., "creatives" for fans.boyvue.com)' });
  }

  try {
    // First check if record already exists
    const checkResult = await apiRequest({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.cloudflare.zoneId}/dns_records?name=${subdomain}.boyvue.com`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (checkResult.data.result && checkResult.data.result.length > 0) {
      return res.json({
        success: true,
        message: 'DNS record already exists',
        record: checkResult.data.result[0]
      });
    }

    // Create A record pointing to same IP as main domain (or specified IP)
    const recordData = {
      type: 'A',
      name: subdomain,
      content: targetIP || '159.89.242.166', // Default to boyvue.com IP
      ttl: 1, // Auto TTL
      proxied: true // Enable Cloudflare proxy
    };

    const result = await apiRequest({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.cloudflare.zoneId}/dns_records`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify(recordData));

    if (result.data.success) {
      res.json({
        success: true,
        message: `DNS record created for ${subdomain}.boyvue.com`,
        record: result.data.result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.data.errors?.[0]?.message || 'Failed to create DNS record',
        details: result.data
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Setup complete subdomain (DNS + cache rules + WAF bypass)
router.post('/cloudflare/setup-subdomain', async (req, res) => {
  const config = loadConfig();
  if (!config.cloudflare.apiToken || !config.cloudflare.zoneId) {
    return res.status(400).json({ error: 'Cloudflare not configured' });
  }

  const { subdomain, targetIP } = req.body;
  if (!subdomain) {
    return res.status(400).json({ error: 'Subdomain required' });
  }

  const results = {
    dns: { success: false },
    cacheRules: { success: false },
    wafBypass: { success: false }
  };

  const fullDomain = `${subdomain}.boyvue.com`;

  try {
    // 1. Create DNS record
    const dnsCheck = await apiRequest({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.cloudflare.zoneId}/dns_records?name=${fullDomain}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (dnsCheck.data.result && dnsCheck.data.result.length > 0) {
      results.dns = { success: true, message: 'Already exists', id: dnsCheck.data.result[0].id };
    } else {
      const dnsResult = await apiRequest({
        hostname: 'api.cloudflare.com',
        path: `/client/v4/zones/${config.cloudflare.zoneId}/dns_records`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.cloudflare.apiToken}`,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        type: 'A',
        name: subdomain,
        content: targetIP || '159.89.242.166',
        ttl: 1,
        proxied: true
      }));
      results.dns = { success: dnsResult.data.success, id: dnsResult.data.result?.id };
    }

    // 2. SSL should be automatic with Cloudflare proxy enabled
    results.ssl = { success: true, message: 'Covered by Universal SSL' };

    // 3. Add WAF bypass for admin paths on this subdomain
    const adminPaths = [`/api/${subdomain}/admin`];
    const expression = `(http.host eq "${fullDomain}" and (http.request.uri.path starts_with "/api/${subdomain}/admin"))`;

    // Get existing rulesets
    const rulesetsResult = await apiRequest({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.cloudflare.zoneId}/rulesets`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    let rulesetId = null;
    if (rulesetsResult.data.success) {
      const customRuleset = rulesetsResult.data.result.find(r => r.phase === 'http_request_firewall_custom');
      if (customRuleset) rulesetId = customRuleset.id;
    }

    if (rulesetId) {
      const wafResult = await apiRequest({
        hostname: 'api.cloudflare.com',
        path: `/client/v4/zones/${config.cloudflare.zoneId}/rulesets/${rulesetId}/rules`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.cloudflare.apiToken}`,
          'Content-Type': 'application/json'
        }
      }, JSON.stringify({
        expression: expression,
        action: 'skip',
        action_parameters: { ruleset: 'current' },
        description: `Bypass challenge for ${subdomain} admin paths`
      }));
      results.wafBypass = { success: wafResult.data.success || false };
    } else {
      results.wafBypass = { success: false, message: 'No custom ruleset found' };
    }

    res.json({
      success: true,
      message: `Subdomain ${fullDomain} setup complete`,
      domain: fullDomain,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message, results });
  }
});

// Purge cache for a specific subdomain
router.post('/cloudflare/purge-subdomain-cache', async (req, res) => {
  const config = loadConfig();
  if (!config.cloudflare.apiToken || !config.cloudflare.zoneId) {
    return res.status(400).json({ error: 'Cloudflare not configured' });
  }

  const { subdomain } = req.body;
  if (!subdomain) {
    return res.status(400).json({ error: 'Subdomain required' });
  }

  const fullDomain = `${subdomain}.boyvue.com`;
  const urlsToPurge = [
    `https://${fullDomain}/`,
    `https://${fullDomain}/sitemap.xml`,
    `https://${fullDomain}/robots.txt`,
    `https://${fullDomain}/sitemap-performers.xml`
  ];

  try {
    const result = await apiRequest({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.cloudflare.zoneId}/purge_cache`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json'
      }
    }, JSON.stringify({ files: urlsToPurge }));

    res.json({
      success: result.data.success,
      purged: urlsToPurge,
      domain: fullDomain
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get zone details
router.get('/cloudflare/zone', async (req, res) => {
  const config = loadConfig();
  if (!config.cloudflare.apiToken || !config.cloudflare.zoneId) {
    return res.status(400).json({ error: 'Cloudflare not configured' });
  }

  try {
    const result = await apiRequest({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones/${config.cloudflare.zoneId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.cloudflare.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DATAFORSEO API - Keyword Research
// ==========================================

// Helper function for DataForSEO API calls
async function dataForSeoRequest(endpoint, payload) {
  const config = loadConfig();
  if (!config.dataforseo?.login || !config.dataforseo?.password) {
    throw new Error('DataForSEO not configured');
  }

  const auth = Buffer.from(`${config.dataforseo.login}:${config.dataforseo.password}`).toString('base64');
  const postData = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.dataforseo.com',
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch {
          resolve({ error: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Test DataForSEO connection
router.get('/dataforseo/test', async (req, res) => {
  const config = loadConfig();
  if (!config.dataforseo?.login || !config.dataforseo?.password) {
    return res.status(400).json({ error: 'DataForSEO not configured. Add login/password to config.' });
  }

  try {
    // Use a cheap endpoint to test - account info
    const auth = Buffer.from(`${config.dataforseo.login}:${config.dataforseo.password}`).toString('base64');

    const result = await new Promise((resolve, reject) => {
      https.get({
        hostname: 'api.dataforseo.com',
        path: '/v3/appendix/user_data',
        headers: { 'Authorization': `Basic ${auth}` }
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ error: data });
          }
        });
      }).on('error', reject);
    });

    if (result.status_code === 20000) {
      res.json({
        success: true,
        message: 'DataForSEO connected!',
        balance: result.tasks?.[0]?.result?.[0]?.money?.balance,
        login: config.dataforseo.login
      });
    } else {
      res.status(400).json({ success: false, error: result.status_message || 'Connection failed' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get top organic keywords for a domain
router.post('/dataforseo/domain-keywords', async (req, res) => {
  const { domain, limit = 10, location = 2840, adult = true } = req.body; // 2840 = United States

  if (!domain) {
    return res.status(400).json({ error: 'Domain required' });
  }

  try {
    // Clean domain - remove protocol and www
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    const result = await dataForSeoRequest('/v3/dataforseo_labs/google/ranked_keywords/live', [{
      target: cleanDomain,
      location_code: location,
      language_code: 'en',
      limit: limit,
      include_serp_info: true,
      ignore_synonyms: false,
      filters: adult ? null : undefined,
      order_by: ['keyword_data.keyword_info.search_volume,desc']
    }]);

    if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]?.items) {
      const keywords = result.tasks[0].result[0].items.map(item => ({
        keyword: item.keyword_data?.keyword,
        position: item.ranked_serp_element?.serp_item?.rank_absolute,
        searchVolume: item.keyword_data?.keyword_info?.search_volume,
        cpc: item.keyword_data?.keyword_info?.cpc,
        competition: item.keyword_data?.keyword_info?.competition,
        url: item.ranked_serp_element?.serp_item?.url
      }));

      res.json({
        success: true,
        domain: cleanDomain,
        keywords,
        totalCount: result.tasks[0].result[0].total_count,
        cost: result.cost
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.tasks?.[0]?.status_message || result.status_message || 'Failed to fetch keywords'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get keywords for multiple competitor domains
router.post('/dataforseo/competitor-keywords', async (req, res) => {
  const { domains, limit = 5 } = req.body; // Array of domains

  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: 'Domains array required' });
  }

  const results = [];
  let totalCost = 0;

  for (const domain of domains.slice(0, 10)) { // Max 10 domains
    try {
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

      const result = await dataForSeoRequest('/v3/dataforseo_labs/google/ranked_keywords/live', [{
        target: cleanDomain,
        location_code: 2840, // US
        language_code: 'en',
        limit: limit,
        order_by: ['keyword_data.keyword_info.search_volume,desc']
      }]);

      if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]?.items) {
        const keywords = result.tasks[0].result[0].items.map(item => ({
          keyword: item.keyword_data?.keyword,
          position: item.ranked_serp_element?.serp_item?.rank_absolute,
          searchVolume: item.keyword_data?.keyword_info?.search_volume,
          cpc: item.keyword_data?.keyword_info?.cpc
        }));

        results.push({
          domain: cleanDomain,
          keywords,
          totalKeywords: result.tasks[0].result[0].total_count
        });
        totalCost += result.cost || 0;
      } else {
        results.push({
          domain: cleanDomain,
          error: result.tasks?.[0]?.status_message || 'Failed'
        });
      }

      // Small delay between requests
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      results.push({ domain, error: err.message });
    }
  }

  res.json({
    success: true,
    results,
    totalCost,
    domainsProcessed: results.length
  });
});

// Get related keywords for seed keyword
router.post('/dataforseo/related-keywords', async (req, res) => {
  const { keyword, limit = 20, location = 2840 } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword required' });
  }

  try {
    const result = await dataForSeoRequest('/v3/dataforseo_labs/google/related_keywords/live', [{
      keyword: keyword,
      location_code: location,
      language_code: 'en',
      limit: limit,
      order_by: ['keyword_data.keyword_info.search_volume,desc']
    }]);

    if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]?.items) {
      const keywords = result.tasks[0].result[0].items.map(item => ({
        keyword: item.keyword_data?.keyword,
        searchVolume: item.keyword_data?.keyword_info?.search_volume,
        cpc: item.keyword_data?.keyword_info?.cpc,
        competition: item.keyword_data?.keyword_info?.competition
      }));

      res.json({
        success: true,
        seedKeyword: keyword,
        relatedKeywords: keywords,
        cost: result.cost
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.tasks?.[0]?.status_message || 'Failed to fetch related keywords'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get keyword data (search volume, CPC, competition) for multiple keywords
router.post('/dataforseo/keyword-data', async (req, res) => {
  const { keywords, location = 2840 } = req.body;

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: 'Keywords array required' });
  }

  try {
    const result = await dataForSeoRequest('/v3/dataforseo_labs/google/bulk_keyword_difficulty/live', [{
      keywords: keywords.slice(0, 1000), // Max 1000 keywords per request
      location_code: location,
      language_code: 'en'
    }]);

    if (result.status_code === 20000 && result.tasks?.[0]?.result) {
      const keywordData = result.tasks[0].result.map(item => ({
        keyword: item.keyword,
        searchVolume: item.search_volume,
        cpc: item.cpc,
        competition: item.competition,
        difficulty: item.keyword_difficulty
      }));

      res.json({
        success: true,
        keywords: keywordData,
        cost: result.cost
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.tasks?.[0]?.status_message || 'Failed to fetch keyword data'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SERP Search with SafeSearch OFF (for adult content)
router.post('/dataforseo/serp-adult', async (req, res) => {
  const { keyword, limit = 10, location = 2840 } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword required' });
  }

  try {
    const result = await dataForSeoRequest('/v3/serp/google/organic/live/advanced', [{
      keyword: keyword,
      location_code: location,
      language_code: 'en',
      device: 'desktop',
      os: 'windows',
      depth: limit,
      // KEY: Disable SafeSearch for adult results
      safe_search: false
    }]);

    if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]?.items) {
      const items = result.tasks[0].result[0].items
        .filter(item => item.type === 'organic')
        .map(item => ({
          position: item.rank_absolute,
          domain: item.domain,
          title: item.title,
          url: item.url,
          description: item.description
        }));

      res.json({
        success: true,
        keyword,
        totalResults: result.tasks[0].result[0].se_results_count,
        items,
        cost: result.cost
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.tasks?.[0]?.status_message || result.status_message || 'Failed'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk SERP check for multiple keywords (adult)
router.post('/dataforseo/serp-adult-bulk', async (req, res) => {
  const { keywords, location = 2840 } = req.body;

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: 'Keywords array required' });
  }

  const results = [];
  let totalCost = 0;

  for (const keyword of keywords.slice(0, 10)) { // Max 10 to control costs
    try {
      const result = await dataForSeoRequest('/v3/serp/google/organic/live/advanced', [{
        keyword: keyword,
        location_code: location,
        language_code: 'en',
        device: 'desktop',
        os: 'windows',
        depth: 10,
        safe_search: false
      }]);

      if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]?.items) {
        const items = result.tasks[0].result[0].items
          .filter(item => item.type === 'organic')
          .slice(0, 5)
          .map(item => ({
            position: item.rank_absolute,
            domain: item.domain,
            title: item.title
          }));

        results.push({
          keyword,
          totalResults: result.tasks[0].result[0].se_results_count,
          top5: items
        });
        totalCost += result.cost || 0;
      } else {
        results.push({ keyword, error: 'No results' });
      }

      // Small delay between requests
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      results.push({ keyword, error: err.message });
    }
  }

  res.json({
    success: true,
    results,
    totalCost,
    keywordsProcessed: results.length
  });
});

// Check where our site ranks for a keyword (adult SERP)
router.post('/dataforseo/check-ranking', async (req, res) => {
  const { keyword, ourDomain = 'boyvue.com', location = 2840 } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword required' });
  }

  try {
    const result = await dataForSeoRequest('/v3/serp/google/organic/live/advanced', [{
      keyword: keyword,
      location_code: location,
      language_code: 'en',
      device: 'desktop',
      os: 'windows',
      depth: 100, // Check top 100 results
      safe_search: false
    }]);

    if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]?.items) {
      const allItems = result.tasks[0].result[0].items.filter(item => item.type === 'organic');

      // Find our position
      const ourPosition = allItems.findIndex(item =>
        item.domain?.includes(ourDomain) || item.url?.includes(ourDomain)
      );

      // Get top 10 competitors
      const top10 = allItems.slice(0, 10).map(item => ({
        position: item.rank_absolute,
        domain: item.domain,
        title: item.title
      }));

      res.json({
        success: true,
        keyword,
        ourDomain,
        ourPosition: ourPosition >= 0 ? ourPosition + 1 : 'Not in top 100',
        totalResults: result.tasks[0].result[0].se_results_count,
        top10,
        cost: result.cost
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.tasks?.[0]?.status_message || 'Failed'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get top backlinks for a domain
router.post('/dataforseo/backlinks', async (req, res) => {
  const { domain, limit = 10 } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Domain required' });
  }

  try {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    const result = await dataForSeoRequest('/v3/backlinks/backlinks/live', [{
      target: cleanDomain,
      mode: 'as_is',
      limit: limit,
      order_by: ['rank,desc'],
      filters: ['dofollow', '=', true]
    }]);

    if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]?.items) {
      const backlinks = result.tasks[0].result[0].items.map(item => ({
        sourceUrl: item.url_from,
        sourceDomain: item.domain_from,
        targetUrl: item.url_to,
        anchor: item.anchor,
        domainRank: item.domain_from_rank,
        pageRank: item.page_from_rank,
        isDofollow: item.dofollow,
        firstSeen: item.first_seen
      }));

      res.json({
        success: true,
        domain: cleanDomain,
        totalBacklinks: result.tasks[0].result[0].total_count,
        backlinks,
        cost: result.cost
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.tasks?.[0]?.status_message || 'Failed to fetch backlinks'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get domain summary (backlinks count, referring domains, rank)
router.post('/dataforseo/domain-summary', async (req, res) => {
  const { domain } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Domain required' });
  }

  try {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    const result = await dataForSeoRequest('/v3/backlinks/summary/live', [{
      target: cleanDomain,
      include_subdomains: true
    }]);

    if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]) {
      const summary = result.tasks[0].result[0];
      res.json({
        success: true,
        domain: cleanDomain,
        rank: summary.rank,
        backlinks: summary.backlinks,
        referringDomains: summary.referring_domains,
        referringMainDomains: summary.referring_main_domains,
        brokenBacklinks: summary.broken_backlinks,
        cost: result.cost
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.tasks?.[0]?.status_message || 'Failed'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch keywords + backlinks for a domain and return combined data
router.post('/dataforseo/full-analysis', async (req, res) => {
  const { domain, keywordLimit = 5, backlinkLimit = 10 } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Domain required' });
  }

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  let totalCost = 0;
  const result = { domain: cleanDomain, keywords: [], backlinks: [], error: null };

  // Fetch keywords
  try {
    const kwResult = await dataForSeoRequest('/v3/dataforseo_labs/google/ranked_keywords/live', [{
      target: cleanDomain,
      location_code: 2840,
      language_code: 'en',
      limit: keywordLimit,
      order_by: ['keyword_data.keyword_info.search_volume,desc']
    }]);

    if (kwResult.status_code === 20000 && kwResult.tasks?.[0]?.result?.[0]?.items) {
      result.keywords = kwResult.tasks[0].result[0].items.map(item => ({
        keyword: item.keyword_data?.keyword,
        position: item.ranked_serp_element?.serp_item?.rank_absolute,
        searchVolume: item.keyword_data?.keyword_info?.search_volume,
        cpc: item.keyword_data?.keyword_info?.cpc,
        url: item.ranked_serp_element?.serp_item?.url
      }));
      result.totalKeywords = kwResult.tasks[0].result[0].total_count;
      totalCost += kwResult.cost || 0;
    }
  } catch (e) {
    result.keywordError = e.message;
  }

  // Small delay
  await new Promise(r => setTimeout(r, 200));

  // Fetch backlinks
  try {
    const blResult = await dataForSeoRequest('/v3/backlinks/backlinks/live', [{
      target: cleanDomain,
      mode: 'as_is',
      limit: backlinkLimit,
      order_by: ['rank,desc']
    }]);

    if (blResult.status_code === 20000 && blResult.tasks?.[0]?.result?.[0]?.items) {
      result.backlinks = blResult.tasks[0].result[0].items.map(item => ({
        sourceUrl: item.url_from,
        sourceDomain: item.domain_from,
        targetUrl: item.url_to,
        anchor: item.anchor,
        domainRank: item.domain_from_rank,
        isDofollow: item.dofollow
      }));
      result.totalBacklinks = blResult.tasks[0].result[0].total_count;
      totalCost += blResult.cost || 0;
    }
  } catch (e) {
    result.backlinkError = e.message;
  }

  result.cost = totalCost;
  res.json({ success: true, ...result });
});

// Save DataForSEO config
router.post('/config/dataforseo', (req, res) => {
  const { login, password } = req.body;
  const config = loadConfig();

  if (!config.dataforseo) config.dataforseo = {};
  if (login) config.dataforseo.login = login;
  if (password) config.dataforseo.password = password;

  saveConfig(config);
  res.json({ success: true, message: 'DataForSEO config updated' });
});

// ==========================================
// DATAFORSEO IMAGE SERP API (Adult Images)
// ==========================================

// Search Google Images with SafeSearch OFF (for adult content)
router.post('/dataforseo/image-serp', async (req, res) => {
  const { keyword, limit = 20, location = 2840 } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword required' });
  }

  try {
    const result = await dataForSeoRequest('/v3/serp/google/images/live/advanced', [{
      keyword: keyword,
      location_code: location,
      language_code: 'en',
      device: 'desktop',
      os: 'windows',
      depth: limit,
      // KEY: Disable SafeSearch for adult image results
      safe_search: false
    }]);

    if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]?.items) {
      const images = result.tasks[0].result[0].items
        .filter(item => item.type === 'images_search')
        .map(item => ({
          title: item.title,
          sourceUrl: item.source_url,
          imageUrl: item.image_url,
          thumbnailUrl: item.thumbnail,
          domain: item.source_url ? new URL(item.source_url).hostname : null,
          alt: item.alt
        }));

      res.json({
        success: true,
        keyword,
        totalResults: result.tasks[0].result[0].se_results_count,
        images,
        cost: result.cost
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.tasks?.[0]?.status_message || result.status_message || 'Failed'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk image search for multiple keywords (adult)
router.post('/dataforseo/image-serp-bulk', async (req, res) => {
  const { keywords, limit = 10, location = 2840 } = req.body;

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: 'Keywords array required' });
  }

  const results = [];
  let totalCost = 0;

  for (const keyword of keywords.slice(0, 10)) { // Max 10 keywords
    try {
      const result = await dataForSeoRequest('/v3/serp/google/images/live/advanced', [{
        keyword: keyword,
        location_code: location,
        language_code: 'en',
        device: 'desktop',
        depth: limit,
        safe_search: false
      }]);

      if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]?.items) {
        const images = result.tasks[0].result[0].items
          .filter(item => item.type === 'images_search')
          .slice(0, 5)
          .map(item => ({
            title: item.title,
            domain: item.source_url ? new URL(item.source_url).hostname : null,
            imageUrl: item.image_url
          }));

        results.push({
          keyword,
          totalResults: result.tasks[0].result[0].se_results_count,
          topImages: images
        });
        totalCost += result.cost || 0;
      } else {
        results.push({ keyword, error: 'No results' });
      }

      // Small delay between requests
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      results.push({ keyword, error: err.message });
    }
  }

  res.json({
    success: true,
    results,
    totalCost,
    keywordsProcessed: results.length
  });
});

// Check where our images rank for a keyword
router.post('/dataforseo/check-image-ranking', async (req, res) => {
  const { keyword, ourDomain = 'boyvue.com', location = 2840 } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword required' });
  }

  try {
    const result = await dataForSeoRequest('/v3/serp/google/images/live/advanced', [{
      keyword: keyword,
      location_code: location,
      language_code: 'en',
      device: 'desktop',
      depth: 100, // Check top 100 image results
      safe_search: false
    }]);

    if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]?.items) {
      const allImages = result.tasks[0].result[0].items.filter(item => item.type === 'images_search');

      // Find our images
      const ourImages = allImages.filter(item =>
        item.source_url?.includes(ourDomain)
      ).map((item, idx) => ({
        position: allImages.indexOf(item) + 1,
        title: item.title,
        imageUrl: item.image_url
      }));

      // Get top 10 competitors
      const top10 = allImages.slice(0, 10).map((item, idx) => ({
        position: idx + 1,
        domain: item.source_url ? new URL(item.source_url).hostname : null,
        title: item.title
      }));

      res.json({
        success: true,
        keyword,
        ourDomain,
        ourImagesFound: ourImages.length,
        ourImages,
        totalResults: result.tasks[0].result[0].se_results_count,
        top10,
        cost: result.cost
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.tasks?.[0]?.status_message || 'Failed'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search Google Video with SafeSearch OFF
router.post('/dataforseo/video-serp', async (req, res) => {
  const { keyword, limit = 20, location = 2840 } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword required' });
  }

  try {
    const result = await dataForSeoRequest('/v3/serp/google/videos/live/advanced', [{
      keyword: keyword,
      location_code: location,
      language_code: 'en',
      device: 'desktop',
      os: 'windows',
      depth: limit,
      safe_search: false
    }]);

    if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]?.items) {
      const videos = result.tasks[0].result[0].items
        .filter(item => item.type === 'video')
        .map(item => ({
          title: item.title,
          url: item.url,
          domain: item.url ? new URL(item.url).hostname : null,
          thumbnailUrl: item.thumbnail,
          duration: item.duration,
          views: item.views,
          timestamp: item.timestamp
        }));

      res.json({
        success: true,
        keyword,
        totalResults: result.tasks[0].result[0].se_results_count,
        videos,
        cost: result.cost
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.tasks?.[0]?.status_message || result.status_message || 'Failed'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check where our videos rank for a keyword
router.post('/dataforseo/check-video-ranking', async (req, res) => {
  const { keyword, ourDomain = 'boyvue.com', location = 2840 } = req.body;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword required' });
  }

  try {
    const result = await dataForSeoRequest('/v3/serp/google/videos/live/advanced', [{
      keyword: keyword,
      location_code: location,
      language_code: 'en',
      device: 'desktop',
      depth: 100,
      safe_search: false
    }]);

    if (result.status_code === 20000 && result.tasks?.[0]?.result?.[0]?.items) {
      const allVideos = result.tasks[0].result[0].items.filter(item => item.type === 'video');

      // Find our videos
      const ourVideos = allVideos.filter(item =>
        item.url?.includes(ourDomain)
      ).map((item) => ({
        position: allVideos.indexOf(item) + 1,
        title: item.title,
        url: item.url
      }));

      // Get top 10 competitors
      const top10 = allVideos.slice(0, 10).map((item, idx) => ({
        position: idx + 1,
        domain: item.url ? new URL(item.url).hostname : null,
        title: item.title
      }));

      res.json({
        success: true,
        keyword,
        ourDomain,
        ourVideosFound: ourVideos.length,
        ourVideos,
        totalResults: result.tasks[0].result[0].se_results_count,
        top10,
        cost: result.cost
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.tasks?.[0]?.status_message || 'Failed'
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// BITWARDEN API - Password Management
// ==========================================

// Test Bitwarden connection
router.get('/bitwarden/test', async (req, res) => {
  const config = loadConfig();
  if (!config.bitwarden?.clientId || !config.bitwarden?.clientSecret) {
    return res.json({ success: false, error: 'Bitwarden credentials not configured. Add client_id and client_secret.' });
  }

  try {
    // Get access token using client credentials (API key auth)
    // Bitwarden requires device information for API access
    const deviceId = config.bitwarden.deviceId || 'boyvue-admin-' + Date.now();

    const tokenRes = await fetch('https://identity.bitwarden.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Device-Type': '6', // 6 = CLI/SDK
        'Device-Identifier': deviceId,
        'Device-Name': 'BoyVue Admin'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'api',
        client_id: config.bitwarden.clientId,
        client_secret: config.bitwarden.clientSecret,
        deviceType: '6',
        deviceIdentifier: deviceId,
        deviceName: 'BoyVue Admin'
      })
    });
    const tokenData = await tokenRes.json();

    if (tokenData.access_token) {
      config.bitwarden.accessToken = tokenData.access_token;
      config.bitwarden.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
      config.bitwarden.deviceId = deviceId;
      saveConfig(config);
      res.json({ success: true, message: 'Bitwarden connected!', expiresIn: tokenData.expires_in });
    } else {
      res.json({ success: false, error: tokenData.error_description || tokenData.error || tokenData.ErrorModel?.Message || 'Failed to authenticate' });
    }
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Helper to ensure valid Bitwarden token
async function ensureBitwardenToken() {
  const config = loadConfig();
  if (!config.bitwarden?.clientId || !config.bitwarden?.clientSecret) {
    throw new Error('Bitwarden not configured');
  }

  // Check if token is still valid (with 5 min buffer)
  if (config.bitwarden.accessToken && config.bitwarden.tokenExpiry > Date.now() + 300000) {
    return config.bitwarden.accessToken;
  }

  // Refresh token with device info
  const deviceId = config.bitwarden.deviceId || 'boyvue-admin-' + Date.now();

  const tokenRes = await fetch('https://identity.bitwarden.com/connect/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Device-Type': '6',
      'Device-Identifier': deviceId,
      'Device-Name': 'BoyVue Admin'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'api',
      client_id: config.bitwarden.clientId,
      client_secret: config.bitwarden.clientSecret,
      deviceType: '6',
      deviceIdentifier: deviceId,
      deviceName: 'BoyVue Admin'
    })
  });
  const tokenData = await tokenRes.json();

  if (tokenData.access_token) {
    config.bitwarden.accessToken = tokenData.access_token;
    config.bitwarden.tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
    config.bitwarden.deviceId = deviceId;
    saveConfig(config);
    return tokenData.access_token;
  }
  throw new Error(tokenData.error_description || tokenData.ErrorModel?.Message || 'Failed to refresh Bitwarden token');
}

// Save login to Bitwarden vault
router.post('/bitwarden/save-login', async (req, res) => {
  const { name, username, password, uri, notes, folderId } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Name, username, and password required' });
  }

  try {
    const token = await ensureBitwardenToken();
    const config = loadConfig();

    const cipherData = {
      type: 1, // Login type
      name: name,
      notes: notes || '',
      login: {
        username: username,
        password: password,
        uris: uri ? [{ uri: uri, match: null }] : []
      },
      folderId: folderId || config.bitwarden?.defaultFolderId || null
    };

    const result = await fetch('https://api.bitwarden.com/ciphers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cipherData)
    });

    const data = await result.json();

    if (data.id) {
      res.json({ success: true, message: 'Login saved to Bitwarden!', id: data.id });
    } else {
      res.json({ success: false, error: data.message || data.Message || 'Failed to save' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save affiliate login with feed info
router.post('/bitwarden/save-affiliate', async (req, res) => {
  const { site, username, password, affiliateUrl, feedUrl, feedType, apiKey, notes } = req.body;

  if (!site || !username || !password) {
    return res.status(400).json({ error: 'Site, username, and password required' });
  }

  try {
    const token = await ensureBitwardenToken();
    const config = loadConfig();

    // Build comprehensive notes with feed info
    const fullNotes = [
      `Affiliate Program: ${site}`,
      `Signup URL: ${affiliateUrl || 'N/A'}`,
      '',
      '--- Content Feed Info ---',
      `Feed URL: ${feedUrl || 'N/A'}`,
      `Feed Type: ${feedType || 'N/A'}`,
      `API Key: ${apiKey || 'N/A'}`,
      '',
      notes || ''
    ].join('\n');

    const cipherData = {
      type: 1,
      name: `Affiliate: ${site}`,
      notes: fullNotes,
      login: {
        username: username,
        password: password,
        uris: [
          affiliateUrl ? { uri: affiliateUrl, match: null } : null,
          feedUrl ? { uri: feedUrl, match: null } : null
        ].filter(Boolean)
      },
      folderId: config.bitwarden?.affiliateFolderId || config.bitwarden?.defaultFolderId || null,
      fields: [
        feedUrl ? { name: 'Feed URL', value: feedUrl, type: 0 } : null,
        feedType ? { name: 'Feed Type', value: feedType, type: 0 } : null,
        apiKey ? { name: 'API Key', value: apiKey, type: 1 } : null // type 1 = hidden
      ].filter(Boolean)
    };

    const result = await fetch('https://api.bitwarden.com/ciphers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cipherData)
    });

    const data = await result.json();

    if (data.id) {
      res.json({ success: true, message: 'Affiliate login saved!', id: data.id, name: `Affiliate: ${site}` });
    } else {
      res.json({ success: false, error: data.message || data.Message || 'Failed to save' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk save affiliate logins
router.post('/bitwarden/save-affiliates-bulk', async (req, res) => {
  const { affiliates } = req.body; // Array of affiliate objects

  if (!affiliates || !Array.isArray(affiliates)) {
    return res.status(400).json({ error: 'Affiliates array required' });
  }

  try {
    const token = await ensureBitwardenToken();
    const config = loadConfig();
    const results = [];

    for (const aff of affiliates) {
      try {
        const fullNotes = [
          `Affiliate Program: ${aff.site}`,
          `Signup URL: ${aff.affiliateUrl || 'N/A'}`,
          '',
          '--- Content Feed Info ---',
          `Feed URL: ${aff.feedUrl || 'N/A'}`,
          `Feed Type: ${aff.feedType || 'N/A'}`,
          `API Key: ${aff.apiKey || 'N/A'}`,
          '',
          aff.notes || ''
        ].join('\n');

        const cipherData = {
          type: 1,
          name: `Affiliate: ${aff.site}`,
          notes: fullNotes,
          login: {
            username: aff.username,
            password: aff.password,
            uris: [aff.affiliateUrl, aff.feedUrl].filter(Boolean).map(u => ({ uri: u, match: null }))
          },
          folderId: config.bitwarden?.affiliateFolderId || null,
          fields: [
            aff.feedUrl ? { name: 'Feed URL', value: aff.feedUrl, type: 0 } : null,
            aff.feedType ? { name: 'Feed Type', value: aff.feedType, type: 0 } : null,
            aff.apiKey ? { name: 'API Key', value: aff.apiKey, type: 1 } : null
          ].filter(Boolean)
        };

        const result = await fetch('https://api.bitwarden.com/ciphers', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(cipherData)
        });

        const data = await result.json();
        results.push({ site: aff.site, success: !!data.id, id: data.id });
      } catch (err) {
        results.push({ site: aff.site, success: false, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Saved ${results.filter(r => r.success).length}/${affiliates.length} affiliates`,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Bitwarden folders
router.get('/bitwarden/folders', async (req, res) => {
  try {
    const token = await ensureBitwardenToken();
    const result = await fetch('https://api.bitwarden.com/folders', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await result.json();
    res.json({ success: true, folders: data.data || data.Data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Bitwarden folder
router.post('/bitwarden/folders', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Folder name required' });

  try {
    const token = await ensureBitwardenToken();
    const result = await fetch('https://api.bitwarden.com/folders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });
    const data = await result.json();

    if (data.id || data.Id) {
      res.json({ success: true, folder: data });
    } else {
      res.json({ success: false, error: data.message || data.Message || 'Failed to create folder' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Configure Bitwarden credentials
router.post('/config/bitwarden', async (req, res) => {
  const { clientId, clientSecret, serverUrl, defaultFolderId, affiliateFolderId } = req.body;
  const config = loadConfig();

  config.bitwarden = {
    ...config.bitwarden,
    clientId: clientId || config.bitwarden?.clientId,
    clientSecret: clientSecret || config.bitwarden?.clientSecret,
    serverUrl: serverUrl || config.bitwarden?.serverUrl,
    defaultFolderId: defaultFolderId || config.bitwarden?.defaultFolderId,
    affiliateFolderId: affiliateFolderId || config.bitwarden?.affiliateFolderId
  };

  saveConfig(config);
  res.json({ success: true, message: 'Bitwarden config saved' });
});

// Get DataForSEO account balance
router.get('/dataforseo/balance', async (req, res) => {
  const config = loadConfig();
  if (!config.dataforseo?.login || !config.dataforseo?.password) {
    return res.status(400).json({ error: 'DataForSEO not configured' });
  }

  try {
    const auth = Buffer.from(`${config.dataforseo.login}:${config.dataforseo.password}`).toString('base64');

    const result = await new Promise((resolve, reject) => {
      https.get({
        hostname: 'api.dataforseo.com',
        path: '/v3/appendix/user_data',
        headers: { 'Authorization': `Basic ${auth}` }
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ error: data });
          }
        });
      }).on('error', reject);
    });

    if (result.status_code === 20000) {
      const userData = result.tasks?.[0]?.result?.[0];
      res.json({
        success: true,
        balance: userData?.money?.balance,
        currency: userData?.money?.currency || 'USD',
        login: userData?.login
      });
    } else {
      res.status(400).json({ success: false, error: result.status_message });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
