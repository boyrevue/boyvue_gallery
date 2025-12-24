/**
 * MediaCard Component
 * Displays a single media item (image/video) card
 * Follows ontology structure from gallery-core.ttl
 */

import React, { useState, useRef, useCallback } from 'react';
import { useI18n } from '../hooks/useI18n.js';
import { useFeatureFlag } from '../hooks/useConfig.js';

/**
 * MediaCard Component
 */
export function MediaCard({
  item,
  size = 'medium',
  showInfo = true,
  showOverlay = true,
  lazy = true,
  onClick,
  onLike,
  className = ''
}) {
  const { t, formatNumber, formatRelativeTime } = useI18n();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  const likesEnabled = useFeatureFlag('likes');
  const ratingsEnabled = useFeatureFlag('ratings');

  // Get appropriate thumbnail URL based on size
  const thumbnailUrl = item.thumbnails?.[size] || 
                       item.thumbnails?.medium || 
                       item.sourceUrl;

  // Size classes from TTL config (mapped here for CSS)
  const sizeClasses = {
    thumb: 'media-card--thumb',
    small: 'media-card--small',
    medium: 'media-card--medium',
    large: 'media-card--large'
  };

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setError(true);
  }, []);

  const handleClick = useCallback((e) => {
    if (onClick) {
      onClick(item, e);
    }
  }, [item, onClick]);

  const handleLike = useCallback((e) => {
    e.stopPropagation();
    if (onLike) {
      onLike(item);
    }
  }, [item, onLike]);

  const isVideo = item.mediaType === 'video';

  return (
    <article 
      className={`media-card ${sizeClasses[size]} ${className} ${loaded ? 'is-loaded' : ''}`}
      onClick={handleClick}
      data-id={item.id}
      data-type={item.mediaType}
    >
      {/* Thumbnail */}
      <div className="media-card__image-container">
        {!loaded && !error && (
          <div className="media-card__placeholder">
            <span className="media-card__spinner" aria-label={t('loading')} />
          </div>
        )}
        
        {error ? (
          <div className="media-card__error">
            <span className="media-card__error-icon">⚠️</span>
            <span>{t('error.imageLoadFailed')}</span>
          </div>
        ) : (
          <img
            ref={imgRef}
            src={thumbnailUrl}
            alt={item.title || item.description || ''}
            className="media-card__image"
            loading={lazy ? 'lazy' : 'eager'}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}

        {/* Video indicator */}
        {isVideo && (
          <div className="media-card__video-indicator">
            <span className="media-card__play-icon">▶</span>
            {item.duration && (
              <span className="media-card__duration">
                {formatDuration(item.duration)}
              </span>
            )}
          </div>
        )}

        {/* Overlay with stats */}
        {showOverlay && loaded && (
          <div className="media-card__overlay">
            <div className="media-card__stats">
              <span className="media-card__stat" title={t('views')}>
                👁 {formatNumber(item.viewCount || 0)}
              </span>
              
              {likesEnabled && (
                <button 
                  className={`media-card__stat media-card__like-btn ${item.isLiked ? 'is-liked' : ''}`}
                  onClick={handleLike}
                  title={t(item.isLiked ? 'unlike' : 'like')}
                >
                  {item.isLiked ? '❤️' : '🤍'} {formatNumber(item.likeCount || 0)}
                </button>
              )}
              
              {ratingsEnabled && item.rating > 0 && (
                <span className="media-card__stat" title={t('rating')}>
                  ⭐ {item.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info section */}
      {showInfo && (
        <div className="media-card__info">
          {item.title && (
            <h3 className="media-card__title" title={item.title}>
              {item.title}
            </h3>
          )}
          
          <div className="media-card__meta">
            {item.creator && (
              <span className="media-card__creator">
                {item.creator.username || item.creator.name}
              </span>
            )}
            
            {item.createdAt && (
              <time 
                className="media-card__date" 
                dateTime={item.createdAt}
                title={new Date(item.createdAt).toLocaleString()}
              >
                {formatRelativeTime(item.createdAt)}
              </time>
            )}
          </div>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="media-card__tags">
              {item.tags.slice(0, 3).map(tag => (
                <span key={tag} className="media-card__tag">
                  {tag}
                </span>
              ))}
              {item.tags.length > 3 && (
                <span className="media-card__tag-more">
                  +{item.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * MediaCardSkeleton - Loading placeholder
 */
export function MediaCardSkeleton({ size = 'medium', showInfo = true }) {
  const sizeClasses = {
    thumb: 'media-card--thumb',
    small: 'media-card--small',
    medium: 'media-card--medium',
    large: 'media-card--large'
  };

  return (
    <div className={`media-card media-card--skeleton ${sizeClasses[size]}`}>
      <div className="media-card__image-container">
        <div className="media-card__placeholder media-card__placeholder--animated" />
      </div>
      
      {showInfo && (
        <div className="media-card__info">
          <div className="media-card__title-skeleton" />
          <div className="media-card__meta-skeleton" />
        </div>
      )}
    </div>
  );
}

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default MediaCard;
