import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StudioCard from '../components/StudioCard';
import CategoryCard from '../components/CategoryCard';

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
        fetch('/api/videos/sections'),
        fetch('/api/videos/stats')
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
          <h1>Find Your Perfect Gay Streaming Site</h1>
          <p className="hero-subtitle">
            Compare {stats.total_studios || 0} premium gay porn sites. Find the best content, pricing, and features for you.
          </p>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">{stats.total_studios || 0}</span>
              <span className="stat-label">Studios Reviewed</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.featured_studios || 0}</span>
              <span className="stat-label">Top Picks</span>
            </div>
            <div className="stat">
              <span className="stat-value">{stats.total_categories || 0}</span>
              <span className="stat-label">Categories</span>
            </div>
          </div>
          <div className="hero-actions">
            <Link to="/studios" className="btn btn-primary btn-lg">Browse All Studios</Link>
            <Link to="/categories" className="btn btn-secondary btn-lg">Browse by Category</Link>
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
              {section.slug !== 'by-category' && (
                <Link to="/studios" className="btn btn-outline">View All</Link>
              )}
            </div>

            {section.slug === 'by-category' ? (
              <div className="categories-grid">
                {section.items.map(category => (
                  <CategoryCard key={category.id} category={category} />
                ))}
              </div>
            ) : (
              <div className="studios-grid">
                {section.items.map(studio => (
                  <StudioCard key={studio.id} studio={studio} />
                ))}
              </div>
            )}
          </div>
        </section>
      ))}

      {/* Why Choose Section */}
      <section className="section why-choose">
        <div className="container">
          <h2>Why Use BoyVue Videos?</h2>
          <div className="features-grid">
            <div className="feature">
              <span className="feature-icon">🔍</span>
              <h3>Honest Reviews</h3>
              <p>Unbiased comparisons of features, content quality, and value for money.</p>
            </div>
            <div className="feature">
              <span className="feature-icon">💰</span>
              <h3>Best Deals</h3>
              <p>Find special offers, trial memberships, and discount codes.</p>
            </div>
            <div className="feature">
              <span className="feature-icon">🎯</span>
              <h3>Find Your Match</h3>
              <p>Browse by category to find exactly the type of content you enjoy.</p>
            </div>
            <div className="feature">
              <span className="feature-icon">⭐</span>
              <h3>Top Rated</h3>
              <p>See which studios have the best ratings and most satisfied members.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
