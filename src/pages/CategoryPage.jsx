/**
 * CategoryPage Component - i18n compliant with SEO keywords, site reviews, and forum links
 */

import React, { useState, useEffect } from 'react';
import { useI18n } from '../hooks/useI18n.js';
import { GalleryGrid } from '../components/GalleryGrid.jsx';

// Star rating component
function StarRating({ rating, max = 5 }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = max - fullStars - (hasHalf ? 1 : 0);

  return (
    <span className="star-rating" title={`${rating}/${max}`}>
      {'★'.repeat(fullStars)}
      {hasHalf && '½'}
      {'☆'.repeat(emptyStars)}
    </span>
  );
}

// Site Index badge
function SiteIndexBadge({ index }) {
  let color = '#666';
  let label = 'Basic';
  if (index >= 80) { color = '#4caf50'; label = 'Excellent'; }
  else if (index >= 65) { color = '#8bc34a'; label = 'Very Good'; }
  else if (index >= 50) { color = '#ff9800'; label = 'Good'; }
  else if (index >= 35) { color = '#ff5722'; label = 'Average'; }

  return (
    <div className="site-index-badge" style={{ borderColor: color }}>
      <span className="site-index-badge__score" style={{ color }}>{index}</span>
      <span className="site-index-badge__label">{label}</span>
    </div>
  );
}

