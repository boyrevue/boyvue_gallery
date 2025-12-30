import React from 'react';
import { Link } from 'react-router-dom';

function PerformerCard({ performer }) {
  const {
    id, username, display_name, avatar_url, cover_photo_url,
    is_online, is_verified, follower_count,
    platform_slug, platform_logo, platform_name,
    affiliate_link
  } = performer;

  return (
    <div className={`performer-card ${is_online ? 'is-online' : ''}`}>
      <Link to={`/performers/${id}`} className="performer-card-link">
        <div className="performer-image">
          <img
            src={cover_photo_url || avatar_url || '/placeholder-performer.jpg'}
            alt={display_name || username}
            loading="lazy"
          />
          {is_online && <span className="live-badge">LIVE</span>}
          {is_verified && <span className="verified-badge">✓</span>}
        </div>
      </Link>

      <div className="performer-info">
        <div className="performer-header">
          <Link to={`/performers/${id}`} className="performer-name">
            {display_name || username}
          </Link>
          {platform_logo && (
            <img
              src={platform_logo}
              alt={platform_name}
              className="platform-badge"
              title={platform_name}
            />
          )}
        </div>

        <div className="performer-meta">
          <span className="username">@{username}</span>
          {follower_count && (
            <span className="followers">{formatCount(follower_count)} followers</span>
          )}
        </div>

        <div className="performer-actions">
          {is_online && affiliate_link ? (
            <a href={affiliate_link} target="_blank" rel="noopener noreferrer" className="btn btn-live">
              Watch Live
            </a>
          ) : affiliate_link ? (
            <a href={affiliate_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              View Profile
            </a>
          ) : (
            <Link to={`/performers/${id}`} className="btn btn-secondary">
              Details
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCount(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default PerformerCard;
