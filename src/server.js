import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import https from 'https';
import routes from './api/routes.js';
import { getTranslationsByCategory, t, getLanguages } from './services/translation-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

app.set('trust proxy', 1);
const translateCache = new Map();
const seoCache = new Map();
const SEO_CACHE_TTL = 5 * 60 * 1000; // 5 min

function translate(text, targetLang) {
  if (!text || targetLang === 'en') return Promise.resolve(text);
  const key = `${text.substring(0,100)}:${targetLang}`;
  if (translateCache.has(key)) return Promise.resolve(translateCache.get(key));
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(text.substring(0, 400));
    https.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encoded}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          const translated = r[0].map(x => x[0]).join('');
          translateCache.set(key, translated);
          resolve(translated);
        } catch(e) { resolve(text); }
      });
    }).on('error', () => resolve(text));
    setTimeout(() => resolve(text), 2000);
  });
}

// Get SEO translations from DB with cache
async function getSeoTranslations(lang) {
  const cacheKey = `seo:${lang}`;
  const cached = seoCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < SEO_CACHE_TTL) {
    return cached.data;
  }
  const seo = await getTranslationsByCategory(lang, 'seo');
  const ui = await getTranslationsByCategory(lang, 'ui');
  const data = {
    title: seo.defaultTitle || 'BoyVue Gallery',
    description: seo.defaultDescription || 'Browse free photos and videos.',
    views: ui.views || 'views',
    browse: ui.allImages || 'Browse'
  };
  seoCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

// Supported languages from DB
let supportedLangs = ['en', 'de', 'ru', 'es', 'zh', 'ja', 'th', 'ko', 'pt', 'fr', 'it', 'nl', 'pl', 'cs', 'ar', 'el', 'vi', 'id', 'tr', 'hu'];
getLanguages().then(langs => { supportedLangs = Object.keys(langs); }).catch(() => {});

