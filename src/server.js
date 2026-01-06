import 'dotenv/config';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { passport } from './auth/passport-config.js';
import authRoutes from './api/auth-routes.js';
import favoritesRoutes from './api/favorites-routes.js';
import blogRoutes from './api/blog-routes.js';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import https from 'https';
import routes from './api/routes.js';
import adminRoutes from './api/admin-routes.js';
import integrations from './api/integrations.js';
import creativesRoutes from './api/creatives-routes.js';
import creativesAdminRoutes from './api/creatives-admin-routes.js';
import videosRoutes from './api/videos-routes.js';
import translationsRoutes from './api/translations-routes.js';
import uploadRoutes from './api/upload-routes.js';
import linksRoutes from './api/links-routes.js';
import vaultRoutes from './api/vault-routes.js';
import subscriptionRoutes from './api/subscription-routes.js';
import creatorRoutes from './api/creator-routes.js';
import creatorOnboardingRoutes from './api/creator-onboarding-routes.js';
import spiderRoutes from './api/spider-routes.js';
import aiSeoRoutes from './api/ai-seo-routes.js';
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

// Base URL for all sections (now unified on single domain)
const BASE_DOMAIN = 'boyvue.com';

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
    // Default SEO
    title: seo.defaultTitle || 'BoyVue Gallery',
    description: seo.defaultDescription || 'Browse free photos and videos.',
    // UI terms
    views: ui.views || 'views',
    browse: ui.allImages || 'Browse',
    // SEO site page terms
    freePicsVideos: seo.freePicsVideos || 'Free Pics & Videos',
    photos: seo.photos || 'photos',
    videos: seo.videos || 'videos',
    models: seo.models || 'models',
    score: seo.score || 'Score',
    latestContent: seo.latestContent || 'Latest Content from',
    fullReview: seo.fullReview || 'Full Review',
    siteStats: seo.siteStats || 'Site Stats',
    updates: seo.updates || 'Updates',
    galleries: seo.galleries || 'Galleries',
    modelInfo: seo.modelInfo || 'Model Info',
    modelAges: seo.modelAges || 'Model Ages',
    quality: seo.quality || 'Quality',
    photoGallery: seo.photoGallery || 'Photo Gallery',
    relatedSites: seo.relatedSites || 'Related Sites',
    viewAll: seo.viewAll || 'View all',
    whatIs: seo.whatIs || 'What is',
    howManyPhotos: seo.howManyPhotos || 'How many photos does',
    whatRating: seo.whatRating || 'What is the rating',
    daily: seo.daily || 'Daily',
    weekly: seo.weekly || 'Weekly',
    visitOfficialSite: seo.visitOfficialSite || 'Visit Official Site',
    siteNotFound: seo.siteNotFound || 'Site Not Found',
    browseSites: seo.browseSites || 'Browse all sites',
    review: seo.review || 'Review',
    preview: seo.preview || 'Preview',
    sites: seo.sites || 'Sites',
    gallery: seo.gallery || 'Gallery',
    // Video-specific terms
    videoSites: seo.videoSites || 'Video Streaming Sites',
    featuredStudios: seo.featuredStudios || 'Featured Studios',
    videoCategories: seo.videoCategories || 'Video Categories',
    compareFeatures: seo.compareFeatures || 'Compare features, pricing, and content from top studios.',
    studios: seo.studios || 'studios',
    freeVideos: seo.freeVideos || 'Free Videos',
    watchFree: seo.watchFree || 'Watch Free'
  };
  seoCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

// Supported languages from DB
let supportedLangs = ['en', 'de', 'ru', 'es', 'zh', 'ja', 'th', 'ko', 'pt', 'fr', 'it', 'nl', 'pl', 'cs', 'ar', 'el', 'vi', 'id', 'tr', 'hu'];
getLanguages().then(langs => { supportedLangs = Object.keys(langs); }).catch(() => {});

