import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import StudioCard from '../components/StudioCard';

function StudiosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [studios, setStudios] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'order';
  const search = searchParams.get('search') || '';

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchStudios();
  }, [category, sort, search]);

  async function fetchCategories() {
    try {
      const res = await fetch('/api/videos/categories');
      const data = await res.json();
      if (data.success) setCategories(data.categories);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }

  async function fetchStudios() {
    setLoading(true);
    try {
      let url = '/api/videos/studios?limit=50';
      if (category) url += `&category=${category}`;
      if (sort) url += `&sort=${sort}`;

      if (search) {
        url = `/api/videos/search?q=${encodeURIComponent(search)}&limit=50`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setStudios(search ? data.results : data.studios);
        setTotal(search ? data.results.length : data.total);
      }
    } catch (err) {
      console.error('Error fetching studios:', err);
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
    if (key !== 'search') params.delete('search');
    setSearchParams(params);
  }

  return (
    <div className="studios-page">
      <div className="container">
        <div className="page-header">
          <h1>{search ? `Search: "${search}"` : 'All Studios'}</h1>
          <p className="page-subtitle">
            {total} {total === 1 ? 'studio' : 'studios'} {category ? `in ${category}` : 'available'}
          </p>
        </div>

        <div className="filters">
          <div className="filter-group">
            <label>Category:</label>
            <select
              value={category}
              onChange={(e) => updateFilter('category', e.target.value)}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Sort by:</label>
            <select
              value={sort}
              onChange={(e) => updateFilter('sort', e.target.value)}
              className="filter-select"
            >
              <option value="order">Featured First</option>
              <option value="name">Name A-Z</option>
              <option value="rating">Highest Rated</option>
              <option value="price">Lowest Price</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          {search && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => updateFilter('search', '')}
            >
              Clear Search
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading">Loading studios...</div>
        ) : studios.length === 0 ? (
          <div className="no-results">
            <p>No studios found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="studios-grid">
            {studios.map(studio => (
              <StudioCard key={studio.id} studio={studio} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StudiosPage;
