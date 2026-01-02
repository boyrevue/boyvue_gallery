import React from 'react';
import { Link } from 'react-router-dom';

function CategoryCard({ category }) {
  return (
    <Link to={`/categories/${category.slug}`} className="category-card">
      <div className="category-card-icon">
        {category.icon || category.name.charAt(0)}
      </div>
      <div className="category-card-content">
        <h3 className="category-card-title">{category.name}</h3>
        <span className="category-card-count">{category.studio_count} studios</span>
      </div>
    </Link>
  );
}

export default CategoryCard;
