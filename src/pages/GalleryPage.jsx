/**
 * GalleryPage Component
 * Main gallery listing page
 */

import React from 'react';
import { useI18n } from '../hooks/useI18n.js';
import { useSEO } from '../hooks/useSEO.js';
import { GalleryGrid } from '../components/GalleryGrid.jsx';

export function GalleryPage({ params = {}, navigate }) {
  const { t } = useI18n();
  
  // SEO - page type from seo.ttl
  useSEO('gallery', {
    title: t('gallery.title'),
    description: t('gallery.description')
  });

  // Parse initial filters from URL params
  const initialFilters = {};
  if (params.category) initialFilters.category = params.category;
  if (params.type) initialFilters.type = params.type;
  if (params.tag) initialFilters.tag = params.tag;

  // Parse initial sort from URL
  const [sortField, sortDir] = (params.sort || 'createdAt:desc').split(':');
  const initialSort = { field: sortField, direction: sortDir || 'desc' };

  const handleItemClick = (item) => {
    const type = item.mediaType === 'video' ? 'video' : 'photo';
    navigate(`/${type}/${item.slug || item.id}`);
  };

  return (
    <div className="gallery-page">
      <header className="gallery-page__header">
        <h1>{t('gallery.title')}</h1>
      </header>

      <GalleryGrid
        apiEndpoint="/api/gallery"
        initialFilters={initialFilters}
        initialSort={initialSort}
        layout="grid"
        cardSize="medium"
        infiniteScroll={true}
        showFilters={true}
        showSort={true}
        showStats={true}
        onItemClick={handleItemClick}
      />
    </div>
  );
}

export default GalleryPage;