function isBot(ua) { return /googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|applebot|petalbot|pinterest|whatsapp|telegram|discord/i.test(ua || ''); }
function getLang(req) { if (req.query.lang && supportedLangs.includes(req.query.lang)) return req.query.lang; const al = (req.headers['accept-language'] || '').split(',')[0]?.split('-')[0]?.toLowerCase(); return supportedLangs.includes(al) ? al : 'en'; }
// Generate hreflang tags using path-based URLs for SEO (e.g., /pics/de/ instead of /pics/?lang=de)
function hreflang(path, section = '') {
  // Remove any existing language prefix or query params
  let cleanPath = path.split('?')[0].replace(/^\/(en|de|fr|es|pt|it|nl|ru|pl|cs|ja|zh|ko|th|vi|ar|tr|id|el|hu)\//, '/');
  // Ensure path ends with / for directories
  if (!cleanPath.endsWith('/') && !cleanPath.includes('.')) cleanPath += '/';

  // For section paths like /pics/, /videos/, etc.
  const basePath = section ? `/${section}` : '';

  return supportedLangs.map(l => {
    // English is default (no prefix), others get language prefix
    const langPath = l === 'en' ? cleanPath : cleanPath.replace(basePath + '/', `${basePath}/${l}/`);
    return `<link rel="alternate" hreflang="${l}" href="https://${BASE_DOMAIN}${langPath}">`;
  }).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="https://${BASE_DOMAIN}${cleanPath}">`;
}
function esc(s) { return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Organization schema for all pages
const ORGANIZATION_SCHEMA = {
  "@type": "Organization",
  "@id": `https://${BASE_DOMAIN}/#organization`,
  "name": "BoyVue",
  "url": `https://${BASE_DOMAIN}`,
  "logo": {
    "@type": "ImageObject",
    "url": `https://${BASE_DOMAIN}/media/logo-social.jpg`,
    "width": 512,
    "height": 512
  },
  "sameAs": []
};

// WebSite schema
const WEBSITE_SCHEMA = {
  "@type": "WebSite",
  "@id": `https://${BASE_DOMAIN}/#website`,
  "name": "BoyVue",
  "url": `https://${BASE_DOMAIN}`,
  "publisher": { "@id": `https://${BASE_DOMAIN}/#organization` },
  "potentialAction": {
    "@type": "SearchAction",
    "target": `https://${BASE_DOMAIN}/pics/search?q={search_term_string}`,
    "query-input": "required name=search_term_string"
  },
  "inLanguage": supportedLangs.map(l => ({ "@type": "Language", "name": l }))
};

// Generate breadcrumb schema
function generateBreadcrumbSchema(items) {
  return {
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };
}

// Generate image/video SEO alt text with keyword rotation
function generateImageAlt(title, siteName, index = 0, keywords = []) {
  const cleanTitle = (title || '').replace(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i, '').trim();
  if (!cleanTitle || cleanTitle.toLowerCase() === 'untitled') {
    if (keywords.length > 0) {
      const kw = keywords[index % keywords.length];
      return `${siteName} - ${kw}`;
    }
    return `${siteName} free photo gallery`;
  }
  if (keywords.length > 0) {
    const kw = keywords[index % keywords.length];
    return `${cleanTitle} at ${siteName} - ${kw}`;
  }
  return `${cleanTitle} at ${siteName}`;
}

function socialShareUrls(url, title, image) {
  const eu = encodeURIComponent(url), et = encodeURIComponent(title), ei = encodeURIComponent(image || '');
  return { twitter: `https://twitter.com/intent/tweet?url=${eu}&text=${et}`, facebook: `https://www.facebook.com/sharer/sharer.php?u=${eu}`, reddit: `https://reddit.com/submit?url=${eu}&title=${et}`, telegram: `https://t.me/share/url?url=${eu}&text=${et}`, whatsapp: `https://api.whatsapp.com/send?text=${et}%20${eu}`, pinterest: `https://pinterest.com/pin/create/button/?url=${eu}&media=${ei}&description=${et}`, tumblr: `https://www.tumblr.com/share/link?url=${eu}&name=${et}`, vk: `https://vk.com/share.php?url=${eu}&title=${et}`, email: `mailto:?subject=${et}&body=${eu}` };
}

// Generate comprehensive @graph schema for any page type
function generatePageSchema(options) {
  const {
    pageType = 'CollectionPage',
    url,
    title,
    description,
    image,
    breadcrumbs = [],
    videoInfo = null,
    imageInfo = null,
    reviewInfo = null,
    faqItems = [],
    datePublished = null,
    dateModified = null,
    numberOfItems = null
  } = options;

  const graph = [
    ORGANIZATION_SCHEMA,
    WEBSITE_SCHEMA
  ];

  // Main page entity
  const pageEntity = {
    "@type": pageType,
    "@id": `${url}#${pageType.toLowerCase()}`,
    "name": title,
    "description": description,
    "url": url,
    "isPartOf": { "@id": `https://${BASE_DOMAIN}/#website` },
    "publisher": { "@id": `https://${BASE_DOMAIN}/#organization` }
  };

  if (image) pageEntity.image = image;
  if (datePublished) pageEntity.datePublished = datePublished;
  if (dateModified) pageEntity.dateModified = dateModified;
  if (numberOfItems) pageEntity.numberOfItems = numberOfItems;

  // Add mainEntity for galleries
  if (pageType === 'CollectionPage' && numberOfItems) {
    pageEntity.mainEntity = {
      "@type": "ImageGallery",
      "name": title,
      "numberOfItems": numberOfItems
    };
  }

  graph.push(pageEntity);

  // Breadcrumb schema
  if (breadcrumbs.length > 0) {
    graph.push(generateBreadcrumbSchema(breadcrumbs));
  }

  // VideoObject schema
  if (videoInfo) {
    graph.push({
      "@type": "VideoObject",
      "@id": `${url}#video`,
      "name": videoInfo.name || title,
      "description": videoInfo.description || description,
      "thumbnailUrl": videoInfo.thumbnailUrl || image,
      "uploadDate": videoInfo.uploadDate || new Date().toISOString(),
      "duration": videoInfo.duration || null,
      "contentUrl": videoInfo.contentUrl,
      "embedUrl": videoInfo.embedUrl,
      "publisher": { "@id": `https://${BASE_DOMAIN}/#organization` },
      "interactionStatistic": {
        "@type": "InteractionCounter",
        "interactionType": { "@type": "WatchAction" },
        "userInteractionCount": videoInfo.viewCount || 0
      }
    });
  }

  // ImageObject schema
  if (imageInfo) {
    graph.push({
      "@type": "ImageObject",
      "@id": `${url}#image`,
      "name": imageInfo.name || title,
      "description": imageInfo.description || description,
      "contentUrl": imageInfo.contentUrl || image,
      "thumbnailUrl": imageInfo.thumbnailUrl || image,
      "width": imageInfo.width,
      "height": imageInfo.height,
      "uploadDate": imageInfo.uploadDate || new Date().toISOString(),
      "author": { "@id": `https://${BASE_DOMAIN}/#organization` }
    });
  }

  // Review/Rating schema (as Product for Google compliance)
  if (reviewInfo && reviewInfo.score) {
    const ratingValue = (reviewInfo.score / 20).toFixed(1); // Convert 0-100 to 0-5
    graph.push({
      "@type": "Product",
      "@id": `${url}#product`,
      "name": reviewInfo.name || title,
      "description": description,
      "image": image,
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": ratingValue,
        "bestRating": "5",
        "worstRating": "1",
        "ratingCount": reviewInfo.ratingCount || Math.max(10, Math.floor((numberOfItems || 100) / 100)),
        "reviewCount": reviewInfo.reviewCount || Math.max(5, Math.floor((numberOfItems || 100) / 200))
      }
    });

    graph.push({
      "@type": "Review",
      "@id": `${url}#review`,
      "itemReviewed": { "@id": `${url}#product` },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": ratingValue,
        "bestRating": "5",
        "worstRating": "1"
      },
      "author": { "@id": `https://${BASE_DOMAIN}/#organization` },
      "publisher": { "@id": `https://${BASE_DOMAIN}/#organization` },
      "reviewBody": description.substring(0, 200)
    });
  }

  // FAQ schema for SERP features
  if (faqItems.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      "mainEntity": faqItems.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

function botHtml(meta, lang, path, schema, body, section = '') {
  const rtl = ['ar'].includes(lang);
  const fullUrl = `https://${BASE_DOMAIN}${path.split('?')[0]}`;
  const shares = socialShareUrls(fullUrl, meta.title, meta.image);
  const homeLink = section === 'pics' ? '/pics/' : section === 'fans' ? '/fans/' : section === 'videos' ? '/videos/' : section === 'adult' ? '/adult/' : '/';
  const siteName = section === 'pics' ? 'BoyVue Pics' : section === 'fans' ? 'BoyVue Fans' : section === 'videos' ? 'BoyVue Videos' : section === 'adult' ? 'BoyVue Adult' : 'BoyVue';
  const langNames = { en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', pt: 'Português', it: 'Italiano', nl: 'Nederlands', ru: 'Русский', pl: 'Polski', cs: 'Čeština', ja: '日本語', zh: '中文', ko: '한국어', th: 'ไทย', vi: 'Tiếng Việt', ar: 'العربية', tr: 'Türkçe', id: 'Indonesian', el: 'Ελληνικά', hu: 'Magyar' };
  const currentDate = new Date().toISOString().split('T')[0];

  // Build meta keywords from title and description if not provided
  const autoKeywords = meta.keywords || `${meta.title?.split(' ').slice(0, 5).join(', ')}, gay, free, photos, videos, ${siteName}`;

  return `<!DOCTYPE html>
<html lang="${lang}"${rtl?' dir="rtl"':''} prefix="og: http://ogp.me/ns#">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">

<!-- SEO Meta Tags -->
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<meta name="keywords" content="${esc(autoKeywords)}">
<meta name="author" content="BoyVue">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="googlebot" content="index,follow,max-image-preview:large">
<meta name="bingbot" content="index,follow">

<!-- Canonical & Language -->
<link rel="canonical" href="${fullUrl}">
${hreflang(path)}

<!-- Adult Content Labels -->
<meta name="rating" content="RTA-5042-1996-1400-1577-RTA">
<meta name="RATING" content="RTA-5042-1996-1400-1577-RTA">
<meta http-equiv="pics-Label" content='(pics-1.1 "http://www.icra.org/pics/vocabularyv03/" l gen true for "https://${BASE_DOMAIN}" r (n 1 s 1 v 1 l 1 oa 1 ob 1 oc 1 od 1 oe 1 of 1 og 1 oh 1 c 1))'>

<!-- Open Graph / Facebook -->
<meta property="og:type" content="${meta.type||'website'}">
<meta property="og:site_name" content="${siteName}">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${fullUrl}">
<meta property="og:locale" content="${lang}_${lang.toUpperCase()}">
${meta.image?`<meta property="og:image" content="${meta.image}">
<meta property="og:image:width" content="${meta.imageWidth || 1200}">
<meta property="og:image:height" content="${meta.imageHeight || 630}">
<meta property="og:image:alt" content="${esc(meta.title)}">`:''}
${meta.type === 'video.other' && meta.videoUrl ? `<meta property="og:video" content="${meta.videoUrl}">
<meta property="og:video:type" content="video/mp4">` : ''}

<!-- Twitter Card -->
<meta name="twitter:card" content="${meta.type === 'video.other' ? 'player' : 'summary_large_image'}">
<meta name="twitter:site" content="@BoyVue">
<meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.description)}">
${meta.image?`<meta name="twitter:image" content="${meta.image}">
<meta name="twitter:image:alt" content="${esc(meta.title)}">`:''}

<!-- Additional Meta -->
<meta name="theme-color" content="#ff6600">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="icon" type="image/png" href="https://${BASE_DOMAIN}/media/favicon.png">
<link rel="apple-touch-icon" href="https://${BASE_DOMAIN}/media/apple-touch-icon.png">

<!-- Preconnect for performance -->
<link rel="preconnect" href="https://www.googletagmanager.com">
<link rel="dns-prefetch" href="https://www.google-analytics.com">

<!-- Schema.org Structured Data -->
${schema?`<script type="application/ld+json">${JSON.stringify(schema, null, 0)}</script>`:''}

<style>
*{box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;background:#111;color:#fff;margin:0;padding:20px;line-height:1.6}
h1,h2,h3{color:#f60;margin-top:0}
a{color:#f60;text-decoration:none}
a:hover{text-decoration:underline}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:15px}
.i{background:#222;padding:10px;border-radius:8px;transition:transform 0.2s}
.i:hover{transform:translateY(-3px)}
.i img{width:100%;height:140px;object-fit:cover;border-radius:4px}
.i h3{font-size:13px;margin:8px 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.i p{font-size:11px;color:#888;margin:0}
.c{max-width:1200px;margin:0 auto}
.share{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0;align-items:center}
.share a{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;color:#fff;text-decoration:none;transition:opacity 0.2s}
.share a:hover{opacity:0.8}
.breadcrumb{font-size:13px;color:#888;margin-bottom:15px}
.breadcrumb a{color:#888}
.breadcrumb span{margin:0 5px}
.stats{display:flex;gap:20px;margin:15px 0;flex-wrap:wrap}
.stats span{background:#222;padding:8px 15px;border-radius:20px;font-size:13px}
.lang-switch{position:fixed;bottom:20px;right:20px;background:#222;padding:5px;border-radius:8px}
.lang-switch select{background:#333;color:#fff;border:none;padding:8px;border-radius:4px}
@media(max-width:768px){.g{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}.i img{height:100px}}
</style>
</head>
<body><div class="c"><header><h1><a href="${homeLink}">${siteName}</a></h1></header><main>${body}
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
<footer style="margin-top:40px;padding-top:20px;border-top:1px solid #333;color:#888;font-size:12px">
<div style="max-width:800px;margin:0 auto;text-align:center">
<!-- Age Verification Notice -->
<p style="color:#f60;font-weight:bold;margin-bottom:15px">WARNING: This website contains adult material. You must be 18 years of age or older to enter.</p>

<!-- RTA & Compliance Labels -->
<p style="margin:10px 0">
<a href="http://www.rtalabel.org/" target="_blank" rel="noopener" style="color:#888;text-decoration:none">
<img src="https://www.rtalabel.org/images/rta-5042-1996-1400-1577-rta.gif" alt="RTA" width="60" height="15" style="vertical-align:middle;margin-right:10px">
RTA-5042-1996-1400-1577-RTA
</a>
</p>

<!-- 18 USC 2257 Compliance -->
<p style="margin:10px 0;font-size:11px">
<strong>18 U.S.C. 2257 Record-Keeping Requirements Compliance Statement:</strong><br>
All models appearing on this site are 18 years of age or older. Records required to be maintained pursuant to 18 U.S.C. 2257 are kept by the custodian of records at the location of each content producer.
</p>

<!-- DMCA -->
<p style="margin:10px 0;font-size:11px">
<strong>DMCA:</strong> We comply with the Digital Millennium Copyright Act.
<a href="/legal/dmca" style="color:#f60">Report content</a>
</p>

<!-- Legal Links -->
<p style="margin:15px 0">
<a href="/legal/terms" style="color:#888;margin:0 10px">Terms of Service</a> |
<a href="/legal/privacy" style="color:#888;margin:0 10px">Privacy Policy</a> |
<a href="/legal/2257" style="color:#888;margin:0 10px">2257 Statement</a> |
<a href="/legal/dmca" style="color:#888;margin:0 10px">DMCA</a> |
<a href="/legal/cookies" style="color:#888;margin:0 10px">Cookie Policy</a>
</p>

<!-- Parental Controls -->
<p style="margin:10px 0;font-size:11px">
Parents: Protect your children from adult content with
<a href="https://www.cyberpatrol.com/" target="_blank" rel="noopener" style="color:#888">CyberPatrol</a> |
<a href="https://www.netnanny.com/" target="_blank" rel="noopener" style="color:#888">NetNanny</a> |
<a href="https://www.cybersitter.com/" target="_blank" rel="noopener" style="color:#888">CyberSitter</a>
</p>

<!-- Copyright -->
<p style="margin-top:15px;color:#666">
&copy; 2025-2026 BoyVue.com - All Rights Reserved<br>
All depicted models were 18 years of age or older at the time of photography.
</p>
</div>
</footer></div></body></html>`;
}

// Serve SPAs
function serveMainSpa(req, res) {
  res.sendFile(join(__dirname, '../dist-main/index.html'));
}

function servePicsSpa(req, res) {
  res.sendFile(join(__dirname, '../dist/index.html'));
}

function serveFansSpa(req, res) {
  res.sendFile(join(__dirname, '../dist-creatives/index.html'));
}

function serveVideosSpa(req, res) {
  res.sendFile(join(__dirname, '../dist-videos/index.html'));
}

function serveAdultSpa(req, res) {
  res.sendFile(join(__dirname, '../dist-adult/index.html'));
}

console.log('Starting Gallery Platform with subdirectory routing...');

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

// Cookie parser for auth tokens
app.use(cookieParser());

// Session for OAuth state - now simpler since all on same domain
app.use(session({
  secret: process.env.SESSION_SECRET || 'boyvue-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 1000
  }
}));

// Initialize Passport
app.use(passport.initialize());

// 301 Redirects from old subdomains to new paths
app.use((req, res, next) => {
  const host = req.hostname || req.headers.host?.split(':')[0] || '';

  // Skip redirect for sitemaps, robots.txt, and API calls
  if (req.path.includes('sitemap') || req.path === '/robots.txt' || req.path.startsWith('/api/')) {
    return next();
  }

  // Redirect pics.boyvue.com/* to boyvue.com/pics/*
  if (host === 'pics.boyvue.com') {
    return res.redirect(301, `https://boyvue.com/pics${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`);
  }

  // Redirect fans.boyvue.com/* to boyvue.com/fans/*
  if (host === 'fans.boyvue.com' || host === 'creatives.boyvue.com') {
    return res.redirect(301, `https://boyvue.com/fans${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`);
  }

  // Redirect videos.boyvue.com/* to boyvue.com/videos/*
  if (host === 'videos.boyvue.com') {
    return res.redirect(301, `https://boyvue.com/videos${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`);
  }

  // Redirect adult.boyvue.com/* to boyvue.com/adult/*
  if (host === 'adult.boyvue.com') {
    return res.redirect(301, `https://boyvue.com/adult${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`);
  }

  next();
});

// API routes (shared across all sections)
app.use('/api', routes);
app.use('/api/admin', adminRoutes);
app.use('/api/integrations', integrations);
app.use('/api/creatives', creativesRoutes);
app.use('/api/creatives/admin', creativesAdminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/admin/translations', translationsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/creators/onboard', creatorOnboardingRoutes);
app.use('/api/spider', spiderRoutes);
app.use('/api/ai-seo', aiSeoRoutes);

// Affiliate link redirect
app.use('/go', creativesRoutes);

// Media files
app.use('/media', express.static('/var/www/html/bp/data'));

// Serve static sitemaps from public directory
app.use(express.static(join(__dirname, '../public'), {
  index: false,
  setHeaders: (res, path) => {
    if (path.endsWith('.xml')) {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    }
  }
}));

// ========== PICS SECTION (/pics/*) ==========

// Pics static assets
app.use('/pics', express.static(join(__dirname, '../dist'), { index: false }));

// Pics homepage
app.get('/pics/', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req);

  if (isBot(ua) || req.query.lang) {
    const seo = await getSeoTranslations(lang);
    const meta = { title: seo.title, description: seo.description, image: `https://${BASE_DOMAIN}/media/logo-social.jpg` };
    const schema = {"@context":"https://schema.org","@type":"WebSite","name":"BoyVue Gallery","url":`https://${BASE_DOMAIN}/pics/`,"description":meta.description,"inLanguage":lang,"potentialAction":{"@type":"SearchAction","target":`https://${BASE_DOMAIN}/pics/search?q={search_term_string}`,"query-input":"required name=search_term_string"}};
    let body = `<h2>${seo.browse}</h2><div class="g">`;
    try { const cats = await pool.query('SELECT id,catname,photo_count FROM category WHERE photo_count>0 ORDER BY photo_count DESC LIMIT 20'); for (const c of cats.rows) body += `<div class="i"><h3><a href="/pics/c/${c.id}">${esc(c.catname)}</a></h3><p>${c.photo_count.toLocaleString()} items</p></div>`; } catch(e) {}
    body += `</div><div class="g">`;
    try { const imgs = await pool.query('SELECT id,title,thumbnail_path,view_count FROM image ORDER BY view_count DESC LIMIT 24'); for (const i of imgs.rows) body += `<div class="i"><a href="/pics/v/${i.id}"><img src="/media/${i.thumbnail_path}" alt="${esc(i.title||'')}" loading="lazy"></a><h3><a href="/pics/v/${i.id}">${esc((i.title||'Video').substring(0,45))}</a></h3><p>${(i.view_count||0).toLocaleString()} ${seo.views}</p></div>`; } catch(e) {}
    body += `</div>`;
    return res.send(botHtml(meta, lang, '/pics/', schema, body, 'pics'));
  }
  servePicsSpa(req, res);
});

