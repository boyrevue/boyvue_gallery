import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'boyvue-jwt-secret-change-in-production';

const { Pool } = pg;
const pool = new Pool({
  host: 'localhost', port: 5432, database: 'gallery',
  user: 'galleryuser', password: 'apple1apple'
});

function requireAuth(req, res, next) {
  const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Available emoji icons for themes
const THEME_ICONS = ['🔥','💪','🧑','🐻','🌶️','🌸','👑','👨','⚽','🎓','💕','🌈','⭐','💎','🎭','🎪','🎯','🎨','🎬','🎤','🎸','🏆','🥇','👀','💋','🍑','🍆','💦','🔞','❤️','💜','💙','🖤','🤍'];

// Get icons list
router.get('/icons', (req, res) => {
  res.json({ success: true, icons: THEME_ICONS });
});

// Get all themes (system + user's custom)
// Get all themes (system + user's custom)
router.get('/themes', requireAuth, async (req, res) => {
  try {
    // System themes
    const systemThemes = await pool.query('SELECT id, name, slug, icon, NULL as user_id, false as is_custom FROM themes ORDER BY name');
    
    // User's custom themes with performer count
    const userThemes = await pool.query(`
      SELECT ut.id, ut.name, NULL as slug, ut.icon, ut.user_id, true as is_custom, ut.color,
             COUNT(uf.id) as count
      FROM user_themes ut
      LEFT JOIN user_favorites uf ON uf.user_theme_id = ut.id
      WHERE ut.user_id = $1
      GROUP BY ut.id
      ORDER BY ut.name
    `, [req.userId]);
    
    res.json({ 
      success: true, 
      themes: systemThemes.rows,
      customThemes: userThemes.rows,
      icons: THEME_ICONS
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get themes' });
  }
});

// Create custom theme
router.post('/themes', requireAuth, async (req, res) => {
  const { name, icon, color } = req.body;
  
  if (!name || name.length < 2 || name.length > 30) {
    return res.status(400).json({ error: 'Name must be 2-30 characters' });
  }
  
  const selectedIcon = THEME_ICONS.includes(icon) ? icon : '🏷️';
  const selectedColor = /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#f60';
  
  try {
    const result = await pool.query(
      `INSERT INTO user_themes (user_id, name, icon, color)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, name) DO UPDATE SET icon = $3, color = $4
       RETURNING *`,
      [req.userId, name.trim(), selectedIcon, selectedColor]
    );
    res.json({ success: true, theme: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create theme' });
  }
});

// Update custom theme
router.put('/themes/:themeId', requireAuth, async (req, res) => {
  const { themeId } = req.params;
  const { name, icon, color } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE user_themes SET 
        name = COALESCE($3, name),
        icon = COALESCE($4, icon),
        color = COALESCE($5, color)
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [themeId, req.userId, name, icon, color]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.json({ success: true, theme: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

// Delete custom theme
router.delete('/themes/:themeId', requireAuth, async (req, res) => {
  const { themeId } = req.params;
  try {
    await pool.query('DELETE FROM user_themes WHERE id = $1 AND user_id = $2', [themeId, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete theme' });
  }
});

// Get user's favorites
router.get('/', requireAuth, async (req, res) => {
  const { theme_id, user_theme_id, hot_only = 'false', page = 1, limit = 20, all } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    let query = `
      SELECT p.*, uf.is_hot, uf.theme_id, uf.user_theme_id, uf.created_at as favorited_at,
             t.name as theme_name, t.slug as theme_slug,
             ut.name as custom_theme_name, ut.icon as custom_theme_icon,
             pl.name as platform_name, pl.slug as platform_slug
      FROM user_favorites uf
      JOIN performers p ON uf.performer_id = p.id
      LEFT JOIN themes t ON uf.theme_id = t.id
      LEFT JOIN user_themes ut ON uf.user_theme_id = ut.id
      LEFT JOIN affiliate_platforms pl ON p.platform_id = pl.id
      WHERE uf.user_id = $1
    `;
    const params = [req.userId];
    let idx = 2;
    
    if (hot_only === 'true') query += ' AND uf.is_hot = true';
    if (theme_id) { query += ` AND uf.theme_id = $${idx}`; params.push(theme_id); idx++; }
    if (user_theme_id) { query += ` AND uf.user_theme_id = $${idx}`; params.push(user_theme_id); idx++; }
    
    if (all !== "true") {
      query += ` ORDER BY uf.created_at DESC LIMIT $${idx} OFFSET $${idx+1}`;
      params.push(parseInt(limit), parseInt(offset));
    } else {
      query += " ORDER BY uf.created_at DESC";
    }
    
    const result = await pool.query(query, params);
    res.json({ success: true, favorites: result.rows, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

// Get next performer to rate
router.get('/next', requireAuth, async (req, res) => {
  const { platform, count = 5 } = req.query;
  
  try {
    let query = `
      SELECT p.*, pl.name as platform_name, pl.slug as platform_slug, pl.logo_url as platform_logo
      FROM performers p
      JOIN affiliate_platforms pl ON p.platform_id = pl.id
      JOIN performer_selections ps ON p.id = ps.performer_id
      WHERE ps.is_promoted = true AND p.is_online = true
        AND p.id NOT IN (SELECT performer_id FROM user_favorites WHERE user_id = $1)
    `;
    const params = [req.userId];
    let idx = 2;
    
    if (platform) { query += ` AND pl.slug = $${idx}`; params.push(platform); idx++; }
    query += ` ORDER BY RANDOM() LIMIT $${idx}`;
    params.push(parseInt(count));
    
    const result = await pool.query(query, params);
    res.json({ success: true, performers: result.rows, remaining: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get performers' });
  }
});

// Rate performer (Hot or Not)
router.post('/:performerId', requireAuth, async (req, res) => {
  const { performerId } = req.params;
  const { isHot } = req.body;
  
  if (typeof isHot !== 'boolean') {
    return res.status(400).json({ error: 'isHot must be a boolean' });
  }
  
  try {
    await pool.query(`
      INSERT INTO user_favorites (user_id, performer_id, is_hot)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, performer_id) 
      DO UPDATE SET is_hot = $3, created_at = NOW()
    `, [req.userId, performerId, isHot]);
    res.json({ success: true, isHot });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

// Classify with system theme
router.post('/:performerId/theme', requireAuth, async (req, res) => {
  const { performerId } = req.params;
  const { themeId } = req.body;
  
  try {
    await pool.query(`
      UPDATE user_favorites SET theme_id = $3, user_theme_id = NULL, created_at = NOW()
      WHERE user_id = $1 AND performer_id = $2 AND is_hot = true
    `, [req.userId, performerId, themeId]);
    res.json({ success: true, themeId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to classify' });
  }
});

// Classify with custom theme
router.post('/:performerId/custom-theme', requireAuth, async (req, res) => {
  const { performerId } = req.params;
  const { userThemeId } = req.body;
  
  try {
    // Verify theme belongs to user
    const theme = await pool.query('SELECT id FROM user_themes WHERE id = $1 AND user_id = $2', [userThemeId, req.userId]);
    if (!theme.rows.length) {
      return res.status(404).json({ error: 'Custom theme not found' });
    }
    
    await pool.query(`
      UPDATE user_favorites SET user_theme_id = $3, theme_id = NULL, created_at = NOW()
      WHERE user_id = $1 AND performer_id = $2 AND is_hot = true
    `, [req.userId, performerId, userThemeId]);
    res.json({ success: true, userThemeId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to classify' });
  }
});

// Remove from favorites
router.delete('/:performerId', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_favorites WHERE user_id = $1 AND performer_id = $2', [req.userId, req.params.performerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove' });
  }
});

// Get stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const basic = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE is_hot) as hot_count,
             COUNT(*) FILTER (WHERE NOT is_hot) as not_count,
             COUNT(*) as total_rated
      FROM user_favorites WHERE user_id = $1
    `, [req.userId]);
    
    const byTheme = await pool.query(`
      SELECT t.id, t.name, t.slug, t.icon, COUNT(uf.id) as count, false as is_custom
      FROM themes t
      LEFT JOIN user_favorites uf ON uf.theme_id = t.id AND uf.user_id = $1 AND uf.is_hot = true
      GROUP BY t.id ORDER BY count DESC, t.name
    `, [req.userId]);
    
    const byCustomTheme = await pool.query(`
      SELECT ut.id, ut.name, ut.icon, ut.color, COUNT(uf.id) as count, true as is_custom
      FROM user_themes ut
      LEFT JOIN user_favorites uf ON uf.user_theme_id = ut.id AND uf.is_hot = true
      WHERE ut.user_id = $1
      GROUP BY ut.id ORDER BY count DESC, ut.name
    `, [req.userId]);
    
    res.json({
      success: true,
      stats: {
        hotCount: parseInt(basic.rows[0].hot_count) || 0,
        notCount: parseInt(basic.rows[0].not_count) || 0,
        totalRated: parseInt(basic.rows[0].total_rated) || 0,
        byTheme: byTheme.rows,
        byCustomTheme: byCustomTheme.rows
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Undo
router.post('/undo', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM user_favorites WHERE id = (
        SELECT id FROM user_favorites WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
      ) RETURNING performer_id
    `, [req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Nothing to undo' });
    res.json({ success: true, undonePerformerId: result.rows[0].performer_id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to undo' });
  }
});

export default router;
