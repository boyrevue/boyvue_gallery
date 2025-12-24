/**
 * MediaPage Component
 * Single media item (photo/video) detail view
 */

import React, { useEffect } from 'react';
import { useI18n } from '../hooks/useI18n.js';
import { useSEO } from '../hooks/useSEO.js';
import { useMediaItem, useGallery } from '../hooks/useGallery.js';
import { useFeatureFlag } from '../hooks/useConfig.js';
import { GalleryGridCompact } from '../components/GalleryGrid.jsx';

export function MediaPage({ id, navigate }) {
  const { t, formatNumber, formatDate, formatRelativeTime } = useI18n();
  
  // Fetch the media item
  const { item, loading, error, like, unlike, trackView } = useMediaItem(id);

  // Feature flags
  const commentsEnabled = useFeatureFlag('comments');
  const ratingsEnabled = useFeatureFlag('ratings');
  const likesEnabled = useFeatureFlag('likes');
  const downloadEnabled = useFeatureFlag('download');
  const sharingEnabled = useFeatureFlag('sharing');

  // SEO - dynamic based on media type
  useSEO(item?.mediaType === 'video' ? 'video' : 'photo', {
    title: item?.title,
    description: item?.description,
    image: item?.thumbnails?.large || item?.sourceUrl,
    imageUrl: item?.sourceUrl,
    thumbnailUrl: item?.thumbnails?.medium,
    createdAt: item?.createdAt,
    creator: item?.creator,
    duration: item?.duration,
    slug: item?.slug || id
  });

  // Track view on mount
  useEffect(() => {
    if (item) {
      trackView();
    }
  }, [item?.id]);

  // Related content
  const { items: relatedItems } = useGallery('/api/gallery/related', {
    initialFilters: { relatedTo: id },
    pageSize: 6
  });

  // Loading state
  if (loading) {
    return <MediaPageSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div className="media-page media-page--error">
        <h1>{t('error.title')}</h1>
        <p>{error}</p>
        <button onClick={() => navigate('/gallery')}>{t('backToGallery')}</button>
      </div>
    );
  }

  // Not found
  if (!item) {
    return (
      <div className="media-page media-page--not-found">
        <h1>404</h1>
        <p>{t('error.mediaNotFound')}</p>
        <button onClick={() => navigate('/gallery')}>{t('backToGallery')}</button>
      </div>
    );
  }

  const isVideo = item.mediaType === 'video';

  const handleLike = () => {
    if (item.isLiked) {
      unlike();
    } else {
      like();
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: item.description,
          url: window.location.href
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = item.sourceUrl;
    link.download = item.title || 'download';
    link.click();
  };

  const handleRelatedClick = (relatedItem) => {
    const type = relatedItem.mediaType === 'video' ? 'video' : 'photo';
    navigate(`/${type}/${relatedItem.slug || relatedItem.id}`);
  };

  return (
    <div className="media-page">
      {/* Breadcrumbs */}
      <nav className="media-page__breadcrumbs" aria-label="Breadcrumb">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          {t('home')}
        </a>
        <span className="breadcrumb-separator">/</span>
        <a href="/gallery" onClick={(e) => { e.preventDefault(); navigate('/gallery'); }}>
          {t('gallery')}
        </a>
        {item.category && (
          <>
            <span className="breadcrumb-separator">/</span>
            <a 
              href={`/category/${item.category.slug}`}
              onClick={(e) => { e.preventDefault(); navigate(`/category/${item.category.slug}`); }}
            >
              {item.category.name}
            </a>
          </>
        )}
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{item.title}</span>
      </nav>

      {/* Main content */}
      <article className="media-page__content">
        {/* Media viewer */}
        <div className="media-page__viewer">
          {isVideo ? (
            <video
              className="media-page__video"
              src={item.sourceUrl}
              poster={item.thumbnails?.large}
              controls
              playsInline
            />
          ) : (
            <img
              className="media-page__image"
              src={item.sourceUrl}
              alt={item.title || item.description}
              loading="eager"
            />
          )}
        </div>

        {/* Info sidebar */}
        <aside className="media-page__sidebar">
          {/* Title and description */}
          <header className="media-page__header">
            <h1 className="media-page__title">{item.title}</h1>
            {item.description && (
              <p className="media-page__description">{item.description}</p>
            )}
          </header>

          {/* Creator info */}
          {item.creator && (
            <div className="media-page__creator">
              <a 
                href={`/creator/${item.creator.username}`}
                onClick={(e) => { e.preventDefault(); navigate(`/creator/${item.creator.username}`); }}
                className="media-page__creator-link"
              >
                {item.creator.avatar && (
                  <img 
                    src={item.creator.avatar} 
                    alt={item.creator.name || item.creator.username}
                    className="media-page__creator-avatar"
                  />
                )}
                <span className="media-page__creator-name">
                  {item.creator.name || item.creator.username}
                </span>
              </a>
            </div>
          )}

          {/* Stats */}
          <div className="media-page__stats">
            <span className="media-page__stat" title={t('views')}>
              👁 {formatNumber(item.viewCount)}
            </span>
            
            {likesEnabled && (
              <button 
                className={`media-page__stat media-page__like-btn ${item.isLiked ? 'is-liked' : ''}`}
                onClick={handleLike}
              >
                {item.isLiked ? '❤️' : '🤍'} {formatNumber(item.likeCount)}
              </button>
            )}
            
            {ratingsEnabled && item.rating > 0 && (
              <span className="media-page__stat" title={t('rating')}>
                ⭐ {item.rating.toFixed(1)}
              </span>
            )}

            {commentsEnabled && (
              <span className="media-page__stat" title={t('comments')}>
                💬 {formatNumber(item.commentCount || 0)}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="media-page__actions">
            {sharingEnabled && (
              <button 
                className="media-page__action"
                onClick={handleShare}
                title={t('share')}
              >
                📤 {t('share')}
              </button>
            )}
            
            {downloadEnabled && (
              <button 
                className="media-page__action"
                onClick={handleDownload}
                title={t('download')}
              >
                ⬇️ {t('download')}
              </button>
            )}
          </div>

          {/* Meta info */}
          <dl className="media-page__meta">
            <dt>{t('uploaded')}</dt>
            <dd title={formatDate(item.createdAt)}>
              {formatRelativeTime(item.createdAt)}
            </dd>
            
            {item.dimensions && (
              <>
                <dt>{t('dimensions')}</dt>
                <dd>{item.dimensions.width} × {item.dimensions.height}</dd>
              </>
            )}

            {isVideo && item.duration && (
              <>
                <dt>{t('duration')}</dt>
                <dd>{formatDuration(item.duration)}</dd>
              </>
            )}

            {item.fileSize && (
              <>
                <dt>{t('fileSize')}</dt>
                <dd>{formatFileSize(item.fileSize)}</dd>
              </>
            )}
          </dl>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="media-page__tags">
              <h3>{t('tags')}</h3>
              <div className="media-page__tag-list">
                {item.tags.map(tag => (
                  <a
                    key={tag}
                    href={`/tag/${tag}`}
                    onClick={(e) => { e.preventDefault(); navigate(`/gallery?tag=${tag}`); }}
                    className="media-page__tag"
                  >
                    #{tag}
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>
      </article>

      {/* Comments section */}
      {commentsEnabled && (
        <section className="media-page__comments">
          <h2>{t('comments')} ({formatNumber(item.commentCount || 0)})</h2>
          <CommentsSection itemId={id} />
        </section>
      )}

      {/* Related content */}
      {relatedItems.length > 0 && (
        <section className="media-page__related">
          <h2>{t('related')}</h2>
          <GalleryGridCompact
            items={relatedItems}
            cardSize="small"
            columns={6}
            onItemClick={handleRelatedClick}
          />
        </section>
      )}
    </div>
  );
}

/**
 * Comments Section Component
 */
function CommentsSection({ itemId }) {
  const { t } = useI18n();
  
  // This would fetch comments from API
  // Placeholder for now
  return (
    <div className="comments-section">
      <form className="comments-section__form">
        <textarea 
          placeholder={t('comments.placeholder')}
          className="comments-section__input"
        />
        <button type="submit" className="comments-section__submit">
          {t('comments.submit')}
        </button>
      </form>
      
      <div className="comments-section__list">
        <p className="comments-section__empty">{t('comments.empty')}</p>
      </div>
    </div>
  );
}

/**
 * Loading skeleton
 */
function MediaPageSkeleton() {
  return (
    <div className="media-page media-page--loading">
      <div className="media-page__viewer">
        <div className="skeleton skeleton--viewer" />
      </div>
      <aside className="media-page__sidebar">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--text" />
        <div className="skeleton skeleton--stats" />
      </aside>
    </div>
  );
}

/**
 * Format duration
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

/**
 * Format file size
 */
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default MediaPage;