// Pics video/image page
app.get('/pics/v/:id', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req), id = parseInt(req.params.id);
  if (!isBot(ua) && !req.query.lang) return servePicsSpa(req, res);
  try {
    const r = await pool.query('SELECT i.*,c.catname FROM image i LEFT JOIN category c ON i.belongs_to_gallery=c.id WHERE i.id=$1', [id]);
    if (!r.rows.length) {
      res.status(404);
      const meta = { title: 'Page Not Found | BoyVue', description: 'The requested content could not be found.' };
      return res.send(botHtml(meta, lang, `/pics/v/${id}`, null, '<h2>404 - Not Found</h2><p>This content does not exist or has been removed.</p><p><a href="/pics/">Return to gallery</a></p>', 'pics'));
    }
    const img = r.rows[0];
    const seo = await getSeoTranslations(lang);
    const ui = await getTranslationsByCategory(lang, 'ui');
    let title = img.title || 'Video', desc = (img.description || title).substring(0, 100);
    if (lang !== 'en') { title = await translate(title, lang); desc = await translate(desc, lang); }
    const isVid = /\.(mp4|webm|avi|mov|flv|mkv)$/i.test(img.local_path);
    const vl = seo.views, vc = (img.view_count||0).toLocaleString();
    const meta = { title: `${title.substring(0,50)} | BoyVue`, description: `${desc.substring(0,120)} - ${vc} ${vl}`, image: `https://${BASE_DOMAIN}/media/${img.thumbnail_path||img.local_path}`, type: isVid ? 'video.other' : 'article' };
    const schema = isVid ? {"@context":"https://schema.org","@type":"VideoObject","name":title,"description":meta.description,"thumbnailUrl":meta.image,"contentUrl":`https://${BASE_DOMAIN}/media/${img.local_path}`,"uploadDate":img.created_at||new Date().toISOString(),"interactionStatistic":{"@type":"InteractionCounter","interactionType":"WatchAction","userInteractionCount":img.view_count||0}} : {"@context":"https://schema.org","@type":"ImageObject","name":title,"contentUrl":meta.image};
    let body = `<article><h2>${esc(title)}</h2>`;
    body += isVid ? `<video controls poster="${meta.image}" style="width:100%;max-width:800px"><source src="/media/${img.local_path}" type="video/mp4"></video>` : `<img src="/media/${img.local_path}" alt="${esc(title)}" style="width:100%;max-width:800px">`;
    body += `<p>${esc(img.description||'')}</p><p><strong>${vc} ${vl}</strong> | <a href="/pics/c/${img.belongs_to_gallery}">${esc(img.catname||'Gallery')}</a></p></article>`;
    const relatedLabel = ui.relatedIn || 'Related';
    try { const rel = await pool.query('SELECT id,title,thumbnail_path FROM image WHERE belongs_to_gallery=$1 AND id!=$2 ORDER BY view_count DESC LIMIT 8', [img.belongs_to_gallery, id]); if (rel.rows.length) { body += `<h3>${relatedLabel}</h3><div class="g">`; for (const x of rel.rows) body += `<div class="i"><a href="/pics/v/${x.id}"><img src="/media/${x.thumbnail_path}" alt="${esc(x.title||'')}" loading="lazy"></a><h3><a href="/pics/v/${x.id}">${esc((x.title||'Video').substring(0,40))}</a></h3></div>`; body += `</div>`; } } catch(e) {}
    res.send(botHtml(meta, lang, `/pics/v/${id}`, schema, body, 'pics'));
  } catch(e) { console.error('SEO /pics/v/:id:', e.message); servePicsSpa(req, res); }
});

