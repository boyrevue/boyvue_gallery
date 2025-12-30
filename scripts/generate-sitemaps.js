import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// All supported languages for i18n sitemaps
const LANGUAGES = ['en', 'de', 'ru', 'es', 'zh', 'ja', 'th', 'ko', 'pt', 'fr', 'it', 'nl', 'pl', 'cs', 'ar', 'el', 'vi', 'id', 'tr', 'hu'];
const DEFAULT_LANG = 'en';
const BASE_URL = 'https://boyvue.com';

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Generate hreflang links for a given path
function generateHreflangLinks(pathTemplate, id = null) {
  let links = '';
  for (const lang of LANGUAGES) {
    const langPath = lang === DEFAULT_LANG ? '' : `/${lang}`;
    const url = id !== null
      ? `${BASE_URL}${langPath}${pathTemplate}${id}`
      : `${BASE_URL}${langPath}${pathTemplate}`;
    links += `\n      <xhtml:link rel="alternate" hreflang="${lang}" href="${url}"/>`;
  }
  // x-default points to English version
  const defaultUrl = id !== null
    ? `${BASE_URL}${pathTemplate}${id}`
    : `${BASE_URL}${pathTemplate}`;
  links += `\n      <xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}"/>`;
  return links;
}

async function generateSitemapIndex() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://boyvue.com/sitemap-i18n.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/sitemap-categories.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/sitemap-videos-1.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/sitemap-videos-2.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/sitemap-videos-3.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/sitemap-image.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/sitemap-video.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/sitemap-category-photos.xml</loc></sitemap>
</sitemapindex>`;
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml);
  console.log('Generated sitemap.xml');
}

async function generateCategoriesSitemap() {
  const cats = await pool.query('SELECT id, updated_at FROM category WHERE photo_count > 0 ORDER BY photo_count DESC LIMIT 1000');
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://boyvue.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>${generateHreflangLinks('/')}
  </url>`;
  for (const cat of cats.rows) {
    const lastmod = cat.updated_at ? new Date(cat.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `
  <url>
    <loc>https://boyvue.com/c/${cat.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${generateHreflangLinks('/c/', cat.id)}
  </url>`;
  }
  xml += '\n</urlset>';
  fs.writeFileSync(path.join(publicDir, 'sitemap-categories.xml'), xml);
  console.log(`Generated sitemap-categories.xml (${cats.rows.length} categories with hreflang)`);
}

