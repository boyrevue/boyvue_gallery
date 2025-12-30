import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function PerformerCard({ performer, draggable = false }) {
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  
  const {
    id,
    username,
    display_name,
    avatar_url,
    is_online,
    follower_count,
    platform_name,
    platform_logo,
    chaturbate_username,
    onlyfans_username
  } = performer;

  const handleDragStart = (e) => {
    if (!draggable) return;
    setIsDragging(true);
    e.dataTransfer.setData('performerId', id.toString());
    e.dataTransfer.setData('performerData', JSON.stringify(performer));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleClick = (e) => {
    if (isDragging) {
      e.preventDefault();
      return;
    }
    navigate(`/performers/${id}`);
  };

  return (
    <div 
      className={`performer-card ${is_online ? 'online' : ''} ${draggable ? 'draggable' : ''}`}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={draggable ? handleClick : undefined}
    >
      {draggable ? (
        <div className="card-content">
          <div className="performer-image">
            <img src={avatar_url || '/placeholder.jpg'} alt={display_name} loading="lazy" />
            {is_online && <span className="live-badge">LIVE</span>}
            <span className="drag-hint">Drag to ❤️</span>
          </div>
          <div className="performer-info">
            <h3 className="performer-name">{display_name || username}</h3>
            <div className="performer-meta">
              {platform_logo && <img src={platform_logo} alt={platform_name} className="platform-icon" />}
              <span className="followers">{formatCount(follower_count)} followers</span>
            </div>
          </div>
        </div>
      ) : (
        <Link to={`/performers/${id}`}>
          <div className="performer-image">
            <img src={avatar_url || '/placeholder.jpg'} alt={display_name} loading="lazy" />
            {is_online && <span className="live-badge">LIVE</span>}
          </div>
          <div className="performer-info">
            <h3 className="performer-name">{display_name || username}</h3>
            <div className="performer-meta">
              {platform_logo && <img src={platform_logo} alt={platform_name} className="platform-icon" />}
              <span className="followers">{formatCount(follower_count)} followers</span>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}

function formatCount(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

export default PerformerCard;