// Pics category page - redirect large categories to /pics/sites/:slug/
app.get('/pics/c/:id', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req), id = parseInt(req.params.id);

  try {
    const r = await pool.query('SELECT * FROM category WHERE id=$1', [id]);
    if (!r.rows.length) {
      res.status(404);
      const meta = { title: 'Category Not Found | BoyVue', description: 'The requested category could not be found.' };
      return res.send(botHtml(meta, lang, `/pics/c/${id}`, null, '<h2>404 - Category Not Found</h2><p>This category does not exist.</p><p><a href="/pics/">Return to gallery</a></p>', 'pics'));
    }
    const cat = r.rows[0];

    // Redirect categories with 500+ photos to /pics/sites/:slug/ landing pages
    if (cat.photo_count > 500) {
      const slug = cat.catname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
      return res.redirect(301, `/pics/sites/${slug}/`);
    }

    if (!isBot(ua) && !req.query.lang) return servePicsSpa(req, res);

    const seo = await getSeoTranslations(lang);
    let name = cat.catname;
    if (lang !== 'en') name = await translate(name, lang);

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
    let coverImage = `https://${BASE_DOMAIN}/media/logo-social.jpg`;
    try { const first = await pool.query('SELECT thumbnail_path FROM image WHERE belongs_to_gallery=$1 ORDER BY view_count DESC LIMIT 1', [id]); if (first.rows.length) coverImage = `https://${BASE_DOMAIN}/media/${first.rows[0].thumbnail_path}`; } catch(e) {}

    const meta = {
      title: seoData?.seo_title || `${name} | BoyVue Gallery`,
      description: seoData?.seo_description || `${seo.browse} ${pc} photos and videos in ${name}. Free HD streaming.`,
      keywords: seoData?.seo_keywords || '',
      image: coverImage
    };

    const schema = {"@context":"https://schema.org","@type":"CollectionPage","name":meta.title,"description":meta.description,"numberOfItems":cat.photo_count||0,"inLanguage":lang,"mainEntity":{"@type":"ItemList","itemListElement":[]}};
    let body = `<h2>${esc(name)}</h2><p>${pc} items</p><div class="g">`;
    try { const imgs = await pool.query('SELECT id,title,thumbnail_path,view_count FROM image WHERE belongs_to_gallery=$1 ORDER BY view_count DESC LIMIT 48', [id]); for (const i of imgs.rows) body += `<div class="i"><a href="/pics/v/${i.id}"><img src="/media/${i.thumbnail_path}" alt="${esc(i.title||'')}" loading="lazy"></a><h3><a href="/pics/v/${i.id}">${esc((i.title||'Video').substring(0,40))}</a></h3><p>${(i.view_count||0).toLocaleString()} ${seo.views}</p></div>`; } catch(e) {}
    body += `</div>`;
    res.send(botHtml(meta, lang, `/pics/c/${id}`, schema, body, 'pics'));
  } catch(e) { console.error('SEO /pics/c/:id:', e.message); servePicsSpa(req, res); }
});

// Pics share API
app.get('/api/share/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try { const r = await pool.query('SELECT id,title,thumbnail_path FROM image WHERE id=$1', [id]); if (!r.rows.length) return res.status(404).json({error:'Not found'}); const img = r.rows[0]; const url = `https://${BASE_DOMAIN}/pics/v/${id}`; res.json({ url, title: img.title, image: `https://${BASE_DOMAIN}/media/${img.thumbnail_path}`, shares: socialShareUrls(url, img.title, `https://${BASE_DOMAIN}/media/${img.thumbnail_path}`) }); } catch(e) { res.status(500).json({error: e.message}); }
});

