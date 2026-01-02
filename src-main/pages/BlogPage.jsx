import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/blog/posts')
      .then(r => r.json())
      .then(data => {
        setPosts(data.posts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container section" style={{ textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container section">
      <h1 className="section-title">Blog</h1>

      {posts.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          No blog posts yet. Check back soon!
        </p>
      ) : (
        <div className="blog-grid">
          {posts.map(post => (
            <Link to={`/blog/${post.slug}`} key={post.id} className="blog-card">
              {post.featured_image ? (
                <img src={post.featured_image} alt="" className="blog-image" />
              ) : (
                <div className="blog-image" style={{ background: 'linear-gradient(145deg, var(--primary), #c50)' }} />
              )}
              <div className="blog-content">
                <div className="blog-meta">
                  {new Date(post.published_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default BlogPage;
