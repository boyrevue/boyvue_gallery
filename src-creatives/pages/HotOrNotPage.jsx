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
  const [activeTheme, setActiveTheme] = useState('untagged');
  const [onlineFilter, setOnlineFilter] = useState('all'); // 'all', 'online', 'offline'
  const [editingThemeId, setEditingThemeId] = useState(null);

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

  const updateThemeIcon = async (themeId, newIcon) => {
    try {
      const res = await fetch(`${API}/favorites/themes/${themeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ icon: newIcon })
      });

      if (res.ok) {
        setThemes(prev => prev.map(t =>
          t.id === themeId ? { ...t, icon: newIcon } : t
        ));
      }
    } catch (err) {
      console.error('Error updating theme:', err);
    }
    setEditingThemeId(null);
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

    // Find the favorite being moved to get old theme
    const favorite = favorites.find(f => f.performer_id.toString() === performerId);
    const oldThemeId = favorite?.user_theme_id;

    // Don't do anything if dropping on same theme
    if (oldThemeId === themeId) return;

    try {
      const res = await fetch(`${API}/favorites/${performerId}/custom-theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userThemeId: themeId })
      });

      if (!res.ok) return;

      // Update local state - performer moves to new theme
      setFavorites(prev => prev.map(f =>
        f.performer_id.toString() === performerId
          ? { ...f, user_theme_id: themeId }
          : f
      ));

      // Update theme counts (decrement old, increment new)
      setThemes(prev => prev.map(th => {
        if (th.id === themeId) {
          return { ...th, count: (parseInt(th.count) || 0) + 1 };
        }
        if (th.id === oldThemeId) {
          return { ...th, count: Math.max(0, (parseInt(th.count) || 0) - 1) };
        }
        return th;
      }));
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

  const applyOnlineFilter = (list) => {
    if (onlineFilter === 'online') return list.filter(f => f.is_online);
    if (onlineFilter === 'offline') return list.filter(f => !f.is_online);
    return list;
  };

  const getFilteredFavorites = () => {
    let list = activeTheme === 'untagged'
      ? getUntaggedFavorites()
      : getThemeFavorites(activeTheme);
    return applyOnlineFilter(list);
  };

  const handleDeleteFavorite = async (e, performerId) => {
    e.stopPropagation(); // Prevent drag
    if (!confirm('Remove from favourites?')) return;

    try {
      const res = await fetch(`${API}/favorites/${performerId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setFavorites(prev => prev.filter(f => f.performer_id !== performerId));
      }
    } catch (err) {
      console.error('Error deleting favorite:', err);
    }
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
          <div className="faves-title">
            <h1>❤️ {t('nav.favourites')}</h1>
            <p>{favorites.length} performers saved</p>
          </div>
          <div className="online-filter">
            <button
              className={`filter-btn ${onlineFilter === 'all' ? 'active' : ''}`}
              onClick={() => setOnlineFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-btn ${onlineFilter === 'online' ? 'active' : ''}`}
              onClick={() => setOnlineFilter('online')}
            >
              🟢 Online
            </button>
            <button
              className={`filter-btn ${onlineFilter === 'offline' ? 'active' : ''}`}
              onClick={() => setOnlineFilter('offline')}
            >
              ⚫ Offline
            </button>
          </div>
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
                className={`theme-item ${activeTheme === 'untagged' ? 'active' : ''} ${dragOverTheme === 'untagged' ? 'drag-over' : ''}`}
                onClick={() => setActiveTheme('untagged')}
              >
                <span className="theme-icon">🏷️</span>
                <span className="theme-name">Uncategorized</span>
                <span className="theme-count">{getUntaggedFavorites().length}</span>
              </button>

              {themes.map(theme => (
                <div
                  key={theme.id}
                  className={`theme-item ${activeTheme === theme.id ? 'active' : ''} ${dragOverTheme === theme.id ? 'drag-over' : ''}`}
                  onClick={() => setActiveTheme(theme.id)}
                  onDragOver={(e) => handleDragOver(e, theme.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, theme.id)}
                >
                  {editingThemeId === theme.id ? (
                    <div className="icon-picker-inline" onClick={e => e.stopPropagation()}>
                      {THEME_ICONS.map(icon => (
                        <button
                          key={icon}
                          type="button"
                          className="icon-btn-sm"
                          onClick={() => updateThemeIcon(theme.id, icon)}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span
                      className="theme-icon editable"
                      onClick={(e) => { e.stopPropagation(); setEditingThemeId(theme.id); }}
                      title="Click to change icon"
                    >
                      {theme.icon}
                    </span>
                  )}
                  <span className="theme-name">{theme.name}</span>
                  <span className="theme-count">{theme.count || 0}</span>
                </div>
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
                {getFilteredFavorites().map(fav => (
                  <div
                    key={fav.id}
                    className="fave-card"
                    draggable
                    onDragStart={(e) => handleDragStart(e, fav)}
                  >
                    <button
                      className="delete-fav-btn"
                      onClick={(e) => handleDeleteFavorite(e, fav.performer_id)}
                      title="Remove from favourites"
                    >
                      ✕
                    </button>
                    <img src={fav.avatar_url} alt={fav.display_name} />
                    <div className="fave-info">
                      <h4>{fav.display_name}</h4>
                    </div>
                    <span className="drag-hint">Drag to theme · ✕ to remove</span>
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
