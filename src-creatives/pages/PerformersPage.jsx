import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PerformerCard from '../components/PerformerCard';

function PerformersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [performers, setPerformers] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const platform = searchParams.get('platform') || '';
  const sort = searchParams.get('sort') || 'priority';
  const online = searchParams.get('online') || '';
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 24;

  useEffect(() => {
    fetchPlatforms();
  }, []);

  useEffect(() => {
    fetchPerformers();
  }, [platform, sort, online, search, page]);

  async function fetchPlatforms() {
    try {
      const res = await fetch('/api/creatives/platforms');
      const data = await res.json();
      if (data.success) setPlatforms(data.platforms);
    } catch (err) {
      console.error('Error fetching platforms:', err);
    }
  }

  async function fetchPerformers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit,
        offset: (page - 1) * limit,
        sort
      });
      if (platform) params.append('platform', platform);
      if (online) params.append('online', online);
      if (search) params.append('search', search);

      const res = await fetch(`/api/creatives/performers?${params}`);
      const data = await res.json();

      if (data.success) {
        setPerformers(data.performers);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Error fetching performers:', err);
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(key, value) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    setSearchParams(params);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="performers-page">
      <div className="container">
        <div className="page-header">
          <h1>Browse Creatives</h1>
          <p>{total} performers from {platforms.length} platforms</p>
        </div>

        {/* Filters */}
        <div className="filters">
          <div className="filter-group">
            <label>Platform</label>
            <select value={platform} onChange={e => updateFilter('platform', e.target.value)}>
              <option value="">All Platforms</option>
              {platforms.map(p => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Sort By</label>
            <select value={sort} onChange={e => updateFilter('sort', e.target.value)}>
              <option value="priority">Featured</option>
              <option value="popular">Most Popular</option>
              <option value="newest">Newest</option>
              <option value="online">Online First</option>
            </select>
          </div>

          <div className="filter-group">
            <label>
              <input
                type="checkbox"
                checked={online === 'true'}
                onChange={e => updateFilter('online', e.target.checked ? 'true' : '')}
              />
              Online Now
            </label>
          </div>

          <div className="filter-group search">
            <input
              type="search"
              placeholder="Search performers..."
              value={search}
              onChange={e => updateFilter('search', e.target.value)}
            />
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="loading">Loading performers...</div>
        ) : performers.length === 0 ? (
          <div className="no-results">No performers found matching your criteria.</div>
        ) : (
          <>
            <div className="performers-grid">
              {performers.map(performer => (
                <PerformerCard key={performer.id} performer={performer} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  disabled={page <= 1}
                  onClick={() => updateFilter('page', String(page - 1))}
                >
                  Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => updateFilter('page', String(page + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default PerformersPage;
