import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PerformerCard from '../components/PerformerCard';

const API = '/api';

function HomePage() {
  const { t } = useTranslation();
  const { auth } = useOutletContext();
  const [sections, setSections] = useState([]);
  const [stats, setStats] = useState({});
  const [userThemeCount, setUserThemeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [recentFaves, setRecentFaves] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (auth?.isAuthenticated) {
      fetchUserThemes();
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

  async function fetchUserThemes() {
    try {
      const res = await fetch(`${API}/favorites/themes`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setUserThemeCount(data.customThemes?.length || 0);
      }
    } catch (err) {}
  }

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    
    if (!auth?.isAuthenticated) {
      auth.openLogin();
      return;
    }

    const performerId = e.dataTransfer.getData('performerId');
    const performerData = e.dataTransfer.getData('performerData');
    
    if (performerId) {
      try {
        const res = await fetch(`${API}/favorites/${performerId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ isHot: true })
        });
        
        if (res.ok && performerData) {
          const performer = JSON.parse(performerData);
          setRecentFaves(prev => [performer, ...prev.slice(0, 4)]);
        }
      } catch (err) {
        console.error('Error adding favorite:', err);
      }
    }
  };

  if (loading) {
    return <div className="loading">{t('performers.loading')}</div>;
  }

  return (
    <div className="home-page">
      {/* Favorites Drop Zone */}
      <div 
        className={`faves-drop-zone ${dragOver ? 'drag-over' : ''} ${recentFaves.length > 0 ? 'has-faves' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="drop-zone-content">
          <span className="drop-icon">❤️</span>
          <span className="drop-text">{t('home.dragToFave')}</span>
        </div>
        {recentFaves.length > 0 && (
          <div className="recent-faves">
            {recentFaves.map(p => (
              <img key={p.id} src={p.avatar_url} alt={p.display_name} className="recent-fave-thumb" />
            ))}
          </div>
        )}
      </div>

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
              <span className="stat-value">{recentFaves.length}</span>
              <span className="stat-label">Favourites</span>
            </div>
          </div>
          <div className="hero-actions">
            <Link to="/live" className="btn btn-primary btn-lg">{t('home.watchLive')}</Link>
            <Link to="/performers" className="btn btn-secondary btn-lg">{t('home.browseAll')}</Link>
          </div>
        </div>
      </section>

      {/* Dynamic Sections (without themes) */}
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
