/**
 * SearchPage Component
 */

import React, { useState, useCallback } from 'react';
import { useI18n } from '../hooks/useI18n.js';
import { useSEO } from '../hooks/useSEO.js';
import { GalleryGrid } from '../components/GalleryGrid.jsx';

export function SearchPage({ query: initialQuery = '', navigate }) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  
  useSEO('search', { query: activeQuery });

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    setActiveQuery(searchQuery);
    // Update URL
    const params = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
    window.history.pushState({}, '', `/search${params}`);
  }, [searchQuery]);

  const handleItemClick = (item) => {
    const type = item.mediaType === 'video' ? 'video' : 'photo';
    navigate(`/${type}/${item.slug || item.id}`);
  };

  return (
    <div className="search-page">
      <header className="search-page__header">
        <h1>{t('search.title')}</h1>
        
        <form className="search-page__form" onSubmit={handleSearch}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="search-page__input"
            autoFocus
          />
          <button type="submit" className="search-page__submit">
            🔍 {t('search.button')}
          </button>
        </form>
      </header>

      {activeQuery && (
        <section className="search-page__results">
          <GalleryGrid
            apiEndpoint="/api/search"
            initialFilters={{ q: activeQuery }}
            onItemClick={handleItemClick}
            showFilters={true}
          />
        </section>
      )}

      {!activeQuery && (
        <div className="search-page__suggestions">
          <h2>{t('search.suggestions')}</h2>
          <div className="search-page__tags">
            {['popular', 'trending', 'new', 'featured'].map(tag => (
              <button
                key={tag}
                onClick={() => { setSearchQuery(tag); setActiveQuery(tag); }}
                className="search-page__tag"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchPage;
