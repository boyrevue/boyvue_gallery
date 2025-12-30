import React, { useState, useEffect } from 'react';
import ThemeCard from '../components/ThemeCard';

function ThemesPage() {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThemes();
  }, []);

  async function fetchThemes() {
    try {
      const res = await fetch('/api/creatives/themes');
      const data = await res.json();
      if (data.success) setThemes(data.themes);
    } catch (err) {
      console.error('Error fetching themes:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading">Loading themes...</div>;

  return (
    <div className="themes-page">
      <div className="container">
        <div className="page-header">
          <h1>Browse by Theme</h1>
          <p>Explore our curated collections of performers</p>
        </div>

        <div className="themes-grid themes-grid-large">
          {themes.map(theme => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ThemesPage;
