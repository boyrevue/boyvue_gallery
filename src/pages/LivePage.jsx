/**
 * LivePage Component
 * Live streaming integration page
 * Platform configurations from streaming-platforms.ttl
 */

import React, { useState } from 'react';
import { useI18n } from '../hooks/useI18n.js';
import { useSEO } from '../hooks/useSEO.js';
import { 
  useStreaming, 
  StreamingEmbed, 
  StreamingLink, 
  PlatformBadge 
} from '../hooks/useStreaming.js';

export function LivePage({ navigate }) {
  const { t } = useI18n();
  const { 
    platforms, 
    embeddablePlatforms, 
    loading,
    getPlatform,
    getBrandColor 
  } = useStreaming();
  
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [featuredUsername, setFeaturedUsername] = useState('');
  
  useSEO('live', {
    title: t('live.title'),
    description: t('live.description')
  });

  if (loading) {
    return (
      <div className="live-page live-page--loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="live-page">
      <header className="live-page__header">
        <h1>{t('live.title')}</h1>
        <p className="live-page__subtitle">{t('live.subtitle')}</p>
      </header>

      {/* Platform selector */}
      <section className="live-page__platforms">
        <h2>{t('live.selectPlatform')}</h2>
        
        <div className="live-page__platform-grid">
          {embeddablePlatforms.map(platform => (
            <button
              key={platform.id}
              className={`live-page__platform-card ${selectedPlatform === platform.id ? 'is-selected' : ''}`}
              onClick={() => setSelectedPlatform(platform.id)}
              style={{ '--brand-color': getBrandColor(platform.id) }}
            >
              <PlatformBadge platformId={platform.id} size="large" />
              <span className="live-page__platform-name">{platform.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Featured stream embed */}
      {selectedPlatform && (
        <section className="live-page__featured">
          <h2>{t('live.watchNow')}</h2>
          
          <div className="live-page__username-input">
            <label htmlFor="performer-username">
              {t('live.enterUsername')} ({getPlatform(selectedPlatform)?.name}):
            </label>
            <input
              id="performer-username"
              type="text"
              value={featuredUsername}
              onChange={(e) => setFeaturedUsername(e.target.value)}
              placeholder={t('live.usernamePlaceholder')}
              className="live-page__input"
            />
          </div>

          {featuredUsername && (
            <div className="live-page__embed-container">
              <StreamingEmbed
                platformId={selectedPlatform}
                username={featuredUsername}
                responsive={true}
                maxWidth={1200}
              />
              
              <div className="live-page__embed-actions">
                <StreamingLink
                  platformId={selectedPlatform}
                  username={featuredUsername}
                  className="live-page__profile-link"
                >
                  {t('live.viewProfile')} →
                </StreamingLink>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Platform links */}
      <section className="live-page__all-platforms">
        <h2>{t('live.allPlatforms')}</h2>
        
        <div className="live-page__platform-list">
          {platforms.map(platform => (
            <a
              key={platform.id}
              href={platform.baseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="live-page__platform-link"
              style={{ '--brand-color': getBrandColor(platform.id) }}
            >
              <PlatformBadge platformId={platform.id} size="medium" />
              <span className="live-page__platform-info">
                <span className="live-page__platform-title">{platform.name}</span>
                <span className="live-page__platform-url">{platform.baseUrl}</span>
              </span>
              <span className="live-page__platform-arrow">→</span>
            </a>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <footer className="live-page__disclaimer">
        <p>{t('live.disclaimer')}</p>
      </footer>
    </div>
  );
}

export default LivePage;
