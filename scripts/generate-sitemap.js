import pg from 'pg';
import fs from 'fs';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

const SITE_URL = 'https://boyvue.com';

async function generateSitemap() {
  console.log('Generating sitemap...');
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  // Homepage
  xml += `  <url><loc>${SITE_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
  
  // Categories
  const cats = await pool.query('SELECT id, catname FROM category WHERE photo_count > 0 ORDER BY photo_count DESC');
  for (const cat of cats.rows) {
    const slug = cat.catname.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    xml += `  <url><loc>${SITE_URL}/category/${cat.id}/${slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
  }
  
  // Top images (limit to 10000 for sitemap size)
  const images = await pool.query('SELECT id, title FROM image ORDER BY view_count DESC LIMIT 10000');
  for (const img of images.rows) {
    xml += `  <url><loc>${SITE_URL}/image/${img.id}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
  }
  
  xml += '</urlset>';
  
  fs.writeFileSync('dist/sitemap.xml', xml);
  console.log(`Sitemap: ${cats.rows.length} categories, ${images.rows.length} images`);
  
  // robots.txt
  const robots = `User-agent: *
Allow: /
Sitemap: ${SITE_URL}/sitemap.xml

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /
`;
  fs.writeFileSync('dist/robots.txt', robots);
  console.log('robots.txt generated');
  
  await pool.end();
}

generateSitemap().catch(console.error);