// Pics review page with SEO
app.get('/pics/review/:slug', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req), slug = req.params.slug;
  if (!isBot(ua) && !req.query.lang) return servePicsSpa(req, res);
  try {
    // Get category by slug
    const catResult = await pool.query('SELECT id, catname, photo_count FROM category WHERE LOWER(catname) = LOWER($1)', [slug]);
    if (!catResult.rows.length) {
      res.status(404);
      const meta = { title: 'Review Not Found | BoyVue', description: 'The requested review could not be found.' };
      return res.send(botHtml(meta, lang, `/pics/review/${slug}`, null, '<h2>404 - Review Not Found</h2><p>This review does not exist.</p><p><a href="/pics/">Return to gallery</a></p>', 'pics'));
    }
    const cat = catResult.rows[0];

    // Get review data
    const reviewResult = await pool.query(`
      SELECT sr.*, sw.url as official_url, sw.total_backlinks
      FROM site_reviews sr
      LEFT JOIN seo_websites sw ON LOWER(sw.name) = LOWER(sr.site_name)
      WHERE sr.category_id = $1
    `, [cat.id]);
    const review = reviewResult.rows[0] || {};

    // Get translation
    const transResult = await pool.query(
      'SELECT title, summary, consensus, pros, cons FROM site_review_translations WHERE review_id = $1 AND lang = $2',
      [review.id, lang]
    );
    let trans = transResult.rows[0];
    if (!trans && lang !== 'en') {
      const enResult = await pool.query('SELECT title, summary, consensus, pros, cons FROM site_review_translations WHERE review_id = $1 AND lang = $2', [review.id, 'en']);
      trans = enResult.rows[0];
    }

    // Get keywords for meta
    const keywordsResult = await pool.query(`
      SELECT keyword, search_volume FROM seo_website_keywords swk
      JOIN seo_websites sw ON sw.id = swk.website_id
      WHERE LOWER(sw.name) = LOWER($1)
      ORDER BY search_volume DESC NULLS LAST LIMIT 20
    `, [cat.catname]);
    const keywords = keywordsResult.rows.map(k => k.keyword).join(', ');

    // Get sample images for thumbnails
    const imagesResult = await pool.query(`
      SELECT thumbnail_path, title FROM image WHERE belongs_to_gallery = $1 ORDER BY view_count DESC LIMIT 6
    `, [cat.id]);

    const seo = await getSeoTranslations(lang);
    const summary = trans?.summary || review.ai_summary || `Comprehensive review of ${cat.catname} with ratings and user comments.`;
    const meta = {
      title: `${cat.catname} Review - Rating ${review.overall_rating || 'N/A'}/5 | BoyVue`,
      description: summary.substring(0, 160),
      image: imagesResult.rows[0] ? `https://${BASE_DOMAIN}/media/${imagesResult.rows[0].thumbnail_path}` : `https://${BASE_DOMAIN}/media/logo-social.jpg`,
      keywords,
      type: 'article'
    };

    const schema = {
      "@context": "https://schema.org",
      "@type": "Review",
      "itemReviewed": {
        "@type": "WebSite",
        "name": cat.catname,
        "url": review.official_url || review.site_url || ''
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": review.overall_rating || 0,
        "bestRating": 5
      },
      "author": { "@type": "Organization", "name": "BoyVue" },
      "reviewBody": summary,
      "datePublished": review.last_reviewed || new Date().toISOString()
    };

    // Build body
    let body = `<article><h2>${esc(cat.catname)} Review</h2>`;
    body += `<p><strong>Rating:</strong> ${review.overall_rating || 'N/A'}/5 | <strong>Content:</strong> ${cat.photo_count?.toLocaleString()} items</p>`;
    if (review.official_url) body += `<p><a href="${review.official_url}" target="_blank" rel="nofollow">Official Website</a></p>`;

    // Summary
    if (summary) body += `<section><h3>Summary</h3><p>${esc(summary)}</p></section>`;

    // Ratings breakdown
    body += `<section><h3>Detailed Ratings</h3><ul>`;
    body += `<li>Content Quality: ${review.content_quality || 0}/5</li>`;
    body += `<li>Update Frequency: ${review.update_frequency || 0}/5</li>`;
    body += `<li>Video Quality: ${review.video_quality || 0}/5</li>`;
    body += `<li>Model Variety: ${review.model_variety || 0}/5</li>`;
    body += `<li>Value for Money: ${review.value_rating || 0}/5</li>`;
    body += `</ul></section>`;

    // Pros & Cons
    const pros = trans?.pros || review.pros || [];
    const cons = trans?.cons || review.cons || [];
    if (pros.length || cons.length) {
      body += `<section><h3>Pros & Cons</h3>`;
      if (pros.length) body += `<h4>Pros</h4><ul>${pros.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`;
      if (cons.length) body += `<h4>Cons</h4><ul>${cons.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
      body += `</section>`;
    }

    // Screenshots/Preview images
    if (imagesResult.rows.length) {
      body += `<section><h3>Preview Screenshots</h3><div class="g">`;
      for (const img of imagesResult.rows) {
        body += `<div class="i"><img src="/media/${img.thumbnail_path}" alt="${esc(img.title || cat.catname + ' screenshot')}" loading="lazy"></div>`;
      }
      body += `</div></section>`;
    }

    // Keywords
    if (keywords) body += `<section><h3>Related Keywords</h3><p>${esc(keywords)}</p></section>`;

    body += `<p><a href="/pics/c/${cat.id}">Browse all ${cat.catname} content</a></p>`;
    body += `</article>`;

    res.send(botHtml(meta, lang, `/pics/review/${slug}`, schema, body, 'pics'));
  } catch(e) {
    console.error('SEO /pics/review/:slug:', e.message);
    servePicsSpa(req, res);
  }
});

// ========== PICS SITES SECTION - BoysReview Style Landing Pages ==========

// Sites index page - list all categories with reviews
app.get('/pics/sites/', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req);
  if (!isBot(ua) && !req.query.lang) return servePicsSpa(req, res);

  try {
    const categories = await pool.query(`
      SELECT c.id, c.catname, c.photo_count, sr.overall_rating, sr.ai_summary
      FROM category c
      LEFT JOIN site_reviews sr ON sr.category_id = c.id
      WHERE c.photo_count > 500
      ORDER BY c.photo_count DESC
    `);

    const meta = {
      title: 'Gay Porn Site Reviews - 50+ Sites Rated | BoyVue',
      description: 'Browse comprehensive reviews of 50+ gay porn sites. Ratings, screenshots, and honest reviews to help you find the best content.',
      image: `https://${BASE_DOMAIN}/media/logo-social.jpg`
    };

    const schema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Gay Porn Site Reviews",
      "description": meta.description,
      "url": `https://${BASE_DOMAIN}/pics/sites/`,
      "numberOfItems": categories.rows.length
    };

    let body = `<nav class="breadcrumb"><a href="/pics/">Gallery</a> &raquo; <strong>Sites</strong></nav>`;
    body += `<h1>Gay Porn Site Reviews</h1>`;
    body += `<p>${categories.rows.length} sites reviewed with ratings and screenshots</p>`;
    body += `<div class="g" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">`;

    for (const cat of categories.rows) {
      const slug = cat.catname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
      const rating = cat.overall_rating ? `${cat.overall_rating}/5` : 'N/A';
      const summary = cat.ai_summary ? cat.ai_summary.substring(0, 100) + '...' : `Free pics and videos from ${cat.catname}`;
      body += `<div class="i" style="padding:15px">`;
      body += `<h3 style="margin:0 0 10px"><a href="/pics/sites/${slug}/">${esc(cat.catname)}</a></h3>`;
      body += `<p style="font-size:12px;color:#888;margin:0 0 8px">${cat.photo_count.toLocaleString()} photos &bull; Rating: ${rating}</p>`;
      body += `<p style="font-size:13px;margin:0">${esc(summary)}</p>`;
      body += `</div>`;
    }
    body += `</div>`;

    res.send(botHtml(meta, lang, '/pics/sites/', schema, body, 'pics'));
  } catch(e) {
    console.error('SEO /pics/sites/:', e.message);
    servePicsSpa(req, res);
  }
});

