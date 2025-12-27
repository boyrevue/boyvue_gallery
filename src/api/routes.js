import express from 'express';
import pg from 'pg';
import geoip from 'geoip-lite';
const { Pool } = pg;

const router = express.Router();

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// Country to language mapping
const countryToLang = {
  US: 'en', GB: 'en', AU: 'en', CA: 'en', NZ: 'en', IE: 'en',
  DE: 'de', AT: 'de', CH: 'de',
  RU: 'ru', BY: 'ru', KZ: 'ru', UA: 'ru',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es',
  CN: 'zh', TW: 'zh', HK: 'zh', SG: 'zh',
  JP: 'ja',
  TH: 'th',
  KR: 'ko',
  BR: 'pt', PT: 'pt',
  FR: 'fr', BE: 'fr',
  IT: 'it',
  NL: 'nl',
  PL: 'pl',
  CZ: 'cs', SK: 'cs',
  SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar', DZ: 'ar', IQ: 'ar', JO: 'ar', KW: 'ar', LB: 'ar', QA: 'ar',
  GR: 'el', CY: 'el',
  VN: 'vi',
  ID: 'id', MY: 'id',
  TR: 'tr',
  HU: 'hu'
};

// Detect language from IP
router.get('/detect-language', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const cleanIp = ip?.replace('::ffff:', '') || '';
  
  let lang = 'en';
  let country = 'US';
  
  try {
    const geo = geoip.lookup(cleanIp);
    if (geo && geo.country) {
      country = geo.country;
      lang = countryToLang[country] || 'en';
    }
  } catch (e) {
    console.error('GeoIP error:', e);
  }
  
  res.json({ lang, country, ip: cleanIp });
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

// Categories
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, catname, description, parent_category, photo_count
      FROM category WHERE photo_count > 0 ORDER BY photo_count DESC
    `);
    res.json({ categories: result.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/categories/:id', async (req, res) => {
  try {
    const cat = await pool.query('SELECT * FROM category WHERE id = $1', [req.params.id]);
    if (cat.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const images = await pool.query(
      'SELECT id, title, description, local_path, thumbnail_path, width, height, view_count, average_rating FROM image WHERE belongs_to_gallery = $1 ORDER BY view_count DESC LIMIT 50',
      [req.params.id]
    );
    res.json({ category: cat.rows[0], images: images.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Media
router.get('/media', async (req, res) => {
  try {
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

    res.json({
      images: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/media/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, c.catname as category_name FROM image i
      LEFT JOIN category c ON i.belongs_to_gallery = c.id WHERE i.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    await pool.query('UPDATE image SET view_count = view_count + 1 WHERE id = $1', [req.params.id]);
    
    const related = await pool.query(
      'SELECT id, title, thumbnail_path, view_count FROM image WHERE belongs_to_gallery = $1 AND id != $2 ORDER BY view_count DESC LIMIT 8',
      [result.rows[0].belongs_to_gallery, req.params.id]
    );
    
    res.json({ ...result.rows[0], related: related.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Comments
router.get('/media/:id/comments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, comment_text, created_at FROM comments WHERE photo_id = $1 ORDER BY created_at DESC LIMIT 100',
      [req.params.id]
    );
    res.json({ comments: result.rows });
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

// Search
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const limit = parseInt(req.query.limit) || 12;
    const result = await pool.query(`
      SELECT i.id, i.title, i.local_path, i.thumbnail_path, i.view_count, i.average_rating, c.catname as category_name
      FROM image i LEFT JOIN category c ON i.belongs_to_gallery = c.id
      WHERE i.title ILIKE $1 OR i.description ILIKE $1 OR c.catname ILIKE $1
      ORDER BY i.view_count DESC LIMIT $2
    `, ['%' + q + '%', limit]);
    res.json({ query: q, results: result.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
