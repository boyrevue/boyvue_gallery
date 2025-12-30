import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ThemeCard from '../components/ThemeCard';

function ThemesPage() {
  const { t } = useTranslation();
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/creatives/themes')
      .then(res => res.json())
      .then(data => {
        if (data.success) setThemes(data.themes);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading">{t('performers.loading')}</div>;
  }

  return (
    <div className="themes-page">
      <div className="container">
        <div className="page-header">
          <h1>{t('nav.themes')}</h1>
          <p className="page-subtitle">Explore our curated collections</p>
        </div>

        <div className="themes-grid">
          {themes.map(theme => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ThemesPage;
