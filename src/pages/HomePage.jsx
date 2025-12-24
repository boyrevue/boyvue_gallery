/**
 * HomePage Component
 * Landing page with featured content and streaming promos
 */

import React from 'react';
import { useI18n } from '../hooks/useI18n.js';
import { useSEO } from '../hooks/useSEO.js';
import { useGallery } from '../hooks/useGallery.js';
import { useStreaming, useStreamingPromo } from '../hooks/useStreaming.js';
import { useFeatureFlag } from '../hooks/useConfig.js';
import { GalleryGrid, GalleryGridCompact } from '../components/GalleryGrid.jsx';
import { MediaCard } from '../components/MediaCard.jsx';

export function HomePage({ navigate }) {
  const { t } = useI18n();
  
  // SEO meta tags - all patterns from seo.ttl
  useSEO('home');

  // Feature flags from app.ttl
  const streamingPromoEnabled = useFeatureFlag('streamingPromo');

  // Fetch featured/recent content
  const { items: featuredItems, loading: featuredLoading } = useGallery('/api/gallery/featured', {
    pageSize: 8
  });

  const { items: recentItems, loading: recentLoading } = useGallery('/api/gallery/recent', {
    pageSize: 12
  });

  // Streaming promos
  const { promos } = useStreamingPromo('featured');

  const handleItemClick = (item) => {
    const type = item.mediaType === 'video' ? 'video' : 'photo';
    navigate(`/${type}/${item.slug || item.id}`);
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="home-page__hero">
        <div className="home-page__hero-content">
          <h1 className="home-page__title">{t('home.title')}</h1>
          <p className="home-page__subtitle">{t('home.subtitle')}</p>
          <button 
            className="home-page__cta"
            onClick={() => navigate('/gallery')}
          >
            {t('home.exploreGallery')}
          </button>
        </div>
      </section>

      {/* Featured Content */}
      <section className="home-page__section">
        <div className="home-page__section-header">
          <h2>{t('home.featured')}</h2>
          <a href="/gallery?sort=featured" onClick={(e) => { e.preventDefault(); navigate('/gallery?sort=featured'); }}>
            {t('viewAll')} →
          </a>
        </div>
        
        <GalleryGridCompact
          items={featuredItems}
          loading={featuredLoading}
          cardSize="medium"
          columns={4}
          onItemClick={handleItemClick}
        />
      </section>

      {/* Streaming Promos */}
      {streamingPromoEnabled && promos.length > 0 && (
        <section className="home-page__section home-page__streaming-promos">
          <div className="home-page__section-header">
            <h2>{t('home.liveNow')}</h2>
            <a href="/live" onClick={(e) => { e.preventDefault(); navigate('/live'); }}>
              {t('viewAll')} →
            </a>
          </div>
          
          <StreamingPromoGrid promos={promos} />
        </section>
      )}

      {/* Recent Content */}
      <section className="home-page__section">
        <div className="home-page__section-header">
          <h2>{t('home.recent')}</h2>
          <a href="/gallery?sort=createdAt:desc" onClick={(e) => { e.preventDefault(); navigate('/gallery?sort=createdAt:desc'); }}>
            {t('viewAll')} →
          </a>
        </div>
        
        <GalleryGridCompact
          items={recentItems}
          loading={recentLoading}
          cardSize="small"
          columns={6}
          onItemClick={handleItemClick}
        />
      </section>

      {/* Categories Grid */}
      <section className="home-page__section">
        <div className="home-page__section-header">
          <h2>{t('home.categories')}</h2>
        </div>
        
        <CategoriesGrid navigate={navigate} />
      </section>
    </div>
  );
}

/**
 * Streaming Promo Grid
 */
function StreamingPromoGrid({ promos }) {
  const { getPlatform, getBrandColor } = useStreaming();
  const { t } = useI18n();

  return (
    <div className="streaming-promo-grid">
      {promos.slice(0, 4).map(promo => {
        const platform = getPlatform(promo.platformId);
        if (!platform) return null;

        return (
          <a
            key={promo.id}
            href={platform.baseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="streaming-promo-card"
            style={{ '--brand-color': getBrandColor(promo.platformId) }}
          >
            <div className="streaming-promo-card__icon">
              {platform.iconClass && <i className={platform.iconClass} />}
            </div>
            <div className="streaming-promo-card__content">
              <h3>{platform.name}</h3>
              <span className="streaming-promo-card__live-badge">
                🔴 {t('streaming.live')}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

/**
 * Categories Grid
 */
function CategoriesGrid({ navigate }) {
  const { t } = useI18n();
  
  // This would use useCategories hook in production
  // For now, placeholder categories
  const categories = [
    { id: 1, slug: 'featured', name: t('category.featured'), icon: '⭐' },
    { id: 2, slug: 'popular', name: t('category.popular'), icon: '🔥' },
    { id: 3, slug: 'new', name: t('category.new'), icon: '✨' },
    { id: 4, slug: 'videos', name: t('category.videos'), icon: '🎬' }
  ];

  return (
    <div className="categories-grid">
      {categories.map(cat => (
        <a
          key={cat.id}
          href={`/category/${cat.slug}`}
          onClick={(e) => { e.preventDefault(); navigate(`/category/${cat.slug}`); }}
          className="category-card"
        >
          <span className="category-card__icon">{cat.icon}</span>
          <span className="category-card__name">{cat.name}</span>
        </a>
      ))}
    </div>
  );
}

export default HomePage;
