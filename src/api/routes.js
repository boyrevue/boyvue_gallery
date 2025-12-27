import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gallery',
  user: 'galleryuser',
  password: 'apple1apple'
});

// Config
router.get('/config/languages', (req, res) => res.json({ languages: [
  { code: 'en', name: 'English' }, { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' }, { code: 'ja', name: 'Japanese' }, { code: 'zh', name: 'Chinese' }
]}));

// Stats
router.get('/stats', async (req, res) => {
  try {
    const images = await pool.query('SELECT COUNT(*) FROM image');
    const categories = await pool.query('SELECT COUNT(*) FROM category');
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
    const result = await pool.query('SELECT id, catname, description, parent_category, photo_count FROM category ORDER BY catname');
    res.json({ categories: result.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/categories/:id', async (req, res) => {
  try {
    const cat = await pool.query('SELECT * FROM category WHERE id = $1', [req.params.id]);
    const images = await pool.query(
      'SELECT id, title, local_path, thumbnail_path, width, height, view_count, average_rating FROM image WHERE belongs_to_gallery = $1 ORDER BY id DESC LIMIT 50',
      [req.params.id]
    );
    res.json({ category: cat.rows[0], images: images.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Images/Media
router.get('/media', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 24;
    const offset = (page - 1) * limit;
    const cat = req.query.category;

    let query = 'SELECT id, title, local_path, thumbnail_path, width, height, view_count, average_rating, belongs_to_gallery FROM image';
    let countQuery = 'SELECT COUNT(*) FROM image';
    let params = [];

    if (cat) {
      query += ' WHERE belongs_to_gallery = $1';
      countQuery += ' WHERE belongs_to_gallery = $1';
      params.push(cat);
    }

    query += ' ORDER BY id DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
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
    const result = await pool.query('SELECT * FROM image WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    // Increment view count
    await pool.query('UPDATE image SET view_count = view_count + 1 WHERE id = $1', [req.params.id]);
    
    // Get category info
    const cat = await pool.query('SELECT id, catname FROM category WHERE id = $1', [result.rows[0].belongs_to_gallery]);
    
    res.json({ ...result.rows[0], category: cat.rows[0] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Comments
router.get('/media/:id/comments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, comment_text, created_at FROM comments WHERE photo_id = $1 ORDER BY created_at DESC',
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
    if (!username || !comment_text) {
      return res.status(400).json({ error: 'Username and comment required' });
    }
    
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
    const limit = parseInt(req.query.limit) || 24;
    
    const result = await pool.query(
      "SELECT id, title, local_path, thumbnail_path, view_count FROM image WHERE title ILIKE $1 OR description ILIKE $1 LIMIT $2",
      ['%' + q + '%', limit]
    );
    res.json({ query: q, results: result.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Users (for login simulation)
router.get('/users/:username', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, join_date, post_count FROM users WHERE username = $1', [req.params.username]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
