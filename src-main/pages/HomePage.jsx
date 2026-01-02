import React, { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

function HomePage() {
  const { auth } = useOutletContext();
  const [recentPosts, setRecentPosts] = useState([]);

  useEffect(() => {
    fetch('/api/blog/posts?limit=3')
      .then(r => r.json())
      .then(data => setRecentPosts(data.posts || []))
      .catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <h1>Welcome to <span>BoyVue</span></h1>
          <p>Your gateway to premium adult content. One account for all sites.</p>
          {!auth.isAuthenticated && (
            <button onClick={auth.openLogin} className="btn btn-primary" style={{ padding: '15px 40px', fontSize: '18px' }}>
              Get Started
            </button>
          )}
        </div>
      </section>

      <section className="container">
        <div className="sites">
          <a href="https://pics.boyvue.com" className="site-card">
            <div className="site-icon">📸</div>
            <h3>Pics</h3>
            <p>Browse thousands of high-quality photos and videos in our extensive gallery.</p>
            <span className="btn btn-primary">Visit Pics</span>
          </a>

          <a href="https://fans.boyvue.com" className="site-card">
            <div className="site-icon">⭐</div>
            <h3>Fans</h3>
            <p>Discover live performers, save favorites, and connect with creators.</p>
            <span className="btn btn-primary">Visit Fans</span>
          </a>

          <Link to="/blog" className="site-card">
            <div className="site-icon">📝</div>
            <h3>Blog</h3>
            <p>Read the latest news, updates, and articles from the BoyVue team.</p>
            <span className="btn btn-primary">Read Blog</span>
          </Link>
        </div>
      </section>

      {recentPosts.length > 0 && (
        <section className="section container">
          <h2 className="section-title">Latest from the Blog</h2>
          <div className="blog-grid">
            {recentPosts.map(post => (
              <Link to={`/blog/${post.slug}`} key={post.id} className="blog-card">
                {post.featured_image && (
                  <img src={post.featured_image} alt="" className="blog-image" />
                )}
                <div className="blog-content">
                  <div className="blog-meta">{new Date(post.published_at).toLocaleDateString()}</div>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default HomePage;
