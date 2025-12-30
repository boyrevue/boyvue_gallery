import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function ThemesPage() {
  const { t } = useTranslation();
  const { auth } = useOutletContext();
  const [userThemes, setUserThemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth?.isAuthenticated) {
      fetchUserThemes();
    } else {
      setLoading(false);
    }
  }, [auth?.isAuthenticated]);

  async function fetchUserThemes() {
    try {
      const res = await fetch('/api/favorites/themes', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setUserThemes(data.customThemes || []);
      }
    } catch (err) {
      console.error('Error fetching themes:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">{t('performers.loading')}</div>;
  }

  if (!auth?.isAuthenticated) {
    return (
      <div className="themes-page">
        <div className="container">
          <div className="page-header">
            <h1>{t('nav.themes')}</h1>
            <p className="page-subtitle">Your personal collections</p>
          </div>
          <div className="empty-state">
            <span className="empty-icon">🏷️</span>
            <h3>Sign in to create themes</h3>
            <p>Create custom themes to organize your favourite performers</p>
            <button onClick={auth?.openLogin} className="btn btn-primary">
              {t('nav.signIn')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="themes-page">
      <div className="container">
        <div className="page-header">
          <h1>{t('nav.themes')}</h1>
          <p className="page-subtitle">Your personal collections</p>
        </div>

        {userThemes.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🏷️</span>
            <h3>No themes yet</h3>
            <p>Go to <Link to="/my-faves">Favourites</Link> and classify performers to create themes</p>
          </div>
        ) : (
          <div className="user-themes-grid">
            {userThemes.map(theme => (
              <Link 
                key={theme.id} 
                to={`/themes/${theme.id}`}
                className="user-theme-card"
              >
                <span className="theme-icon">{theme.icon || '🏷️'}</span>
                <div className="theme-info">
                  <h3>{theme.name}</h3>
                  <span className="theme-count">{theme.count || 0} performers</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="themes-cta">
          <p>Add more performers to your themes</p>
          <Link to="/my-faves" className="btn btn-primary">
            ❤️ Go to Favourites
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ThemesPage;
