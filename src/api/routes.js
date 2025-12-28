import express from 'express';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import https from 'https';
import { getTranslations, getTranslationsByCategory, getLanguages, getUITranslations, t } from '../services/translation-service.js';

const { Pool } = pg;
const router = express.Router();

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// Translation cache (in-memory + database)
const translationCache = new Map();

// Google Translate (free method)
async function translateText(text, targetLang) {
  if (!text || targetLang === 'en') return text;
  
  const cacheKey = `${text}:${targetLang}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }
  
  // Check database cache
  try {
    const cached = await pool.query(
      'SELECT translated_text FROM translations_cache WHERE original_text = $1 AND target_lang = $2',
      [text.substring(0, 500), targetLang]
    );
    if (cached.rows.length > 0) {
      translationCache.set(cacheKey, cached.rows[0].translated_text);
      return cached.rows[0].translated_text;
    }
  } catch(e) {}
  
  return new Promise((resolve) => {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodedText}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const result = JSON.parse(data);
          const translated = result[0].map(x => x[0]).join('');
          translationCache.set(cacheKey, translated);
          
          // Save to database
          await pool.query(
            'INSERT INTO translations_cache (original_text, translated_text, target_lang) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [text.substring(0, 500), translated.substring(0, 1000), targetLang]
          );
          
          resolve(translated);
        } catch(e) {
          resolve(text);
        }
      });
    }).on('error', () => resolve(text));
    
    setTimeout(() => resolve(text), 3000);
  });
}

// Translate multiple texts
async function translateBatch(texts, targetLang) {
  if (targetLang === 'en') return texts;
  return Promise.all(texts.map(t => translateText(t, targetLang)));
}

// Learn keywords from search terms
async function learnKeywords(imageId, searchQuery, source = 'search_engine') {
  if (!imageId || !searchQuery) return;
  
  // Extract keywords from search query
  const keywords = searchQuery.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  for (const keyword of keywords) {
    try {
      await pool.query(`
        INSERT INTO image_keywords (image_id, keyword, source, weight)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (image_id, keyword, language) 
        DO UPDATE SET weight = image_keywords.weight + 1
      `, [imageId, keyword, source]);
    } catch(e) {}
  }
}

// Get enhanced keywords for an image
async function getImageKeywords(imageId) {
  try {
    const result = await pool.query(
      'SELECT keyword, weight FROM image_keywords WHERE image_id = $1 ORDER BY weight DESC LIMIT 20',
      [imageId]
    );
    return result.rows.map(r => r.keyword);
  } catch(e) {
    return [];
  }
}

// Country to language mapping
const countryToLang = {
  US: 'en', GB: 'en', AU: 'en', CA: 'en', NZ: 'en', IE: 'en',
  DE: 'de', AT: 'de', CH: 'de', RU: 'ru', BY: 'ru', KZ: 'ru', UA: 'ru',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es',
  CN: 'zh', TW: 'zh', HK: 'zh', SG: 'zh', JP: 'ja', TH: 'th', KR: 'ko',
  BR: 'pt', PT: 'pt', FR: 'fr', BE: 'fr', IT: 'it', NL: 'nl', PL: 'pl',
  CZ: 'cs', SK: 'cs', SA: 'ar', AE: 'ar', EG: 'ar', GR: 'el', TR: 'tr',
  VN: 'vi', ID: 'id', MY: 'id', HU: 'hu', PH: 'en', IN: 'en'
};

let geoip = null;
try { geoip = await import('geoip-lite'); } catch(e) {}

// Search engine patterns
const searchEngines = {
  'google': /google\.[a-z.]+\/(search|url)\?.*[?&](q|url)=([^&]+)/i,
  'bing': /bing\.com\/search\?.*q=([^&]+)/i,
  'yahoo': /search\.yahoo\.com\/search.*p=([^&]+)/i,
  'duckduckgo': /duckduckgo\.com\/\?.*q=([^&]+)/i,
  'yandex': /yandex\.[a-z]+\/search.*text=([^&]+)/i
};

const competitorDomains = [
  'pornhub.com', 'xvideos.com', 'xhamster.com', 'redtube.com',
  'xnxx.com', 'spankbang.com', 'gaymaletube.com', 'boyfriendtv.com',
  'gaytube.com', 'xtube.com', 'thisvid.com', 'reddit.com', 'twitter.com', 'x.com', 'tumblr.com'
];

function getGeoInfo(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress?.replace('::ffff:', '') || '';
  let country = 'XX';
  if (geoip?.default) {
    const geo = geoip.default.lookup(ip);
    if (geo) country = geo.country || 'XX';
  }
  return { ip, country };
}

function extractSearchQuery(referer) {
  for (const [engine, pattern] of Object.entries(searchEngines)) {
    const match = referer.match(pattern);
    if (match) {
      const queryPart = match[3] || match[1];
      try {
        return { engine, query: decodeURIComponent(queryPart.replace(/\+/g, ' ')) };
      } catch (e) {
        return { engine, query: queryPart.replace(/\+/g, ' ') };
      }
    }
  }
  return null;
}

function getDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return null;
  }
}

async function trackVisit(req, page, imageId = null) {
  try {
    const { ip, country } = getGeoInfo(req);
    const ua = req.headers['user-agent'] || '';
    const referer = req.headers['referer'] || '';
    
    await pool.query(
      'INSERT INTO analytics (ip, country, city, page, user_agent, referer) VALUES ($1, $2, $3, $4, $5, $6)',
      [ip, country, '', page, ua.substring(0, 500), referer.substring(0, 500)]
    );
    
    if (referer) {
      const searchInfo = extractSearchQuery(referer);
      if (searchInfo) {
        await pool.query(
          'INSERT INTO search_engine_referrals (engine, search_query, landing_page, ip, country) VALUES ($1, $2, $3, $4, $5)',
          [searchInfo.engine, searchInfo.query.substring(0, 500), page, ip, country]
        );
        
        // Learn keywords from search query for this image
        if (imageId) {
          learnKeywords(imageId, searchInfo.query, 'search_engine');
        }
        
        const hasContent = await pool.query(
          "SELECT COUNT(*) FROM image WHERE title ILIKE $1 OR description ILIKE $1",
          ['%' + searchInfo.query + '%']
        );
        
        await pool.query(
          `INSERT INTO content_demand (term, source, has_content, last_searched)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (term) DO UPDATE SET 
             search_count = content_demand.search_count + 1,
             has_content = $3,
             last_searched = NOW()`,
          [searchInfo.query.toLowerCase().substring(0, 255), searchInfo.engine, parseInt(hasContent.rows[0].count) > 0]
        );
      }
      
      const domain = getDomain(referer);
      if (domain && !domain.includes('boyvue.com')) {
        await pool.query(
          'INSERT INTO external_referrers (referrer_domain, referrer_url, landing_page, ip, country) VALUES ($1, $2, $3, $4, $5)',
          [domain, referer.substring(0, 1000), page, ip, country]
        );
      }
    }
  } catch(e) {}
}

async function logSearch(req, query, resultsCount) {
  try {
    const { ip, country } = getGeoInfo(req);
    await pool.query(
      'INSERT INTO search_logs (query, ip, country, results_count) VALUES ($1, $2, $3, $4)',
      [query.substring(0, 255), ip, country, resultsCount]
    );
  } catch(e) {}
}

// UI translations cache - fetched from DB
const uiTranslationsCache = new Map();
const UI_CACHE_TTL = 5 * 60 * 1000;

async function getUITranslationsForLang(lang) {
  const cacheKey = `ui:${lang}`;
  const cached = uiTranslationsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < UI_CACHE_TTL) {
    return cached.data;
  }
  const ui = await getTranslationsByCategory(lang, 'ui');
  uiTranslationsCache.set(cacheKey, { data: ui, timestamp: Date.now() });
  return ui;
}

// Detect language endpoint
router.get('/detect-language', async (req, res) => {
  const { ip, country } = getGeoInfo(req);
  const lang = countryToLang[country] || 'en';
  trackVisit(req, 'home');
  res.json({ lang, country, ip });
});

// Get UI translations from DB
router.get('/ui-translations/:lang', async (req, res) => {
  const lang = req.params.lang;
  try {
    const ui = await getUITranslationsForLang(lang);
    res.json(ui);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all translations for frontend
router.get('/translations/:lang', async (req, res) => {
  const lang = req.params.lang;
  try {
    const data = await getUITranslations(lang);
    if (!data) {
      return res.status(404).json({ error: 'Language not found' });
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all supported languages
router.get('/languages', async (req, res) => {
  try {
    const langs = await getLanguages();
    res.json(langs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Video thumbnails
router.get('/video-thumbs/:id', (req, res) => {
  const thumbDir = `/var/www/html/bp/data/video-thumbs/${req.params.id}`;
  const thumbs = [];
  if (fs.existsSync(thumbDir)) {
    for (let i = 0; i < 5; i++) {
      const thumbPath = path.join(thumbDir, `thumb_${i}.jpg`);
      if (fs.existsSync(thumbPath)) thumbs.push(`/media/video-thumbs/${req.params.id}/thumb_${i}.jpg`);
    }
  }
  res.json({ thumbs });
});

// Stats
router.get('/stats', async (req, res) => {
  try {
    const images = await pool.query('SELECT COUNT(*) FROM image');
    const categories = await pool.query('SELECT COUNT(*) FROM category WHERE photo_count > 0');
    const comments = await pool.query('SELECT COUNT(*) FROM comments');
    const users = await pool.query('SELECT COUNT(*) FROM users');
    res.json({
      images: parseInt(images.rows[0].count),
      categories: parseInt(categories.rows[0].count),
      comments: parseInt(comments.rows[0].count),
      users: parseInt(users.rows[0].count)
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Categories with translation
router.get('/categories', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const result = await pool.query(`
      SELECT id, catname, description, parent_category, photo_count
      FROM category WHERE photo_count > 0 ORDER BY photo_count DESC
    `);
    
    let categories = result.rows;
    
    // Translate category names if not English
    if (lang !== 'en') {
      const translatedNames = await translateBatch(categories.map(c => c.catname), lang);
      categories = categories.map((c, i) => ({ ...c, catname: translatedNames[i] }));
    }
    
    res.json({ categories });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/categories/:id', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    trackVisit(req, `category/${req.params.id}`);
    
    const cat = await pool.query('SELECT * FROM category WHERE id = $1', [req.params.id]);
    if (cat.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    const images = await pool.query(
      'SELECT id, title, description, local_path, thumbnail_path, width, height, view_count, average_rating FROM image WHERE belongs_to_gallery = $1 ORDER BY view_count DESC LIMIT 50',
      [req.params.id]
    );
    
    let category = cat.rows[0];
    let imageList = images.rows;
    
    // Translate if not English
    if (lang !== 'en') {
      category.catname = await translateText(category.catname, lang);
      if (category.description) {
        category.description = await translateText(category.description, lang);
      }
      
      // Translate image titles (batch for performance)
      const translatedTitles = await translateBatch(imageList.map(i => i.title || ''), lang);
      imageList = imageList.map((img, i) => ({ ...img, title: translatedTitles[i] || img.title }));
    }
    
    res.json({ category, images: imageList });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Media list with translation
router.get('/media', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    trackVisit(req, `gallery/page/${req.query.page || 1}`);
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const offset = (page - 1) * limit;
    const cat = req.query.category;

    let query = `SELECT i.id, i.title, i.description, i.local_path, i.thumbnail_path, i.width, i.height, 
                 i.view_count, i.average_rating, i.belongs_to_gallery, c.catname as category_name
                 FROM image i LEFT JOIN category c ON i.belongs_to_gallery = c.id`;
    let countQuery = 'SELECT COUNT(*) FROM image';
    let params = [];

    if (cat) {
      query += ' WHERE i.belongs_to_gallery = $1';
      countQuery += ' WHERE belongs_to_gallery = $1';
      params.push(cat);
    }

    query += ' ORDER BY i.view_count DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query(countQuery, cat ? [cat] : []);
    const total = parseInt(countResult.rows[0].count);
    
    let imageList = result.rows;
    
    // Translate if not English
    if (lang !== 'en') {
      const translatedTitles = await translateBatch(imageList.map(i => i.title || ''), lang);
      const translatedCategories = await translateBatch(imageList.map(i => i.category_name || ''), lang);
      imageList = imageList.map((img, i) => ({
        ...img,
        title: translatedTitles[i] || img.title,
        category_name: translatedCategories[i] || img.category_name
      }));
    }

    res.json({
      images: imageList,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Single media with translation and keywords
router.get('/media/:id', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const imageId = parseInt(req.params.id);
    
    trackVisit(req, `media/${imageId}`, imageId);
    
    const result = await pool.query(`
      SELECT i.*, c.catname as category_name FROM image i
      LEFT JOIN category c ON i.belongs_to_gallery = c.id WHERE i.id = $1
    `, [imageId]);
    
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    await pool.query('UPDATE image SET view_count = view_count + 1 WHERE id = $1', [imageId]);
    
    const related = await pool.query(
      'SELECT id, title, thumbnail_path, local_path, view_count FROM image WHERE belongs_to_gallery = $1 AND id != $2 ORDER BY view_count DESC LIMIT 8',
      [result.rows[0].belongs_to_gallery, imageId]
    );
    
    // Get learned keywords
    const keywords = await getImageKeywords(imageId);
    
    let image = result.rows[0];
    let relatedList = related.rows;
    
    // Translate if not English
    if (lang !== 'en') {
      image.title = await translateText(image.title, lang);
      image.description = await translateText(image.description, lang);
      image.category_name = await translateText(image.category_name, lang);
      
      const translatedRelated = await translateBatch(relatedList.map(r => r.title || ''), lang);
      relatedList = relatedList.map((r, i) => ({ ...r, title: translatedRelated[i] || r.title }));
    }
    
    const ui = await getUITranslationsForLang(lang);
    res.json({
      ...image,
      related: relatedList,
      keywords,
      ui
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Comments with translation
router.get('/media/:id/comments', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const result = await pool.query(
      'SELECT id, username, comment_text, created_at FROM comments WHERE photo_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.params.id]
    );
    
    let comments = result.rows;
    
    // Translate comments if not English
    if (lang !== 'en' && comments.length > 0) {
      const translatedComments = await translateBatch(comments.map(c => c.comment_text || ''), lang);
      comments = comments.map((c, i) => ({ ...c, comment_text: translatedComments[i] || c.comment_text }));
    }
    
    res.json({ comments });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/media/:id/comments', async (req, res) => {
  try {
    const { username, comment_text } = req.body;
    if (!username || !comment_text) return res.status(400).json({ error: 'Required fields missing' });
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const result = await pool.query(
      'INSERT INTO comments (photo_id, username, comment_text, created_at, ip_address) VALUES ($1, $2, $3, NOW(), $4) RETURNING id, username, comment_text, created_at',
      [req.params.id, username, comment_text, ip]
    );
    res.json({ comment: result.rows[0] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Search with translation and keyword learning
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const lang = req.query.lang || 'en';
    const limit = parseInt(req.query.limit) || 12;
    
    trackVisit(req, `search/${q}`);
    
    // Search in original content + learned keywords
    const result = await pool.query(`
      SELECT DISTINCT i.id, i.title, i.local_path, i.thumbnail_path, i.view_count, i.average_rating, c.catname as category_name
      FROM image i 
      LEFT JOIN category c ON i.belongs_to_gallery = c.id
      LEFT JOIN image_keywords ik ON i.id = ik.image_id
      WHERE i.title ILIKE $1 OR i.description ILIKE $1 OR c.catname ILIKE $1 OR ik.keyword ILIKE $2
      ORDER BY i.view_count DESC LIMIT $3
    `, ['%' + q + '%', q.toLowerCase(), limit]);
    
    logSearch(req, q, result.rows.length);
    
    // Learn from internal searches for matching content
    if (result.rows.length > 0) {
      result.rows.slice(0, 5).forEach(img => {
        learnKeywords(img.id, q, 'internal_search');
      });
    }
    
    let imageList = result.rows;
    
    // Translate if not English
    if (lang !== 'en') {
      const translatedTitles = await translateBatch(imageList.map(i => i.title || ''), lang);
      imageList = imageList.map((img, i) => ({ ...img, title: translatedTitles[i] || img.title }));
    }
    
    res.json({ query: q, results: imageList });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Analytics endpoint
router.get('/analytics', async (req, res) => {
  try {
    const today = await pool.query(`
      SELECT COUNT(DISTINCT ip) as visitors, COUNT(*) as pageviews 
      FROM analytics WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    const countries = await pool.query(`
      SELECT country, COUNT(DISTINCT ip) as visitors 
      FROM analytics WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY country ORDER BY visitors DESC LIMIT 20
    `);
    const live = await pool.query(`
      SELECT COUNT(DISTINCT ip) as live 
      FROM analytics WHERE created_at > NOW() - INTERVAL '5 minutes'
    `);
    const referers = await pool.query(`
      SELECT referer, COUNT(*) as count 
      FROM analytics WHERE referer != '' AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY referer ORDER BY count DESC LIMIT 10
    `);
    res.json({
      live: parseInt(live.rows[0]?.live || 0),
      today: { visitors: parseInt(today.rows[0]?.visitors || 0), pageviews: parseInt(today.rows[0]?.pageviews || 0) },
      countries: countries.rows,
      topReferers: referers.rows
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Search stats endpoint
router.get('/search-stats', async (req, res) => {
  try {
    const popular = await pool.query(`SELECT LOWER(query) as search_term, COUNT(*) as count FROM search_logs GROUP BY LOWER(query) ORDER BY count DESC LIMIT 50`);
    const popularToday = await pool.query(`SELECT LOWER(query) as search_term, COUNT(*) as count FROM search_logs WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY LOWER(query) ORDER BY count DESC LIMIT 20`);
    const totals = await pool.query(`SELECT COUNT(*) as total_searches, COUNT(DISTINCT ip) as unique_searchers, COUNT(DISTINCT LOWER(query)) as unique_terms FROM search_logs`);
    const today = await pool.query(`SELECT COUNT(*) as searches, COUNT(DISTINCT ip) as unique_searchers FROM search_logs WHERE created_at > NOW() - INTERVAL '24 hours'`);
    const recent = await pool.query(`SELECT query, country, results_count, created_at FROM search_logs ORDER BY created_at DESC LIMIT 50`);
    const zeroResults = await pool.query(`SELECT LOWER(query) as search_term, COUNT(*) as count FROM search_logs WHERE results_count = 0 AND created_at > NOW() - INTERVAL '7 days' GROUP BY LOWER(query) ORDER BY count DESC LIMIT 20`);

    res.json({
      totals: { allTime: parseInt(totals.rows[0]?.total_searches || 0), uniqueSearchers: parseInt(totals.rows[0]?.unique_searchers || 0), uniqueTerms: parseInt(totals.rows[0]?.unique_terms || 0) },
      today: { searches: parseInt(today.rows[0]?.searches || 0), uniqueSearchers: parseInt(today.rows[0]?.unique_searchers || 0) },
      popularAllTime: popular.rows, popularToday: popularToday.rows, recent: recent.rows, zeroResults: zeroResults.rows
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Insights endpoint
router.get('/insights', async (req, res) => {
  try {
    const googleSearches = await pool.query(`SELECT search_query, COUNT(*) as count FROM search_engine_referrals WHERE engine = 'google' AND created_at > NOW() - INTERVAL '30 days' GROUP BY search_query ORDER BY count DESC LIMIT 50`);
    const contentGaps = await pool.query(`SELECT term, source, search_count, has_content FROM content_demand WHERE has_content = FALSE ORDER BY search_count DESC LIMIT 30`);
    const popularContent = await pool.query(`SELECT term, source, search_count FROM content_demand WHERE has_content = TRUE ORDER BY search_count DESC LIMIT 30`);
    const competitors = await pool.query(`SELECT referrer_domain, COUNT(*) as visits, COUNT(DISTINCT ip) as unique_visitors FROM external_referrers WHERE referrer_domain = ANY($1) AND created_at > NOW() - INTERVAL '30 days' GROUP BY referrer_domain ORDER BY visits DESC`, [competitorDomains]);
    const allReferrers = await pool.query(`SELECT referrer_domain, COUNT(*) as visits FROM external_referrers WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY referrer_domain ORDER BY visits DESC LIMIT 50`);
    const learnedKeywords = await pool.query(`SELECT keyword, COUNT(*) as count, SUM(weight) as total_weight FROM image_keywords GROUP BY keyword ORDER BY total_weight DESC LIMIT 50`);

    res.json({
      searchEngineTraffic: { google: googleSearches.rows },
      contentInsights: { gaps: contentGaps.rows, popular: popularContent.rows },
      referrers: { competitors: competitors.rows, allSites: allReferrers.rows },
      learnedKeywords: learnedKeywords.rows,
      recommendations: {
        contentToCreate: contentGaps.rows.slice(0, 10).map(r => r.term),
        trendsToCapitalize: popularContent.rows.slice(0, 10).map(r => r.term)
      }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// SEO Analysis endpoint (admin only - trigger manually)
router.post('/seo/analyze', async (req, res) => {
  try {
    const { generateSEOReport, applyAutoSEOUpdates } = await import('../services/seo-analyzer.js');
    const report = await generateSEOReport();

    // Auto-apply suggestions
    if (report.seoSuggestions && report.seoSuggestions.length > 0) {
      await applyAutoSEOUpdates(report.seoSuggestions);
    }

    res.json({
      success: true,
      summary: report.summary,
      trendingKeywords: report.summary.trendingSearches,
      topKeywords: report.summary.topKeywords,
      contentGaps: report.searchEngineTraffic.contentGaps.slice(0, 10),
      seoIssues: report.summary.seoIssuesCount
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get SEO suggestions for a category
router.get('/seo/category/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query(
      'SELECT * FROM category_seo WHERE category_id = $1 ORDER BY language',
      [id]
    );
    res.json({ seo: result.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Update category SEO
router.post('/seo/category/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { language, title, description, keywords, h1 } = req.body;

    await pool.query(`
      INSERT INTO category_seo (category_id, language, seo_title, seo_description, seo_keywords, h1_tag, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (category_id, language) DO UPDATE SET
        seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description,
        seo_keywords = EXCLUDED.seo_keywords,
        h1_tag = EXCLUDED.h1_tag,
        updated_at = NOW()
    `, [id, language || 'en', title, description, keywords || '', h1 || '']);

    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
