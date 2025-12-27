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

async function generateVideoSitemap() {
  console.log('Generating video sitemap...');
  
  // Get all video files
  const videos = await pool.query(`
    SELECT i.id, i.title, i.description, i.local_path, i.view_count, c.catname
    FROM image i
    LEFT JOIN category c ON i.belongs_to_gallery = c.id
    WHERE i.local_path LIKE '%.mp4' 
       OR i.local_path LIKE '%.webm'
       OR i.local_path LIKE '%.avi'
       OR i.local_path LIKE '%.mov'
    ORDER BY i.view_count DESC
    LIMIT 5000
  `);
  
  console.log(`Found ${videos.rows.length} videos`);
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n';
  
  for (const v of videos.rows) {
    const title = (v.title || 'Video').replace(/[<>&'"]/g, '');
    const desc = (v.description || v.catname || 'Gay video').substring(0, 200).replace(/[<>&'"]/g, '');
    
    xml += `  <url>
    <loc>${SITE_URL}/image/${v.id}</loc>
    <video:video>
      <video:thumbnail_loc>${SITE_URL}/media/${v.local_path.replace(/\.[^.]+$/, '.jpg')}</video:thumbnail_loc>
      <video:title>${title}</video:title>
      <video:description>${desc}</video:description>
      <video:content_loc>${SITE_URL}/media/${v.local_path}</video:content_loc>
      <video:family_friendly>no</video:family_friendly>
      <video:live>no</video:live>
    </video:video>
  </url>\n`;
  }
  
  xml += '</urlset>';
  
  fs.writeFileSync('dist/video-sitemap.xml', xml);
  console.log(`Video sitemap generated: ${videos.rows.length} videos`);
  
  // Update robots.txt to include video sitemap
  let robots = fs.readFileSync('dist/robots.txt', 'utf8');
  if (!robots.includes('video-sitemap.xml')) {
    robots += `Sitemap: ${SITE_URL}/video-sitemap.xml\n`;
    fs.writeFileSync('dist/robots.txt', robots);
    console.log('Updated robots.txt with video sitemap');
  }
  
  await pool.end();
}

generateVideoSitemap().catch(console.error);
