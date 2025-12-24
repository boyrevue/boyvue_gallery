/**
 * useStreaming Hook
 * React hook for streaming platform integration from TTL golden source
 * All platform configurations defined in streaming-platforms.ttl
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getConfigService } from '../services/config-service.js';

/**
 * useStreaming hook
 */
export function useStreaming() {
  const config = getConfigService();
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load platforms from config
  useEffect(() => {
    const platformData = config.getStreamingPlatforms();
    setPlatforms(platformData);
    setLoading(false);
  }, []);

  /**
   * Get platform by ID
   */
  const getPlatform = useCallback((platformId) => {
    return platforms.find(p => p.id === platformId);
  }, [platforms]);

  /**
   * Build embed URL for a performer
   */
  const buildEmbedUrl = useCallback((platformId, performerUsername, options = {}) => {
    const platform = getPlatform(platformId);
    if (!platform || !platform.embedPattern) return null;

    let url = platform.embedPattern.replace('{username}', performerUsername);
    
    // Add affiliate parameter if configured
    if (platform.affiliateParam && options.affiliateId) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${platform.affiliateParam}=${options.affiliateId}`;
    }

    return url;
  }, [getPlatform]);

  /**
   * Build profile URL for a performer
   */
  const buildProfileUrl = useCallback((platformId, performerUsername) => {
    const platform = getPlatform(platformId);
    if (!platform || !platform.profilePattern) return null;

    return platform.profilePattern.replace('{username}', performerUsername);
  }, [getPlatform]);

  /**
   * Get embed dimensions for a platform
   */
  const getEmbedDimensions = useCallback((platformId) => {
    const platform = getPlatform(platformId);
    if (!platform) {
      return { width: 640, height: 480 }; // Fallback from TTL defaults
    }

    return {
      width: platform.embedWidth || 640,
      height: platform.embedHeight || 480
    };
  }, [getPlatform]);

  /**
   * Check if platform supports embedding
   */
  const supportsEmbed = useCallback((platformId) => {
    const platform = getPlatform(platformId);
    return platform?.supportsEmbed === true;
  }, [getPlatform]);

  /**
   * Check if platform has API access
   */
  const supportsApi = useCallback((platformId) => {
    const platform = getPlatform(platformId);
    return platform?.supportsApi === true;
  }, [getPlatform]);

  /**
   * Get platforms that support embedding
   */
  const embeddablePlatforms = useMemo(() => {
    return platforms.filter(p => p.supportsEmbed);
  }, [platforms]);

  /**
   * Get brand color for platform
   */
  const getBrandColor = useCallback((platformId) => {
    const platform = getPlatform(platformId);
    return platform?.brandColor || '#666666';
  }, [getPlatform]);

  /**
   * Build responsive embed style
   */
  const getResponsiveEmbedStyle = useCallback((platformId, containerWidth = null) => {
    const dims = getEmbedDimensions(platformId);
    const aspectRatio = dims.height / dims.width;

    return {
      position: 'relative',
      width: '100%',
      maxWidth: containerWidth || dims.width,
      paddingBottom: `${aspectRatio * 100}%`,
      height: 0,
      overflow: 'hidden'
    };
  }, [getEmbedDimensions]);

  /**
   * Build iframe style for responsive container
   */
  const getIframeStyle = useCallback(() => {
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: 'none'
    };
  }, []);

  return {
    // State
    platforms,
    loading,
    embeddablePlatforms,

    // Functions
    getPlatform,
    buildEmbedUrl,
    buildProfileUrl,
    getEmbedDimensions,
    supportsEmbed,
    supportsApi,
    getBrandColor,
    getResponsiveEmbedStyle,
    getIframeStyle
  };
}

/**
 * useStreamingPromo hook - for displaying promotional content
 */
export function useStreamingPromo(promoType = 'featured') {
  const config = getConfigService();
  const { platforms } = useStreaming();
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, this would fetch live promo data
    // For now, return platform-based promos
    const platformPromos = platforms
      .filter(p => p.supportsEmbed)
      .map(p => ({
        id: `promo-${p.id}`,
        platformId: p.id,
        platformName: p.name,
        type: promoType,
        brandColor: p.brandColor,
        iconClass: p.iconClass
      }));

    setPromos(platformPromos);
    setLoading(false);
  }, [platforms, promoType]);

  return {
    promos,
    loading
  };
}

/**
 * StreamingEmbed Component
 * Renders an embedded stream player
 */
export function StreamingEmbed({ 
  platformId, 
  username, 
  affiliateId = null,
  autoplay = false,
  responsive = true,
  maxWidth = null,
  className = '',
  onLoad = () => {},
  onError = () => {}
}) {
  const { 
    buildEmbedUrl, 
    supportsEmbed, 
    getResponsiveEmbedStyle, 
    getIframeStyle,
    getPlatform 
  } = useStreaming();

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Check if embedding is supported
  if (!supportsEmbed(platformId)) {
    return (
      <div className={`streaming-embed-unsupported ${className}`}>
        Embedding not supported for this platform
      </div>
    );
  }

  const embedUrl = buildEmbedUrl(platformId, username, { affiliateId });
  const platform = getPlatform(platformId);

  if (!embedUrl) {
    return (
      <div className={`streaming-embed-error ${className}`}>
        Unable to generate embed URL
      </div>
    );
  }

  const containerStyle = responsive 
    ? getResponsiveEmbedStyle(platformId, maxWidth)
    : { width: platform.embedWidth, height: platform.embedHeight };

  const iframeStyle = responsive
    ? getIframeStyle()
    : { width: '100%', height: '100%', border: 'none' };

  const handleLoad = () => {
    setLoaded(true);
    onLoad();
  };

  const handleError = (e) => {
    setError('Failed to load stream');
    onError(e);
  };

  return (
    <div 
      className={`streaming-embed ${className}`}
      style={containerStyle}
      data-platform={platformId}
    >
      {!loaded && (
        <div className="streaming-embed-loading">
          Loading stream...
        </div>
      )}
      <iframe
        src={embedUrl}
        style={iframeStyle}
        allow="autoplay; fullscreen"
        allowFullScreen
        onLoad={handleLoad}
        onError={handleError}
        title={`${platform.name} stream - ${username}`}
      />
      {error && (
        <div className="streaming-embed-error">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * StreamingLink Component
 * Renders a link to a performer's profile
 */
export function StreamingLink({
  platformId,
  username,
  children,
  className = '',
  showIcon = true,
  target = '_blank'
}) {
  const { buildProfileUrl, getPlatform, getBrandColor } = useStreaming();
  
  const platform = getPlatform(platformId);
  const profileUrl = buildProfileUrl(platformId, username);

  if (!profileUrl) {
    return <span className={className}>{children || username}</span>;
  }

  const style = showIcon ? {
    '--platform-color': getBrandColor(platformId)
  } : {};

  return (
    <a
      href={profileUrl}
      target={target}
      rel="noopener noreferrer"
      className={`streaming-link ${className}`}
      style={style}
      data-platform={platformId}
    >
      {showIcon && platform?.iconClass && (
        <i className={platform.iconClass} aria-hidden="true" />
      )}
      {children || username}
    </a>
  );
}

/**
 * PlatformBadge Component
 * Shows a platform badge/logo
 */
export function PlatformBadge({
  platformId,
  size = 'medium',
  showName = true,
  className = ''
}) {
  const { getPlatform, getBrandColor } = useStreaming();
  
  const platform = getPlatform(platformId);
  if (!platform) return null;

  const sizeClasses = {
    small: 'platform-badge--small',
    medium: 'platform-badge--medium',
    large: 'platform-badge--large'
  };

  return (
    <span
      className={`platform-badge ${sizeClasses[size]} ${className}`}
      style={{ '--platform-color': getBrandColor(platformId) }}
      data-platform={platformId}
    >
      {platform.iconClass && (
        <i className={platform.iconClass} aria-hidden="true" />
      )}
      {showName && <span className="platform-badge__name">{platform.name}</span>}
    </span>
  );
}

export default useStreaming;
