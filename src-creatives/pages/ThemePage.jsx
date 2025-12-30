import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PerformerCard from '../components/PerformerCard';

function ThemePage() {
  const { slug } = useParams();
  const [theme, setTheme] = useState(null);
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTheme();
  }, [slug]);

  async function fetchTheme() {
    try {
      const res = await fetch(`/api/creatives/themes/${slug}`);
      const data = await res.json();
      if (data.success) {
        setTheme(data.theme);
        setPerformers(data.performers);
      }
    } catch (err) {
      console.error('Error fetching theme:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (!theme) return <div className="not-found">Theme not found</div>;

  return (
    <div className="theme-page">
      <div className="container">
        <div className="page-header" style={{ '--theme-color': theme.color || '#f60' }}>
          <div className="theme-icon-large">{theme.icon || '📁'}</div>
          <h1>{theme.name}</h1>
          {theme.description && <p>{theme.description}</p>}
          <span className="performer-count">{theme.performer_count || performers.length} performers</span>
        </div>

        <div className="performers-grid">
          {performers.map(performer => (
            <PerformerCard key={performer.id} performer={performer} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ThemePage;
