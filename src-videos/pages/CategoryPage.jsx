import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import StudioCard from '../components/StudioCard';

function CategoryPage() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [studios, setStudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCategory();
  }, [slug]);

  async function fetchCategory() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/categories/${slug}`);
      const data = await res.json();

      if (data.success) {
        setCategory(data.category);
        setStudios(data.studios);
      } else {
        setError(data.error || 'Category not found');
      }
    } catch (err) {
      setError('Failed to load category');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error || !category) {
    return (
      <div className="error-page">
        <div className="container">
          <h1>Category Not Found</h1>
          <p>{error}</p>
          <Link to="/categories" className="btn btn-primary">Browse All Categories</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="category-page">
      <div className="container">
        {/* Breadcrumb */}
        <nav className="breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/categories">Categories</Link>
          <span>/</span>
          <span>{category.name}</span>
        </nav>

        {/* Category Header */}
        <div className="category-header">
          <div className="category-icon-large">{category.icon}</div>
          <div className="category-info">
            <h1>{category.name} Studios</h1>
            {category.description && <p className="category-description">{category.description}</p>}
            <span className="studio-count">{studios.length} studios</span>
          </div>
        </div>

        {/* Studios Grid */}
        {studios.length === 0 ? (
          <div className="no-results">
            <p>No studios found in this category yet.</p>
            <Link to="/studios" className="btn btn-primary">Browse All Studios</Link>
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

export default CategoryPage;
