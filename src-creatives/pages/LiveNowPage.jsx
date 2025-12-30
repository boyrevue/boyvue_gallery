import React, { useState, useEffect } from 'react';
import PerformerCard from '../components/PerformerCard';

function LiveNowPage() {
  const [performers, setPerformers] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [selectedPlatform]);

  async function fetchData() {
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (selectedPlatform) params.append('platform', selectedPlatform);

      const [liveRes, platformsRes] = await Promise.all([
        fetch(`/api/creatives/live?${params}`),
        fetch('/api/creatives/platforms')
      ]);

      const liveData = await liveRes.json();
      const platformsData = await platformsRes.json();

      if (liveData.success) setPerformers(liveData.live);
      if (platformsData.success) setPlatforms(platformsData.platforms);
    } catch (err) {
      console.error('Error fetching live data:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="live-page">
      <div className="container">
        <div className="page-header">
          <div className="live-indicator">
            <span className="pulse"></span>
            <h1>Live Now</h1>
          </div>
          <p>{performers.length} performers currently streaming</p>
        </div>

        {/* Platform Filter */}
        <div className="filters">
          <div className="filter-group">
            <label>Platform</label>
            <select
              value={selectedPlatform}
              onChange={e => setSelectedPlatform(e.target.value)}
            >
              <option value="">All Platforms</option>
              {platforms.map(p => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Performers Grid */}
        {loading ? (
          <div className="loading">Loading live performers...</div>
        ) : performers.length === 0 ? (
          <div className="no-results">
            No performers currently live. Check back soon!
          </div>
        ) : (
          <div className="performers-grid performers-grid-live">
            {performers.map(performer => (
              <PerformerCard key={performer.id} performer={performer} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveNowPage;
