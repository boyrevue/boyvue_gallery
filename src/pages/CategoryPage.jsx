/**
 * CategoryPage Component
 */

import React from 'react';
import { useI18n } from '../hooks/useI18n.js';
import { useSEO } from '../hooks/useSEO.js';
import { GalleryGrid } from '../components/GalleryGrid.jsx';

export function CategoryPage({ slug, navigate }) {
  const { t } = useI18n();
  
  useSEO('category', { slug, title: slug });

  const handleItemClick = (item) => {
    const type = item.mediaType === 'video' ? 'video' : 'photo';
    navigate(`/${type}/${item.slug || item.id}`);
  };

  return (
    <div className="category-page">
      <header className="category-page__header">
        <h1>{slug}</h1>
      </header>

      <GalleryGrid
        apiEndpoint="/api/gallery"
        initialFilters={{ category: slug }}
        onItemClick={handleItemClick}
      />
    </div>
  );
}

export default CategoryPage;