function isBot(ua) { return /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|applebot|petalbot|pinterest|whatsapp|telegram|discord/i.test(ua || ''); }
function getLang(req) { if (req.query.lang && supportedLangs.includes(req.query.lang)) return req.query.lang; const al = (req.headers['accept-language'] || '').split(',')[0]?.split('-')[0]?.toLowerCase(); return supportedLangs.includes(al) ? al : 'en'; }
function hreflang(path) { const p = path.split('?')[0]; return supportedLangs.map(l => `<link rel="alternate" hreflang="${l}" href="https://boyvue.com${p}?lang=${l}">`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="https://boyvue.com${p}">`; }
function esc(s) { return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function socialShareUrls(url, title, image) {
  const eu = encodeURIComponent(url), et = encodeURIComponent(title), ei = encodeURIComponent(image || '');
  return { twitter: `https://twitter.com/intent/tweet?url=${eu}&text=${et}`, facebook: `https://www.facebook.com/sharer/sharer.php?u=${eu}`, reddit: `https://reddit.com/submit?url=${eu}&title=${et}`, telegram: `https://t.me/share/url?url=${eu}&text=${et}`, whatsapp: `https://api.whatsapp.com/send?text=${et}%20${eu}`, pinterest: `https://pinterest.com/pin/create/button/?url=${eu}&media=${ei}&description=${et}`, tumblr: `https://www.tumblr.com/share/link?url=${eu}&name=${et}`, vk: `https://vk.com/share.php?url=${eu}&title=${et}`, email: `mailto:?subject=${et}&body=${eu}` };
}

function botHtml(meta, lang, path, schema, body) {
  const rtl = ['ar'].includes(lang);
  const fullUrl = `https://boyvue.com${path.split('?')[0]}`;
  const shares = socialShareUrls(fullUrl, meta.title, meta.image);
  return `<!DOCTYPE html>
<html lang="${lang}"${rtl?' dir="rtl"':''}>
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="index,follow,max-image-preview:large">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
${meta.keywords ? `<meta name="keywords" content="${esc(meta.keywords)}">` : ''}
<meta property="og:type" content="${meta.type||'website'}"><meta property="og:site_name" content="BoyVue Gallery">
<meta property="og:title" content="${esc(meta.title)}"><meta property="og:description" content="${esc(meta.description)}">
${meta.image?`<meta property="og:image" content="${meta.image}">`:''}
<meta property="og:url" content="${fullUrl}"><meta property="og:locale" content="${lang}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.description)}">
${meta.image?`<meta name="twitter:image" content="${meta.image}">`:''}
<link rel="canonical" href="${fullUrl}">
${hreflang(path)}
<meta name="rating" content="RTA-5042-1996-1400-1577-RTA">
${schema?`<script type="application/ld+json">${JSON.stringify(schema)}</script>`:''}
<style>body{font-family:Arial,sans-serif;background:#111;color:#fff;margin:0;padding:20px}h1,h2{color:#f60}a{color:#f60}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:15px}.i{background:#222;padding:10px;border-radius:8px}.i img{width:100%;height:140px;object-fit:cover;border-radius:4px}.i h3{font-size:13px;margin:8px 0 4px}.i p{font-size:11px;color:#888;margin:0}.c{max-width:1200px;margin:0 auto}.share{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0;align-items:center}.share a{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;color:#fff;text-decoration:none}</style>
</head>
<body><div class="c"><header><h1><a href="/">BoyVue Gallery</a></h1></header><main>${body}
<div class="share"><span style="color:#888;font-size:13px;margin-right:5px">Share:</span>
<a href="${shares.twitter}" target="_blank" rel="noopener" style="background:#1DA1F2">𝕏</a>
<a href="${shares.facebook}" target="_blank" rel="noopener" style="background:#4267B2">f</a>
<a href="${shares.reddit}" target="_blank" rel="noopener" style="background:#FF4500">↑</a>
<a href="${shares.telegram}" target="_blank" rel="noopener" style="background:#0088cc">✈</a>
<a href="${shares.whatsapp}" target="_blank" rel="noopener" style="background:#25D366">💬</a>
<a href="${shares.pinterest}" target="_blank" rel="noopener" style="background:#E60023">P</a>
<a href="${shares.tumblr}" target="_blank" rel="noopener" style="background:#35465C">t</a>
<a href="${shares.vk}" target="_blank" rel="noopener" style="background:#4C75A3">V</a>
<a href="${shares.email}" style="background:#666">✉</a>
</div></main>
<footer style="margin-top:40px;padding-top:20px;border-top:1px solid #333;color:#666;font-size:12px"><p>All models 18+ at time of depiction. RTA Labeled. © 2025 BoyVue.com</p></footer></div></body></html>`;
}

function serveSpa(req, res) { res.sendFile(join(__dirname, '../dist/index.html')); }

console.log('Starting Gallery Platform with i18n SEO...');

// Handle malformed URI errors early (e.g. %92 Windows-1252 chars from old bots)
app.use((req, res, next) => {
  try {
    decodeURIComponent(req.path);
    next();
  } catch (e) {
    if (e instanceof URIError) {
      res.status(400).send('Bad Request: Invalid URL encoding');
    } else {
      next(e);
    }
  }
});

app.use(express.json());
app.use('/api', routes);
app.use('/media', express.static('/var/www/html/bp/data'));

// Serve static sitemaps from public directory (generated by scripts/generate-sitemaps.js)
// This serves XML files before any dynamic routes to bypass Cloudflare challenges
app.use(express.static(join(__dirname, '../public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.xml')) {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    }
  }
}));

// Sitemap alias for legacy URL
app.get('/sitemap-images.xml', (req, res) => {
  res.redirect(301, '/image-sitemap.xml');
});

// Homepage
app.get('/', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req);
  if (isBot(ua) || req.query.lang) {
    const seo = await getSeoTranslations(lang);
    const meta = { title: seo.title, description: seo.description, image: 'https://boyvue.com/media/logo-social.jpg' };
    const schema = {"@context":"https://schema.org","@type":"WebSite","name":"BoyVue Gallery","url":"https://boyvue.com","description":meta.description,"inLanguage":lang,"potentialAction":{"@type":"SearchAction","target":"https://boyvue.com/search?q={search_term_string}","query-input":"required name=search_term_string"}};
    let body = `<h2>${seo.browse}</h2><div class="g">`;
    try { const cats = await pool.query('SELECT id,catname,photo_count FROM category WHERE photo_count>0 ORDER BY photo_count DESC LIMIT 20'); for (const c of cats.rows) body += `<div class="i"><h3><a href="/c/${c.id}">${esc(c.catname)}</a></h3><p>${c.photo_count.toLocaleString()} items</p></div>`; } catch(e) {}
    body += `</div><div class="g">`;
    try { const imgs = await pool.query('SELECT id,title,thumbnail_path,view_count FROM image ORDER BY view_count DESC LIMIT 24'); for (const i of imgs.rows) body += `<div class="i"><a href="/v/${i.id}"><img src="/media/${i.thumbnail_path}" alt="${esc(i.title||'')}" loading="lazy"></a><h3><a href="/v/${i.id}">${esc((i.title||'Video').substring(0,45))}</a></h3><p>${(i.view_count||0).toLocaleString()} ${seo.views}</p></div>`; } catch(e) {}
    body += `</div>`;
    return res.send(botHtml(meta, lang, '/', schema, body));
  }
  serveSpa(req, res);
});

