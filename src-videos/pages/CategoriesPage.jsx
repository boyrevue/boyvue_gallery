import React, { useState, useEffect } from 'react';
import CategoryCard from '../components/CategoryCard';

function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const res = await fetch('/api/videos/categories');
      const data = await res.json();
      if (data.success) setCategories(data.categories);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="categories-page">
      <div className="container">
        <div className="page-header">
          <h1>Browse by Category</h1>
          <p className="page-subtitle">
            Find studios that specialize in your favorite type of content
          </p>
        </div>

        <div className="categories-grid categories-grid-large">
          {categories.map(category => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default CategoriesPage;
