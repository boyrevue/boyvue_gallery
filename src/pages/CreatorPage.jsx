/**
 * CreatorPage Component
 * Profile page for content creators
 */

import React from 'react';
import { useI18n } from '../hooks/useI18n.js';
import { useSEO } from '../hooks/useSEO.js';
import { useGallery } from '../hooks/useGallery.js';
import { GalleryGrid } from '../components/GalleryGrid.jsx';

export function CreatorPage({ username, navigate }) {
  const { t, formatNumber } = useI18n();
  
  // This would fetch creator data from API
  const creator = { username, name: username }; // Placeholder
  
  useSEO('creator', { 
    username, 
    name: creator.name,
    avatar: creator.avatar,
    bio: creator.bio
  });

  const handleItemClick = (item) => {
    const type = item.mediaType === 'video' ? 'video' : 'photo';
    navigate(`/${type}/${item.slug || item.id}`);
  };

  return (
    <div className="creator-page">
      {/* Profile header */}
      <header className="creator-page__header">
        <div className="creator-page__avatar">
          {creator.avatar ? (
            <img src={creator.avatar} alt={creator.name} />
          ) : (
            <span className="creator-page__avatar-placeholder">
              {(creator.name || username).charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        
        <div className="creator-page__info">
          <h1 className="creator-page__name">{creator.name || username}</h1>
          <span className="creator-page__username">@{username}</span>
          
          {creator.bio && (
            <p className="creator-page__bio">{creator.bio}</p>
          )}
          
          <div className="creator-page__stats">
            <span>{formatNumber(creator.mediaCount || 0)} {t('items')}</span>
            <span>{formatNumber(creator.viewCount || 0)} {t('views')}</span>
            <span>{formatNumber(creator.followerCount || 0)} {t('followers')}</span>
          </div>
        </div>
      </header>

      {/* Creator's content */}
      <section className="creator-page__content">
        <GalleryGrid
          apiEndpoint="/api/gallery"
          initialFilters={{ creator: username }}
          onItemClick={handleItemClick}
          showFilters={false}
        />
      </section>
    </div>
  );
}

export default CreatorPage;
