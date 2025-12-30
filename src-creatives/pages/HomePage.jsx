import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PerformerCard from '../components/PerformerCard';

function HomePage() {
  const { t } = useTranslation();
  const { auth } = useOutletContext();
  const [sections, setSections] = useState([]);
  const [stats, setStats] = useState({});
  const [userThemeCount, setUserThemeCount] = useState(0);
  const [favesCount, setFavesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (auth?.isAuthenticated) {
      fetchUserData();
    }
  }, [auth?.isAuthenticated]);

  async function fetchData() {
    try {
      const [sectionsRes, statsRes] = await Promise.all([
        fetch('/api/creatives/sections'),
        fetch('/api/creatives/stats')
      ]);

      const sectionsData = await sectionsRes.json();
      const statsData = await statsRes.json();

      if (sectionsData.success) {
        const filtered = sectionsData.sections.filter(s => s.slug !== 'browse-themes');
        setSections(filtered);
      }
      if (statsData.success) setStats(statsData.stats);
    } catch (err) {
      console.error('Error fetching homepage data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserData() {
    try {
      const [themesRes, favesRes] = await Promise.all([
        fetch('/api/favorites/themes', { credentials: 'include' }),
        fetch('/api/favorites?all=true', { credentials: 'include' })
      ]);
      
      const themesData = await themesRes.json();
      const favesData = await favesRes.json();
      
      if (themesData.success) setUserThemeCount(themesData.customThemes?.length || 0);
      if (favesData.success) setFavesCount(favesData.favorites?.length || 0);
    } catch (err) {}
  }

  if (loading) {
    return <div className="loading">{t('performers.loading')}</div>;
  }

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <h1>{t('home.title')}</h1>
          <p>{t('home.subtitle', { count: stats.total_performers || 0, platforms: stats.platforms || 0 })}</p>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">{stats.online_now || 0}</span>
              <span className="stat-label">{t('home.liveNow')}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{auth?.isAuthenticated ? userThemeCount : 0}</span>
              <span className="stat-label">{t('home.themes')}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{auth?.isAuthenticated ? favesCount : 0}</span>
              <span className="stat-label">Favourites</span>
            </div>
          </div>
          <div className="hero-actions">
            <Link to="/live" className="btn btn-primary btn-lg">{t('home.watchLive')}</Link>
            <Link to="/performers" className="btn btn-secondary btn-lg">{t('home.browseAll')}</Link>
          </div>
          
          <p className="drag-tip">💡 Drag performers to the ❤️ Favourites tab to save them</p>
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
              <Link to={section.slug === 'live-now' ? '/live' : '/performers'} className="btn btn-outline">
                {t('home.viewAll')}
              </Link>
            </div>
            <div className="performers-grid">
              {section.items.map(performer => (
                <PerformerCard key={performer.id} performer={performer} draggable />
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

export default HomePage;
