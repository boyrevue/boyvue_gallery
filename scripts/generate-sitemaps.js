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

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function generateSitemapIndex() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://boyvue.com/sitemap-categories.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/sitemap-videos-1.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/sitemap-videos-2.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/sitemap-videos-3.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/image-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/video-sitemap.xml</loc></sitemap>
  <sitemap><loc>https://boyvue.com/category-photos-sitemap.xml</loc></sitemap>
</sitemapindex>`;
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml);
  console.log('Generated sitemap.xml');
}

async function generateCategoriesSitemap() {
  const cats = await pool.query('SELECT id, updated_at FROM category WHERE photo_count > 0 ORDER BY photo_count DESC LIMIT 1000');
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://boyvue.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`;
  for (const cat of cats.rows) {
    const lastmod = cat.updated_at ? new Date(cat.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `\n  <url><loc>https://boyvue.com/c/${cat.id}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
  }
  xml += '\n</urlset>';
  fs.writeFileSync(path.join(publicDir, 'sitemap-categories.xml'), xml);
  console.log('Generated sitemap-categories.xml');
}

async function generateVideosSitemap(page) {
  const limit = 10000;
  const offset = (page - 1) * limit;
  const vids = await pool.query(`SELECT id, created_at FROM image ORDER BY view_count DESC LIMIT $1 OFFSET $2`, [limit, offset]);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  for (const v of vids.rows) {
    const lastmod = v.created_at ? new Date(v.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `\n  <url><loc>https://boyvue.com/v/${v.id}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`;
  }
  xml += '\n</urlset>';
  fs.writeFileSync(path.join(publicDir, `sitemap-videos-${page}.xml`), xml);
  console.log(`Generated sitemap-videos-${page}.xml (${vids.rows.length} URLs)`);
}

async function generateVideoSitemap() {
  const vids = await pool.query(`SELECT id, title, description, thumbnail_path, local_path, created_at, view_count
    FROM image WHERE local_path LIKE '%.mp4' OR local_path LIKE '%.webm'
    ORDER BY view_count DESC LIMIT 5000`);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`;
  for (const v of vids.rows) {
    const title = esc(v.title || 'Video');
    const desc = esc((v.description || v.title || 'Video').substring(0, 200));
    const date = v.created_at ? new Date(v.created_at).toISOString() : new Date().toISOString();
    xml += `
  <url>
    <loc>https://boyvue.com/v/${v.id}</loc>
    <video:video>
      <video:thumbnail_loc>https://boyvue.com/media/${v.thumbnail_path}</video:thumbnail_loc>
      <video:title>${title}</video:title>
      <video:description>${desc}</video:description>
      <video:content_loc>https://boyvue.com/media/${v.local_path}</video:content_loc>
      <video:publication_date>${date}</video:publication_date>
      <video:family_friendly>no</video:family_friendly>
    </video:video>
  </url>`;
  }
  xml += '\n</urlset>';
  fs.writeFileSync(path.join(publicDir, 'video-sitemap.xml'), xml);
  console.log(`Generated video-sitemap.xml (${vids.rows.length} videos)`);
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
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;
  for (const cat of cats.rows) {
    const lastmod = cat.updated_at ? new Date(cat.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    xml += `
  <url>
    <loc>https://boyvue.com/c/${cat.id}</loc>
    <lastmod>${lastmod}</lastmod>`;
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
  fs.writeFileSync(path.join(publicDir, 'category-photos-sitemap.xml'), xml);
  console.log(`Generated category-photos-sitemap.xml (${cats.rows.length} categories)`);
}

async function generateImageSitemap() {
  const imgs = await pool.query(`SELECT id, title, thumbnail_path FROM image
    WHERE local_path NOT LIKE '%.mp4' AND local_path NOT LIKE '%.webm'
    ORDER BY view_count DESC LIMIT 10000`);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;
  for (const img of imgs.rows) {
    const title = esc(img.title || 'Image');
    xml += `
  <url>
    <loc>https://boyvue.com/v/${img.id}</loc>
    <image:image>
      <image:loc>https://boyvue.com/media/${img.thumbnail_path}</image:loc>
      <image:title>${title}</image:title>
    </image:image>
  </url>`;
  }
  xml += '\n</urlset>';
  fs.writeFileSync(path.join(publicDir, 'image-sitemap.xml'), xml);
  console.log(`Generated image-sitemap.xml (${imgs.rows.length} images)`);
}

async function main() {
  console.log('Generating static sitemaps...');
  try {
    await generateSitemapIndex();
    await generateCategoriesSitemap();
    await generateVideosSitemap(1);
    await generateVideosSitemap(2);
    await generateVideosSitemap(3);
    await generateVideoSitemap();
    await generateImageSitemap();
    await generateCategoryPhotosSitemap();
    console.log('All sitemaps generated successfully!');
  } catch (e) {
    console.error('Error generating sitemaps:', e.message);
  } finally {
    await pool.end();
  }
}

main();
