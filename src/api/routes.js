import express from 'express';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import https from 'https';
import { getTranslations, getTranslationsByCategory, getLanguages, getUITranslations, t } from '../services/translation-service.js';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import sharp from 'sharp';
import { getAdminSession } from './auth-routes.js';

const execAsync = promisify(exec);

const { Pool } = pg;
const router = express.Router();

// PostgreSQL pool with query timeout
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple',
  statement_timeout: 10000, // 10 second query timeout
  query_timeout: 10000,
  connectionTimeoutMillis: 5000,
  max: 20
});

// Simulated online users (varies by time of day)
function getOnlineUsers() {
  const hour = new Date().getHours();
  // Base: 80-150 users, higher in evenings (18-23), lower at night (2-7)
  let base = 100;
  if (hour >= 18 && hour <= 23) base = 140;
  else if (hour >= 2 && hour <= 7) base = 60;
  // Add some randomness (+/- 30)
  return base + Math.floor(Math.random() * 60) - 30;
}

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

// Top GSC keywords for SEO alt tags (white-hat SEO)
const GSC_KEYWORDS = [
  'nude twinks', 'gay boys', 'boys nude', 'nude teen boys 18+',
  'gay twink photos', 'twink galleries', 'nude boys pics',
  'young gay twinks', 'hot twink boys', 'twink porn free',
  'gay nude photos', 'twink sites', 'nude gay models'
];

// Generate SEO-optimized alt tag for images
function generateSeoAlt(title, siteName, type = 'photo') {
  const cleanTitle = title ? title.replace(/[_-]/g, ' ').trim() : '';
  const cleanSite = siteName ? siteName.replace(/[_-]/g, ' ').trim() : '';

  // Rotate through keyword variations for diversity
  const keywordIndex = Math.floor(Math.random() * 5);
  const keywords = GSC_KEYWORDS.slice(keywordIndex, keywordIndex + 2);

  if (type === 'video') {
    if (cleanTitle && cleanSite) {
      return `${cleanTitle} - ${cleanSite} nude twink video`;
    } else if (cleanSite) {
      return `${cleanSite} gay twink video - free nude boys`;
    }
    return `Free gay twink video - ${keywords[0]}`;
  }

  if (type === 'gallery') {
    if (cleanSite) {
      return `${cleanSite} - nude twink photos and gay boy galleries`;
    }
    return `Gay twink gallery - ${keywords[0]} pics`;
  }

  // Default: photo
  if (cleanTitle && cleanSite) {
    return `${cleanTitle} from ${cleanSite} - ${keywords[0]}`;
  } else if (cleanTitle) {
    return `${cleanTitle} - ${keywords[0]} photo`;
  } else if (cleanSite) {
    return `${cleanSite} ${keywords[0]} - free gay pics`;
  }
  return `Free ${keywords[0]} photo gallery`;
}

