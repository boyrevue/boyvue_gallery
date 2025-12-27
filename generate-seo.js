import pg from 'pg';
import https from 'https';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

const languages = ['en', 'de', 'fr', 'es', 'nl', 'it', 'pt', 'ru', 'pl', 'ja'];

// Translate via Google
function translate(text, targetLang) {
  if (!text || targetLang === 'en') return Promise.resolve(text);
  
  return new Promise((resolve) => {
    const encoded = encodeURIComponent(text.substring(0, 400));
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encoded}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          resolve(r[0].map(x => x[0]).join(''));
        } catch(e) { resolve(text); }
      });
    }).on('error', () => resolve(text));
    
    setTimeout(() => resolve(text), 5000);
  });
}

async function generateSeo() {
  console.log('Starting SEO generation...');
  
  // Get top 5000 images
  const images = await pool.query(`
    SELECT i.id, i.title, i.description, i.view_count, i.average_rating, c.catname
    FROM image i
    LEFT JOIN category c ON i.belongs_to_gallery = c.id
    WHERE i.title IS NOT NULL AND i.title != ''
    ORDER BY i.view_count DESC
    LIMIT 5000
  `);
  
  console.log(`Processing ${images.rows.length} images...`);
  
  let count = 0;
  for (const img of images.rows) {
    for (const lang of languages) {
      try {
        // Check if exists
        const exists = await pool.query(
          'SELECT 1 FROM seo_content WHERE image_id = $1 AND language = $2',
          [img.id, lang]
        );
        if (exists.rows.length > 0) continue;
        
        let title = img.title;
        let desc = img.description || img.title;
        
        // Translate if not English
        if (lang !== 'en') {
          title = await translate(img.title, lang);
          await new Promise(r => setTimeout(r, 150)); // Rate limit
        }
        
        const seoTitle = `${title} - BoyVue`.substring(0, 60);
        const seoDesc = `${desc.substring(0, 120)} - ${img.view_count || 0} views`.substring(0, 155);
        
        await pool.query(`
          INSERT INTO seo_content (image_id, language, seo_title, seo_description, seo_keywords)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [img.id, lang, seoTitle, seoDesc, img.catname || '']);
        
        count++;
      } catch(e) {
        // Skip errors
      }
    }
    
    if (count % 500 === 0 && count > 0) {
      console.log(`Generated ${count} SEO entries...`);
    }
  }
  
  // Categories
  console.log('Processing categories...');
  const cats = await pool.query('SELECT id, catname, photo_count FROM category WHERE photo_count > 0');
  
  for (const cat of cats.rows) {
    for (const lang of languages) {
      try {
        const exists = await pool.query(
          'SELECT 1 FROM category_seo WHERE category_id = $1 AND language = $2',
          [cat.id, lang]
        );
        if (exists.rows.length > 0) continue;
        
        let name = cat.catname;
        if (lang !== 'en') {
          name = await translate(cat.catname, lang);
          await new Promise(r => setTimeout(r, 150));
        }
        
        const seoTitle = `${name} - BoyVue Gallery`.substring(0, 60);
        const seoDesc = `Browse ${cat.photo_count} photos and videos in ${name}. Free HD streaming.`.substring(0, 155);
        
        await pool.query(`
          INSERT INTO category_seo (category_id, language, seo_title, seo_description, seo_keywords)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [cat.id, lang, seoTitle, seoDesc, name]);
        
      } catch(e) {}
    }
  }
  
  console.log(`Done! Generated ${count} image SEO entries + categories`);
  pool.end();
}

generateSeo();