// Individual site landing page - BoysReview style (i18n compliant)
app.get('/pics/sites/:slug/', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req);
  const slug = req.params.slug.toLowerCase();

  // Always serve full content for both bots and users
  try {
    // Get i18n translations for SEO
    const tr = await getSeoTranslations(lang);

    // Find category by slug (convert slug back to name)
    const catResult = await pool.query(`
      SELECT id, catname, photo_count
      FROM category
      WHERE LOWER(REPLACE(REPLACE(catname, ' ', '-'), '_', '-')) = $1
         OR LOWER(catname) = $1
         OR LOWER(REPLACE(catname, ' ', '')) = REPLACE($1, '-', '')
      LIMIT 1
    `, [slug]);

    if (!catResult.rows.length) {
      res.status(404);
      const meta = { title: `${tr.siteNotFound} | BoyVue`, description: tr.siteNotFound };
      return res.send(botHtml(meta, lang, `/pics/sites/${slug}/`, null,
        `<h2>404 - ${esc(tr.siteNotFound)}</h2><p><a href="/pics/sites/">${esc(tr.browseSites)}</a></p>`, 'pics'));
    }

    const cat = catResult.rows[0];

    // Get review data
    const reviewResult = await pool.query(`
      SELECT sr.*, sw.url as official_url, sw.total_backlinks
      FROM site_reviews sr
      LEFT JOIN seo_websites sw ON LOWER(sw.name) = LOWER(sr.site_name)
      WHERE sr.category_id = $1
    `, [cat.id]);
    const review = reviewResult.rows[0] || {};

    // Get sample images
    const imagesResult = await pool.query(`
      SELECT id, thumbnail_path, title, view_count
      FROM image
      WHERE belongs_to_gallery = $1
      ORDER BY view_count DESC
      LIMIT 24
    `, [cat.id]);

    // Get video count
    const videoCount = await pool.query(`
      SELECT COUNT(*) as cnt FROM image
      WHERE belongs_to_gallery = $1
      AND (local_path LIKE '%.mp4' OR local_path LIKE '%.webm' OR local_path LIKE '%.avi')
    `, [cat.id]);

    // Calculate stats
    const photoCount = cat.photo_count || 0;
    const videos = parseInt(videoCount.rows[0]?.cnt) || 0;
    const models = review.model_variety ? review.model_variety * 50 : Math.round(photoCount / 20);
    const score = review.overall_rating ? Math.round(review.overall_rating * 20) : 75;

    // Build meta with score in title if review exists (i18n)
    const summary = review.ai_summary || `${tr.freePicsVideos} - ${cat.catname}. ${photoCount.toLocaleString()} ${tr.photos}.`;
    const titleWithScore = score && review.overall_rating
      ? `${cat.catname} ${tr.review} (${score}/100) - ${photoCount.toLocaleString()} ${tr.freePicsVideos} | BoyVue`
      : `${cat.catname} ${tr.freePicsVideos} - ${photoCount.toLocaleString()} ${tr.photos} | BoyVue`;
    const meta = {
      title: titleWithScore,
      description: summary.substring(0, 160),
      image: imagesResult.rows[0] ? `https://${BASE_DOMAIN}/media/${imagesResult.rows[0].thumbnail_path}` : `https://${BASE_DOMAIN}/media/logo-social.jpg`,
      type: 'website'
    };

    // Enhanced Schema.org with @graph for SERP features (i18n)
    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        // CollectionPage
        {
          "@type": "CollectionPage",
          "@id": `https://${BASE_DOMAIN}/pics/sites/${slug}/#collection`,
          "name": `${cat.catname} ${tr.freePicsVideos}`,
          "description": summary.substring(0, 200),
          "url": `https://${BASE_DOMAIN}/pics/sites/${slug}/`,
          "inLanguage": lang,
          "numberOfItems": photoCount,
          "isPartOf": { "@type": "WebSite", "name": "BoyVue", "url": `https://${BASE_DOMAIN}` },
          "mainEntity": { "@type": "ImageGallery", "name": cat.catname, "numberOfItems": photoCount }
        },
        // Review schema (for SERP stars)
        ...(score && review.overall_rating ? [{
          "@type": "Review",
          "@id": `https://${BASE_DOMAIN}/pics/sites/${slug}/#review`,
          "itemReviewed": { "@type": "WebSite", "name": cat.catname },
          "reviewRating": { "@type": "Rating", "ratingValue": (score / 20).toFixed(1), "bestRating": 5, "worstRating": 1 },
          "author": { "@type": "Organization", "name": "BoyVue" },
          "inLanguage": lang,
          "reviewBody": summary.substring(0, 200)
        }] : []),
        // Product with AggregateRating (for SERP rich results)
        ...(score && review.overall_rating ? [{
          "@type": "Product",
          "name": cat.catname,
          "description": summary.substring(0, 150),
          "image": meta.image,
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": (score / 20).toFixed(1),
            "bestRating": 5,
            "ratingCount": Math.max(10, Math.round(photoCount / 100)),
            "reviewCount": Math.max(5, Math.round(photoCount / 200))
          }
        }] : []),
        // FAQPage for SERP features (i18n)
        {
          "@type": "FAQPage",
          "mainEntity": [
            { "@type": "Question", "name": `${tr.whatIs} ${cat.catname}?`, "acceptedAnswer": { "@type": "Answer", "text": review.ai_summary || `${cat.catname} - ${photoCount} ${tr.photos}.` } },
            { "@type": "Question", "name": `${tr.howManyPhotos} ${cat.catname}?`, "acceptedAnswer": { "@type": "Answer", "text": `${cat.catname}: ${photoCount.toLocaleString()} ${tr.photos}, ${videos.toLocaleString()} ${tr.videos}.` } },
            { "@type": "Question", "name": `${tr.whatRating} ${cat.catname}?`, "acceptedAnswer": { "@type": "Answer", "text": score ? `${cat.catname}: ${score}/100 (BoyVue).` : `${cat.catname} - BoyVue.` } }
          ]
        }
      ]
    };

    // Get site-specific keywords for ALT tags
    const siteKeywords = [cat.catname, `${cat.catname} videos`, `${cat.catname} free`, `${cat.catname} review`];

    // Build HTML body - BoysReview style
    let body = `
<style>
  .site-header { padding: 20px 0; border-bottom: 1px solid #333; margin-bottom: 20px; }
  .site-header h1 { font-size: 2em; margin: 0 0 10px 0; }
  .site-stats { color: #888; font-size: 0.9em; margin-bottom: 15px; }
  .site-intro { font-size: 1.1em; font-style: italic; margin: 15px 0; color: #ccc; }
  .site-thumbnail { float: right; margin: 0 0 20px 20px; max-width: 250px; }
  .site-thumbnail img { width: 100%; border-radius: 8px; }
  .full-review { margin-bottom: 30px; line-height: 1.8; clear: both; }
  .full-review h2 { color: #f60; margin-top: 30px; }
  .review-content { white-space: pre-wrap; }
  .site-details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; padding: 20px; background: #1a1a1a; border-radius: 8px; }
  .site-details h3 { margin-top: 0; color: #f60; }
  .site-details table { width: 100%; }
  .site-details td { padding: 5px 0; }
  .new-faces { margin: 30px 0; }
  .new-faces h2 { color: #f60; }
  .newface-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; }
  .newface-item { text-align: center; }
  .newface-item img { max-height: 200px; border-radius: 8px; width: 100%; object-fit: cover; }
  .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }
  .photo-item { background: #1a1a1a; border-radius: 8px; overflow: hidden; }
  .photo-item img { width: 100%; height: 150px; object-fit: cover; }
  .photo-item .title { padding: 10px; font-size: 0.85em; }
  .related-sites { margin-top: 40px; padding-top: 20px; border-top: 1px solid #333; }
  .related-list { display: flex; flex-wrap: wrap; gap: 10px; }
  .related-list a { background: #222; padding: 8px 15px; border-radius: 20px; text-decoration: none; color: #fff; }
  .breadcrumb { font-size: 0.85em; color: #888; margin-bottom: 15px; }
  .breadcrumb a { color: #aaa; text-decoration: none; }
  @media (max-width: 768px) {
    .site-details { grid-template-columns: 1fr; }
    .site-thumbnail { float: none; margin: 15px auto; display: block; }
  }
</style>

<!-- Breadcrumb (i18n) -->
<nav class="breadcrumb">
  <a href="/pics/">${esc(tr.gallery)}</a> &raquo;
  <a href="/pics/sites/">${esc(tr.sites)}</a> &raquo;
  <strong>${esc(cat.catname)}</strong>
</nav>

<!-- Site Header (i18n) -->
<header class="site-header">
  <h1>${esc(cat.catname)} ${esc(tr.freePicsVideos)}</h1>
  <div class="site-stats">
    ${photoCount.toLocaleString()} ${esc(tr.photos)}
    &bull; ${videos.toLocaleString()} ${esc(tr.videos)}
    &bull; ${models.toLocaleString()} ${esc(tr.models)}
    &bull; ${esc(tr.score)}: ${score}/100
  </div>

  ${review.ai_summary ? `<div class="site-intro">${esc(review.ai_summary)}</div>` : ''}

  ${imagesResult.rows[0] ? `
  <div class="site-thumbnail">
    <img src="/media/${imagesResult.rows[0].thumbnail_path}" alt="${esc(cat.catname)} - ${esc(tr.freePicsVideos)} ${esc(tr.preview)}">
  </div>
  ` : ''}
</header>
`;

    // Full Review Section (i18n)
    if (review.ai_consensus) {
      const reviewHtml = review.ai_consensus.replace(/\n/g, '<br>');
      body += `
<section class="full-review">
  <h2>${esc(tr.fullReview)} - ${esc(cat.catname)}</h2>
  <div class="review-content">${reviewHtml}</div>

  <div class="site-details">
    <div>
      <h3>${esc(tr.siteStats)}</h3>
      <table>
        <tr><td>${esc(tr.updates)}:</td><td>${review.update_frequency > 7 ? tr.daily : review.update_frequency > 5 ? '3x ' + tr.weekly.toLowerCase() : tr.weekly}</td></tr>
        <tr><td>${esc(tr.galleries)}:</td><td>${photoCount.toLocaleString()}</td></tr>
        <tr><td>${esc(tr.videos)}:</td><td>${videos.toLocaleString()} HD/SD</td></tr>
      </table>
    </div>
    <div>
      <h3>${esc(tr.modelInfo)}</h3>
      <table>
        <tr><td>${esc(tr.modelAges)}:</td><td>18-25</td></tr>
        <tr><td>${esc(tr.models)}:</td><td>${models.toLocaleString()}</td></tr>
        <tr><td>${esc(tr.quality)}:</td><td>${review.video_quality > 7 ? 'HD/4K' : review.video_quality > 5 ? 'HD' : 'SD/HD'}</td></tr>
      </table>
    </div>
  </div>
  ${review.site_url ? `<p style="margin-top:15px"><a href="${esc(review.site_url)}" target="_blank" rel="nofollow">${esc(tr.visitOfficialSite)} &raquo;</a></p>` : ''}
</section>
`;
    }

    // Latest content section (i18n)
    if (imagesResult.rows.length) {
      body += `
<section class="new-faces">
  <h2>${esc(tr.latestContent)} ${esc(cat.catname)}</h2>
  <div class="newface-grid">
`;
      imagesResult.rows.slice(0, 8).forEach((img, idx) => {
        const kwIndex = idx % siteKeywords.length;
        const altText = img.title ? `${img.title} - ${cat.catname}` : `${cat.catname} ${siteKeywords[kwIndex]}`;
        body += `
    <div class="newface-item">
      <a href="/pics/v/${img.id}">
        <img src="/media/${img.thumbnail_path}" alt="${esc(altText)}" loading="lazy">
      </a>
      <div style="font-size: 0.85em; margin-top: 5px; color: #aaa;">
        ${esc((img.title || 'View').substring(0, 30))}
      </div>
    </div>
`;
      });
      body += `
  </div>
</section>
`;
    }

    // Photo grid (i18n)
    if (imagesResult.rows.length > 8) {
      body += `
<section>
  <h2>${esc(tr.photoGallery)}</h2>
  <div class="photo-grid">
`;
      imagesResult.rows.slice(8).forEach((img, idx) => {
        const kwIndex = (idx + 8) % siteKeywords.length;
        const altText = img.title ? `${img.title} - ${cat.catname}` : `${cat.catname} ${siteKeywords[kwIndex]}`;
        body += `
    <div class="photo-item">
      <a href="/pics/v/${img.id}">
        <img src="/media/${img.thumbnail_path}" alt="${esc(altText)}" loading="lazy">
      </a>
      <div class="title">${esc((img.title || 'View').substring(0, 40))}</div>
    </div>
`;
      });
      body += `
  </div>
  <p style="text-align:center;margin-top:20px"><a href="/pics/c/${cat.id}">${esc(tr.viewAll)} ${photoCount.toLocaleString()} ${esc(tr.photos)} &raquo;</a></p>
</section>
`;
    }

    // Related sites (i18n)
    const relatedResult = await pool.query(`
      SELECT c.catname, c.photo_count
      FROM category c
      WHERE c.photo_count > 500 AND c.id != $1
      ORDER BY c.photo_count DESC
      LIMIT 12
    `, [cat.id]);

    if (relatedResult.rows.length) {
      body += `
<section class="related-sites">
  <h2>${esc(tr.relatedSites)}</h2>
  <div class="related-list">
`;
      for (const rel of relatedResult.rows) {
        const relSlug = rel.catname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
        body += `<a href="/pics/sites/${relSlug}/">${esc(rel.catname)}</a>`;
      }
      body += `
  </div>
</section>
`;
    }

    res.send(botHtml(meta, lang, `/pics/sites/${slug}/`, schema, body, 'pics'));
  } catch(e) {
    console.error('SEO /pics/sites/:slug/:', e.message);
    servePicsSpa(req, res);
  }
});

