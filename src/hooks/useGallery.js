/**
 * useGallery Hook
 * React hook for gallery and media item data management
 * Works with data structured according to gallery-core.ttl ontology
 */

import { useState, useEffect, useCallback, useReducer } from 'react';
import { usePagination, useMediaConfig } from './useConfig.js';

// Action types
const ACTIONS = {
  SET_ITEMS: 'SET_ITEMS',
  APPEND_ITEMS: 'APPEND_ITEMS',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_FILTERS: 'SET_FILTERS',
  SET_SORT: 'SET_SORT',
  SET_PAGE: 'SET_PAGE',
  RESET: 'RESET'
};

// Initial state
const initialState = {
  items: [],
  total: 0,
  page: 1,
  hasMore: true,
  loading: false,
  error: null,
  filters: {},
  sort: { field: 'createdAt', direction: 'desc' }
};

// Reducer
function galleryReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_ITEMS:
      return {
        ...state,
        items: action.payload.items,
        total: action.payload.total,
        hasMore: action.payload.hasMore,
        loading: false,
        error: null
      };
    
    case ACTIONS.APPEND_ITEMS:
      return {
        ...state,
        items: [...state.items, ...action.payload.items],
        hasMore: action.payload.hasMore,
        loading: false
      };
    
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    
    case ACTIONS.SET_FILTERS:
      return { ...state, filters: action.payload, page: 1 };
    
    case ACTIONS.SET_SORT:
      return { ...state, sort: action.payload, page: 1 };
    
    case ACTIONS.SET_PAGE:
      return { ...state, page: action.payload };
    
    case ACTIONS.RESET:
      return { ...initialState };
    
    default:
      return state;
  }
}

/**
 * useGallery hook
 */
