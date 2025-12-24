/**
 * GalleryGrid Component
 * Responsive grid layout for media items
 * Supports infinite scroll and various layouts
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { MediaCard, MediaCardSkeleton } from './MediaCard.jsx';
import { useGallery } from '../hooks/useGallery.js';
import { useI18n } from '../hooks/useI18n.js';
import { usePagination } from '../hooks/useConfig.js';

/**
 * GalleryGrid Component
 */
export function GalleryGrid({
  // Data source
  apiEndpoint = '/api/gallery',
  initialFilters = {},
  initialSort = { field: 'createdAt', direction: 'desc' },
  
  // Layout
  layout = 'grid', // 'grid', 'masonry', 'list'
  columns = 'auto', // number or 'auto'
  cardSize = 'medium',
  gap = 16,
  
  // Features
  infiniteScroll = true,
  showFilters = true,
  showSort = true,
  showStats = true,
  
  // Callbacks
  onItemClick,
  onItemLike,
  
  // Style
  className = ''
}) {
  const { t, formatNumber } = useI18n();
  const paginationConfig = usePagination();
  const containerRef = useRef(null);
  const observerRef = useRef(null);

  const {
    items,
    total,
    loading,
    error,
    hasMore,
    filters,
    sort,
    loadMore,
    refresh,
    setFilters,
    setFilter,
    clearFilters,
    setSort
  } = useGallery(apiEndpoint, { initialFilters, initialSort });

  // Infinite scroll observer
  useEffect(() => {
    if (!infiniteScroll || !paginationConfig.infiniteScrollEnabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [infiniteScroll, hasMore, loading, loadMore, paginationConfig]);

  // Observe sentinel element
  const sentinelRef = useCallback((node) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    if (node && observerRef.current) {
      observerRef.current.observe(node);
    }
  }, []);

  // Handle item click
  const handleItemClick = useCallback((item, e) => {
    if (onItemClick) {
      onItemClick(item, e);
    }
  }, [onItemClick]);

  // Handle item like
  const handleItemLike = useCallback((item) => {
    if (onItemLike) {
      onItemLike(item);
    }
  }, [onItemLike]);

  // Sort options from ontology properties
  const sortOptions = [
    { value: 'createdAt', label: t('sort.newest') },
    { value: 'viewCount', label: t('sort.mostViewed') },
    { value: 'likeCount', label: t('sort.mostLiked') },
    { value: 'rating', label: t('sort.topRated') },
    { value: 'title', label: t('sort.alphabetical') }
  ];

  // Layout classes
  const layoutClasses = {
    grid: 'gallery-grid--grid',
    masonry: 'gallery-grid--masonry',
    list: 'gallery-grid--list'
  };

  // Calculate grid columns
  const gridStyle = {
    '--grid-gap': `${gap}px`,
    '--grid-columns': columns === 'auto' ? getAutoColumns(cardSize) : columns
  };

  return (
    <div 
      ref={containerRef}
      className={`gallery-grid ${layoutClasses[layout]} ${className}`}
      style={gridStyle}
    >
      {/* Header with stats and controls */}
      <header className="gallery-grid__header">
        {showStats && (
          <div className="gallery-grid__stats">
            <span className="gallery-grid__total">
              {formatNumber(total)} {t('items')}
            </span>
          </div>
        )}

        <div className="gallery-grid__controls">
          {showSort && (
            <SortSelect 
              value={sort} 
              options={sortOptions}
              onChange={setSort}
              t={t}
            />
          )}

          {showFilters && (
            <FilterControls
              filters={filters}
              onFilterChange={setFilter}
              onClear={clearFilters}
              t={t}
            />
          )}

          <button 
            className="gallery-grid__refresh"
            onClick={refresh}
            disabled={loading}
            title={t('refresh')}
          >
            🔄
          </button>
        </div>
      </header>

      {/* Error state */}
      {error && (
        <div className="gallery-grid__error">
          <span className="gallery-grid__error-icon">⚠️</span>
          <p>{t('error.loadFailed')}: {error}</p>
          <button onClick={refresh}>{t('retry')}</button>
        </div>
      )}

      {/* Items grid */}
      <div className="gallery-grid__items" role="list">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            size={cardSize}
            onClick={handleItemClick}
            onLike={handleItemLike}
          />
        ))}

        {/* Loading skeletons */}
        {loading && (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <MediaCardSkeleton key={`skeleton-${i}`} size={cardSize} />
            ))}
          </>
        )}
      </div>

      {/* Empty state */}
      {!loading && items.length === 0 && !error && (
        <div className="gallery-grid__empty">
          <span className="gallery-grid__empty-icon">📭</span>
          <p>{t('empty.noItems')}</p>
          {Object.keys(filters).length > 0 && (
            <button onClick={clearFilters}>{t('clearFilters')}</button>
          )}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {infiniteScroll && hasMore && (
        <div 
          ref={sentinelRef}
          className="gallery-grid__sentinel"
          aria-hidden="true"
        />
      )}

      {/* Load more button (fallback for non-infinite scroll) */}
      {!infiniteScroll && hasMore && (
        <div className="gallery-grid__load-more">
          <button 
            onClick={loadMore}
            disabled={loading}
            className="gallery-grid__load-more-btn"
          >
            {loading ? t('loading') : t('loadMore')}
          </button>
        </div>
      )}

      {/* End of results */}
      {!hasMore && items.length > 0 && (
        <div className="gallery-grid__end">
          <span>{t('endOfResults')}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Sort Select Component
 */
function SortSelect({ value, options, onChange, t }) {
  const handleChange = (e) => {
    const [field, direction = 'desc'] = e.target.value.split(':');
    onChange(field, direction);
  };

  return (
    <div className="gallery-grid__sort">
      <label htmlFor="sort-select" className="sr-only">
        {t('sortBy')}
      </label>
      <select
        id="sort-select"
        value={`${value.field}:${value.direction}`}
        onChange={handleChange}
        className="gallery-grid__sort-select"
      >
        {options.map(opt => (
          <React.Fragment key={opt.value}>
            <option value={`${opt.value}:desc`}>
              {opt.label} ↓
            </option>
            <option value={`${opt.value}:asc`}>
              {opt.label} ↑
            </option>
          </React.Fragment>
        ))}
      </select>
    </div>
  );
}

/**
 * Filter Controls Component
 */
function FilterControls({ filters, onFilterChange, onClear, t }) {
  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="gallery-grid__filters">
      {/* Category filter */}
      <select
        value={filters.category || ''}
        onChange={(e) => onFilterChange('category', e.target.value || undefined)}
        className="gallery-grid__filter-select"
        aria-label={t('filterByCategory')}
      >
        <option value="">{t('allCategories')}</option>
        {/* Categories would be loaded from useCategories hook */}
      </select>

      {/* Media type filter */}
      <select
        value={filters.type || ''}
        onChange={(e) => onFilterChange('type', e.target.value || undefined)}
        className="gallery-grid__filter-select"
        aria-label={t('filterByType')}
      >
        <option value="">{t('allTypes')}</option>
        <option value="image">{t('images')}</option>
        <option value="video">{t('videos')}</option>
      </select>

      {/* Clear filters */}
      {hasFilters && (
        <button 
          onClick={onClear}
          className="gallery-grid__clear-filters"
          title={t('clearFilters')}
        >
          ✕ {t('clear')}
        </button>
      )}
    </div>
  );
}

/**
 * Get auto column count based on card size
 */
function getAutoColumns(size) {
  const columnMap = {
    thumb: 6,
    small: 5,
    medium: 4,
    large: 3
  };
  return columnMap[size] || 4;
}

/**
 * GalleryGridCompact - Simplified grid without controls
 */
export function GalleryGridCompact({
  items = [],
  loading = false,
  cardSize = 'small',
  columns = 4,
  onItemClick,
  className = ''
}) {
  return (
    <div 
      className={`gallery-grid gallery-grid--compact ${className}`}
      style={{ '--grid-columns': columns }}
    >
      <div className="gallery-grid__items">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            size={cardSize}
            showInfo={false}
            onClick={onItemClick}
          />
        ))}
        
        {loading && Array.from({ length: columns }).map((_, i) => (
          <MediaCardSkeleton key={`skeleton-${i}`} size={cardSize} showInfo={false} />
        ))}
      </div>
    </div>
  );
}

export default GalleryGrid;