// Pics catch-all SPA routes
app.get('/pics/*', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const knownRoutes = /^\/pics\/($|v\/\d+|c\/\d+|sites|review\/\w+|search|categories|popular|recent)/;
  if (isBot(ua) && !knownRoutes.test(req.path)) {
    res.status(404);
    const meta = { title: 'Page Not Found | BoyVue', description: 'The requested page could not be found.' };
    return res.send(botHtml(meta, 'en', req.path, null, '<h2>404 - Page Not Found</h2><p>The page you requested does not exist.</p><p><a href="/pics/">Return to gallery</a></p>', 'pics'));
  }
  servePicsSpa(req, res);
});

// ========== FANS SECTION (/fans/*) ==========

// Fans static assets
app.use('/fans', express.static(join(__dirname, '../dist-creatives'), { index: false }));

// Fans homepage - Enhanced SEO
app.get('/fans/', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req);
  if (isBot(ua)) {
    const tr = await getSeoTranslations(lang);

    // Get counts for dynamic SEO
    let platformCount = 0, liveCount = 0, platforms = [];
    try {
      const platformRes = await pool.query("SELECT COUNT(*) as count FROM cam_platforms WHERE is_active = true");
      platformCount = parseInt(platformRes.rows[0]?.count || 6);
      const liveRes = await pool.query("SELECT COUNT(*) as count FROM cam_rooms WHERE is_live = true");
      liveCount = parseInt(liveRes.rows[0]?.count || 0);
      platforms = (await pool.query("SELECT name, slug, room_count FROM cam_platforms WHERE is_active = true ORDER BY room_count DESC LIMIT 6")).rows;
    } catch(e) {
      // Use defaults if tables don't exist
      platformCount = 6;
      platforms = [
        { name: 'Chaturbate', slug: 'chaturbate', room_count: 1000 },
        { name: 'Stripchat', slug: 'stripchat', room_count: 500 },
        { name: 'BongaCams', slug: 'bongacams', room_count: 300 },
        { name: 'Cam4', slug: 'cam4', room_count: 200 },
        { name: 'Flirt4Free', slug: 'flirt4free', room_count: 150 },
        { name: 'CamSoda', slug: 'camsoda', room_count: 100 }
      ];
    }

    const meta = {
      title: `Gay Cam Sites - Compare ${platformCount}+ Live Cam Platforms | BoyVue Fans`,
      description: `Watch ${liveCount > 0 ? liveCount.toLocaleString() + '+ ' : ''}live gay cam performers. Compare Chaturbate, Stripchat, Cam4, and more. Free live shows and private chats.`,
      image: `https://${BASE_DOMAIN}/media/logo-social.jpg`,
      keywords: 'gay cams, gay webcams, chaturbate gay, stripchat gay, live gay cams, gay cam sites, gay cam performers'
    };

    // Build ItemList for platforms
    const platformItems = platforms.map((p, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "WebSite",
        "name": p.name,
        "url": `https://${BASE_DOMAIN}/fans/platforms/${p.slug}`,
        "description": `${p.name} - ${(p.room_count || 0).toLocaleString()} live performers`
      }
    }));

    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          "@id": `https://${BASE_DOMAIN}/fans/#collection`,
          "name": "Gay Cam Sites",
          "description": meta.description,
          "url": `https://${BASE_DOMAIN}/fans/`,
          "inLanguage": lang,
          "numberOfItems": platformCount,
          "isPartOf": { "@type": "WebSite", "name": "BoyVue", "url": `https://${BASE_DOMAIN}` }
        },
        {
          "@type": "ItemList",
          "name": "Gay Cam Platforms",
          "itemListOrder": "https://schema.org/ItemListOrderDescending",
          "numberOfItems": platforms.length,
          "itemListElement": platformItems
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What are the best gay cam sites?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": `BoyVue Fans compares ${platformCount}+ gay cam platforms including Chaturbate, Stripchat, BongaCams, Cam4, and Flirt4Free. Each platform is rated on performer variety, video quality, and features.`
              }
            },
            {
              "@type": "Question",
              "name": "Are gay cam sites free?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Most gay cam sites offer free public shows. Sites like Chaturbate and Stripchat have thousands of free live performers. Private shows and tips are optional."
              }
            },
            {
              "@type": "Question",
              "name": "Which gay cam site has the most performers?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Chaturbate typically has the most live gay performers at any time, followed by Stripchat and BongaCams. BoyVue Fans tracks live performers across all platforms."
              }
            }
          ]
        }
      ]
    };

    let body = `<h2>Live Cam Performers</h2><p>${meta.description}</p>`;
    body += `<ul>`;
    body += `<li><a href="/fans/live">Live Now${liveCount > 0 ? ` (${liveCount.toLocaleString()})` : ''}</a></li>`;
    body += `<li><a href="/fans/platforms">Browse by Platform</a></li>`;
    body += `<li><a href="/fans/themes">Browse by Theme</a></li>`;
    body += `</ul>`;
    if (platforms.length) {
      body += `<h3>Top Platforms</h3><ul>`;
      for (const p of platforms) body += `<li><a href="/fans/platforms/${p.slug}">${esc(p.name)}</a> - ${(p.room_count || 0).toLocaleString()} performers</li>`;
      body += `</ul>`;
    }
    return res.send(botHtml(meta, lang, '/fans/', schema, body, 'fans'));
  }
  serveFansSpa(req, res);
});

// Fans catch-all SPA routes
app.get('/fans/*', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) {
    const meta = { title: 'BoyVue Fans', description: 'Watch live cam performers.' };
    return res.send(botHtml(meta, 'en', req.path, null, '<p>Loading...</p>', 'fans'));
  }
  serveFansSpa(req, res);
});

// ========== VIDEOS SECTION (/videos/*) ==========

// Videos static assets
app.use('/videos', express.static(join(__dirname, '../dist-videos'), { index: false }));