async function generateVideosSitemap(page) {
  const limit = 10000;
  const offset = (page - 1) * limit;
  const vids = await pool.query(`SELECT id, created_at FROM image ORDER BY view_count DESC LIMIT $1 OFFSET $2`, [limit, offset]);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">`;
  for (const v of vids.rows) {
    const lastmod = v.created_at ? new Date(v.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `
  <url>
    <loc>https://boyvue.com/v/${v.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>${generateHreflangLinks('/v/', v.id)}
  </url>`;
  }
  xml += '\n</urlset>';
  fs.writeFileSync(path.join(publicDir, `sitemap-videos-${page}.xml`), xml);
  console.log(`Generated sitemap-videos-${page}.xml (${vids.rows.length} URLs with hreflang)`);
}

async function generateVideoSitemap() {
  const vids = await pool.query(`SELECT id, title, description, thumbnail_path, local_path, created_at, view_count
    FROM image WHERE local_path LIKE '%.mp4' OR local_path LIKE '%.webm'
    ORDER BY view_count DESC LIMIT 5000`);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`;
  for (const v of vids.rows) {
    const title = esc(v.title || 'Gay Video');
    const desc = esc((v.description || v.title || 'Adult gay video content').substring(0, 200));
    const date = v.created_at ? new Date(v.created_at).toISOString() : new Date().toISOString();
    xml += `
  <url>
    <loc>https://boyvue.com/v/${v.id}</loc>${generateHreflangLinks('/v/', v.id)}
    <video:video>
      <video:thumbnail_loc>https://boyvue.com/media/${v.thumbnail_path}</video:thumbnail_loc>
      <video:title>${title}</video:title>
      <video:description>${desc}</video:description>
      <video:content_loc>https://boyvue.com/media/${v.local_path}</video:content_loc>
      <video:publication_date>${date}</video:publication_date>
      <video:family_friendly>no</video:family_friendly>
      <video:requires_subscription>no</video:requires_subscription>
      <video:live>no</video:live>
      <video:tag>gay</video:tag>
      <video:tag>adult</video:tag>
      <video:tag>twink</video:tag>
      <video:category>Adult</video:category>
    </video:video>
  </url>`;
  }
  xml += '\n</urlset>';
  fs.writeFileSync(path.join(publicDir, 'sitemap-video.xml'), xml);
  console.log(`Generated sitemap-video.xml (${vids.rows.length} videos with hreflang + adult tags)`);
}

async function generateCategoryPhotosSitemap() {
  const cats = await pool.query(`
    SELECT c.id, c.catname, c.updated_at,
           array_agg(i.thumbnail_path ORDER BY i.view_count DESC) as photos,
           array_agg(i.title ORDER BY i.view_count DESC) as titles
    FROM category c
    JOIN image i ON i.belongs_to_gallery = c.id
    WHERE c.photo_count > 0
      AND i.local_path NOT LIKE '%.mp4' AND i.local_path NOT LIKE '%.webm'
    GROUP BY c.id, c.catname, c.updated_at
    ORDER BY c.photo_count DESC
    LIMIT 500
  `);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;
  for (const cat of cats.rows) {
    const lastmod = cat.updated_at ? new Date(cat.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `
  <url>
    <loc>https://boyvue.com/c/${cat.id}</loc>
    <lastmod>${lastmod}</lastmod>${generateHreflangLinks('/c/', cat.id)}`;
    const photos = (cat.photos || []).slice(0, 10);
    const titles = cat.titles || [];
    for (let i = 0; i < photos.length; i++) {
      if (photos[i]) {
        const title = esc(titles[i] || cat.catname || 'Photo');
        xml += `
    <image:image>
      <image:loc>https://boyvue.com/media/${photos[i]}</image:loc>
      <image:title>${title}</image:title>
    </image:image>`;
      }
    }
    xml += `
  </url>`;
  }
  xml += '\n</urlset>';
  fs.writeFileSync(path.join(publicDir, 'sitemap-category-photos.xml'), xml);
  console.log(`Generated sitemap-category-photos.xml (${cats.rows.length} categories with hreflang)`);
}

async function generateImageSitemap() {
  const imgs = await pool.query(`SELECT id, title, thumbnail_path, description FROM image
    WHERE local_path NOT LIKE '%.mp4' AND local_path NOT LIKE '%.webm'
    ORDER BY view_count DESC LIMIT 10000`);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;
  for (const img of imgs.rows) {
    const title = esc(img.title || 'Gay Photo');
    const caption = esc((img.description || img.title || 'Adult gay photo gallery image').substring(0, 200));
    xml += `
  <url>
    <loc>https://boyvue.com/v/${img.id}</loc>${generateHreflangLinks('/v/', img.id)}
    <image:image>
      <image:loc>https://boyvue.com/media/${img.thumbnail_path}</image:loc>
      <image:title>${title}</image:title>
      <image:caption>${caption}</image:caption>
    </image:image>
  </url>`;
  }
  xml += '\n</urlset>';
  fs.writeFileSync(path.join(publicDir, 'sitemap-image.xml'), xml);
  console.log(`Generated sitemap-image.xml (${imgs.rows.length} images with hreflang + captions)`);
}

// Generate dedicated i18n sitemap with all language homepages
async function generateI18nSitemap() {
  const today = new Date().toISOString().split('T')[0];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">`;

  // Homepage for each language
  for (const lang of LANGUAGES) {
    const langPath = lang === DEFAULT_LANG ? '' : `/${lang}`;
    xml += `
  <url>
    <loc>${BASE_URL}${langPath}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>${generateHreflangLinks('/')}
  </url>`;
  }

  xml += '\n</urlset>';
  fs.writeFileSync(path.join(publicDir, 'sitemap-i18n.xml'), xml);
  console.log(`Generated sitemap-i18n.xml (${LANGUAGES.length} language homepages)`);
}

async function main() {
  console.log('Generating i18n-compliant sitemaps with hreflang support...');
  console.log(`Supported languages: ${LANGUAGES.join(', ')}`);
  try {
    await generateSitemapIndex();
    await generateI18nSitemap();
    await generateCategoriesSitemap();
    await generateVideosSitemap(1);
    await generateVideosSitemap(2);
    await generateVideosSitemap(3);
    await generateVideoSitemap();
    await generateImageSitemap();
    await generateCategoryPhotosSitemap();
    console.log('All i18n sitemaps generated successfully!');
  } catch (e) {
    console.error('Error generating sitemaps:', e.message);
  } finally {
    await pool.end();
  }
}

main();
