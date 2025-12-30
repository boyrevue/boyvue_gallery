import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../styles/HotOrNot.css';

const API = '/api';
const THEME_ICONS = ['🔥','💪','🧑','🐻','🌶️','🌸','👑','👨','⚽','🎓','💕','🌈','⭐','💎','🎭','🎪','🏆','🎯','💫','🦁'];

function FavouritesPage() {
  const { t } = useTranslation();
  const { auth } = useOutletContext();
  const [favorites, setFavorites] = useState([]);
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTheme, setShowCreateTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeIcon, setNewThemeIcon] = useState('🏷️');
  const [dragOverTheme, setDragOverTheme] = useState(null);
  const [activeTheme, setActiveTheme] = useState(null);

  useEffect(() => {
    if (auth?.isAuthenticated) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [auth?.isAuthenticated]);

  const fetchData = async () => {
    try {
      const [favesRes, themesRes] = await Promise.all([
        fetch(`${API}/favorites?all=true`, { credentials: 'include' }),
        fetch(`${API}/favorites/themes`, { credentials: 'include' })
      ]);
      
      const favesData = await favesRes.json();
      const themesData = await themesRes.json();
      
      if (favesData.success) setFavorites(favesData.favorites || []);
      if (themesData.success) setThemes(themesData.customThemes || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createTheme = async (e) => {
    e.preventDefault();
    if (!newThemeName.trim()) return;
    
    try {
      const res = await fetch(`${API}/favorites/themes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newThemeName, icon: newThemeIcon })
      });
      
      const data = await res.json();
      if (data.success) {
        setThemes(prev => [...prev, data.theme]);
        setNewThemeName('');
        setNewThemeIcon('🏷️');
        setShowCreateTheme(false);
      }
    } catch (err) {
      console.error('Error creating theme:', err);
    }
  };

  const handleDragStart = (e, favorite) => {
    e.dataTransfer.setData('favoriteId', favorite.id.toString());
    e.dataTransfer.setData('performerId', favorite.performer_id.toString());
  };

  const handleDragOver = (e, themeId) => {
    e.preventDefault();
    setDragOverTheme(themeId);
  };

  const handleDragLeave = () => {
    setDragOverTheme(null);
  };

  const handleDrop = async (e, themeId) => {
    e.preventDefault();
    setDragOverTheme(null);
    
    const performerId = e.dataTransfer.getData('performerId');
    if (!performerId) return;
    
    try {
      await fetch(`${API}/favorites/${performerId}/custom-theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userThemeId: themeId })
      });
      
      // Update local state
      setFavorites(prev => prev.map(f => 
        f.performer_id.toString() === performerId 
          ? { ...f, user_theme_id: themeId }
          : f
      ));
      
      // Update theme count
      setThemes(prev => prev.map(th => 
        th.id === themeId 
          ? { ...th, count: (parseInt(th.count) || 0) + 1 }
          : th
      ));
    } catch (err) {
      console.error('Error assigning theme:', err);
    }
  };

  const getThemeFavorites = (themeId) => {
    return favorites.filter(f => f.user_theme_id === themeId);
  };

  const getUntaggedFavorites = () => {
    return favorites.filter(f => !f.user_theme_id);
  };

  if (!auth?.isAuthenticated) {
    return (
      <div className="faves-page">
        <div className="container">
          <div className="empty-state">
            <span className="empty-icon">❤️</span>
            <h3>{t('faves.signInRequired')}</h3>
            <p>Sign in to save and organize your favourites</p>
            <button onClick={auth?.openLogin} className="btn btn-primary">
              {t('nav.signIn')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="loading">{t('performers.loading')}</div>;
  }

  return (
    <div className="faves-page">
      <div className="container">
        <div className="faves-header">
          <h1>❤️ {t('nav.favourites')}</h1>
          <p>{favorites.length} performers saved</p>
        </div>

        {/* Themes Sidebar */}
        <div className="faves-layout">
          <div className="themes-sidebar">
            <div className="sidebar-header">
              <h3>Your Themes</h3>
              <button 
                className="btn-add-theme"
                onClick={() => setShowCreateTheme(!showCreateTheme)}
              >
                +
              </button>
            </div>

            {showCreateTheme && (
              <form onSubmit={createTheme} className="create-theme-form">
                <div className="icon-picker">
                  {THEME_ICONS.slice(0, 10).map(icon => (
                    <button
                      key={icon}
                      type="button"
                      className={`icon-btn ${newThemeIcon === icon ? 'active' : ''}`}
                      onClick={() => setNewThemeIcon(icon)}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={newThemeName}
                  onChange={e => setNewThemeName(e.target.value)}
                  placeholder="Theme name..."
                  className="theme-input"
                />
                <button type="submit" className="btn btn-primary btn-sm">Create</button>
              </form>
            )}

            <div className="themes-list">
              <button
                className={`theme-item ${activeTheme === null ? 'active' : ''}`}
                onClick={() => setActiveTheme(null)}
              >
                <span className="theme-icon">📋</span>
                <span className="theme-name">All Favourites</span>
                <span className="theme-count">{favorites.length}</span>
              </button>

              <button
                className={`theme-item ${activeTheme === 'untagged' ? 'active' : ''} ${dragOverTheme === 'untagged' ? 'drag-over' : ''}`}
                onClick={() => setActiveTheme('untagged')}
              >
                <span className="theme-icon">🏷️</span>
                <span className="theme-name">Uncategorized</span>
                <span className="theme-count">{getUntaggedFavorites().length}</span>
              </button>

              {themes.map(theme => (
                <button
                  key={theme.id}
                  className={`theme-item ${activeTheme === theme.id ? 'active' : ''} ${dragOverTheme === theme.id ? 'drag-over' : ''}`}
                  onClick={() => setActiveTheme(theme.id)}
                  onDragOver={(e) => handleDragOver(e, theme.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, theme.id)}
                >
                  <span className="theme-icon">{theme.icon}</span>
                  <span className="theme-name">{theme.name}</span>
                  <span className="theme-count">{theme.count || 0}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Favorites Grid */}
          <div className="faves-content">
            {favorites.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🔍</span>
                <h3>No favourites yet</h3>
                <p>Drag performers from the homepage to add them here</p>
              </div>
            ) : (
              <div className="faves-grid">
                {(activeTheme === null 
                  ? favorites 
                  : activeTheme === 'untagged'
                    ? getUntaggedFavorites()
                    : getThemeFavorites(activeTheme)
                ).map(fav => (
                  <div
                    key={fav.id}
                    className="fave-card"
                    draggable
                    onDragStart={(e) => handleDragStart(e, fav)}
                  >
                    <img src={fav.avatar_url} alt={fav.display_name} />
                    <div className="fave-info">
                      <h4>{fav.display_name}</h4>
                      {fav.is_online && <span className="live-badge">LIVE</span>}
                    </div>
                    <span className="drag-hint">Drag to theme</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FavouritesPage;