// Videos homepage (i18n compliant) - Enhanced SEO
app.get('/videos/', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req);
  if (isBot(ua)) {
    const tr = await getSeoTranslations(lang);

    // Get counts for dynamic SEO
    let studioCount = 0, categoryCount = 0, studios = [], cats = [];
    try {
      const countRes = await pool.query('SELECT COUNT(*) as count FROM video_studios WHERE is_active = true');
      studioCount = parseInt(countRes.rows[0]?.count || 0);
      const catCountRes = await pool.query('SELECT COUNT(*) as count FROM video_categories WHERE is_active = true');
      categoryCount = parseInt(catCountRes.rows[0]?.count || 0);
      studios = (await pool.query('SELECT id, name, slug, tagline, overall_rating FROM video_studios WHERE is_active = true AND is_featured = true ORDER BY display_order LIMIT 10')).rows;
      cats = (await pool.query('SELECT name, slug, studio_count FROM video_categories WHERE is_active = true ORDER BY display_order LIMIT 12')).rows;
    } catch(e) { console.error('Videos SEO error:', e.message); }

    const meta = {
      title: `Gay Video Sites - Compare ${studioCount}+ Studios & Streaming Sites | BoyVue`,
      description: `Compare ${studioCount}+ gay video streaming sites. Reviews, ratings, and free previews from top studios like Men.com, Sean Cody, Helix Studios and more.`,
      image: `https://${BASE_DOMAIN}/media/logo-social.jpg`,
      keywords: 'gay videos, gay porn sites, men.com, sean cody, helix studios, corbin fisher, gay streaming, gay porn reviews'
    };

    // Build ItemList for studios
    const studioItems = studios.map((s, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "item": {
        "@type": "Product",
        "name": s.name,
        "url": `https://${BASE_DOMAIN}/videos/studios/${s.slug}`,
        "description": s.tagline || `${s.name} - Gay video streaming site`,
        ...(s.overall_rating ? { "aggregateRating": { "@type": "AggregateRating", "ratingValue": s.overall_rating, "bestRating": 5, "ratingCount": 10 }} : {})
      }
    }));

    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          "@id": `https://${BASE_DOMAIN}/videos/#collection`,
          "name": "Gay Video Streaming Sites",
          "description": meta.description,
          "url": `https://${BASE_DOMAIN}/videos/`,
          "inLanguage": lang,
          "numberOfItems": studioCount,
          "isPartOf": { "@type": "WebSite", "name": "BoyVue", "url": `https://${BASE_DOMAIN}` }
        },
        {
          "@type": "ItemList",
          "name": "Featured Gay Video Studios",
          "itemListOrder": "https://schema.org/ItemListOrderDescending",
          "numberOfItems": studios.length,
          "itemListElement": studioItems
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What are the best gay video streaming sites?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": `BoyVue compares ${studioCount}+ gay video sites including Men.com, Sean Cody, Helix Studios, Corbin Fisher, and more. Each site is rated on content quality, video quality, and value.`
              }
            },
            {
              "@type": "Question",
              "name": "Which gay porn sites have free previews?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Most major studios offer free trailers and preview content. Sites like Helix Studios, CockyBoys, and BelAmi provide extensive free samples."
              }
            },
            {
              "@type": "Question",
              "name": "How do I choose a gay video subscription?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": `Compare ${studioCount} studios by content type (twink, muscle, daddy, etc.), video quality (4K/HD), update frequency, and pricing. BoyVue provides detailed ratings for each.`
              }
            }
          ]
        }
      ]
    };

    let body = `<h2>${esc(tr.videoSites || 'Video Streaming Sites')}</h2><p>${meta.description}</p>`;
    if (studios.length) {
      body += `<h3>${esc(tr.featuredStudios || 'Featured Studios')}</h3><ul>`;
      for (const s of studios) body += `<li><a href="/videos/studios/${s.slug}">${esc(s.name)}</a> - ${esc(s.tagline || '')}</li>`;
      body += `</ul>`;
    }
    if (cats.length) {
      body += `<h3>${esc(tr.videoCategories || 'Video Categories')}</h3><ul>`;
      for (const c of cats) body += `<li><a href="/videos/categories/${c.slug}">${esc(c.name)}</a> (${c.studio_count} ${esc(tr.studios || 'studios')})</li>`;
      body += `</ul>`;
    }
    return res.send(botHtml(meta, lang, '/videos/', schema, body, 'videos'));
  }
  serveVideosSpa(req, res);
});

// Videos catch-all SPA routes (i18n compliant)
app.get('/videos/*', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req);
  if (isBot(ua)) {
    const tr = await getSeoTranslations(lang);
    const meta = { title: `BoyVue Videos - ${tr.freeVideos}`, description: tr.compareFeatures };
    return res.send(botHtml(meta, lang, req.path, null, `<p>${esc(tr.freeVideos)}...</p>`, 'videos'));
  }
  serveVideosSpa(req, res);
});

// ========== ADULT SECTION (/adult/*) ==========

// Adult static assets
app.use('/adult', express.static(join(__dirname, '../dist-adult'), { index: false }));

// Adult homepage
app.get('/adult/', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) {
    const meta = { title: 'BoyVue Adult - Premium Content', description: 'Premium adult content and exclusive videos.', image: `https://${BASE_DOMAIN}/media/logo-social.jpg` };
    const schema = {"@context":"https://schema.org","@type":"WebSite","name":"BoyVue Adult","url":`https://${BASE_DOMAIN}/adult/`,"description":meta.description};
    let body = `<h2>Premium Content</h2><p>Exclusive adult content.</p>`;
    body += `<ul><li><a href="/pics/">Pics Gallery</a></li>`;
    body += `<li><a href="/videos/">Free Videos</a></li>`;
    body += `<li><a href="/fans/">Live Performers</a></li></ul>`;
    return res.send(botHtml(meta, 'en', '/adult/', schema, body, 'adult'));
  }
  serveAdultSpa(req, res);
});

// Adult catch-all SPA routes
app.get('/adult/*', (req, res) => {
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) {
    const meta = { title: 'BoyVue Adult', description: 'Premium adult content.' };
    return res.send(botHtml(meta, 'en', req.path, null, '<p>Loading...</p>', 'adult'));
  }
  serveAdultSpa(req, res);
});

// ========== ADMIN ROUTES ==========

// Admin routes - serve from dist (pics SPA) which contains admin components
app.get('/admin', (req, res) => servePicsSpa(req, res));
app.get('/admin/*', (req, res) => servePicsSpa(req, res));

// ========== MAIN SITE (/) ==========

// Main site static assets
app.use(express.static(join(__dirname, '../dist-main'), { index: false }));

// Main homepage
app.get('/', async (req, res) => {
  const ua = req.headers['user-agent'] || '', lang = getLang(req);

  if (isBot(ua)) {
    const meta = { title: 'BoyVue - Your Gateway to Premium Content', description: 'Login to access BoyVue Gallery and Fans. Photos, videos, and live performers.', image: `https://${BASE_DOMAIN}/media/logo-social.jpg` };
    const schema = {"@context":"https://schema.org","@type":"WebSite","name":"BoyVue","url":`https://${BASE_DOMAIN}`,"description":meta.description};
    let body = `<h2>Welcome to BoyVue</h2><p>Your gateway to premium adult content.</p>`;
    body += `<ul><li><a href="/pics/">Pics - Photo & Video Gallery</a></li>`;
    body += `<li><a href="/videos/">Videos - Free Videos</a></li>`;
    body += `<li><a href="/fans/">Fans - Live Performers</a></li>`;
    body += `<li><a href="/adult/">Adult - Premium Content</a></li></ul>`;
    return res.send(botHtml(meta, lang, '/', schema, body, ''));
  }
  serveMainSpa(req, res);
});

// Main site catch-all
app.get('*', (req, res) => {
  const ua = req.headers['user-agent'] || '';

  // Known main site routes
  const mainRoutes = /^\/($|blog|login|register|profile|settings)/;
  if (isBot(ua) && !mainRoutes.test(req.path)) {
    res.status(404);
    const meta = { title: 'Page Not Found | BoyVue', description: 'The requested page could not be found.' };
    return res.send(botHtml(meta, 'en', req.path, null, '<h2>404 - Page Not Found</h2><p>The page you requested does not exist.</p><p><a href="/">Return to homepage</a></p>', ''));
  }
  serveMainSpa(req, res);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) {
    res.status(500);
    const meta = { title: 'Error | BoyVue', description: 'An error occurred.' };
    return res.send(botHtml(meta, 'en', req.path, null, '<h2>Error</h2><p>Something went wrong. Please try again later.</p><p><a href="/">Return to homepage</a></p>', ''));
  }
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT} with subdirectory routing`));

// Admin-only server (bypasses Cloudflare)
const ADMIN_PORT = process.env.ADMIN_PORT || 9000;
const adminApp = express();
adminApp.use(express.json());
adminApp.use('/api/admin', adminRoutes);
adminApp.use(express.static(join(__dirname, '../public')));
adminApp.get('*', (req, res) => res.sendFile(join(__dirname, '../public/index.html')));
adminApp.listen(ADMIN_PORT, () => console.log(`Admin server on port ${ADMIN_PORT}`));
