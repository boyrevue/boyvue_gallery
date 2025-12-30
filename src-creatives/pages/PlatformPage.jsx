import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PerformerCard from '../components/PerformerCard';

function PlatformPage() {
  const { slug } = useParams();
  const [platform, setPlatform] = useState(null);
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [slug]);

  async function fetchData() {
    try {
      const [platformRes, performersRes] = await Promise.all([
        fetch(`/api/creatives/platforms/${slug}`),
        fetch(`/api/creatives/performers?platform=${slug}&limit=50`)
      ]);

      const platformData = await platformRes.json();
      const performersData = await performersRes.json();

      if (platformData.success) setPlatform(platformData.platform);
      if (performersData.success) setPerformers(performersData.performers);
    } catch (err) {
      console.error('Error fetching platform:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (!platform) return <div className="not-found">Platform not found</div>;

  return (
    <div className="platform-page">
      <div className="container">
        <div className="page-header">
          {platform.logo_url && (
            <img src={platform.logo_url} alt={platform.name} className="platform-logo-large" />
          )}
          <h1>{platform.name}</h1>
          <p>{platform.performer_count} performers on this platform</p>
          {platform.online_count > 0 && (
            <span className="online-badge">{platform.online_count} currently live</span>
          )}
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

export default PlatformPage;
