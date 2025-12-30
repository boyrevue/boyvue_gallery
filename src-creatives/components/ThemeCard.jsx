import React from 'react';
import { Link } from 'react-router-dom';

function ThemeCard({ theme }) {
  const { id, name, slug, thumbnail_url, icon, color, performer_count } = theme;

  return (
    <Link
      to={`/themes/${slug}`}
      className="theme-card"
      style={{ '--theme-color': color || '#f60' }}
    >
      {thumbnail_url ? (
        <img src={thumbnail_url} alt={name} className="theme-image" loading="lazy" />
      ) : (
        <div className="theme-icon">{icon || '📁'}</div>
      )}

      <div className="theme-overlay">
        <h3 className="theme-name">{name}</h3>
        <span className="theme-count">{performer_count || 0} performers</span>
      </div>
    </Link>
  );
}

export default ThemeCard;
