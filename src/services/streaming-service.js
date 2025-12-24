/**
 * Streaming Service
 * Handles streaming platform embeds, promos, and API integration
 * All platform configuration derived from TTL golden source
 */

import { getConfigService } from './config-service.js';

/**
 * Streaming Service Class
 */
class StreamingService {
  constructor() {
    this.platforms = [];
    this.embedConfig = null;
    this.promoConfig = null;
  }

  /**
   * Initialize from configuration service
   */
  initialize() {
    const configService = getConfigService();
    this.platforms = configService.getStreamingPlatforms();
    
    // Extract embed and promo config from graph
    // These would come from the streaming-platforms.ttl
    this.embedConfig = {
      responsive: true,
      autoplay: false,
      lazyLoad: true,
      showPlaceholder: true
    };
    
    this.promoConfig = {
      maxPromos: 4,
      rotateInterval: 30000,
      showOnMobile: true
    };
  }

  /**
   * Get platform by ID
   */
  getPlatform(platformId) {
    return this.platforms.find(p => p.id === platformId);
  }

  /**
   * Get all platforms
   */
  getAllPlatforms() {
    return this.platforms;
  }

  /**
   * Get platforms that support embeds
   */
  getEmbeddablePlatforms() {
    return this.platforms.filter(p => p.supportsEmbed);
  }

  /**
   * Generate embed URL for a performer
   */
  generateEmbedUrl(platformId, performerName, options = {}) {
    const platform = this.getPlatform(platformId);
    if (!platform || !platform.embedPattern) {
      return null;
    }

    let embedUrl = platform.embedPattern.replace('{performer}', performerName);
    
    // Add affiliate parameter if configured
    if (platform.affiliateParam && options.affiliateId) {
      const separator = embedUrl.includes('?') ? '&' : '?';
      embedUrl += `${separator}${platform.affiliateParam}=${options.affiliateId}`;
    }

    return embedUrl;
  }

  /**
   * Generate profile URL for a performer
   */
  generateProfileUrl(platformId, performerName) {
    const platform = this.getPlatform(platformId);
    if (!platform || !platform.profilePattern) {
      return null;
    }

    return platform.profilePattern.replace('{performer}', performerName);
  }

  /**
   * Generate embed HTML
   */
  generateEmbedHtml(platformId, performerName, options = {}) {
    const platform = this.getPlatform(platformId);
    if (!platform) {
      return '';
    }

    const embedUrl = this.generateEmbedUrl(platformId, performerName, options);
    if (!embedUrl) {
      return '';
    }

    const width = options.width || platform.embedWidth || 580;
    const height = options.height || platform.embedHeight || 326;
    const responsive = options.responsive !== undefined ? options.responsive : this.embedConfig.responsive;

    if (responsive) {
      return `
        <div class="streaming-embed streaming-embed--${platformId}" style="position: relative; padding-bottom: ${(height / width * 100).toFixed(2)}%; height: 0; overflow: hidden;">
          <iframe 
            src="${embedUrl}"
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
            allowfullscreen
            ${this.embedConfig.lazyLoad ? 'loading="lazy"' : ''}
          ></iframe>
        </div>
      `.trim();
    }

    return `
      <iframe 
        src="${embedUrl}"
        width="${width}"
        height="${height}"
        style="border: 0;"
        allowfullscreen
        ${this.embedConfig.lazyLoad ? 'loading="lazy"' : ''}
      ></iframe>
    `.trim();
  }

  /**
   * Generate promo card data
   */
  generatePromoData(profile) {
    const platform = this.getPlatform(profile.platformId);
    if (!platform) {
      return null;
    }

    return {
      id: profile.id,
      name: profile.name,
      displayName: profile.displayName || profile.name,
      platform: {
        id: platform.id,
        name: platform.name,
        brandColor: platform.brandColor,
        iconClass: platform.iconClass
      },
      profileUrl: this.generateProfileUrl(platform.id, profile.name),
      embedUrl: this.generateEmbedUrl(platform.id, profile.name),
      thumbnailUrl: profile.thumbnailUrl,
      isLive: profile.isLive,
      viewerCount: profile.viewerCount,
      tags: profile.tags || [],
      previewGif: profile.previewGif
    };
  }

