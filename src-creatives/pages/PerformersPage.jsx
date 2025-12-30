import React, { useState, useEffect } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PerformerCard from '../components/PerformerCard';

function PerformersPage() {
  const { t } = useTranslation();
  const { auth } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [performers, setPerformers] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const platform = searchParams.get('platform') || '';
  const sort = searchParams.get('sort') || 'popular';
  const online = searchParams.get('online') || '';
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 24;

  useEffect(() => {
    fetchPerformers();
    fetchPlatforms();
  }, [platform, sort, online, search, page]);

  async function fetchPerformers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit,
        offset: (page - 1) * limit,
        ...(platform && { platform }),
        ...(sort && { sort }),
        ...(online && { online: 'true' }),
        ...(search && { search })
      });

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

  async function fetchPlatforms() {
    try {
      const res = await fetch('/api/creatives/platforms');
      const data = await res.json();
      if (data.success) setPlatforms(data.platforms);
    } catch (err) {}
  }

  function updateFilter(key, value) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== 'page') {
      params.set('page', '1');
    }
    setSearchParams(params);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="performers-page">
      <div className="container">
        <div className="page-header">
          <h1>{t('performers.title')}</h1>

          <div className="filters">
            <select value={platform} onChange={e => updateFilter('platform', e.target.value)}>
              <option value="">{t('performers.allPlatforms')}</option>
              {platforms.map(p => (
                <option key={p.id} value={p.slug}>{p.name}</option>
              ))}
            </select>

            <select value={sort} onChange={e => updateFilter('sort', e.target.value)}>
              <option value="popular">{t('performers.popular')}</option>
              <option value="newest">{t('performers.newest')}</option>
              <option value="followers">{t('performers.mostFollowers')}</option>
            </select>

            <label className="online-filter">
              <input
                type="checkbox"
                checked={online === 'true'}
                onChange={e => updateFilter('online', e.target.checked ? 'true' : '')}
              />
              {t('performers.onlineOnly')}
            </label>

            <input
              type="text"
              placeholder={t('performers.search')}
              value={search}
              onChange={e => updateFilter('search', e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {loading ? (
          <div className="loading">{t('performers.loading')}</div>
        ) : (
          <>
            <p className="drag-tip">💡 Drag any performer to the ❤️ bar above to add to favourites</p>
            <div className="performers-grid">
              {performers.map(performer => (
                <PerformerCard key={performer.id} performer={performer} draggable />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  disabled={page <= 1}
                  onClick={() => updateFilter('page', String(page - 1))}
                >
                  {t('performers.previous')}
                </button>
                <span>{t('performers.page')} {page} {t('performers.of')} {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => updateFilter('page', String(page + 1))}
                >
                  {t('performers.next')}
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
