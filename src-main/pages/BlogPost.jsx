import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/blog/posts/${slug}`)
      .then(r => {
        if (!r.ok) throw new Error('Post not found');
        return r.json();
      })
      .then(data => {
        setPost(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="blog-post" style={{ textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="blog-post" style={{ textAlign: 'center' }}>
        <h1>Post Not Found</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          The blog post you're looking for doesn't exist.
        </p>
        <Link to="/blog" className="btn btn-primary" style={{ marginTop: '20px', display: 'inline-block' }}>
          Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <article className="blog-post">
      <Link to="/blog" style={{ display: 'block', marginBottom: '20px', fontSize: '14px' }}>
        &larr; Back to Blog
      </Link>

      <h1>{post.title}</h1>

      <div className="meta">
        {new Date(post.published_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
        {post.author_name && ` • By ${post.author_name}`}
      </div>

      {post.featured_image && (
        <img
          src={post.featured_image}
          alt=""
          style={{
            width: '100%',
            borderRadius: '12px',
            marginBottom: '30px',
            maxHeight: '400px',
            objectFit: 'cover'
          }}
        />
      )}

      <div
        className="content"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </article>
  );
}

export default BlogPost;
