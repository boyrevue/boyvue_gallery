import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

function PerformerPage() {
  const { id } = useParams();
  const [performer, setPerformer] = useState(null);
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformer();
  }, [id]);

  async function fetchPerformer() {
    try {
      const [performerRes, contentRes] = await Promise.all([
        fetch(`/api/creatives/performers/${id}`),
        fetch(`/api/creatives/performers/${id}/content?limit=20`)
      ]);

      const performerData = await performerRes.json();
      const contentData = await contentRes.json();

      if (performerData.success) setPerformer(performerData.performer);
      if (contentData.success) setContent(contentData.content);
    } catch (err) {
      console.error('Error fetching performer:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (!performer) return <div className="not-found">Performer not found</div>;

  const affiliateUrl = performer.short_code
    ? `/go/${performer.short_code}`
    : performer.affiliate_link;

  return (
    <div className="performer-page">
      <div className="container">
        {/* Header */}
        <div className="performer-header">
          <div className="performer-cover">
            {performer.cover_photo_url && (
              <img src={performer.cover_photo_url} alt="" className="cover-image" />
            )}
          </div>

          <div className="performer-profile">
            <img
              src={performer.avatar_url || '/placeholder-performer.jpg'}
              alt={performer.display_name}
              className="avatar"
            />

            <div className="profile-info">
              <h1>
                {performer.display_name || performer.username}
                {performer.is_verified && <span className="verified-badge">✓</span>}
                {performer.is_online && <span className="live-badge">LIVE</span>}
              </h1>
              <p className="username">@{performer.username}</p>

              <div className="stats">
                {performer.follower_count && (
                  <div className="stat">
                    <span className="value">{formatCount(performer.follower_count)}</span>
                    <span className="label">Followers</span>
                  </div>
                )}
                {performer.media_count && (
                  <div className="stat">
                    <span className="value">{performer.media_count}</span>
                    <span className="label">Media</span>
                  </div>
                )}
              </div>

              {affiliateUrl && (
                <a
                  href={affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn ${performer.is_online ? 'btn-live' : 'btn-primary'} btn-lg`}
                >
                  {performer.is_online ? 'Watch Live' : 'View on ' + performer.platform_name}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bio & Details */}
        <div className="performer-details">
          {performer.bio && (
            <div className="bio">
              <h2>About</h2>
              <p>{performer.bio}</p>
            </div>
          )}

          {performer.categories && performer.categories.length > 0 && (
            <div className="tags">
              <h3>Tags</h3>
              <div className="tag-list">
                {performer.categories.map((tag, i) => (
                  <span key={i} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          )}

          <div className="platform-info">
            <h3>Platform</h3>
            <Link to={`/platforms/${performer.platform_slug}`} className="platform-link">
              {performer.platform_logo && (
                <img src={performer.platform_logo} alt={performer.platform_name} />
              )}
              <span>{performer.platform_name}</span>
            </Link>
          </div>
        </div>

        {/* Content Gallery */}
        {content.length > 0 && (
          <div className="performer-content">
            <h2>Content</h2>
            <div className="content-grid">
              {content.map(item => (
                <div key={item.id} className="content-item">
                  <img
                    src={item.thumbnail_url || '/placeholder-content.jpg'}
                    alt={item.title || 'Content'}
                    loading="lazy"
                  />
                  {item.content_type === 'video' && item.duration_seconds && (
                    <span className="duration">{formatDuration(item.duration_seconds)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatCount(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default PerformerPage;