export function useGallery(apiEndpoint = '/api/gallery', options = {}) {
  const [state, dispatch] = useReducer(galleryReducer, {
    ...initialState,
    filters: options.initialFilters || {},
    sort: options.initialSort || initialState.sort
  });

  const paginationConfig = usePagination();
  const mediaConfig = useMediaConfig();

  const pageSize = options.pageSize || paginationConfig.defaultPageSize;

  /**
   * Fetch items from API
   */
  const fetchItems = useCallback(async (page = 1, append = false) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: true });

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        sort: state.sort.field,
        order: state.sort.direction,
        ...state.filters
      });

      const response = await fetch(`${apiEndpoint}?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      
      // Transform items to add CDN URLs if configured
      const items = data.items.map(item => transformMediaItem(item, mediaConfig));
      const hasMore = items.length === pageSize && (data.total > page * pageSize);

      if (append) {
        dispatch({
          type: ACTIONS.APPEND_ITEMS,
          payload: { items, hasMore }
        });
      } else {
        dispatch({
          type: ACTIONS.SET_ITEMS,
          payload: { items, total: data.total, hasMore }
        });
      }
      
      dispatch({ type: ACTIONS.SET_PAGE, payload: page });

    } catch (err) {
      dispatch({ type: ACTIONS.SET_ERROR, payload: err.message });
    }
  }, [apiEndpoint, pageSize, state.filters, state.sort, mediaConfig]);

  /**
   * Load initial data
   */
  useEffect(() => {
    fetchItems(1);
  }, [state.filters, state.sort]);

  /**
   * Load more items (infinite scroll)
   */
  const loadMore = useCallback(() => {
    if (!state.loading && state.hasMore) {
      fetchItems(state.page + 1, true);
    }
  }, [fetchItems, state.loading, state.hasMore, state.page]);

  /**
   * Refresh data
   */
  const refresh = useCallback(() => {
    fetchItems(1);
  }, [fetchItems]);

  /**
   * Set filters
   */
  const setFilters = useCallback((filters) => {
    dispatch({ type: ACTIONS.SET_FILTERS, payload: filters });
  }, []);

  /**
   * Update a single filter
   */
  const setFilter = useCallback((key, value) => {
    dispatch({
      type: ACTIONS.SET_FILTERS,
      payload: { ...state.filters, [key]: value }
    });
  }, [state.filters]);

  /**
   * Clear filters
   */
  const clearFilters = useCallback(() => {
    dispatch({ type: ACTIONS.SET_FILTERS, payload: {} });
  }, []);

  /**
   * Set sort
   */
  const setSort = useCallback((field, direction = 'desc') => {
    dispatch({ type: ACTIONS.SET_SORT, payload: { field, direction } });
  }, []);

  /**
   * Go to specific page
   */
  const goToPage = useCallback((page) => {
    fetchItems(page);
  }, [fetchItems]);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    dispatch({ type: ACTIONS.RESET });
  }, []);

  return {
    // State
    items: state.items,
    total: state.total,
    page: state.page,
    hasMore: state.hasMore,
    loading: state.loading,
    error: state.error,
    filters: state.filters,
    sort: state.sort,
    pageSize,

    // Actions
    loadMore,
    refresh,
    setFilters,
    setFilter,
    clearFilters,
    setSort,
    goToPage,
    reset
  };
}

/**
 * useMediaItem hook
 * Fetch and manage a single media item
 */
export function useMediaItem(itemId, options = {}) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiEndpoint = options.apiEndpoint || '/api/media';
  const mediaConfig = useMediaConfig();

  const fetchItem = useCallback(async () => {
    if (!itemId) {
      setItem(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiEndpoint}/${itemId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Item not found');
        }
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setItem(transformMediaItem(data, mediaConfig));
    } catch (err) {
      setError(err.message);
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [itemId, apiEndpoint, mediaConfig]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  /**
   * Like the item
   */
  const like = useCallback(async () => {
    if (!item) return;

    try {
      await fetch(`${apiEndpoint}/${itemId}/like`, { method: 'POST' });
      setItem(prev => ({
        ...prev,
        likeCount: (prev.likeCount || 0) + 1,
        isLiked: true
      }));
    } catch (err) {
      console.error('Failed to like item:', err);
    }
  }, [item, itemId, apiEndpoint]);

  /**
   * Unlike the item
   */
  const unlike = useCallback(async () => {
    if (!item) return;

    try {
      await fetch(`${apiEndpoint}/${itemId}/like`, { method: 'DELETE' });
      setItem(prev => ({
        ...prev,
        likeCount: Math.max(0, (prev.likeCount || 0) - 1),
        isLiked: false
      }));
    } catch (err) {
      console.error('Failed to unlike item:', err);
    }
  }, [item, itemId, apiEndpoint]);

  /**
   * Increment view count
   */
  const trackView = useCallback(async () => {
    if (!item) return;

    try {
      await fetch(`${apiEndpoint}/${itemId}/view`, { method: 'POST' });
      setItem(prev => ({
        ...prev,
        viewCount: (prev.viewCount || 0) + 1
      }));
    } catch (err) {
      // Silent fail for view tracking
    }
  }, [item, itemId, apiEndpoint]);

  return {
    item,
    loading,
    error,
    refresh: fetchItem,
    like,
    unlike,
    trackView
  };
}

/**
 * useCategories hook
 * Fetch category tree
 */
export function useCategories(options = {}) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiEndpoint = options.apiEndpoint || '/api/categories';

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch(apiEndpoint);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const data = await response.json();
        setCategories(buildCategoryTree(data));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, [apiEndpoint]);

  return { categories, loading, error };
}

/**
 * useTags hook
 * Fetch popular/suggested tags
 */
export function useTags(options = {}) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  const apiEndpoint = options.apiEndpoint || '/api/tags';
  const limit = options.limit || 50;

  useEffect(() => {
    async function fetchTags() {
      try {
        const response = await fetch(`${apiEndpoint}?limit=${limit}`);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        
        const data = await response.json();
        setTags(data);
      } catch (err) {
        console.error('Failed to fetch tags:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTags();
  }, [apiEndpoint, limit]);

  return { tags, loading };
}

/**
 * Transform media item with CDN URLs
 */
function transformMediaItem(item, mediaConfig) {
  const cdnUrl = mediaConfig.cdnUrl || '';

  return {
    ...item,
    // Add CDN prefix to URLs if configured
    sourceUrl: item.sourceUrl ? `${cdnUrl}${item.sourceUrl}` : null,
    thumbnails: item.thumbnails ? Object.fromEntries(
      Object.entries(item.thumbnails).map(([size, url]) => [
        size,
        `${cdnUrl}${url}`
      ])
    ) : {},
    // Ensure required fields have defaults
    viewCount: item.viewCount || 0,
    likeCount: item.likeCount || 0,
    commentCount: item.commentCount || 0,
    rating: item.rating || 0,
    tags: item.tags || [],
    // Add type based on ontology class
    mediaType: item.mediaType || detectMediaType(item)
  };
}

/**
 * Detect media type from item data
 */
function detectMediaType(item) {
  if (item['@type']) {
    if (item['@type'].includes('Video')) return 'video';
    if (item['@type'].includes('Image')) return 'image';
  }
  
  if (item.mimeType) {
    if (item.mimeType.startsWith('video/')) return 'video';
    if (item.mimeType.startsWith('image/')) return 'image';
  }
  
  if (item.duration) return 'video';
  
  return 'image';
}

/**
 * Build category tree from flat list
 */
function buildCategoryTree(categories) {
  const map = new Map();
  const roots = [];

  // First pass: create map
  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }

  // Second pass: build tree
  for (const cat of categories) {
    const node = map.get(cat.id);
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export default useGallery;
