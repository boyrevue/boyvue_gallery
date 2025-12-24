/**
 * API Routes
 * RESTful API endpoints for GalleryX
 * Data models follow gallery-core.ttl ontology
 */

import express from 'express';
import { getConfigService } from '../services/config-service.js';

const router = express.Router();

// Middleware to attach config service
router.use((req, res, next) => {
  req.config = getConfigService();
  next();
});

// ============================================================================
// GALLERY ENDPOINTS
// ============================================================================

/**
 * GET /api/gallery
 * List gallery items with pagination and filtering
 * Supports: page, limit, sort, order, category, type, tag, creator
 */
router.get('/gallery', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 24,
      sort = 'createdAt',
      order = 'desc',
      category,
      type,
      tag,
      creator
    } = req.query;

    // Build query from ontology-defined properties
    const query = {
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      sort,
      order,
      filters: {}
    };

    if (category) query.filters.category = category;
    if (type) query.filters.mediaType = type;
    if (tag) query.filters.tags = tag;
    if (creator) query.filters.creator = creator;

    // In production, query database
    // For now, return mock data structure following ontology
    const items = generateMockItems(query);
    const total = 100; // Mock total

    res.json({
      items,
      total,
      page: query.page,
      limit: query.limit,
      hasMore: (query.page * query.limit) < total
    });
  } catch (error) {
    console.error('Gallery list error:', error);
    res.status(500).json({ error: 'Failed to fetch gallery items' });
  }
});

/**
 * GET /api/gallery/featured
 * Get featured items
 */
router.get('/gallery/featured', async (req, res) => {
  try {
    const { limit = 8 } = req.query;
    
    const items = generateMockItems({
      limit: parseInt(limit, 10),
      filters: { featured: true }
    });

    res.json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch featured items' });
  }
});

/**
 * GET /api/gallery/recent
 * Get recently added items
 */
router.get('/gallery/recent', async (req, res) => {
  try {
    const { limit = 12 } = req.query;
    
    const items = generateMockItems({
      limit: parseInt(limit, 10),
      sort: 'createdAt',
      order: 'desc'
    });

    res.json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent items' });
  }
});

/**
 * GET /api/gallery/related
 * Get related items
 */
router.get('/gallery/related', async (req, res) => {
  try {
    const { relatedTo, limit = 6 } = req.query;
    
    const items = generateMockItems({
      limit: parseInt(limit, 10)
    });

    res.json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch related items' });
  }
});

// ============================================================================
// MEDIA ITEM ENDPOINTS
// ============================================================================

/**
 * GET /api/media/:id
 * Get single media item
 */
router.get('/media/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // In production, fetch from database
    const item = generateMockItem(id);
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch media item' });
  }
});

/**
 * POST /api/media/:id/view
 * Track view
 */
router.post('/media/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    // In production, increment view count in database
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to track view' });
  }
});

/**
 * POST /api/media/:id/like
 * Like an item
 */
router.post('/media/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    // In production, add like to database
    res.json({ success: true, liked: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to like item' });
  }
});

/**
 * DELETE /api/media/:id/like
 * Unlike an item
 */
router.delete('/media/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    // In production, remove like from database
    res.json({ success: true, liked: false });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unlike item' });
  }
});

// ============================================================================
// SEARCH ENDPOINT
// ============================================================================

/**
 * GET /api/search
 * Search media items
 */
router.get('/search', async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 24,
      sort = 'relevance',
      order = 'desc',
      type,
      category
    } = req.query;

    if (!q) {
      return res.json({ items: [], total: 0 });
    }

    // In production, use Elasticsearch
    const items = generateMockItems({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });

    res.json({
      items,
      total: items.length,
      query: q
    });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ============================================================================
// CATEGORIES ENDPOINT
// ============================================================================

/**
 * GET /api/categories
 * Get category tree
 */
