/**
 * useConfig Hook
 * React hook for accessing application configuration from TTL golden source
 * All configuration values defined in app.ttl
 */

import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { getConfigService } from '../services/config-service.js';

// Context for app config
const ConfigContext = createContext(null);

/**
 * Config Provider component
 */
export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const configService = getConfigService();
      const appConfig = configService.getAppConfig();
      setConfig(appConfig);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  // Reload configuration
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const configService = getConfigService();
      await configService.reload();
      const appConfig = configService.getAppConfig();
      setConfig(appConfig);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, []);

  const value = {
    config,
    loading,
    error,
    reload
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

/**
 * useConfig hook
 */
export function useConfig() {
  const context = useContext(ConfigContext);
  
  // If not in provider, get config directly
  if (!context) {
    const configService = getConfigService();
    return {
      config: configService.getAppConfig(),
      loading: false,
      error: null,
      reload: async () => {
        await configService.reload();
      }
    };
  }
  
  return context;
}

/**
 * useFeatureFlag hook
 * Check if a feature is enabled from TTL config
 */
export function useFeatureFlag(flagName) {
  const configService = getConfigService();
  
  // Feature flags are defined in app.ttl under galapp:Features
  const features = useMemo(() => {
    const graph = configService.graph;
    if (!graph) return {};
    
    const ns = 'http://gallery.example.org/app#';
    const featuresSubject = `${ns}Features`;
    
    return {
      comments: graph.getValue(featuresSubject, `${ns}commentsEnabled`) === true,
      ratings: graph.getValue(featuresSubject, `${ns}ratingsEnabled`) === true,
      likes: graph.getValue(featuresSubject, `${ns}likesEnabled`) === true,
      sharing: graph.getValue(featuresSubject, `${ns}sharingEnabled`) === true,
      download: graph.getValue(featuresSubject, `${ns}downloadEnabled`) === true,
      subscriptions: graph.getValue(featuresSubject, `${ns}subscriptionsEnabled`) === true,
      notifications: graph.getValue(featuresSubject, `${ns}notificationsEnabled`) === true,
      streamingPromo: graph.getValue(featuresSubject, `${ns}streamingPromoEnabled`) === true,
      adultContent: graph.getValue(featuresSubject, `${ns}adultContentEnabled`) === true,
      userUpload: graph.getValue(featuresSubject, `${ns}userUploadEnabled`) === true,
      aiTagging: graph.getValue(featuresSubject, `${ns}aiTaggingEnabled`) === true,
      analytics: graph.getValue(featuresSubject, `${ns}analyticsEnabled`) === true
    };
  }, []);

  return features[flagName] ?? false;
}

/**
 * usePagination hook
 * Get pagination settings from TTL config
 */
export function usePagination() {
  const configService = getConfigService();
  
  const settings = useMemo(() => {
    const graph = configService.graph;
    if (!graph) {
      return {
        defaultPageSize: 24,
        maxPageSize: 100,
        infiniteScrollEnabled: true,
        preloadPages: 2
      };
    }
    
    const ns = 'http://gallery.example.org/app#';
    const paginationSubject = `${ns}Pagination`;
    
    return {
      defaultPageSize: graph.getValue(paginationSubject, `${ns}defaultPageSize`) || 24,
      maxPageSize: graph.getValue(paginationSubject, `${ns}maxPageSize`) || 100,
      infiniteScrollEnabled: graph.getValue(paginationSubject, `${ns}infiniteScrollEnabled`) !== false,
      preloadPages: graph.getValue(paginationSubject, `${ns}preloadPages`) || 2
    };
  }, []);

  return settings;
}

/**
 * useMediaConfig hook
 * Get media processing settings from TTL config
 */
export function useMediaConfig() {
  const configService = getConfigService();
  
  const settings = useMemo(() => {
    const graph = configService.graph;
    if (!graph) {
      return {
        maxUploadSize: 104857600,
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'],
        thumbnailSizes: ['thumb', 'small', 'medium', 'large', 'full']
      };
    }
    
    const ns = 'http://gallery.example.org/app#';
    const storageSubject = `${ns}MediaStorage`;
    const imageSubject = `${ns}ImageProcessing`;
    
    return {
      maxUploadSize: graph.getValue(storageSubject, `${ns}maxUploadSize`) || 104857600,
      cdnUrl: graph.getValue(storageSubject, `${ns}cdnUrl`),
      watermarkEnabled: graph.getValue(imageSubject, `${ns}watermarkEnabled`) === true,
      outputFormat: graph.getValue(imageSubject, `${ns}outputFormat`) || 'webp',
      quality: graph.getValue(imageSubject, `${ns}quality`) || 85
    };
  }, []);

  return settings;
}

/**
 * useAuthConfig hook
 * Get authentication settings from TTL config
 */
export function useAuthConfig() {
  const configService = getConfigService();
  
  const settings = useMemo(() => {
    const graph = configService.graph;
    if (!graph) {
      return {
        ageVerificationRequired: true,
        minimumAge: 18,
        csrfEnabled: true,
        rateLimitEnabled: true
      };
    }
    
    const ns = 'http://gallery.example.org/app#';
    const authSubject = `${ns}Auth`;
    
    return {
      ageVerificationRequired: graph.getValue(authSubject, `${ns}ageVerificationRequired`) === true,
      minimumAge: graph.getValue(authSubject, `${ns}minimumAge`) || 18,
      csrfEnabled: graph.getValue(authSubject, `${ns}csrfEnabled`) !== false,
      rateLimitEnabled: graph.getValue(authSubject, `${ns}rateLimitEnabled`) !== false,
      rateLimitWindow: graph.getValue(authSubject, `${ns}rateLimitWindow`) || 900,
      rateLimitMaxRequests: graph.getValue(authSubject, `${ns}rateLimitMaxRequests`) || 100
    };
  }, []);

  return settings;
}

/**
 * withConfig HOC
 * Add config to class components
 */
export function withConfig(Component) {
  return function WithConfigComponent(props) {
    const config = useConfig();
    return <Component {...props} config={config} />;
  };
}

export default useConfig;