// Video/Image page
app.get('/v/:id', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req), id = parseInt(req.params.id);
  if (!isBot(ua) && !req.query.lang) return serveSpa(req, res);
  try {
    const r = await pool.query('SELECT i.*,c.catname FROM image i LEFT JOIN category c ON i.belongs_to_gallery=c.id WHERE i.id=$1', [id]);
    if (!r.rows.length) {
      // Return proper 404 for bots when content doesn't exist
      res.status(404);
      const meta = { title: 'Page Not Found | BoyVue', description: 'The requested content could not be found.' };
      return res.send(botHtml(meta, lang, `/v/${id}`, null, '<h2>404 - Not Found</h2><p>This content does not exist or has been removed.</p><p><a href="/">Return to homepage</a></p>'));
    }
    const img = r.rows[0];
    const seo = await getSeoTranslations(lang);
    const ui = await getTranslationsByCategory(lang, 'ui');
    let title = img.title || 'Video', desc = (img.description || title).substring(0, 100);
    if (lang !== 'en') { title = await translate(title, lang); desc = await translate(desc, lang); }
    const isVid = /\.(mp4|webm|avi|mov|flv|mkv)$/i.test(img.local_path);
    const vl = seo.views, vc = (img.view_count||0).toLocaleString();
    const meta = { title: `${title.substring(0,50)} | BoyVue`, description: `${desc.substring(0,120)} - ${vc} ${vl}`, image: `https://boyvue.com/media/${img.thumbnail_path||img.local_path}`, type: isVid ? 'video.other' : 'article' };
    const schema = isVid ? {"@context":"https://schema.org","@type":"VideoObject","name":title,"description":meta.description,"thumbnailUrl":meta.image,"contentUrl":`https://boyvue.com/media/${img.local_path}`,"uploadDate":img.created_at||new Date().toISOString(),"interactionStatistic":{"@type":"InteractionCounter","interactionType":"WatchAction","userInteractionCount":img.view_count||0}} : {"@context":"https://schema.org","@type":"ImageObject","name":title,"contentUrl":meta.image};
    let body = `<article><h2>${esc(title)}</h2>`;
    body += isVid ? `<video controls poster="${meta.image}" style="width:100%;max-width:800px"><source src="/media/${img.local_path}" type="video/mp4"></video>` : `<img src="/media/${img.local_path}" alt="${esc(title)}" style="width:100%;max-width:800px">`;
    body += `<p>${esc(img.description||'')}</p><p><strong>${vc} ${vl}</strong> | <a href="/c/${img.belongs_to_gallery}">${esc(img.catname||'Gallery')}</a></p></article>`;
    const relatedLabel = ui.relatedIn || 'Related';
    try { const rel = await pool.query('SELECT id,title,thumbnail_path FROM image WHERE belongs_to_gallery=$1 AND id!=$2 ORDER BY view_count DESC LIMIT 8', [img.belongs_to_gallery, id]); if (rel.rows.length) { body += `<h3>${relatedLabel}</h3><div class="g">`; for (const x of rel.rows) body += `<div class="i"><a href="/v/${x.id}"><img src="/media/${x.thumbnail_path}" alt="${esc(x.title||'')}" loading="lazy"></a><h3><a href="/v/${x.id}">${esc((x.title||'Video').substring(0,40))}</a></h3></div>`; body += `</div>`; } } catch(e) {}
    res.send(botHtml(meta, lang, `/v/${id}`, schema, body));
  } catch(e) { console.error('SEO /v/:id:', e.message); serveSpa(req, res); }
});