// Generate SEO title for pages
function generateSeoTitle(title, siteName, type = 'photo') {
  const cleanTitle = title ? title.replace(/[_-]/g, ' ').trim() : '';
  const cleanSite = siteName ? siteName.replace(/[_-]/g, ' ').trim() : '';

  if (type === 'video') {
    return cleanTitle
      ? `${cleanTitle} - ${cleanSite || 'Gay Twink'} Video | BoyVue`
      : `${cleanSite || 'Gay Twink'} Videos - Free Nude Boys | BoyVue`;
  }

  if (type === 'gallery') {
    return `${cleanSite || 'Gallery'} - Free Gay Twink Photos | BoyVue`;
  }

  // photo
  return cleanTitle
    ? `${cleanTitle} - ${cleanSite || 'Gallery'} | BoyVue`
    : `${cleanSite || 'Gallery'} Photo | BoyVue`;
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

// Extract language from URL query param or Accept-Language header
function detectLanguage(req) {
  // Check URL param first
  if (req.query?.lang) return req.query.lang.substring(0, 5);
  // Then Accept-Language header
  const al = req.headers['accept-language'] || '';
  const match = al.match(/^([a-z]{2})/i);
  return match ? match[1].toLowerCase() : 'en';
}

// Extract region from search engine TLD
function getSearchRegion(referer) {
  const regionMap = {
    'google.de': 'DE', 'google.fr': 'FR', 'google.es': 'ES', 'google.it': 'IT',
    'google.nl': 'NL', 'google.pl': 'PL', 'google.ru': 'RU', 'google.co.jp': 'JP',
    'google.co.kr': 'KR', 'google.com.br': 'BR', 'google.com.tr': 'TR',
    'google.co.th': 'TH', 'google.com.vn': 'VN', 'google.co.id': 'ID',
    'google.gr': 'GR', 'google.cz': 'CZ', 'google.hu': 'HU', 'google.com.sa': 'SA',
    'google.com.tw': 'TW', 'google.cn': 'CN', 'google.com': 'US', 'google.co.uk': 'GB',
    'yandex.ru': 'RU', 'yandex.com': 'RU', 'baidu.com': 'CN', 'm.baidu.com': 'CN',
    'naver.com': 'KR', 'seznam.cz': 'CZ', 'bing.com': 'US'
  };
  for (const [domain, region] of Object.entries(regionMap)) {
    if (referer.includes(domain)) return region;
  }
  return null;
}

async function trackVisit(req, page, imageId = null) {
  try {
    const { ip, country } = getGeoInfo(req);
    const ua = req.headers['user-agent'] || '';
    const referer = req.headers['referer'] || '';
    const language = detectLanguage(req);

    await pool.query(
      'INSERT INTO analytics (ip, country, city, page, user_agent, referer, language) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [ip, country, '', page, ua.substring(0, 500), referer.substring(0, 500), language]
    );

    if (referer) {
      const searchInfo = extractSearchQuery(referer);
      if (searchInfo) {
        const region = getSearchRegion(referer);
        await pool.query(
          'INSERT INTO search_engine_referrals (engine, search_query, landing_page, ip, country, language, region) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [searchInfo.engine, searchInfo.query.substring(0, 500), page, ip, country, language, region]
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
      users: parseInt(users.rows[0].count),
      onlineUsers: getOnlineUsers()
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GeoIP detection endpoint
router.get('/geoip', async (req, res) => {
  try {
    // Get IP from Cloudflare or direct connection
    const ip = req.headers['cf-connecting-ip'] ||
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.socket.remoteAddress || '';

    // Get country from Cloudflare header first
    let country = req.headers['cf-ipcountry'];

    if (!country && ip && ip !== '127.0.0.1' && !ip.match(/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/)) {
      // Fallback to ipinfo.io
      try {
        const response = await fetch(`https://ipinfo.io/${ip}/json?token=`, {
          signal: AbortSignal.timeout(2000)
        });
        if (response.ok) {
          const data = await response.json();
          country = data.country;
        }
      } catch (e) {
        console.log('GeoIP lookup failed:', e.message);
      }
    }

    const lang = country ? (countryToLang[country.toUpperCase()] || 'en') : 'en';

    res.json({
      ip: ip.substring(0, 20), // Truncate for privacy
      country: country || 'US',
      lang
    });
  } catch(e) {
    res.json({ ip: '', country: 'US', lang: 'en' });
  }
});

// Categories with translation
router.get('/categories', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const result = await pool.query(`
      SELECT c.id, c.catname, c.description, c.parent_category, c.photo_count,
             CASE WHEN sr.id IS NOT NULL THEN true ELSE false END as has_review,
             sr.overall_rating,
             sr.site_index,
             LEFT(sr.oscar_review, 120) as review_snippet,
             pc.name as parent_name,
             pc.slug as parent_slug,
             (SELECT thumbnail_path FROM image WHERE belongs_to_gallery = c.id
              AND thumbnail_path IS NOT NULL
              AND thumbnail_path NOT LIKE '%.mp4'
              AND thumbnail_path NOT LIKE '%.webm'
              ORDER BY id DESC LIMIT 1) as thumbnail,
             (SELECT EXTRACT(EPOCH FROM MAX(created_at)) FROM image WHERE belongs_to_gallery = c.id) as last_update
      FROM category c
      LEFT JOIN site_reviews sr ON sr.category_id = c.id
      LEFT JOIN parent_categories pc ON pc.id = c.parent_category
      WHERE c.photo_count > 0
      ORDER BY c.photo_count DESC
    `);

    let categories = result.rows;

    // Keep original name as slug for API calls, translate display name
    if (lang !== 'en') {
      // Fetch pre-translated descriptions from content_translations
      const categoryIds = categories.map(c => c.id);
      const translationsResult = await pool.query(`
        SELECT content_id, field_name, translated_text
        FROM content_translations
        WHERE content_type = 'category' AND language_code = $1 AND content_id = ANY($2)
      `, [lang, categoryIds]);

      // Build translations map
      const translationsMap = {};
      translationsResult.rows.forEach(t => {
        if (!translationsMap[t.content_id]) translationsMap[t.content_id] = {};
        translationsMap[t.content_id][t.field_name] = t.translated_text;
      });

      categories = categories.map((c) => ({
        ...c,
        slug: c.catname, // Original English name for API
        thumbnail: c.thumbnail ? `/data/${c.thumbnail}` : null,
        description: translationsMap[c.id]?.description || c.description,
        review_snippet: translationsMap[c.id]?.review_snippet || c.review_snippet
      }));
    } else {
      categories = categories.map(c => ({ ...c, slug: c.catname, thumbnail: c.thumbnail ? `/data/${c.thumbnail}` : null }));
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

    const cat = await pool.query(`
      SELECT c.*,
             CASE WHEN sr.id IS NOT NULL THEN true ELSE false END as has_review,
             sr.oscar_review,
             sr.ai_summary,
             sr.overall_rating as review_rating,
             sr.pros,
             sr.cons
      FROM category c
      LEFT JOIN site_reviews sr ON sr.category_id = c.id
      WHERE c.id = $1
    `, [req.params.id]);
    if (cat.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const images = await pool.query(
      'SELECT id, title, description, local_path, thumbnail_path, width, height, view_count, average_rating FROM image WHERE belongs_to_gallery = $1 ORDER BY view_count DESC LIMIT 50',
      [req.params.id]
    );

    let category = cat.rows[0];
    const originalSlug = category.catname; // Keep original for API calls
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

    category.slug = originalSlug; // Always include original slug
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

    // Add SEO alt tags to each image
    const imagesWithSeo = imageList.map(img => ({
      ...img,
      seoAlt: generateSeoAlt(img.title, img.category_name, 'photo'),
      seoTitle: generateSeoTitle(img.title, img.category_name, 'photo')
    }));

    res.json({
      images: imagesWithSeo,
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

// Get category metadata with i18n and keywords (public)
router.get('/category-meta/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const lang = req.query.lang || 'en';

    // Find category by slug (catname)
    const catResult = await pool.query(
      'SELECT id, catname, description FROM category WHERE LOWER(catname) = LOWER($1)',
      [slug]
    );

    if (catResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = catResult.rows[0];

    // Get translation for this category
    const transResult = await pool.query(
      'SELECT title, description, meta_title, meta_description, meta_keywords FROM category_translations WHERE category_id = $1 AND lang = $2',
      [category.id, lang]
    );

    // Get keywords from category_keywords (imported from admin panel)
    const keywordsResult = await pool.query(`
      SELECT ck.keyword, ck.search_volume, w.name as source_site
      FROM category_keywords ck
      LEFT JOIN seo_websites w ON w.id = ck.source_website_id
      WHERE ck.category_id = $1
      ORDER BY ck.search_volume DESC NULLS LAST
      LIMIT 20
    `, [category.id]);

    // Combine keywords into comma-separated string
    const importedKeywords = keywordsResult.rows.map(k => k.keyword).join(', ');

    // Get translation or fallback to English/default
    let translation = transResult.rows[0];
    if (!translation && lang !== 'en') {
      // Try English fallback
      const enResult = await pool.query(
        'SELECT title, description, meta_title, meta_description, meta_keywords FROM category_translations WHERE category_id = $1 AND lang = $2',
        [category.id, 'en']
      );
      translation = enResult.rows[0];
    }

    // Build response with fallbacks
    const title = translation?.title || category.catname;
    const description = translation?.description || category.description || '';
    const metaTitle = translation?.meta_title || `${title} - Free Gay Photos & Videos | BoyVue`;
    const metaDescription = translation?.meta_description || description || `Browse free ${title} gay photos and videos. HD quality content updated daily.`;

    // Combine stored meta_keywords with imported keywords
    let allKeywords = [];
    if (translation?.meta_keywords) {
      allKeywords.push(translation.meta_keywords);
    }
    if (importedKeywords) {
      allKeywords.push(importedKeywords);
    }
    // Add category name as keyword
    allKeywords.push(category.catname.toLowerCase());

    const metaKeywords = allKeywords.filter(Boolean).join(', ');

    // Translate if needed
    let finalTitle = title;
    let finalDescription = metaDescription;

    if (lang !== 'en' && !translation) {
      finalTitle = await translateText(title, lang);
      finalDescription = await translateText(metaDescription, lang);
    }

    // Get featured models for this category (from image titles/tags) with thumbnails
    let models = [];
    try {
      const modelsResult = await pool.query(`
        WITH model_names AS (
          SELECT
            TRIM(SPLIT_PART(title, ' at ', 1)) as name,
            COUNT(*) as count
          FROM image
          WHERE belongs_to_gallery = $1
            AND title IS NOT NULL
            AND title != ''
            AND title LIKE '% at %'
          GROUP BY TRIM(SPLIT_PART(title, ' at ', 1))
          HAVING COUNT(*) >= 3
          ORDER BY count DESC
          LIMIT 25
        )
        SELECT
          mn.name,
          mn.count,
          (
            SELECT ARRAY_AGG(thumbnail_path ORDER BY id DESC)
            FROM (
              SELECT id, thumbnail_path
              FROM image
              WHERE belongs_to_gallery = $2
                AND title LIKE mn.name || ' at %'
                AND thumbnail_path IS NOT NULL
              ORDER BY id DESC
              LIMIT 3
            ) thumbs
          ) as thumbnails
        FROM model_names mn
        ORDER BY mn.count DESC
      `, [category.id, category.id]);

      models = modelsResult.rows.map(m => ({
        name: m.name,
        count: parseInt(m.count),
        slug: m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        thumbnails: (m.thumbnails || []).map(t => `/minis/${t}`)
      }));
    } catch (e) {
      // Models query failed, continue without
      console.error('Models query error:', e.message);
    }

    // Get popular searches for this category
    let popularSearches = [];
    try {
      // Generate popular search terms based on category name
      const siteName = category.catname;
      popularSearches = [
        { term: siteName, volume: 0 },
        { term: `${siteName} models`, volume: 0 },
        { term: `${siteName} pics`, volume: 0 },
        { term: `${siteName} free`, volume: 0 },
        { term: `${siteName} videos`, volume: 0 },
        { term: `${siteName} review`, volume: 0 },
        { term: `${siteName} login`, volume: 0 },
        { term: `${siteName} scenes`, volume: 0 },
        { term: `${siteName} membership`, volume: 0 },
        { term: `${siteName} discount`, volume: 0 },
      ];

      // Try to get actual keyword volumes if available
      const volumeResult = await pool.query(`
        SELECT keyword, search_volume
        FROM category_keywords
        WHERE category_id = $1 AND search_volume > 0
        ORDER BY search_volume DESC
        LIMIT 10
      `, [category.id]);

      if (volumeResult.rows.length > 0) {
        // Replace with actual keywords that have volume data
        popularSearches = volumeResult.rows.map(k => ({
          term: k.keyword,
          volume: parseInt(k.search_volume) || 0
        }));
      }
    } catch (e) {
      // Popular searches query failed, continue without
    }

    res.json({
      id: category.id,
      slug: category.catname,
      title: finalTitle,
      description: finalDescription,
      metaTitle: translation?.meta_title || `${finalTitle} - BoyVue`,
      metaDescription: finalDescription,
      metaKeywords: metaKeywords,
      keywords: keywordsResult.rows,
      models: models,
      popularSearches: popularSearches,
      lang
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get site review with i18n support and forum links
router.get('/site-review/:slug', async (req, res) => {
  // Prevent caching to ensure fresh data
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  try {
    const slug = req.params.slug.replace(/-/g, ' ').replace(/\+/g, ' ');
    const lang = req.query.lang || 'en';

    // Find category by slug (convert dashes to spaces for URL-friendly slugs)
    const catResult = await pool.query(
      'SELECT id, catname, photo_count FROM category WHERE LOWER(catname) = LOWER($1)',
      [slug]
    );

    if (catResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = catResult.rows[0];

    // Get site review
    const reviewResult = await pool.query(`
      SELECT sr.*,
             sw.url as official_url,
             sw.total_backlinks,
             sw.total_keywords as keyword_count
      FROM site_reviews sr
      LEFT JOIN seo_websites sw ON LOWER(sw.name) = LOWER(sr.site_name)
      WHERE sr.category_id = $1
    `, [category.id]);

    if (reviewResult.rows.length === 0) {
      // Return basic info if no review
      return res.json({
        id: category.id,
        siteName: category.catname,
        photoCount: category.photo_count,
        hasReview: false
      });
    }

    const review = reviewResult.rows[0];

    // Get translation for this review from site_review_translations
    const transResult = await pool.query(
      'SELECT title, summary, consensus, pros, cons FROM site_review_translations WHERE review_id = $1 AND lang = $2',
      [review.id, lang]
    );

    // Get English fallback if no translation
    let translation = transResult.rows[0];
    if (!translation && lang !== 'en') {
      const enResult = await pool.query(
        'SELECT title, summary, consensus, pros, cons FROM site_review_translations WHERE review_id = $1 AND lang = $2',
        [review.id, 'en']
      );
      translation = enResult.rows[0];
    }

    // Also get translations from content_translations table (for Oscar reviews, pros, cons, verdict)
    let contentTranslation = {};
    if (lang !== 'en') {
      const ctResult = await pool.query(`
        SELECT field_name, translated_text
        FROM content_translations
        WHERE content_type = 'site_review' AND content_id = $1 AND language_code = $2
      `, [review.id, lang]);

      ctResult.rows.forEach(row => {
        contentTranslation[row.field_name] = row.translated_text;
      });
    }

    // Get forum links
    const forumResult = await pool.query(
      'SELECT forum_name, forum_url, post_title, sentiment FROM site_forum_links WHERE category_id = $1',
      [category.id]
    );

    // Get keywords for this category (both from category_keywords and seo_website_keywords)
    const keywordsResult = await pool.query(`
      SELECT DISTINCT ON (LOWER(keyword)) keyword, search_volume
      FROM (
        SELECT ck.keyword, ck.search_volume
        FROM category_keywords ck
        WHERE ck.category_id = $1
        UNION ALL
        SELECT swk.keyword, swk.search_volume
        FROM seo_website_keywords swk
        JOIN seo_websites sw ON sw.id = swk.website_id
        WHERE LOWER(sw.name) = LOWER($2)
      ) combined
      ORDER BY LOWER(keyword), search_volume DESC NULLS LAST
    `, [category.id, category.catname]);

    // Get top 20 keywords sorted by volume for SEO meta
    const topKeywords = [...keywordsResult.rows]
      .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
      .slice(0, 20);

    // Generate site name variations for tags
    const siteName = category.catname;
    const siteNameVariations = [
      siteName,
      siteName.toLowerCase(),
      siteName.replace(/([A-Z])/g, ' $1').trim(),
      siteName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''),
      siteName.replace(/Online$/i, '').trim(),
      siteName.replace(/Boys$/i, '').trim(),
      `${siteName} review`,
      `${siteName.toLowerCase()} review`,
      `${siteName} site`,
      `is ${siteName.toLowerCase()} good`,
      `${siteName.toLowerCase()} worth it`
    ].filter((v, i, arr) => v && arr.indexOf(v) === i); // Remove duplicates

    // Get backlinks
    const backlinksResult = await pool.query(`
      SELECT swb.source_url, swb.anchor, swb.domain_rank
      FROM seo_website_backlinks swb
      JOIN seo_websites sw ON sw.id = swb.website_id
      WHERE LOWER(sw.name) = LOWER($1)
      ORDER BY swb.domain_rank DESC NULLS LAST
      LIMIT 10
    `, [category.catname]);

    // Get website screenshots
    const screenshotsResult = await pool.query(`
      SELECT screenshot_path, screenshot_type, page_url, created_at
      FROM site_screenshots
      WHERE review_id = $1
      ORDER BY screenshot_type
    `, [review.id]);

    // Build response
    res.json({
      id: category.id,
      siteName: category.catname,
      siteUrl: review.official_url || review.site_url || '',
      photoCount: category.photo_count,
      hasReview: true,
      // Ratings
      siteIndex: review.site_index || 0,
      overallRating: parseFloat(review.overall_rating) || 0,
      contentQuality: review.content_quality || 0,
      updateFrequency: review.update_frequency || 0,
      videoQuality: review.video_quality || 0,
      modelVariety: review.model_variety || 0,
      valueRating: review.value_rating || 0,
      // Content (use translation or fallback)
      title: translation?.title || `${category.catname} Review`,
      summary: translation?.summary || review.ai_summary || '',
      consensus: translation?.consensus || review.ai_consensus || '',
      oscarReview: contentTranslation.oscar_review || review.oscar_review || '',  // Oscar Wilde style prose review (translated if available)
      pros: contentTranslation.pros || translation?.pros || review.pros || [],
      cons: contentTranslation.cons || translation?.cons || review.cons || [],
      verdict: contentTranslation.verdict || review.verdict || '',
      // SEO data & tags
      keywords: topKeywords.slice(0, 15),
      allKeywords: topKeywords,
      siteNameVariations,
      seoMetaKeywords: [...siteNameVariations.slice(0, 5), ...topKeywords.slice(0, 15).map(k => k.keyword)].join(', '),
      backlinks: backlinksResult.rows.map(bl => ({
        source_url: bl.source_url,
        anchor_text: bl.anchor,
        domain_authority: bl.domain_rank
      })),
      totalBacklinks: parseInt(review.total_backlinks) || 0,
      totalKeywords: topKeywords.length,
      // Forum links
      forumLinks: forumResult.rows,
      // Website screenshots (from Playwright captures)
      websiteScreenshots: screenshotsResult.rows.map(ss => ({
        path: ss.screenshot_path,
        type: ss.screenshot_type,
        url: ss.page_url,
        capturedAt: ss.created_at
      })),
      // Meta for SEO
      seoTitle: `${category.catname} Review - Honest Rating & User Comments | BoyVue`,
      seoDescription: (translation?.summary || review.ai_summary || `Comprehensive review of ${category.catname} with ratings, pros, cons, and user comments.`).substring(0, 160),
      lastReviewed: review.last_reviewed,
      lang
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get SERP content for a keyword
router.get('/serp/:keyword', async (req, res) => {
  try {
    const keyword = decodeURIComponent(req.params.keyword);
    const lang = req.query.lang || 'en';

    const result = await pool.query(`
      SELECT * FROM seo_serp_content
      WHERE keyword_term = $1 AND language = $2
    `, [keyword, lang]);

    if (result.rows.length === 0) {
      const enResult = await pool.query(`
        SELECT * FROM seo_serp_content
        WHERE keyword_term = $1 AND language = 'en'
      `, [keyword]);
      if (enResult.rows.length === 0) {
        return res.status(404).json({ error: 'SERP content not found' });
      }
      return res.json(enResult.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all SERPs for a language
router.get('/serps/:lang', async (req, res) => {
  try {
    const lang = req.params.lang || 'en';
    const limit = parseInt(req.query.limit) || 100;

    const result = await pool.query(`
      SELECT keyword_term, translated_keyword,
             serp1_title, serp1_description,
             serp2_title, serp2_description,
             serp3_title, serp3_description,
             target_url, category_id
      FROM seo_serp_content
      WHERE language = $1
      ORDER BY keyword_term
      LIMIT $2
    `, [lang, limit]);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get SERP content for a category
router.get('/category-serps/:categoryId', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    const lang = req.query.lang || 'en';

    const result = await pool.query(`
      SELECT keyword_term, translated_keyword,
             serp1_title, serp1_description,
             serp2_title, serp2_description,
             serp3_title, serp3_description,
             meta_keywords, content_snippet
      FROM seo_serp_content
      WHERE category_id = $1 AND language = $2
    `, [categoryId, lang]);

    const catResult = await pool.query(
      'SELECT seo_keywords FROM category WHERE id = $1',
      [categoryId]
    );

    res.json({
      serps: result.rows,
      categoryKeywords: catResult.rows[0]?.seo_keywords || []
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get random SERPs for homepage
router.get('/random-serps', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const count = parseInt(req.query.count) || 10;

    const result = await pool.query(`
      SELECT keyword_term, translated_keyword,
             serp1_title, serp1_description, target_url
      FROM seo_serp_content
      WHERE language = $1
      ORDER BY RANDOM()
      LIMIT $2
    `, [lang, count]);
    res.json(result.rows);
  } catch (e) {
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

// ===== SITE REVIEW COMMENTS =====

// Get approved comments for a site review
router.get('/site-review/:slug/comments', async (req, res) => {
  try {
    const slug = req.params.slug;

    // Find category and review
    const catResult = await pool.query(
      'SELECT id FROM category WHERE LOWER(catname) = LOWER($1)',
      [slug]
    );

    if (catResult.rows.length === 0) {
      return res.json({ comments: [] });
    }

    const reviewResult = await pool.query(
      'SELECT id FROM site_reviews WHERE category_id = $1',
      [catResult.rows[0].id]
    );

    if (reviewResult.rows.length === 0) {
      return res.json({ comments: [] });
    }

    const reviewId = reviewResult.rows[0].id;

    // Get approved comments
    const comments = await pool.query(`
      SELECT id, username, comment_text, created_at
      FROM site_review_comments
      WHERE review_id = $1 AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT 100
    `, [reviewId]);

    res.json({ comments: comments.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Submit a comment for a site review (pending moderation)
router.post('/site-review/:slug/comments', async (req, res) => {
  try {
    const slug = req.params.slug;
    const { username, comment_text } = req.body;

    if (!username?.trim() || !comment_text?.trim()) {
      return res.status(400).json({ error: 'Username and comment are required' });
    }

    // Validate lengths
    if (username.length > 100 || comment_text.length > 2000) {
      return res.status(400).json({ error: 'Username or comment too long' });
    }

    // Find category and review
    const catResult = await pool.query(
      'SELECT id FROM category WHERE LOWER(catname) = LOWER($1)',
      [slug]
    );

    if (catResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const reviewResult = await pool.query(
      'SELECT id FROM site_reviews WHERE category_id = $1',
      [catResult.rows[0].id]
    );

    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ error: 'No review exists for this category' });
    }

    const reviewId = reviewResult.rows[0].id;
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '';

    // Insert comment as pending
    const result = await pool.query(`
      INSERT INTO site_review_comments (review_id, username, comment_text, ip_address, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, username, comment_text, created_at, status
    `, [reviewId, username.trim(), comment_text.trim(), ip]);

    res.json({
      success: true,
      comment: result.rows[0],
      message: 'Your comment has been submitted and is awaiting moderation.'
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Get comment count for a site review (for UI badge)
router.get('/site-review/:slug/comment-count', async (req, res) => {
  try {
    const slug = req.params.slug;

    const catResult = await pool.query(
      'SELECT id FROM category WHERE LOWER(catname) = LOWER($1)',
      [slug]
    );

    if (catResult.rows.length === 0) {
      return res.json({ count: 0 });
    }

    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM site_review_comments src
      JOIN site_reviews sr ON sr.id = src.review_id
      WHERE sr.category_id = $1 AND src.status = 'approved'
    `, [catResult.rows[0].id]);

    res.json({ count: parseInt(result.rows[0].count) || 0 });
  } catch(e) {
    res.json({ count: 0 });
  }
});

// ============================================================================
// SEO-OPTIMIZED GALLERY & PHOTO ENDPOINTS (for React frontend)
// ============================================================================

// Gallery by slug (SEO-friendly URL like /gallery/boyfun)
router.get('/gallery/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.replace(/-/g, ' ').replace(/\+/g, ' ');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const offset = (page - 1) * limit;

    // Find category by name (case-insensitive) with parent category
    const catResult = await pool.query(`
      SELECT c.*, pc.name as parent_name, pc.slug as parent_slug
      FROM category c
      LEFT JOIN parent_categories pc ON pc.id = c.parent_category
      WHERE LOWER(c.catname) = LOWER($1)
    `, [slug]);

    if (catResult.rows.length === 0) {
      return res.status(404).json({ error: 'Gallery not found' });
    }

    const category = catResult.rows[0];
    trackVisit(req, `gallery/${category.catname}`);

    // Get images with pagination
    // For featured galleries (501, 999, 1001), use sort_order (set by daily shuffle script)
    // For others, use created_at DESC
    const orderClause = [501, 999, 1001].includes(category.id)
      ? 'ORDER BY sort_order ASC NULLS LAST, average_rating DESC NULLS LAST, view_count DESC NULLS LAST'
      : 'ORDER BY created_at DESC';

    const imagesResult = await pool.query(`
      SELECT id, title, description, local_path, thumbnail_path,
             width, height, view_count, average_rating, created_at
      FROM image
      WHERE belongs_to_gallery = $1
      ${orderClause}
      LIMIT $2 OFFSET $3
    `, [category.id, limit, offset]);

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM image WHERE belongs_to_gallery = $1',
      [category.id]
    );
    const total = parseInt(countResult.rows[0].count);

    // Generate SEO metadata
    const seoTitle = category.meta_serp_title ||
      `${category.catname} - Free Gay Pics & Videos | BoyVue`;
    const seoDescription = category.meta_serp_description ||
      `Browse ${total.toLocaleString()} free photos and videos from ${category.catname}. High quality gay twink content updated regularly.`;
    const seoKeywords = category.seo_keywords || [];

    // Get first image for OG image (fix video extensions)
    let ogImage = imagesResult.rows[0]?.thumbnail_path || null;
    if (ogImage && /\.(mp4|webm|flv|avi|mov|wmv)$/i.test(ogImage)) {
      ogImage = ogImage.replace(/\.(mp4|webm|flv|avi|mov|wmv)$/i, '.jpg');
    }

    res.json({
      category: {
        id: category.id,
        name: category.catname,
        slug: category.catname.toLowerCase().replace(/\s+/g, '-'),
        description: category.description,
        photoCount: total,
        parentCategory: category.parent_name ? {
          id: category.parent_category,
          name: category.parent_name,
          slug: category.parent_slug
        } : null
      },
      images: imagesResult.rows.map(img => {
        // Fix video thumbnails: convert .mp4/.webm/.flv to .jpg
        let thumb = img.thumbnail_path;
        const isVideo = thumb && /\.(mp4|webm|flv|avi|mov|wmv)$/i.test(thumb);
        if (isVideo) {
          thumb = thumb.replace(/\.(mp4|webm|flv|avi|mov|wmv)$/i, '.jpg');
        }
        return {
          id: img.id,
          title: img.title,
          description: img.description,
          thumbnail: thumb,
          fullPath: img.local_path,
          width: img.width,
          height: img.height,
          views: img.view_count,
          rating: img.average_rating,
          date: img.created_at,
          seoAlt: generateSeoAlt(img.title, category.catname, isVideo ? 'video' : 'photo'),
          seoTitle: generateSeoTitle(img.title, category.catname, isVideo ? 'video' : 'photo')
        };
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
        // SEO-friendly pagination URLs
        nextUrl: page < Math.ceil(total / limit) ? `/gallery/${slug}/?page=${page + 1}` : null,
        prevUrl: page > 1 ? `/gallery/${slug}/?page=${page - 1}` : null,
        nextSeoTitle: page < Math.ceil(total / limit) ? `${category.catname} Photos - Page ${page + 1}` : null,
        prevSeoTitle: page > 1 ? `${category.catname} Photos - Page ${page - 1}` : null
      },
      breadcrumbs: [
        { name: 'Home', url: '/', seoTitle: 'BoyVue - Free Gay Twink Photos' },
        { name: 'Sites', url: '/sites', seoTitle: 'Browse All Gay Twink Sites' },
        { name: category.catname, url: `/gallery/${slug}/`, seoTitle: `${category.catname} - Nude Twink Gallery` }
      ],
      internalLinks: {
        sites: { url: '/sites', title: 'All Sites', seoAlt: 'Browse all gay twink photo sites' },
        journey: { url: '/journey', title: 'Discover', seoAlt: 'Discover trending nude twink content' },
        hotornot: { url: '/hotornot.php', title: 'Hot or Not', seoAlt: 'Rate gay twink photos' },
        videos: { url: '/gallery/gay+videos/', title: 'Videos', seoAlt: 'Watch free gay twink videos' }
      },
      seo: {
        title: seoTitle,
        description: seoDescription,
        keywords: seoKeywords.length > 0 ? seoKeywords : GSC_KEYWORDS.slice(0, 10),
        ogImage,
        canonical: `https://boysreview.com/gallery/${category.catname.toLowerCase().replace(/\s+/g, '-')}/`
      }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Single photo view (SEO-optimized)
router.get('/photo/:id', async (req, res) => {
  try {
    const photoId = parseInt(req.params.id);
    if (isNaN(photoId)) {
      return res.status(400).json({ error: 'Invalid photo ID' });
    }

    // Get photo with category info
    const result = await pool.query(`
      SELECT i.*, c.catname as category_name, c.id as category_id
      FROM image i
      LEFT JOIN category c ON i.belongs_to_gallery = c.id
      WHERE i.id = $1
    `, [photoId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photo = result.rows[0];
    trackVisit(req, `photo/${photoId}`, photoId);

    // Increment view count
    await pool.query('UPDATE image SET view_count = view_count + 1 WHERE id = $1', [photoId]);

    // Get related photos (same category)
    const relatedResult = await pool.query(`
      SELECT id, title, thumbnail_path, view_count
      FROM image
      WHERE belongs_to_gallery = $1 AND id != $2
      ORDER BY view_count DESC
      LIMIT 12
    `, [photo.belongs_to_gallery, photoId]);

    // Get previous and next photos for navigation with full SEO details
    const navResult = await pool.query(`
      SELECT
        (SELECT id FROM image WHERE belongs_to_gallery = $1 AND id < $2 ORDER BY id DESC LIMIT 1) as prev_id,
        (SELECT id FROM image WHERE belongs_to_gallery = $1 AND id > $2 ORDER BY id ASC LIMIT 1) as next_id
    `, [photo.belongs_to_gallery, photoId]);

    const nav = navResult.rows[0];

    // Fix video thumbnails: convert .mp4/.webm/.flv to .jpg
    const fixVideoThumb = (path) => {
      if (path && /\.(mp4|webm|flv|avi|mov|wmv)$/i.test(path)) {
        return path.replace(/\.(mp4|webm|flv|avi|mov|wmv)$/i, '.jpg');
      }
      return path;
    };

    // Fetch full details for prev/next photos for enhanced SEO
    let prevPhoto = null, nextPhoto = null;
    if (nav.prev_id) {
      const prevResult = await pool.query(
        'SELECT id, title, thumbnail_path FROM image WHERE id = $1',
        [nav.prev_id]
      );
      if (prevResult.rows.length > 0) {
        const p = prevResult.rows[0];
        prevPhoto = {
          id: p.id,
          title: p.title,
          thumbnail: fixVideoThumb(p.thumbnail_path),
          url: `/photo/${p.id}/`,
          seoAlt: generateSeoAlt(p.title, photo.category_name, 'photo'),
          seoTitle: `Previous: ${p.title || photo.category_name + ' Photo'}`
        };
      }
    }
    if (nav.next_id) {
      const nextResult = await pool.query(
        'SELECT id, title, thumbnail_path FROM image WHERE id = $1',
        [nav.next_id]
      );
      if (nextResult.rows.length > 0) {
        const n = nextResult.rows[0];
        nextPhoto = {
          id: n.id,
          title: n.title,
          thumbnail: fixVideoThumb(n.thumbnail_path),
          url: `/photo/${n.id}/`,
          seoAlt: generateSeoAlt(n.title, photo.category_name, 'photo'),
          seoTitle: `Next: ${n.title || photo.category_name + ' Photo'}`
        };
      }
    }

    // Generate SEO metadata
    const siteName = photo.category_name || 'Gallery';
    const seoTitle = photo.title
      ? `${photo.title} - ${siteName} | BoyVue`
      : `${siteName} Photo #${photoId} | BoyVue`;
    const seoDescription = photo.description ||
      `View this photo from ${siteName}. Browse more free gay twink pics and videos.`;

    // Determine if this is a video
    const isVideo = photo.local_path && /\.(mp4|webm|flv|avi|mov|wmv)$/i.test(photo.local_path);
    const contentType = isVideo ? 'video' : 'photo';

    // Generate breadcrumb SEO
    const categorySlug = photo.category_name?.toLowerCase().replace(/\s+/g, '-') || 'gallery';
    const breadcrumbs = [
      { name: 'Home', url: '/', seoTitle: 'BoyVue Home - Free Gay Twink Photos' },
      { name: 'Sites', url: '/sites', seoTitle: 'All Gay Twink Sites' },
      { name: photo.category_name || 'Gallery', url: `/gallery/${categorySlug}/`, seoTitle: `${photo.category_name} - Nude Twink Photos` },
      { name: photo.title || `Photo #${photoId}`, url: `/photo/${photoId}/`, seoTitle: seoTitle }
    ];

    // Full-size image SEO
    const fullImageSeo = {
      alt: generateSeoAlt(photo.title, photo.category_name, contentType),
      title: `${photo.title || photo.category_name} - Full Size ${isVideo ? 'Video' : 'Photo'}`,
      description: `View full size ${isVideo ? 'video' : 'photo'} of ${photo.title || 'content'} from ${photo.category_name}. Free gay twink content.`
    };

    // Internal links for SEO
    const internalLinks = {
      gallery: {
        url: `/gallery/${categorySlug}/`,
        title: `More from ${photo.category_name}`,
        seoAlt: `View more nude twink photos from ${photo.category_name}`
      },
      sites: {
        url: '/sites',
        title: 'Browse All Sites',
        seoAlt: 'Browse all gay twink photo sites'
      },
      hotornot: {
        url: '/hotornot.php',
        title: 'Rate Photos',
        seoAlt: 'Rate hot or not gay twink photos'
      }
    };

    res.json({
      photo: {
        id: photo.id,
        title: photo.title,
        description: photo.description,
        fullPath: photo.local_path,
        thumbnail: fixVideoThumb(photo.thumbnail_path),
        width: photo.width,
        height: photo.height,
        views: photo.view_count + 1,
        rating: photo.average_rating,
        date: photo.created_at,
        categoryId: photo.category_id,
        categoryName: photo.category_name,
        categorySlug: categorySlug,
        approved: photo.approved,
        belongs_to_gallery: photo.belongs_to_gallery,
        seoAlt: generateSeoAlt(photo.title, photo.category_name, contentType),
        seoTitle: generateSeoTitle(photo.title, photo.category_name, contentType),
        fullImageSeo: fullImageSeo
      },
      navigation: {
        prev: prevPhoto,
        next: nextPhoto,
        prevId: nav.prev_id,
        nextId: nav.next_id
      },
      breadcrumbs: breadcrumbs,
      internalLinks: internalLinks,
      related: relatedResult.rows.map(r => ({
        id: r.id,
        title: r.title,
        thumbnail: fixVideoThumb(r.thumbnail_path),
        views: r.view_count,
        url: `/photo/${r.id}/`,
        seoAlt: generateSeoAlt(r.title, photo.category_name, 'photo'),
        seoTitle: generateSeoTitle(r.title, photo.category_name, 'photo')
      })),
      seo: {
        title: seoTitle,
        description: seoDescription,
        ogImage: fixVideoThumb(photo.thumbnail_path),
        canonical: `https://boysreview.com/photo/${photoId}/`,
        keywords: GSC_KEYWORDS.slice(0, 8).concat([photo.category_name, photo.title].filter(Boolean))
      }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Featured galleries (BR Freestuff: Today's Post, Lost Treasures, Gay Videos)
router.get('/featured-galleries', async (req, res) => {
  try {
    const brGalleries = [501, 999, 1001]; // Todays Post, Lost Treasures, Gay Videos

    const result = await pool.query(`
      SELECT id, catname, description, photo_count,
             (SELECT thumbnail_path FROM image WHERE belongs_to_gallery = c.id ORDER BY created_at DESC LIMIT 1) as latest_thumb
      FROM category c
      WHERE id = ANY($1)
    `, [brGalleries]);

    const featured = result.rows.map(cat => ({
      id: cat.id,
      name: cat.catname,
      slug: cat.catname.toLowerCase().replace(/\s+/g, '-'),
      description: cat.description,
      photoCount: cat.photo_count,
      thumbnail: cat.latest_thumb
    }));

    res.json({ featured });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// FEATURED SITES API (for SitesPage)
// ============================================================================

router.get('/featured', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';

    const result = await pool.query(`
      SELECT c.id, c.catname as name, c.description, c.photo_count,
             (SELECT thumbnail_path FROM image WHERE belongs_to_gallery = c.id ORDER BY view_count DESC NULLS LAST LIMIT 1) as thumbnail
      FROM category c
      WHERE c.photo_count > 100
      ORDER BY c.photo_count DESC
      LIMIT 20
    `);

    let featured = result.rows;

    // Get translated descriptions if not English
    if (lang !== 'en') {
      const categoryIds = featured.map(c => c.id);
      const translationsResult = await pool.query(`
        SELECT content_id, field_name, translated_text
        FROM content_translations
        WHERE content_type = 'category' AND language_code = $1 AND content_id = ANY($2)
      `, [lang, categoryIds]);

      const translationsMap = {};
      translationsResult.rows.forEach(t => {
        if (!translationsMap[t.content_id]) translationsMap[t.content_id] = {};
        translationsMap[t.content_id][t.field_name] = t.translated_text;
      });

      featured = featured.map(s => ({
        id: s.id,
        name: s.name, // Keep original name for URLs
        slug: s.name?.toLowerCase().replace(/\s+/g, '-'),
        description: translationsMap[s.id]?.description || s.description,
        photoCount: s.photo_count,
        thumbnail: s.thumbnail ? `/data/${s.thumbnail}` : null
      }));
    } else {
      featured = featured.map(s => ({
        id: s.id,
        name: s.name,
        slug: s.name?.toLowerCase().replace(/\s+/g, '-'),
        description: s.description,
        photoCount: s.photo_count,
        thumbnail: s.thumbnail ? `/data/${s.thumbnail}` : null
      }));
    }

    res.json({ featured });
  } catch(e) {
    console.error('Featured error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// JOURNEY PAGE API (curated content sections)
// ============================================================================

// Journey cache (5 minute TTL)
let journeyCache = { data: null, timestamp: 0 };
const JOURNEY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Journey section translations
const journeySectionTranslations = {
  en: { newToday: 'New Today', newTodaySub: 'Fresh content added recently', trending: 'Trending Now', trendingSub: 'Most viewed this week', topRated: 'Top Rated', topRatedSub: 'Highest rated by community' },
  es: { newToday: 'Nuevo Hoy', newTodaySub: 'Contenido fresco añadido recientemente', trending: 'Tendencias', trendingSub: 'Más vistos esta semana', topRated: 'Mejor Valorados', topRatedSub: 'Los mejor calificados por la comunidad' },
  de: { newToday: 'Neu Heute', newTodaySub: 'Frisch hinzugefügte Inhalte', trending: 'Im Trend', trendingSub: 'Diese Woche am meisten angesehen', topRated: 'Top Bewertet', topRatedSub: 'Höchstbewertet von der Community' },
  fr: { newToday: "Nouveau Aujourd'hui", newTodaySub: 'Contenu frais ajouté récemment', trending: 'Tendances', trendingSub: 'Les plus vus cette semaine', topRated: 'Mieux Notés', topRatedSub: 'Les mieux notés par la communauté' },
  it: { newToday: 'Nuovo Oggi', newTodaySub: 'Contenuti freschi aggiunti di recente', trending: 'Di Tendenza', trendingSub: 'Più visti questa settimana', topRated: 'Più Votati', topRatedSub: 'I più votati dalla community' },
  pt: { newToday: 'Novo Hoje', newTodaySub: 'Conteúdo fresco adicionado recentemente', trending: 'Em Alta', trendingSub: 'Mais vistos esta semana', topRated: 'Mais Votados', topRatedSub: 'Melhor avaliados pela comunidade' },
  nl: { newToday: 'Nieuw Vandaag', newTodaySub: 'Verse content recent toegevoegd', trending: 'Trending', trendingSub: 'Meest bekeken deze week', topRated: 'Top Beoordeeld', topRatedSub: 'Hoogst beoordeeld door de community' },
  ru: { newToday: 'Новое Сегодня', newTodaySub: 'Свежий контент добавлен недавно', trending: 'В Тренде', trendingSub: 'Самые просматриваемые на этой неделе', topRated: 'Лучшие', topRatedSub: 'Высший рейтинг от сообщества' },
  ja: { newToday: '本日の新着', newTodaySub: '最近追加された新しいコンテンツ', trending: 'トレンド', trendingSub: '今週最も閲覧された', topRated: '高評価', topRatedSub: 'コミュニティで最高評価' },
  zh: { newToday: '今日新增', newTodaySub: '最近添加的新内容', trending: '热门趋势', trendingSub: '本周最多浏览', topRated: '最高评分', topRatedSub: '社区最高评分' },
  ar: { newToday: 'جديد اليوم', newTodaySub: 'محتوى جديد أضيف مؤخراً', trending: 'الأكثر رواجاً', trendingSub: 'الأكثر مشاهدة هذا الأسبوع', topRated: 'الأعلى تقييماً', topRatedSub: 'الأعلى تقييماً من المجتمع' },
  ko: { newToday: '오늘의 신규', newTodaySub: '최근 추가된 새 콘텐츠', trending: '인기 급상승', trendingSub: '이번 주 가장 많이 본', topRated: '최고 평점', topRatedSub: '커뮤니티 최고 평점' },
  el: { newToday: 'Νέο Σήμερα', newTodaySub: 'Φρέσκο περιεχόμενο που προστέθηκε πρόσφατα', trending: 'Τάσεις', trendingSub: 'Τα πιο δημοφιλή αυτή την εβδομάδα', topRated: 'Κορυφαία', topRatedSub: 'Υψηλότερη βαθμολογία από την κοινότητα' },
  sv: { newToday: 'Nytt Idag', newTodaySub: 'Färskt innehåll nyligen tillagt', trending: 'Trendande', trendingSub: 'Mest visade denna vecka', topRated: 'Högst Betyg', topRatedSub: 'Högst betygsatt av communityn' },
  da: { newToday: 'Nyt I Dag', newTodaySub: 'Frisk indhold tilføjet for nylig', trending: 'Trending', trendingSub: 'Mest set denne uge', topRated: 'Top Bedømt', topRatedSub: 'Højest bedømt af fællesskabet' },
  no: { newToday: 'Nytt I Dag', newTodaySub: 'Ferskt innhold lagt til nylig', trending: 'Trending', trendingSub: 'Mest sett denne uken', topRated: 'Topprangert', topRatedSub: 'Høyest rangert av fellesskapet' },
  fi: { newToday: 'Uutta Tänään', newTodaySub: 'Tuore sisältö lisätty äskettäin', trending: 'Trendaavat', trendingSub: 'Katsotuimmat tällä viikolla', topRated: 'Parhaiten Arvioidut', topRatedSub: 'Yhteisön parhaiten arvioima' }
};

router.get('/journey', async (req, res) => {
  try {
    const lang = req.query.lang || 'en';
    const translations = journeySectionTranslations[lang] || journeySectionTranslations.en;

    // Check cache first (per language)
    const cacheKey = `journey_${lang}`;
    const now = Date.now();
    if (journeyCache[cacheKey] && (now - journeyCache[cacheKey].timestamp) < JOURNEY_CACHE_TTL) {
      return res.json(journeyCache[cacheKey].data);
    }

    // Run queries in parallel using PostgreSQL
    const [latestResult, popularResult, topRatedResult] = await Promise.all([
      pool.query(`
        SELECT i.id, i.title, i.thumbnail_path, c.catname as site, i.belongs_to_gallery as cat
        FROM image i
        LEFT JOIN category c ON i.belongs_to_gallery = c.id
        WHERE i.thumbnail_path IS NOT NULL
        ORDER BY i.id DESC
        LIMIT 16
      `),
      pool.query(`
        SELECT i.id, i.title, i.thumbnail_path, c.catname as site, i.belongs_to_gallery as cat
        FROM image i
        LEFT JOIN category c ON i.belongs_to_gallery = c.id
        WHERE i.thumbnail_path IS NOT NULL
        ORDER BY COALESCE(i.view_count, 0) DESC
        LIMIT 16
      `),
      pool.query(`
        SELECT i.id, i.title, i.thumbnail_path, c.catname as site, i.belongs_to_gallery as cat
        FROM image i
        LEFT JOIN category c ON i.belongs_to_gallery = c.id
        WHERE i.thumbnail_path IS NOT NULL AND i.average_rating > 0
        ORDER BY i.average_rating DESC
        LIMIT 16
      `)
    ]);

    const formatItems = (rows) => rows.map(r => ({
      id: r.id,
      title: r.title || 'Untitled',
      thumbnail: r.thumbnail_path ? `/data/${r.thumbnail_path}` : null,
      site: r.site,
      siteId: r.cat,
      comments: 0,
      url: `/photo/${r.id}/`,
      isVideo: false,
      seoAlt: generateSeoAlt(r.title, r.site, 'photo'),
      seoTitle: generateSeoTitle(r.title, r.site, 'photo')
    }));

    const responseData = {
      journey: [
        { id: 'new-today', title: translations.newToday, subtitle: translations.newTodaySub, icon: 'Sparkles', items: formatItems(latestResult.rows) },
        { id: 'trending', title: translations.trending, subtitle: translations.trendingSub, icon: 'TrendingUp', items: formatItems(popularResult.rows) },
        { id: 'top-rated', title: translations.topRated, subtitle: translations.topRatedSub, icon: 'Star', items: formatItems(topRatedResult.rows) }
      ]
    };

    // Save to cache (per language)
    if (!journeyCache || typeof journeyCache !== 'object') journeyCache = {};
    journeyCache[cacheKey] = { data: responseData, timestamp: Date.now() };

    res.json(responseData);
  } catch(e) {
    console.error('Journey endpoint error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// MODELS PAGE API
// ============================================================================

router.get('/models', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const search = req.query.q || '';
    const categoryId = parseInt(req.query.category) || 0;
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        TRIM(SPLIT_PART(title, ' at ', 1)) as name,
        COUNT(*) as photo_count,
        MAX(i.thumbnail_path) as thumbnail,
        MAX(c.catname) as site,
        MAX(c.id) as category_id
      FROM image i
      LEFT JOIN category c ON i.belongs_to_gallery = c.id
      WHERE title LIKE '% at %'
    `;

    const params = [];

    // Filter by category if provided
    if (categoryId > 0) {
      params.push(categoryId);
      query += ` AND i.belongs_to_gallery = $${params.length}`;
    }

    if (search) {
      params.push('%' + search + '%');
      query += ` AND title ILIKE $${params.length}`;
    }

    query += `
      GROUP BY TRIM(SPLIT_PART(title, ' at ', 1))
      HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(DISTINCT TRIM(SPLIT_PART(title, ' at ', 1))) as total
      FROM image i
      WHERE title LIKE '% at %'
    `;
    const countParams = [];
    if (categoryId > 0) {
      countParams.push(categoryId);
      countQuery += ` AND i.belongs_to_gallery = $${countParams.length}`;
    }
    if (search) {
      countParams.push('%' + search + '%');
      countQuery += ` AND title ILIKE $${countParams.length}`;
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total) || 0;

    res.json({
      models: result.rows.map(m => {
        const siteSlug = (m.site || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const modelSlug = encodeURIComponent(m.name || '');
        return {
          id: m.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: m.name,
          photoCount: parseInt(m.photo_count),
          thumbnail: m.thumbnail ? `/data/${m.thumbnail}` : null,
          site: m.site,
          url: `/model/${siteSlug}/${modelSlug}`
        };
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Model detail with AI bio
router.get('/model/:site/:name', async (req, res) => {
  try {
    const { site, name } = req.params;
    const modelName = decodeURIComponent(name);
    const siteName = decodeURIComponent(site);

    // Get model photos
    const photosResult = await pool.query(`
      SELECT i.id, i.title, i.thumbnail_path, i.local_path, i.view_count, i.created_at,
             c.catname as site_name
      FROM image i
      LEFT JOIN category c ON i.belongs_to_gallery = c.id
      WHERE LOWER(i.title) LIKE LOWER($1)
        AND LOWER(c.catname) = LOWER($2)
      ORDER BY i.created_at DESC
      LIMIT 100
    `, [`%${modelName} at %`, siteName]);

    if (photosResult.rows.length === 0) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const photos = photosResult.rows;
    const photoCount = photos.length;

    // Generate AI bio characteristics based on model name patterns
    // In production, this would come from a database or AI service
    const characteristics = generateModelCharacteristics(modelName, photoCount);

    // Get unique photosets (grouped by date)
    const photosets = {};
    photos.forEach(p => {
      const date = p.created_at ? new Date(p.created_at).toISOString().split('T')[0] : 'unknown';
      if (!photosets[date]) {
        photosets[date] = {
          date,
          photos: [],
          thumbnail: p.thumbnail_path
        };
      }
      photosets[date].photos.push(p);
    });

    res.json({
      model: {
        name: modelName,
        site: photos[0]?.site_name || siteName,
        photoCount,
        thumbnail: photos[0]?.thumbnail_path ? `/data/${photos[0].thumbnail_path}` : null
      },
      bio: characteristics,
      photos: photos.map(p => ({
        id: p.id,
        title: p.title,
        thumbnail: p.thumbnail_path,
        fullPath: p.local_path,
        views: p.view_count || 0
      })),
      photosets: Object.values(photosets).slice(0, 20),
      seo: {
        title: `${modelName} - ${photos[0]?.site_name || siteName} Model Photos`,
        description: `View ${photoCount} photos of ${modelName} from ${photos[0]?.site_name || siteName}. ${characteristics.summary}`,
        canonical: `https://boysreview.com/model/${encodeURIComponent(siteName)}/${encodeURIComponent(modelName)}`
      }
    });
  } catch(e) {
    console.error('Model detail error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Generate model characteristics (AI-style bio with adult attributes)
function generateModelCharacteristics(name, photoCount) {
  // Seed random based on name for consistency
  const seed = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (arr) => arr[seed % arr.length];
  const rand2 = (arr, mult) => arr[(seed * mult) % arr.length];

  // Physical characteristics
  const eyeColors = ['Blue', 'Green', 'Brown', 'Hazel', 'Gray'];
  const hairColors = ['Blonde', 'Brown', 'Black', 'Red', 'Light Brown', 'Dark Blonde'];
  const hairTypes = ['Straight', 'Wavy', 'Curly'];
  const bodyTypes = ['Slim', 'Athletic', 'Toned', 'Lean', 'Muscular', 'Twink'];
  const heights = ['5\'7"', '5\'8"', '5\'9"', '5\'10"', '5\'11"', '6\'0"', '6\'1"'];

  // Adult characteristics
  const cockSizes = ['Average', 'Above Average', 'Well Endowed', 'Hung', 'Impressive'];
  const cutStatus = ['Cut', 'Uncut'];
  const positions = ['Top', 'Bottom', 'Versatile', 'Versatile Top', 'Versatile Bottom'];
  const pubicStyles = ['Trimmed', 'Shaved', 'Natural', 'Groomed'];
  const assTypes = ['Bubble Butt', 'Tight', 'Smooth', 'Firm', 'Peachy'];
  const dickTypes = ['Thick', 'Long', 'Curved', 'Straight', 'Girthy'];

  const eyeColor = rand(eyeColors);
  const hairColor = rand2(hairColors, 3);
  const hairType = rand2(hairTypes, 7);
  const bodyType = rand2(bodyTypes, 11);
  const height = rand2(heights, 13);
  const age = 18 + (seed % 8); // 18-25

  const cockSize = rand2(cockSizes, 17);
  const cut = rand2(cutStatus, 19);
  const position = rand2(positions, 23);
  const pubicStyle = rand2(pubicStyles, 29);
  const assType = rand2(assTypes, 31);
  const dickType = rand2(dickTypes, 37);

  const positionDesc = position === 'Top' ? 'dominant top' :
                       position === 'Bottom' ? 'eager bottom' :
                       'versatile performer';

  return {
    eyeColor,
    hairColor,
    hairType,
    bodyType,
    height,
    age,
    // Adult attributes
    cockSize,
    cut,
    position,
    pubicStyle,
    assType,
    dickType,
    summary: `${name} is a ${age}-year-old ${bodyType.toLowerCase()} model with ${hairColor.toLowerCase()} ${hairType.toLowerCase()} hair and ${eyeColor.toLowerCase()} eyes. Standing at ${height}, this ${positionDesc} is known for his ${assType.toLowerCase()} and ${cockSize.toLowerCase()} ${cut.toLowerCase()} ${dickType.toLowerCase()} cock.`,
    stats: {
      totalPhotos: photoCount,
      popularity: photoCount > 50 ? 'High' : photoCount > 20 ? 'Medium' : 'Rising'
    }
  };
}

// ============================================================================
// TICKERS API (for homepage widgets)
// ============================================================================

router.get('/tickers', async (req, res) => {
  try {
    // Latest comments
    const comments = await pool.query(`
      SELECT c.id, c.comment_text, c.username, c.created_at, i.title as photo_title, i.id as photo_id
      FROM comments c
      JOIN image i ON c.photo_id = i.id
      ORDER BY c.created_at DESC
      LIMIT 10
    `);

    // Best pics today
    const bestPics = await pool.query(`
      SELECT id, title, thumbnail_path, view_count
      FROM image
      WHERE created_at > NOW() - INTERVAL '7 days'
      ORDER BY view_count DESC
      LIMIT 10
    `);

    // Latest updates
    const latest = await pool.query(`
      SELECT id, title, thumbnail_path, created_at
      FROM image
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({
      comments: comments.rows.map(c => ({
        id: c.id,
        text: c.comment_text?.substring(0, 100),
        username: c.username,
        photoId: c.photo_id,
        photoTitle: c.photo_title
      })),
      bestPics: bestPics.rows.map(p => ({
        id: p.id,
        title: p.title,
        thumbnail: p.thumbnail_path ? `/data/${p.thumbnail_path}` : null,
        views: p.view_count
      })),
      latest: latest.rows.map(p => ({
        id: p.id,
        title: p.title,
        thumbnail: p.thumbnail_path ? `/data/${p.thumbnail_path}` : null
      }))
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// HOT OR NOT API ENDPOINTS
// ============================================================================

// Get random photo for Hot or Not
router.get('/hotornot/random', async (req, res) => {
  try {
    // Get a random photo from popular categories
    const result = await pool.query(`
      SELECT i.id, i.title, i.local_path, i.thumbnail_path, i.view_count,
             c.catname as category_name, c.id as category_id
      FROM image i
      LEFT JOIN category c ON i.belongs_to_gallery = c.id
      WHERE i.local_path IS NOT NULL
        AND i.thumbnail_path IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No photos available' });
    }

    const photo = result.rows[0];

    // Get vote stats for this photo
    const statsResult = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN vote = 'hot' THEN 1 ELSE 0 END), 0) as hot_votes,
        COALESCE(SUM(CASE WHEN vote = 'not' THEN 1 ELSE 0 END), 0) as not_votes,
        COUNT(*) as total_votes
      FROM hotornot_votes
      WHERE photo_id = $1
    `, [photo.id]);

    const stats = statsResult.rows[0];
    const totalVotes = parseInt(stats.total_votes) || 0;
    const hotVotes = parseInt(stats.hot_votes) || 0;
    const hotPercentage = totalVotes > 0 ? Math.round((hotVotes / totalVotes) * 100) : 50;

    res.json({
      photo: {
        id: photo.id,
        title: photo.title,
        fullPath: photo.local_path,
        thumbnail: photo.thumbnail_path,
        views: photo.view_count,
        categoryId: photo.category_id,
        categoryName: photo.category_name,
        categorySlug: photo.category_name?.toLowerCase().replace(/\s+/g, '-')
      },
      stats: {
        totalVotes,
        hotPercentage
      }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Submit vote for Hot or Not
router.post('/hotornot/vote', async (req, res) => {
  try {
    const { photoId, vote } = req.body;

    if (!photoId || !['hot', 'not'].includes(vote)) {
      return res.status(400).json({ error: 'Invalid vote' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '';

    // Check if already voted (simple IP-based check)
    const existingVote = await pool.query(
      'SELECT id FROM hotornot_votes WHERE photo_id = $1 AND ip_address = $2',
      [photoId, ip]
    );

    if (existingVote.rows.length > 0) {
      // Update existing vote
      await pool.query(
        'UPDATE hotornot_votes SET vote = $1, updated_at = NOW() WHERE photo_id = $2 AND ip_address = $3',
        [vote, photoId, ip]
      );
    } else {
      // Insert new vote
      await pool.query(
        'INSERT INTO hotornot_votes (photo_id, vote, ip_address) VALUES ($1, $2, $3)',
        [photoId, vote, ip]
      );
    }

    // Get updated stats
    const statsResult = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN vote = 'hot' THEN 1 ELSE 0 END), 0) as hot_votes,
        COUNT(*) as total_votes
      FROM hotornot_votes
      WHERE photo_id = $1
    `, [photoId]);

    const stats = statsResult.rows[0];
    const totalVotes = parseInt(stats.total_votes) || 0;
    const hotVotes = parseInt(stats.hot_votes) || 0;
    const hotPercentage = totalVotes > 0 ? Math.round((hotVotes / totalVotes) * 100) : 50;

    res.json({
      success: true,
      stats: {
        totalVotes,
        hotPercentage
      }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

// Check if user is authenticated (checks admin_session in database first, then user session)
router.get('/auth/check', async (req, res) => {
  try {
    // First check admin_session cookie (database-backed)
    const adminSessionId = req.cookies?.admin_session;
    if (adminSessionId) {
      const session = await getAdminSession(adminSessionId);
      if (session) {
        const isAdmin = session.roles?.includes('super_admin') || session.roles?.includes('admin');
        return res.json({
          authenticated: true,
          isAdmin,
          roles: session.roles,
          permissions: session.permissions,
          username: session.username
        });
      }
    }

    // Fall back to database session check for regular users
    const sessionId = req.cookies?.session || req.headers['x-session-id'];

    if (!sessionId) {
      return res.json({ authenticated: false, isAdmin: false });
    }

    // Check session in database
    const result = await pool.query(
      'SELECT u.id, u.username, u.email FROM users u JOIN sessions s ON u.id = s.user_id WHERE s.session_id = $1 AND s.expires_at > NOW()',
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: {
        id: result.rows[0].id,
        username: result.rows[0].username,
        email: result.rows[0].email
      }
    });
  } catch(e) {
    res.json({ authenticated: false });
  }
});

// ============================================================================
// ENHANCED SEARCH ENDPOINT
// ============================================================================

// Enhanced search with type filtering for React SearchPage
router.get('/search/advanced', async (req, res) => {
  try {
    const q = req.query.q || '';
    const type = req.query.type || 'all';
    const limit = parseInt(req.query.limit) || 24;

    if (!q.trim()) {
      return res.json({ photos: [], videos: [], galleries: [], models: [], total: 0 });
    }

    const searchPattern = '%' + q + '%';
    let photos = [];
    let videos = [];
    let galleries = [];
    let models = [];

    // Search photos/videos
    if (type === 'all' || type === 'photos' || type === 'videos') {
      const imageResult = await pool.query(`
        SELECT i.id, i.title, i.thumbnail_path, i.local_path, i.view_count,
               c.catname as category_name,
               CASE WHEN i.local_path LIKE '%.mp4' OR i.local_path LIKE '%.webm' THEN true ELSE false END as is_video
        FROM image i
        LEFT JOIN category c ON i.belongs_to_gallery = c.id
        WHERE i.title ILIKE $1 OR i.description ILIKE $1 OR c.catname ILIKE $1
        ORDER BY i.view_count DESC
        LIMIT $2
      `, [searchPattern, limit]);

      const images = imageResult.rows.map(img => ({
        id: img.id,
        title: img.title,
        thumbnail: img.thumbnail_path,
        fullPath: img.local_path,
        views: img.view_count,
        categoryName: img.category_name
      }));

      if (type === 'all' || type === 'photos') {
        photos = images.filter(img => !img.fullPath?.match(/\.(mp4|webm|mov)$/i));
      }
      if (type === 'all' || type === 'videos') {
        videos = images.filter(img => img.fullPath?.match(/\.(mp4|webm|mov)$/i));
      }
    }

    // Search galleries
    if (type === 'all' || type === 'galleries') {
      const galleryResult = await pool.query(`
        SELECT c.id, c.catname as name, c.description, c.photo_count,
               (SELECT thumbnail_path FROM image WHERE belongs_to_gallery = c.id LIMIT 1) as thumbnail
        FROM category c
        WHERE c.catname ILIKE $1 OR c.description ILIKE $1
        ORDER BY c.photo_count DESC
        LIMIT $2
      `, [searchPattern, limit]);

      galleries = galleryResult.rows.map(g => ({
        id: g.id,
        name: g.name,
        slug: g.name?.toLowerCase().replace(/\s+/g, '-'),
        description: g.description,
        photoCount: g.photo_count,
        thumbnail: g.thumbnail
      }));
    }

    // Search models (from image titles)
    if (type === 'all' || type === 'models') {
      const modelResult = await pool.query(`
        SELECT
          TRIM(SPLIT_PART(title, ' at ', 1)) as name,
          COUNT(*) as photo_count,
          (SELECT thumbnail_path FROM image WHERE title ILIKE $1 LIMIT 1) as thumbnail
        FROM image
        WHERE title ILIKE $1
          AND title LIKE '% at %'
        GROUP BY TRIM(SPLIT_PART(title, ' at ', 1))
        HAVING COUNT(*) >= 2
        ORDER BY COUNT(*) DESC
        LIMIT $2
      `, [searchPattern, limit]);

      models = modelResult.rows.map(m => ({
        id: m.name?.toLowerCase().replace(/\s+/g, '-'),
        name: m.name,
        photoCount: parseInt(m.photo_count),
        thumbnail: m.thumbnail
      }));
    }

    const total = photos.length + videos.length + galleries.length + models.length;

    logSearch(req, q, total);

    res.json({
      query: q,
      photos,
      videos,
      galleries,
      models,
      total
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================================
// ADMIN AUTHENTICATION & UPLOAD API
// ============================================================================

// Admin session check using database (imported from auth-routes.js)
// All admin auth is now database-backed via getAdminSession

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = '/tmp/boyvue-uploads';
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomBytes(8).toString('hex');
    cb(null, `${uniqueId}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  }
});

// Check admin session middleware (database-backed)
async function checkAdminSession(req) {
  const sessionId = req.cookies?.admin_session || req.headers['x-admin-session'];
  if (!sessionId) return null;
  const session = await getAdminSession(sessionId);
  if (!session) return null;
  return {
    ...session,
    isAdmin: session.roles?.includes('super_admin') || session.roles?.includes('admin')
  };
}

// NOTE: /auth/check, /auth/login, /auth/logout are now handled by auth-routes.js
// The auth-routes.js endpoints at /api/auth/* take precedence

// Admin file upload
router.post('/admin/upload', upload.single('file'), async (req, res) => {
  try {
    const session = await checkAdminSession(req);
    if (!session?.isAdmin) {
      return res.status(401).json({ success: false, error: 'Admin access required' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { category, file_type, title, keywords, model, actors } = req.body;
    const categoryId = parseInt(category);

    // Get uploader IP for logging
    const uploaderIP = req.headers['cf-connecting-ip'] ||
                       req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                       req.socket.remoteAddress || '';

    if (!categoryId) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'Invalid category' });
    }

    const file = req.file;
    const isVideo = file.mimetype.startsWith('video/');
    const isImage = file.mimetype.startsWith('image/');

    // Data paths - use boysreview data directory
    const DATA_PATH = '/var/www/html/boysreview/data';
    const catPath = `${DATA_PATH}/${categoryId}`;
    const thumbPath = `${catPath}/thumbs`;
    const mediumPath = `${catPath}/medium`;

    // Create directories
    [catPath, thumbPath, mediumPath].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // Generate SEO-friendly filename
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const cleanTitle = (title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
    const cleanKeyword = (keywords || '').split(',')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    let seoBase = `${categoryId}-${cleanTitle}`;
    if (cleanKeyword) seoBase += `-${cleanKeyword}`;
    seoBase += `-${uniqueId}`;

    let result;
    if (isImage) {
      result = await processImageUpload(file.path, seoBase, catPath, thumbPath, mediumPath);
    } else {
      result = await processVideoUpload(file.path, seoBase, catPath, thumbPath);
    }

    if (!result.success) {
      fs.unlinkSync(file.path);
      return res.status(500).json({ success: false, error: result.error });
    }

    // Clean up temp file
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    // Build proper paths with category prefix for database storage
    const localPath = `${categoryId}/${result.filename}`;
    const thumbPath_db = `${categoryId}/thumbs/${result.thumbFilename || result.filename}`;
    const hasWebp = result.webp || false;

    // Insert into PostgreSQL (using existing column names)
    const dbTitle = title || cleanTitle.replace(/-/g, ' ');
    const actorsList = actors || model || ''; // Support both actors and model fields
    const insertResult = await pool.query(`
      INSERT INTO image (
        belongs_to_gallery, title, description, local_path, thumbnail_path,
        width, height, file_size, webp_available, created_at,
        approved, is_admin_upload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), true, true)
      RETURNING id
    `, [
      categoryId,
      dbTitle,
      `${actorsList ? 'Actors: ' + actorsList + '. ' : ''}${keywords ? 'Keywords: ' + keywords : ''}`.trim() || null,
      localPath,
      thumbPath_db,
      result.width || 0,
      result.height || 0,
      result.filesize || 0,
      hasWebp
    ]);

    const photoId = insertResult.rows[0].id;

    // Update category photo count
    await pool.query(`
      UPDATE category SET photo_count = photo_count + 1 WHERE id = $1
    `, [categoryId]);

    // Log upload with IP address
    await pool.query(`
      INSERT INTO admin_logs (admin_user, action, ip_address, details, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [
      session.username,
      'upload_' + (isVideo ? 'video' : 'image'),
      uploaderIP,
      JSON.stringify({ photoId, categoryId, title: dbTitle, actors: actorsList, filename: result.filename })
    ]).catch(e => console.error('Log insert error:', e.message));

    res.json({
      success: true,
      photoId,
      filename: result.filename,
      type: isVideo ? 'video' : 'image',
      ip: uploaderIP.substring(0, 15) // Show truncated IP in response
    });

  } catch (error) {
    console.error('Upload error:', error);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process image upload using Sharp (replaces ImageMagick)
async function processImageUpload(srcPath, seoBase, catPath, thumbPath, mediumPath) {
  const filename = `${seoBase}.jpg`;
  const destPath = `${catPath}/${filename}`;
  const thumbDest = `${thumbPath}/${filename}`;
  const mediumDest = `${mediumPath}/${filename}`;
  const webpDest = `${catPath}/${seoBase}.webp`;

  try {
    // Get original dimensions using Sharp
    const metadata = await sharp(srcPath).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    // Main image - high quality JPEG
    await sharp(srcPath)
      .jpeg({ quality: 90 })
      .toFile(destPath);

    // Thumbnail (300x300 center crop)
    await sharp(srcPath)
      .resize(300, 300, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 80 })
      .toFile(thumbDest);

    // Medium (600x450 fit within, don't enlarge)
    await sharp(srcPath)
      .resize(600, 450, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(mediumDest);

    // WebP version for modern browsers
    await sharp(srcPath)
      .webp({ quality: 85 })
      .toFile(webpDest);

    const stats = fs.statSync(destPath);

    return {
      success: true,
      filename,
      thumbFilename: filename,
      width,
      height,
      filesize: stats.size,
      webp: true
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Process video upload
async function processVideoUpload(srcPath, seoBase, catPath, thumbPath) {
  const filename = `${seoBase}.mp4`;
  const destPath = `${catPath}/${filename}`;
  const thumbFilename = `${seoBase}.jpg`;
  const mainThumbDest = `${thumbPath}/${thumbFilename}`;

  try {
    // Get video info
    const { stdout: probeOut } = await execAsync(`ffprobe -v quiet -print_format json -show_format -show_streams "${srcPath}"`);
    const probeData = JSON.parse(probeOut);
    const duration = parseFloat(probeData.format?.duration || 0);
    let width = 0, height = 0;
    for (const stream of (probeData.streams || [])) {
      if (stream.codec_type === 'video') {
        width = stream.width;
        height = stream.height;
        break;
      }
    }

    // Convert to MP4 H.264
    await execAsync(`ffmpeg -i "${srcPath}" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart -y "${destPath}"`);

    // Generate thumbnails at 10% intervals (300x300)
    for (let pct = 0; pct <= 90; pct += 10) {
      const time = Math.max(0.5, (duration * pct / 100));
      const thumbDest = `${thumbPath}/${seoBase}_${pct}.jpg`;
      await execAsync(`ffmpeg -i "${destPath}" -ss ${time} -vframes 1 -vf "scale=300:300:force_original_aspect_ratio=increase,crop=300:300" -y "${thumbDest}"`).catch(() => {});
    }

    // Main thumbnail at 10%
    const thumb10 = `${thumbPath}/${seoBase}_10.jpg`;
    if (fs.existsSync(thumb10)) {
      fs.copyFileSync(thumb10, mainThumbDest);
    } else if (fs.existsSync(`${thumbPath}/${seoBase}_0.jpg`)) {
      fs.copyFileSync(`${thumbPath}/${seoBase}_0.jpg`, mainThumbDest);
    }

    const stats = fs.statSync(destPath);

    return {
      success: true,
      filename,
      thumbFilename,
      width,
      height,
      filesize: stats.size,
      duration: Math.round(duration)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// SITEMAP GENERATION & SEARCH ENGINE SUBMISSION
// ============================================================================

// Generate sitemap XML
async function generateSitemap() {
  const baseUrl = 'https://boysreview.com';
  const now = new Date().toISOString().split('T')[0];

  // Get all categories with content
  const categories = await pool.query(`
    SELECT id, catname, photo_count FROM category
    WHERE photo_count > 0 ORDER BY photo_count DESC
  `);

  // Get recent images for image sitemap
  const recentImages = await pool.query(`
    SELECT i.id, i.title, i.thumbnail_path, i.created_at, c.catname
    FROM image i
    JOIN category c ON i.belongs_to_gallery = c.id
    WHERE i.thumbnail_path IS NOT NULL
    ORDER BY i.created_at DESC LIMIT 5000
  `);

  // Get all models
  const models = await pool.query(`
    SELECT DISTINCT TRIM(SPLIT_PART(title, ' at ', 1)) as name,
           c.catname as site,
           MAX(i.created_at) as last_updated
    FROM image i
    JOIN category c ON i.belongs_to_gallery = c.id
    WHERE title LIKE '% at %'
    GROUP BY TRIM(SPLIT_PART(title, ' at ', 1)), c.catname
    HAVING COUNT(*) >= 3
  `);

  // Get videos for video sitemap
  const videos = await pool.query(`
    SELECT i.id, i.local_path, i.title, i.thumbnail_path, i.created_at, c.catname
    FROM image i
    LEFT JOIN category c ON i.belongs_to_gallery = c.id
    WHERE (i.local_path LIKE '%.mp4' OR i.local_path LIKE '%.webm' OR i.local_path LIKE '%.mov')
    ORDER BY i.created_at DESC
    LIMIT 5000
  `);

  // Build sitemap index
  let sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${baseUrl}/sitemap_pages.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${baseUrl}/sitemap_categories.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${baseUrl}/sitemap_images.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${baseUrl}/sitemap_videos.xml</loc><lastmod>${now}</lastmod></sitemap>
  <sitemap><loc>${baseUrl}/sitemap_models.xml</loc><lastmod>${now}</lastmod></sitemap>
</sitemapindex>`;

  // Pages sitemap
  let pagesSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${baseUrl}/sites</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>${baseUrl}/models</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
  <url><loc>${baseUrl}/search</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>
</urlset>`;

  // Categories sitemap
  let categoriesSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
  for (const cat of categories.rows) {
    const slug = cat.catname.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    categoriesSitemap += `  <url>
    <loc>${baseUrl}/gallery/${encodeURIComponent(slug)}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  }
  categoriesSitemap += `</urlset>`;

  // Images sitemap
  let imagesSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;
  for (const img of recentImages.rows) {
    const catSlug = img.catname.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    imagesSitemap += `  <url>
    <loc>${baseUrl}/photo/${catSlug}/${img.id}</loc>
    <image:image>
      <image:loc>${baseUrl}/data/${img.thumbnail_path}</image:loc>
      <image:title>${(img.title || '').replace(/[<>&'"]/g, '')}</image:title>
    </image:image>
  </url>\n`;
  }
  imagesSitemap += `</urlset>`;

  // Models sitemap
  let modelsSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
  for (const model of models.rows) {
    const siteSlug = model.site.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const modelSlug = encodeURIComponent(model.name);
    modelsSitemap += `  <url>
    <loc>${baseUrl}/model/${siteSlug}/${modelSlug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
  }
  modelsSitemap += `</urlset>`;

  // Videos sitemap with unique watch pages (fixes GSC "Video isn't on a watch page")
  let videosSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
`;
  for (const video of videos.rows) {
    const pathParts = (video.local_path || '').split('/');
    const storecat = pathParts.length > 1 ? pathParts[0] : '';
    const filename = pathParts.length > 1 ? pathParts.slice(1).join('/') : video.local_path;

    const titleSlug = (video.title || 'video')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    const pageUrl = `${baseUrl}/video/${video.id}/${titleSlug}`;
    const videoUrl = `${baseUrl}/data/${video.local_path}`;

    const thumbFile = filename.replace(/\.(mp4|webm|mov)$/i, '.jpg');
    const thumbUrl = video.thumbnail_path
      ? `${baseUrl}/data/${video.thumbnail_path}`
      : `${baseUrl}/data/${storecat}/thumbs/${thumbFile}`;

    const title = (video.title || filename || 'Video').replace(/[<>&'"]/g, '').substring(0, 100);
    const description = `${title} - Gay twink video content from ${video.catname || 'BoysReview'}`;
    const uploadDate = video.created_at ? new Date(video.created_at).toISOString().split('T')[0] : now;

    videosSitemap += `  <url>
    <loc>${pageUrl}</loc>
    <video:video>
      <video:thumbnail_loc>${thumbUrl}</video:thumbnail_loc>
      <video:title>${title}</video:title>
      <video:description>${description}</video:description>
      <video:content_loc>${videoUrl}</video:content_loc>
      <video:player_loc allow_embed="yes">${pageUrl}</video:player_loc>
      <video:duration>300</video:duration>
      <video:publication_date>${uploadDate}</video:publication_date>
      <video:family_friendly>no</video:family_friendly>
      <video:requires_subscription>no</video:requires_subscription>
      <video:live>no</video:live>
      <video:tag>gay</video:tag>
      <video:tag>twink</video:tag>
      <video:tag>${(video.catname || 'adult').replace(/[<>&'"]/g, '')}</video:tag>
    </video:video>
  </url>
`;
  }
  videosSitemap += `</urlset>`;

  return {
    sitemapIndex,
    pagesSitemap,
    categoriesSitemap,
    imagesSitemap,
    videosSitemap,
    modelsSitemap,
    stats: {
      categories: categories.rows.length,
      images: recentImages.rows.length,
      videos: videos.rows.length,
      models: models.rows.length
    }
  };
}

// Ping search engines with sitemap
async function pingSearchEngines(sitemapUrl) {
  const engines = [
    { name: 'Google', url: `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}` },
    { name: 'Bing', url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}` },
    { name: 'Yandex', url: `https://webmaster.yandex.ru/ping?sitemap=${encodeURIComponent(sitemapUrl)}` }
  ];

  const results = [];
  for (const engine of engines) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(engine.url, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeout);

      results.push({
        engine: engine.name,
        success: response.status < 400,
        status: response.status
      });
    } catch (e) {
      results.push({
        engine: engine.name,
        success: false,
        error: e.message
      });
    }
  }
  return results;
}

// Admin: Generate and submit sitemaps
router.post('/admin/generate-sitemap', express.json(), async (req, res) => {
  try {
    const session = checkAdminSession(req);
    if (!session?.isAdmin) {
      return res.status(401).json({ success: false, error: 'Admin access required' });
    }

    // Get IP for logging
    const ip = req.headers['cf-connecting-ip'] ||
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.socket.remoteAddress || '';

    console.log(`[${new Date().toISOString()}] Sitemap generation triggered by ${session.username} from IP: ${ip}`);

    // Generate sitemaps
    const sitemaps = await generateSitemap();

    // Save to filesystem
    const sitemapPath = '/var/www/html/boysreview';
    fs.writeFileSync(`${sitemapPath}/sitemap_index.xml`, sitemaps.sitemapIndex);
    fs.writeFileSync(`${sitemapPath}/sitemap_pages.xml`, sitemaps.pagesSitemap);
    fs.writeFileSync(`${sitemapPath}/sitemap_categories.xml`, sitemaps.categoriesSitemap);
    fs.writeFileSync(`${sitemapPath}/sitemap_images.xml`, sitemaps.imagesSitemap);
    fs.writeFileSync(`${sitemapPath}/sitemap_videos.xml`, sitemaps.videosSitemap);
    fs.writeFileSync(`${sitemapPath}/sitemap_models.xml`, sitemaps.modelsSitemap);

    // Ping search engines
    const pingResults = await pingSearchEngines('https://boysreview.com/sitemap_index.xml');

    // Log to database
    await pool.query(`
      INSERT INTO admin_logs (admin_user, action, ip_address, details, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [session.username, 'sitemap_generate', ip, JSON.stringify({ stats: sitemaps.stats, pingResults })]);

    res.json({
      success: true,
      stats: sitemaps.stats,
      pingResults,
      message: 'Sitemaps generated and search engines notified'
    });
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin: Get upload logs
router.get('/admin/upload-logs', async (req, res) => {
  try {
    const session = checkAdminSession(req);
    if (!session?.isAdmin) {
      return res.status(401).json({ success: false, error: 'Admin access required' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const logs = await pool.query(`
      SELECT * FROM admin_logs
      WHERE action LIKE 'upload%' OR action = 'sitemap_generate'
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({ logs: logs.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /banner - Get affiliate banner for display
 * Query params:
 *   - category: Category ID (optional, 0 for random)
 *   - site: Site name to match (optional)
 *   - position: 'top' or 'bottom' (default: 'top')
 */
router.get('/banner', async (req, res) => {
  try {
    const categoryId = parseInt(req.query.category) || 0;
    const siteName = req.query.site || '';
    const position = req.query.position || 'top';

    let banner = null;

    // Special categories that get random banners
    const specialCats = [0, 501, 999, 1001, 514, 774, 1534, 1506, 1539, 1318, 1278];

    if (specialCats.includes(categoryId)) {
      // Try to find a matching category by site name first
      if (siteName) {
        const siteMatch = await pool.query(`
          SELECT * FROM banners
          WHERE LOWER(site_name) LIKE LOWER($1)
            AND banner_url IS NOT NULL
            AND banner_url != ''
            AND is_active = true
          LIMIT 1
        `, [`%${siteName}%`]);

        if (siteMatch.rows.length > 0) {
          banner = siteMatch.rows[0];
        }
      }

      // If no site-specific banner found, get random best-seller
      if (!banner) {
        const minBestSeller = position === 'top' ? 2 : 1;
        const randomBanner = await pool.query(`
          SELECT * FROM banners
          WHERE best_seller >= $1
            AND banner_url IS NOT NULL
            AND banner_url != ''
            AND is_active = true
          ORDER BY RANDOM()
          LIMIT 1
        `, [minBestSeller]);

        if (randomBanner.rows.length > 0) {
          banner = randomBanner.rows[0];
        }
      }
    } else {
      // Site-specific category
      const specificBanner = await pool.query(`
        SELECT * FROM banners
        WHERE category_id = $1
          AND is_active = true
        LIMIT 1
      `, [categoryId]);

      if (specificBanner.rows.length > 0) {
        banner = specificBanner.rows[0];
      }
    }

    if (!banner) {
      return res.json({ success: false, error: 'No banner found' });
    }

    // 30% chance to show Chaturbate banner
    const showChaturbate = Math.random() < 0.3;
    if (showChaturbate) {
      const chaturbate = await pool.query(`
        SELECT * FROM banners WHERE site_name = 'Chaturbate Live Cams' LIMIT 1
      `);
      if (chaturbate.rows.length > 0) {
        banner = chaturbate.rows[0];
      }
    }

    // Build affiliate URL
    let affiliateUrl = banner.affiliate_url;
    if (!affiliateUrl.startsWith('http') && !affiliateUrl.startsWith('//')) {
      affiliateUrl = `//ezgay.com/r${banner.category_id}`;
    }

    // Track impression (increment asynchronously)
    pool.query('UPDATE banners SET click_count = click_count + 1 WHERE id = $1', [banner.id]).catch(() => {});

    // Use SEO-optimized alt tag if available, otherwise generate one
    const altTag = banner.seo_alt || `${banner.site_name} - nude twink photos and gay boy galleries`;
    const seoTitle = banner.seo_title || `${banner.site_name} Nude Twink Gallery`;
    const seoKeywords = banner.seo_keywords || ['nude twinks', 'gay boys', 'twink photos'];

    res.json({
      success: true,
      categoryId: banner.category_id,
      siteName: banner.site_name,
      bannerUrl: banner.banner_url,
      affiliateUrl: affiliateUrl,
      altTag: altTag,
      seoTitle: seoTitle,
      seoKeywords: seoKeywords,
      position: position,
      isChaturbate: banner.site_name === 'Chaturbate Live Cams'
    });
  } catch (error) {
    console.error('Banner fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
