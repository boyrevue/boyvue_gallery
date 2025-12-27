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

const languages = ['en', 'de', 'fr', 'es', 'nl', 'it', 'pt', 'ru', 'pl', 'ja', 'zh', 'th', 'tr', 'ko'];
const baseUrl = 'https://boyvue.com';

async function generate() {
  console.log('Generating sitemaps...');
  
  // Get top images
  const images = await pool.query(`
    SELECT id, view_count FROM image 
    ORDER BY view_count DESC LIMIT 50000
  `);
  
  // Get categories
  const categories = await pool.query(`
    SELECT id FROM category WHERE photo_count > 0
  `);
  
  // Main sitemap index
  let index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${baseUrl}/sitemap-main.xml</loc></sitemap>
  <sitemap><loc>${baseUrl}/sitemap-videos.xml</loc></sitemap>
</sitemapindex>`;
  
  fs.writeFileSync('/var/www/html/boyvue/dist/sitemap.xml', index);
  console.log('Created sitemap.xml (index)');
  
  // Main sitemap with homepage and categories
  let main = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
`;
  
  // Homepage with all language alternates
  main += `  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
`;
  for (const l of languages) {
    main += `    <xhtml:link rel="alternate" hreflang="${l}" href="${baseUrl}/?lang=${l}"/>\n`;
  }
  main += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/"/>\n  </url>\n`;
  
  // Categories
  for (const cat of categories.rows) {
    main += `  <url>
    <loc>${baseUrl}/c/${cat.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
  }
  
  main += '</urlset>';
  fs.writeFileSync('/var/www/html/boyvue/dist/sitemap-main.xml', main);
  console.log(`Created sitemap-main.xml (${categories.rows.length} categories)`);
  
  // Videos/images sitemap
  let videos = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
  
  for (const img of images.rows) {
    const priority = img.view_count > 100000 ? '0.9' : img.view_count > 10000 ? '0.7' : '0.5';
    videos += `  <url>
    <loc>${baseUrl}/v/${img.id}</loc>
    <changefreq>monthly</changefreq>
    <priority>${priority}</priority>
  </url>\n`;
  }
  
  videos += '</urlset>';
  fs.writeFileSync('/var/www/html/boyvue/dist/sitemap-videos.xml', videos);
  console.log(`Created sitemap-videos.xml (${images.rows.length} items)`);
  
  // Robots.txt
  const robots = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml

# Crawl-delay for politeness
User-agent: Googlebot
Crawl-delay: 1

User-agent: Bingbot
Crawl-delay: 2
`;
  fs.writeFileSync('/var/www/html/boyvue/dist/robots.txt', robots);
  console.log('Created robots.txt');
  
  pool.end();
  console.log('Done!');
}

generate();
