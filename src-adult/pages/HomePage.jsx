import React from 'react';

export default function HomePage() {
  return (
    <div className="home-page">
      <h1>BoyVue Adult</h1>
      <p>Premium adult content and exclusive videos.</p>
      <div className="sections">
        <a href="/pics/" className="section-card">
          <h2>Pics</h2>
          <p>Photo & Video Gallery</p>
        </a>
        <a href="/videos/" className="section-card">
          <h2>Videos</h2>
          <p>Free Videos</p>
        </a>
        <a href="/fans/" className="section-card">
          <h2>Fans</h2>
          <p>Live Performers</p>
        </a>
      </div>
    </div>
  );
}