export function CategoryPage({ slug, navigate }) {
  const { t, lang } = useI18n();
  const [meta, setMeta] = useState(null);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFullReview, setShowFullReview] = useState(false);

  // Fetch category metadata and site review
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch both meta and review in parallel
        const [metaRes, reviewRes] = await Promise.all([
          fetch(`/api/category-meta/${encodeURIComponent(slug)}?lang=${lang}`),
          fetch(`/api/site-review/${encodeURIComponent(slug)}?lang=${lang}`)
        ]);

        if (metaRes.ok) {
          const data = await metaRes.json();
          setMeta(data);

          // Update document meta tags
          document.title = data.metaTitle || `${data.title} - BoyVue`;

          let descTag = document.querySelector('meta[name="description"]');
          if (!descTag) {
            descTag = document.createElement('meta');
            descTag.name = 'description';
            document.head.appendChild(descTag);
          }
          descTag.content = data.metaDescription || '';

          let kwTag = document.querySelector('meta[name="keywords"]');
          if (!kwTag) {
            kwTag = document.createElement('meta');
            kwTag.name = 'keywords';
            document.head.appendChild(kwTag);
          }
          kwTag.content = data.metaKeywords || '';

          let ogTitle = document.querySelector('meta[property="og:title"]');
          if (ogTitle) ogTitle.content = data.metaTitle || data.title;

          let ogDesc = document.querySelector('meta[property="og:description"]');
          if (ogDesc) ogDesc.content = data.metaDescription || '';
        }

        if (reviewRes.ok) {
          const reviewData = await reviewRes.json();
          setReview(reviewData);
        }
      } catch (e) {
        console.warn('Failed to fetch category data:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug, lang]);

  const handleItemClick = (item) => {
    const type = item.mediaType === 'video' ? 'video' : 'photo';
    navigate(`/${type}/${item.slug || item.id}`);
  };

  return (
    <div className="category-page">
      <header className="category-page__header">
        <div className="category-page__title-row">
          <h1>{meta?.title || slug}</h1>
          {review?.hasReview && review?.siteIndex > 0 && (
            <SiteIndexBadge index={review.siteIndex} />
          )}
        </div>

        {meta?.description && (
          <p className="category-page__description">{meta.description}</p>
        )}

        {/* SEO Keywords */}
        {meta?.keywords?.length > 0 && (
          <div className="category-page__keywords">
            <span className="keywords-label">{t('keywords') || 'Keywords'}:</span>
            {meta.keywords.slice(0, 8).map((kw, i) => (
              <span key={i} className="keyword-tag">
                {kw.keyword}
                {kw.search_volume > 0 && (
                  <small className="keyword-volume">{kw.search_volume.toLocaleString()}/mo</small>
                )}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Site Review Section */}
      {review?.hasReview && (
        <section className="site-review">
          <div className="site-review__header">
            <h2>{review.title || `${review.siteName} Review`}</h2>
            <div className="site-review__ratings">
              <div className="rating-item rating-item--main">
                <StarRating rating={review.overallRating} />
                <span className="rating-value">{review.overallRating.toFixed(1)}/5</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="site-review__stats">
            <div className="stat-item">
              <span className="stat-value">{review.photoCount?.toLocaleString() || 0}</span>
              <span className="stat-label">{t('photos') || 'Photos'}</span>
            </div>
            {review.totalBacklinks > 0 && (
              <div className="stat-item">
                <span className="stat-value">{(review.totalBacklinks / 1000).toFixed(0)}K</span>
                <span className="stat-label">{t('backlinks') || 'Backlinks'}</span>
              </div>
            )}
            {review.totalKeywords > 0 && (
              <div className="stat-item">
                <span className="stat-value">{review.totalKeywords}</span>
                <span className="stat-label">{t('keywords') || 'Keywords'}</span>
              </div>
            )}
            {review.forumLinks?.length > 0 && (
              <div className="stat-item">
                <span className="stat-value">{review.forumLinks.length}</span>
                <span className="stat-label">{t('forums') || 'Forums'}</span>
              </div>
            )}
          </div>

          {/* AI Summary */}
          {review.summary && (
            <div className="site-review__summary">
              <p>{review.summary}</p>
            </div>
          )}

          {/* Expandable Details */}
          <button
            className="site-review__toggle"
            onClick={() => setShowFullReview(!showFullReview)}
          >
            {showFullReview ? (t('showLess') || 'Show Less') : (t('showMore') || 'Show Full Review')}
          </button>

          {showFullReview && (
            <div className="site-review__details">
              {/* Sub-ratings */}
              <div className="site-review__sub-ratings">
                <div className="sub-rating">
                  <span className="sub-rating__label">{t('contentQuality') || 'Content'}</span>
                  <StarRating rating={review.contentQuality} />
                </div>
                <div className="sub-rating">
                  <span className="sub-rating__label">{t('modelVariety') || 'Variety'}</span>
                  <StarRating rating={review.modelVariety} />
                </div>
                <div className="sub-rating">
                  <span className="sub-rating__label">{t('videoQuality') || 'Quality'}</span>
                  <StarRating rating={review.videoQuality} />
                </div>
                <div className="sub-rating">
                  <span className="sub-rating__label">{t('updates') || 'Updates'}</span>
                  <StarRating rating={review.updateFrequency} />
                </div>
              </div>

              {/* Pros & Cons */}
              <div className="site-review__pros-cons">
                {review.pros?.length > 0 && (
                  <div className="pros">
                    <h4>{t('pros') || 'Pros'}</h4>
                    <ul>
                      {review.pros.map((pro, i) => (
                        <li key={i}>{pro}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {review.cons?.length > 0 && (
                  <div className="cons">
                    <h4>{t('cons') || 'Cons'}</h4>
                    <ul>
                      {review.cons.map((con, i) => (
                        <li key={i}>{con}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* User Consensus */}
              {review.consensus && (
                <div className="site-review__consensus">
                  <h4>{t('userConsensus') || 'User Consensus'}</h4>
                  <p>{review.consensus}</p>
                </div>
              )}

              {/* Forum Links */}
              {review.forumLinks?.length > 0 && (
                <div className="site-review__forums">
                  <h4>{t('communityDiscussions') || 'Community Discussions'}</h4>
                  <ul className="forum-links">
                    {review.forumLinks.map((link, i) => (
                      <li key={i}>
                        <a
                          href={link.forum_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="forum-link"
                        >
                          <span className="forum-link__name">{link.forum_name}</span>
                          <span className="forum-link__title">{link.post_title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Backlinks */}
              {review.backlinks?.length > 0 && (
                <div className="site-review__backlinks">
                  <h4>{t('featuredOn') || 'Featured On'}</h4>
                  <ul className="backlink-list">
                    {review.backlinks.slice(0, 5).map((bl, i) => (
                      <li key={i}>
                        <a
                          href={bl.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {bl.anchor_text || new URL(bl.source_url).hostname}
                        </a>
                        {bl.domain_authority && (
                          <span className="da-badge">DA {bl.domain_authority}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Official Site Link */}
              {review.siteUrl && (
                <div className="site-review__official">
                  <a
                    href={review.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--primary"
                  >
                    {t('visitOfficialSite') || 'Visit Official Site'}
                  </a>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <GalleryGrid
        apiEndpoint="/api/gallery"
        initialFilters={{ category: slug }}
        onItemClick={handleItemClick}
      />

      {/* Structured Data for SEO */}
      {review?.hasReview && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Review",
            "itemReviewed": {
              "@type": "WebSite",
              "name": review.siteName,
              "url": review.siteUrl || undefined
            },
            "reviewRating": {
              "@type": "Rating",
              "ratingValue": review.overallRating,
              "bestRating": 5
            },
            "author": {
              "@type": "Organization",
              "name": "BoyVue"
            },
            "reviewBody": review.summary
          })
        }} />
      )}

      <style>{`
        .category-page__title-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .site-index-badge {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          padding: 0.5rem 1rem;
          border: 2px solid;
          border-radius: 8px;
          background: rgba(0,0,0,0.3);
        }

        .site-index-badge__score {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .site-index-badge__label {
          font-size: 0.7rem;
          text-transform: uppercase;
          opacity: 0.8;
        }

        .category-page__keywords {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 1rem;
          align-items: center;
        }

        .keywords-label {
          font-size: 0.85rem;
          opacity: 0.7;
        }

        .keyword-tag {
          background: rgba(255,255,255,0.1);
          padding: 0.3rem 0.7rem;
          border-radius: 20px;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }

        .keyword-volume {
          opacity: 0.6;
          font-size: 0.7rem;
        }

        .site-review {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 1.5rem;
          margin: 1.5rem 0;
        }

        .site-review__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .site-review__header h2 {
          margin: 0;
          font-size: 1.3rem;
        }

        .site-review__ratings {
          display: flex;
          gap: 1rem;
        }

        .rating-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .rating-item--main .star-rating {
          font-size: 1.3rem;
          color: #ffc107;
        }

        .rating-value {
          font-weight: bold;
          font-size: 1.1rem;
        }

        .star-rating {
          color: #ffc107;
          letter-spacing: 1px;
        }

        .site-review__stats {
          display: flex;
          gap: 2rem;
          margin: 1rem 0;
          flex-wrap: wrap;
        }

        .stat-item {
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: bold;
          color: #4fc3f7;
        }

        .stat-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          opacity: 0.7;
        }

        .site-review__summary {
          background: rgba(0,0,0,0.2);
          padding: 1rem;
          border-radius: 8px;
          margin: 1rem 0;
          line-height: 1.6;
        }

        .site-review__toggle {
          background: rgba(255,255,255,0.1);
          border: none;
          color: inherit;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.2s;
        }

        .site-review__toggle:hover {
          background: rgba(255,255,255,0.2);
        }

        .site-review__details {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255,255,255,0.1);
        }

        .site-review__sub-ratings {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .sub-rating {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .sub-rating__label {
          font-size: 0.85rem;
          opacity: 0.8;
        }

        .site-review__pros-cons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin: 1.5rem 0;
        }

        .pros h4 { color: #4caf50; }
        .cons h4 { color: #f44336; }

        .pros ul, .cons ul {
          list-style: none;
          padding: 0;
          margin: 0.5rem 0;
        }

        .pros li::before { content: '✓ '; color: #4caf50; }
        .cons li::before { content: '✗ '; color: #f44336; }

        .pros li, .cons li {
          padding: 0.3rem 0;
          font-size: 0.9rem;
        }

        .site-review__consensus {
          background: rgba(79, 195, 247, 0.1);
          padding: 1rem;
          border-radius: 8px;
          border-left: 3px solid #4fc3f7;
          margin: 1.5rem 0;
        }

        .site-review__consensus h4 {
          margin: 0 0 0.5rem 0;
          color: #4fc3f7;
        }

        .site-review__forums, .site-review__backlinks {
          margin: 1.5rem 0;
        }

        .site-review__forums h4, .site-review__backlinks h4 {
          margin-bottom: 0.75rem;
          font-size: 1rem;
        }

        .forum-links, .backlink-list {
          list-style: none;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .forum-link {
          display: flex;
          flex-direction: column;
          background: rgba(255,255,255,0.05);
          padding: 0.75rem 1rem;
          border-radius: 8px;
          text-decoration: none;
          color: inherit;
          transition: background 0.2s;
        }

        .forum-link:hover {
          background: rgba(255,255,255,0.1);
        }

        .forum-link__name {
          font-weight: bold;
          color: #4fc3f7;
          font-size: 0.9rem;
        }

        .forum-link__title {
          font-size: 0.8rem;
          opacity: 0.7;
        }

        .backlink-list li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .backlink-list a {
          color: #4fc3f7;
          text-decoration: none;
        }

        .backlink-list a:hover {
          text-decoration: underline;
        }

        .da-badge {
          background: rgba(255,255,255,0.1);
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
        }

        .site-review__official {
          margin-top: 1.5rem;
          text-align: center;
        }

        .btn--primary {
          display: inline-block;
          background: linear-gradient(135deg, #4fc3f7, #29b6f6);
          color: white;
          padding: 0.75rem 2rem;
          border-radius: 25px;
          text-decoration: none;
          font-weight: bold;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .btn--primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(79, 195, 247, 0.4);
        }

        @media (max-width: 600px) {
          .site-review__header {
            flex-direction: column;
          }

          .site-review__stats {
            justify-content: space-around;
          }

          .site-review__pros-cons {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default CategoryPage;
