import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PerformerCard from '../components/PerformerCard';
import ThemeCard from '../components/ThemeCard';

function HomePage() {
  const [sections, setSections] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [sectionsRes, statsRes] = await Promise.all([
        fetch('/api/creatives/sections'),
        fetch('/api/creatives/stats')
      ]);

      const sectionsData = await sectionsRes.json();
      const statsData = await statsRes.json();

      if (sectionsData.success) setSections(sectionsData.sections);
      if (statsData.success) setStats(statsData.stats);
    } catch (err) {
      console.error('Error fetching homepage data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <h1>Premium Gay Creatives</h1>
          <p>Discover {stats.total_performers || 0}+ hand-picked performers from {stats.platforms || 0} platforms</p>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">{stats.online_now || 0}</span>
              <span className="stat-label">Live Now</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.themes || 0}</span>
              <span className="stat-label">Themes</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.galleries || 0}</span>
              <span className="stat-label">Galleries</span>
            </div>
          </div>
          <div className="hero-actions">
            <Link to="/live" className="btn btn-primary btn-lg">Watch Live</Link>
            <Link to="/performers" className="btn btn-secondary btn-lg">Browse All</Link>
          </div>
        </div>
      </section>

      {/* Dynamic Sections */}
      {sections.map(section => (
        <section key={section.id} className={`section section-${section.section_type}`}>
          <div className="container">
            <div className="section-header">
              <div>
                <h2>{section.title}</h2>
                {section.subtitle && <p className="section-subtitle">{section.subtitle}</p>}
              </div>
              {section.slug !== 'browse-themes' && (
                <Link to={section.slug === 'live-now' ? '/live' : '/performers'} className="btn btn-outline">
                  View All
                </Link>
              )}
            </div>

            {section.slug === 'browse-themes' ? (
              <div className="themes-grid">
                {section.items.map(theme => (
                  <ThemeCard key={theme.id} theme={theme} />
                ))}
              </div>
            ) : (
              <div className="performers-grid">
                {section.items.map(performer => (
                  <PerformerCard key={performer.id} performer={performer} />
                ))}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export default HomePage;