// Category page with i18n SEO from database
app.get('/c/:id', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req), id = parseInt(req.params.id);
  if (!isBot(ua) && !req.query.lang) return serveSpa(req, res);
  try {
    const r = await pool.query('SELECT * FROM category WHERE id=$1', [id]);
    if (!r.rows.length) {
      // Return proper 404 for bots when category doesn't exist
      res.status(404);
      const meta = { title: 'Category Not Found | BoyVue', description: 'The requested category could not be found.' };
      return res.send(botHtml(meta, lang, `/c/${id}`, null, '<h2>404 - Category Not Found</h2><p>This category does not exist.</p><p><a href="/">Return to homepage</a></p>'));
    }
    const cat = r.rows[0];
    const seo = await getSeoTranslations(lang);
    let name = cat.catname;
    if (lang !== 'en') name = await translate(name, lang);

    // Get i18n SEO from database
    let seoData = null;
    try {
      const seoRes = await pool.query('SELECT seo_title, seo_description, seo_keywords FROM category_seo WHERE category_id=$1 AND language=$2', [id, lang]);
      if (seoRes.rows.length) seoData = seoRes.rows[0];
      if (!seoData && lang !== 'en') {
        const seoEn = await pool.query('SELECT seo_title, seo_description, seo_keywords FROM category_seo WHERE category_id=$1 AND language=$2', [id, 'en']);
        if (seoEn.rows.length) seoData = seoEn.rows[0];
      }
    } catch(e) {}

    const pc = (cat.photo_count||0).toLocaleString();
    let coverImage = 'https://boyvue.com/media/logo-social.jpg';
    try { const first = await pool.query('SELECT thumbnail_path FROM image WHERE belongs_to_gallery=$1 ORDER BY view_count DESC LIMIT 1', [id]); if (first.rows.length) coverImage = `https://boyvue.com/media/${first.rows[0].thumbnail_path}`; } catch(e) {}

    const meta = {
      title: seoData?.seo_title || `${name} | BoyVue Gallery`,
      description: seoData?.seo_description || `${seo.browse} ${pc} photos and videos in ${name}. Free HD streaming.`,
      keywords: seoData?.seo_keywords || '',
      image: coverImage
    };

    const schema = {"@context":"https://schema.org","@type":"CollectionPage","name":meta.title,"description":meta.description,"numberOfItems":cat.photo_count||0,"inLanguage":lang,"mainEntity":{"@type":"ItemList","itemListElement":[]}};
    let body = `<h2>${esc(name)}</h2><p>${pc} items</p><div class="g">`;
    try { const imgs = await pool.query('SELECT id,title,thumbnail_path,view_count FROM image WHERE belongs_to_gallery=$1 ORDER BY view_count DESC LIMIT 48', [id]); for (const i of imgs.rows) body += `<div class="i"><a href="/v/${i.id}"><img src="/media/${i.thumbnail_path}" alt="${esc(i.title||'')}" loading="lazy"></a><h3><a href="/v/${i.id}">${esc((i.title||'Video').substring(0,40))}</a></h3><p>${(i.view_count||0).toLocaleString()} ${seo.views}</p></div>`; } catch(e) {}
    body += `</div>`;
    res.send(botHtml(meta, lang, `/c/${id}`, schema, body));
  } catch(e) { console.error('SEO /c/:id:', e.message); serveSpa(req, res); }
});

app.get('/api/share/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try { const r = await pool.query('SELECT id,title,thumbnail_path FROM image WHERE id=$1', [id]); if (!r.rows.length) return res.status(404).json({error:'Not found'}); const img = r.rows[0]; const url = `https://boyvue.com/v/${id}`; res.json({ url, title: img.title, image: `https://boyvue.com/media/${img.thumbnail_path}`, shares: socialShareUrls(url, img.title, `https://boyvue.com/media/${img.thumbnail_path}`) }); } catch(e) { res.status(500).json({error: e.message}); }
});

app.use(express.static(join(__dirname, '../dist')));

// Catch-all: serve SPA for browsers, 404 for bots on unknown routes
app.get('*', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  // Known SPA routes that should always serve the app
  const knownRoutes = /^\/($|v\/\d+|c\/\d+|search|categories|popular|recent)/;
  if (isBot(ua) && !knownRoutes.test(req.path)) {
    res.status(404);
    const meta = { title: 'Page Not Found | BoyVue', description: 'The requested page could not be found.' };
    return res.send(botHtml(meta, 'en', req.path, null, '<h2>404 - Page Not Found</h2><p>The page you requested does not exist.</p><p><a href="/">Return to homepage</a></p>'));
  }
  serveSpa(req, res);
});

// Global error handler to prevent 5xx errors
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) {
    res.status(500);
    const meta = { title: 'Error | BoyVue', description: 'An error occurred.' };
    return res.send(botHtml(meta, 'en', req.path, null, '<h2>Error</h2><p>Something went wrong. Please try again later.</p><p><a href="/">Return to homepage</a></p>'));
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