  /**
   * Generate promo widget HTML
   */
  generatePromoWidgetHtml(profiles, options = {}) {
    const promoType = options.type || 'sidebar';
    const maxItems = options.maxItems || this.promoConfig.maxPromos;
    
    const promos = profiles
      .slice(0, maxItems)
      .map(p => this.generatePromoData(p))
      .filter(Boolean);

    if (promos.length === 0) {
      return '';
    }

    const itemsHtml = promos.map(promo => `
      <div class="promo-item promo-item--${promo.platform.id}" style="border-left: 3px solid ${promo.platform.brandColor};">
        <a href="${promo.profileUrl}" target="_blank" rel="noopener noreferrer" class="promo-link">
          <div class="promo-thumbnail">
            <img 
              src="${promo.thumbnailUrl || '/assets/placeholder-stream.jpg'}" 
              alt="${promo.displayName}"
              loading="lazy"
            >
            ${promo.isLive ? '<span class="live-badge">LIVE</span>' : ''}
            ${promo.viewerCount ? `<span class="viewer-count">${this.formatViewerCount(promo.viewerCount)}</span>` : ''}
          </div>
          <div class="promo-info">
            <span class="promo-name">${promo.displayName}</span>
            <span class="promo-platform">
              <i class="${promo.platform.iconClass}"></i>
              ${promo.platform.name}
            </span>
          </div>
        </a>
      </div>
    `).join('\n');

    return `
      <div class="promo-widget promo-widget--${promoType}">
        <div class="promo-header">
          <h3>Live Now</h3>
        </div>
        <div class="promo-items">
          ${itemsHtml}
        </div>
      </div>
    `.trim();
  }

  /**
   * Format viewer count for display
   */
  formatViewerCount(count) {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  }

  /**
   * Generate CSP frame-src directive for streaming platforms
   */
  generateCSPFrameSrc() {
    const domains = this.platforms
      .filter(p => p.supportsEmbed)
      .map(p => {
        const url = new URL(p.baseUrl);
        return `*.${url.hostname} ${url.hostname}`;
      });

    return `frame-src 'self' ${[...new Set(domains)].join(' ')}`;
  }

  /**
   * Create streaming profile object for database
   */
  createStreamingProfile(data) {
    const platform = this.getPlatform(data.platformId);
    if (!platform) {
      throw new Error(`Unknown platform: ${data.platformId}`);
    }

    return {
      id: data.id || this.generateId(),
      platformId: data.platformId,
      name: data.name,
      displayName: data.displayName || data.name,
      profileUrl: this.generateProfileUrl(data.platformId, data.name),
      embedUrl: platform.supportsEmbed ? this.generateEmbedUrl(data.platformId, data.name) : null,
      thumbnailUrl: data.thumbnailUrl,
      isLive: data.isLive || false,
      lastChecked: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return 'stream_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Validate streaming profile data
   */
  validateProfile(data) {
    const errors = [];

    if (!data.platformId) {
      errors.push('Platform ID is required');
    } else if (!this.getPlatform(data.platformId)) {
      errors.push(`Unknown platform: ${data.platformId}`);
    }

    if (!data.name) {
      errors.push('Performer name is required');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(data.name)) {
      errors.push('Performer name contains invalid characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if platform requires age verification
   */
  requiresAgeVerification(platformId) {
    const platform = this.getPlatform(platformId);
    return platform?.adultContent === true;
  }

  /**
   * Get platform brand styles for CSS
   */
  getPlatformStyles() {
    return this.platforms.map(p => `
      .platform-${p.id} { --platform-color: ${p.brandColor}; }
      .promo-item--${p.id} { border-color: ${p.brandColor}; }
      .streaming-embed--${p.id} .live-badge { background-color: ${p.brandColor}; }
    `).join('\n');
  }
}

// Singleton instance
let streamingInstance = null;

/**
 * Get streaming service instance
 */
export function getStreamingService() {
  if (!streamingInstance) {
    streamingInstance = new StreamingService();
    streamingInstance.initialize();
  }
  return streamingInstance;
}

export { StreamingService };
export default { getStreamingService, StreamingService };