router.get('/categories', async (req, res) => {
  try {
    // In production, fetch from database
    const categories = [
      { id: 1, name: 'Featured', slug: 'featured', parentId: null, itemCount: 100 },
      { id: 2, name: 'Popular', slug: 'popular', parentId: null, itemCount: 250 },
      { id: 3, name: 'New', slug: 'new', parentId: null, itemCount: 50 },
      { id: 4, name: 'Videos', slug: 'videos', parentId: null, itemCount: 75 }
    ];

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ============================================================================
// TAGS ENDPOINT
// ============================================================================

/**
 * GET /api/tags
 * Get popular tags
 */
router.get('/tags', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    // In production, fetch from database
    const tags = [
      { name: 'popular', count: 500 },
      { name: 'trending', count: 350 },
      { name: 'new', count: 200 },
      { name: 'featured', count: 150 }
    ];

    res.json(tags.slice(0, parseInt(limit, 10)));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// ============================================================================
// CREATORS ENDPOINT
// ============================================================================

/**
 * GET /api/creators/:username
 * Get creator profile
 */
router.get('/creators/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // In production, fetch from database
    const creator = {
      id: username,
      username,
      name: username,
      bio: 'Content creator',
      avatar: null,
      mediaCount: 50,
      viewCount: 10000,
      followerCount: 500,
      createdAt: new Date().toISOString()
    };

    res.json(creator);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch creator' });
  }
});

// ============================================================================
// CONFIG ENDPOINT (public config only)
// ============================================================================

/**
 * GET /api/config
 * Get public configuration
 */
router.get('/config', async (req, res) => {
  try {
    const config = req.config;
    
    res.json({
      app: config.getAppConfig(),
      languages: config.getLanguages(),
      platforms: config.getStreamingPlatforms(),
      seo: config.getSEOConfig()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

/**
 * GET /api/translations/:lang
 * Get translations for language
 */
router.get('/translations/:lang', async (req, res) => {
  try {
    const { lang } = req.params;
    const config = req.config;
    
    const translations = config.getAllTranslations(lang);
    res.json(translations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

// ============================================================================
// MOCK DATA GENERATORS
// ============================================================================

/**
 * Generate mock items following ontology structure
 */
function generateMockItems(options = {}) {
  const { limit = 24, page = 1 } = options;
  const items = [];
  
  for (let i = 0; i < limit; i++) {
    const id = ((page - 1) * limit) + i + 1;
    items.push(generateMockItem(id));
  }
  
  return items;
}

/**
 * Generate single mock item following gal:MediaItem ontology
 */
function generateMockItem(id) {
  const isVideo = Math.random() > 0.7;
  
  return {
    // Core ontology properties
    '@type': isVideo ? 'gal:Video' : 'gal:Image',
    id: String(id),
    slug: `item-${id}`,
    
    // gal:title, gal:description
    title: `Media Item ${id}`,
    description: `Description for media item ${id}`,
    
    // gal:sourceUrl, gal:localPath
    sourceUrl: `/media/items/${id}.${isVideo ? 'mp4' : 'jpg'}`,
    thumbnails: {
      thumb: `/media/thumbs/thumb/${id}.webp`,
      small: `/media/thumbs/small/${id}.webp`,
      medium: `/media/thumbs/medium/${id}.webp`,
      large: `/media/thumbs/large/${id}.webp`
    },
    
    // gal:dimensions
    dimensions: {
      width: 1920,
      height: 1080
    },
    
    // gal:fileSize
    fileSize: Math.floor(Math.random() * 10000000),
    mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
    
    // Video-specific (gal:duration)
    ...(isVideo && {
      duration: Math.floor(Math.random() * 600) + 30
    }),
    
    // gal:mediaType
    mediaType: isVideo ? 'video' : 'image',
    
    // Interaction properties
    viewCount: Math.floor(Math.random() * 10000),
    likeCount: Math.floor(Math.random() * 500),
    commentCount: Math.floor(Math.random() * 50),
    rating: (Math.random() * 2 + 3).toFixed(1),
    isLiked: false,
    
    // gal:hasTag
    tags: ['tag1', 'tag2', 'tag3'].slice(0, Math.floor(Math.random() * 3) + 1),
    
    // gal:hasCategory
    category: {
      id: 1,
      name: 'General',
      slug: 'general'
    },
    
    // gal:creator
    creator: {
      id: 'creator1',
      username: 'creator1',
      name: 'Content Creator',
      avatar: null
    },
    
    // Timestamps
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export default router;
