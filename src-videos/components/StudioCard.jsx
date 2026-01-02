import React from 'react';
import { Link } from 'react-router-dom';

function StudioCard({ studio }) {
  const affiliateUrl = studio.short_code ? `/api/videos/go/${studio.short_code}` : '#';

  return (
    <div className="studio-card">
      <Link to={`/studios/${studio.slug}`} className="studio-card-link">
        <div className="studio-card-image">
          {studio.logo_url ? (
            <img src={studio.logo_url} alt={studio.name} loading="lazy" />
          ) : (
            <div className="studio-card-placeholder">
              <span>{studio.name.charAt(0)}</span>
            </div>
          )}
          {studio.is_featured && <span className="badge badge-featured">Featured</span>}
        </div>
        <div className="studio-card-content">
          <h3 className="studio-card-title">{studio.name}</h3>
          {studio.tagline && <p className="studio-card-tagline">{studio.tagline}</p>}

          <div className="studio-card-meta">
            {studio.rating && (
              <span className="studio-rating">
                {'★'.repeat(Math.round(studio.rating))}{'☆'.repeat(5 - Math.round(studio.rating))}
                <span className="rating-value">{studio.rating.toFixed(1)}</span>
              </span>
            )}
            {studio.video_quality && (
              <span className="quality-badge">{studio.video_quality}</span>
            )}
          </div>

          {studio.features && studio.features.length > 0 && (
            <div className="studio-card-features">
              {studio.features.slice(0, 3).map((feature, i) => (
                <span key={i} className="feature-tag">{feature}</span>
              ))}
            </div>
          )}
        </div>
      </Link>

      <div className="studio-card-footer">
        <div className="studio-pricing">
          {studio.trial_price ? (
            <div className="trial-price">
              <span className="price">${studio.trial_price}</span>
              <span className="label">{studio.trial_days || 7} day trial</span>
            </div>
          ) : studio.monthly_price ? (
            <div className="monthly-price">
              <span className="price">${studio.monthly_price}</span>
              <span className="label">/month</span>
            </div>
          ) : null}
        </div>
        <a
          href={affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm"
          onClick={(e) => e.stopPropagation()}
        >
          Visit Site
        </a>
      </div>
    </div>
  );
}

export default StudioCard;
