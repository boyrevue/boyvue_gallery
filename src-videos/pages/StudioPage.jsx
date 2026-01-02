import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import StudioCard from '../components/StudioCard';

function StudioPage() {
  const { slug } = useParams();
  const [studio, setStudio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStudio();
  }, [slug]);

  async function fetchStudio() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/studios/${slug}`);
      const data = await res.json();

      if (data.success) {
        setStudio(data.studio);
      } else {
        setError(data.error || 'Studio not found');
      }
    } catch (err) {
      setError('Failed to load studio');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error || !studio) {
    return (
      <div className="error-page">
        <div className="container">
          <h1>Studio Not Found</h1>
          <p>{error}</p>
          <Link to="/studios" className="btn btn-primary">Browse All Studios</Link>
        </div>
      </div>
    );
  }

  const mainLink = studio.affiliate_links?.find(l => l.link_type === 'main');
  const affiliateUrl = mainLink ? `/api/videos/go/${mainLink.short_code}` : studio.website_url;

  return (
    <div className="studio-page">
      <div className="container">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/studios">Studios</Link>
          <span>/</span>
          <span>{studio.name}</span>
        </nav>

        {/* Studio Header */}
        <div className="studio-header">
          <div className="studio-header-content">
            <div className="studio-logo-large">
              {studio.logo_url ? (
                <img src={studio.logo_url} alt={studio.name} />
              ) : (
                <div className="studio-logo-placeholder">{studio.name.charAt(0)}</div>
              )}
            </div>

            <div className="studio-info">
              <h1>{studio.name}</h1>
              {studio.tagline && <p className="studio-tagline">{studio.tagline}</p>}

              {studio.rating && (
                <div className="studio-rating-large">
                  <span className="stars">
                    {'★'.repeat(Math.round(studio.rating))}{'☆'.repeat(5 - Math.round(studio.rating))}
                  </span>
                  <span className="rating-value">{studio.rating.toFixed(1)} / 5</span>
                </div>
              )}

              {studio.category_details && (
                <div className="studio-categories">
                  {studio.category_details.map(cat => (
                    <Link key={cat.id} to={`/categories/${cat.slug}`} className="category-tag">
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="studio-cta">
              <div className="pricing-box">
                {studio.trial_price && (
                  <div className="trial-offer">
                    <span className="trial-price">${studio.trial_price}</span>
                    <span className="trial-label">{studio.trial_days || 7} Day Trial</span>
                  </div>
                )}
                <div className="regular-price">
                  {studio.monthly_price && (
                    <span>${studio.monthly_price}/month</span>
                  )}
                  {studio.yearly_price && (
                    <span className="yearly">${studio.yearly_price}/year</span>
                  )}
                </div>
              </div>
              <a
                href={affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-lg btn-block"
              >
                Visit {studio.name}
              </a>
            </div>
          </div>
        </div>

        {/* Studio Details */}
        <div className="studio-details">
          <div className="studio-main">
            {studio.description && (
              <section className="studio-section">
                <h2>About {studio.name}</h2>
                <p>{studio.description}</p>
              </section>
            )}

            {studio.features && studio.features.length > 0 && (
              <section className="studio-section">
                <h2>Features</h2>
                <div className="features-list">
                  {studio.features.map((feature, i) => (
                    <div key={i} className="feature-item">
                      <span className="feature-check">✓</span>
                      {feature}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="studio-section">
              <h2>Content Info</h2>
              <div className="info-grid">
                {studio.video_quality && (
                  <div className="info-item">
                    <span className="info-label">Video Quality</span>
                    <span className="info-value">{studio.video_quality}</span>
                  </div>
                )}
                {studio.video_count && (
                  <div className="info-item">
                    <span className="info-label">Videos</span>
                    <span className="info-value">{studio.video_count.toLocaleString()}+</span>
                  </div>
                )}
                {studio.model_count && (
                  <div className="info-item">
                    <span className="info-label">Models</span>
                    <span className="info-value">{studio.model_count.toLocaleString()}+</span>
                  </div>
                )}
                {studio.update_frequency && (
                  <div className="info-item">
                    <span className="info-label">Updates</span>
                    <span className="info-value">{studio.update_frequency}</span>
                  </div>
                )}
                <div className="info-item">
                  <span className="info-label">Downloads</span>
                  <span className="info-value">{studio.downloadable ? 'Yes' : 'Streaming Only'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Exclusive</span>
                  <span className="info-value">{studio.exclusive_content ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </section>
          </div>

          <aside className="studio-sidebar">
            <div className="sidebar-box">
              <h3>Quick Facts</h3>
              <ul className="facts-list">
                {studio.video_quality && <li><strong>Quality:</strong> {studio.video_quality}</li>}
                {studio.content_type && <li><strong>Type:</strong> {studio.content_type}</li>}
                {studio.commission_rate && <li><strong>Commission:</strong> {studio.commission_rate}%</li>}
              </ul>
            </div>

            {studio.specialties && studio.specialties.length > 0 && (
              <div className="sidebar-box">
                <h3>Specialties</h3>
                <div className="specialty-tags">
                  {studio.specialties.map((specialty, i) => (
                    <span key={i} className="specialty-tag">{specialty}</span>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Related Studios */}
        {studio.related_studios && studio.related_studios.length > 0 && (
          <section className="related-studios">
            <h2>Similar Studios</h2>
            <div className="studios-grid">
              {studio.related_studios.map(related => (
                <StudioCard key={related.id} studio={related} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default StudioPage;
