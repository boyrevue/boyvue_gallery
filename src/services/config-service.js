/**
 * Configuration Service
 * Loads and manages configuration from TTL golden source files
 * All configuration values are derived from TTL - no hardcoding
 */

import { loadTTL, mergeGraphs, NAMESPACES } from './ttl-parser.js';

// Environment variable interpolation regex
const ENV_VAR_REGEX = /\$\{([^}]+)\}/g;

/**
 * Configuration loader and manager
 */
class ConfigurationService {
  constructor() {
    this.graph = null;
    this.cache = new Map();
    this.loaded = false;
    this.configPaths = [];
  }

  /**
   * Initialize configuration from TTL files
   */
  async initialize(configPaths = []) {
    this.configPaths = configPaths;
    const graphs = [];

    for (const path of configPaths) {
      try {
        const graph = await loadTTL(path);
        graphs.push(graph);
      } catch (error) {
        console.error(`Failed to load config from ${path}:`, error);
      }
    }

    this.graph = mergeGraphs(...graphs);
    this.loaded = true;
    this.buildCache();
  }

  /**
   * Build lookup caches for common queries
   */
  buildCache() {
    // Cache languages
    this.cache.set('languages', this.extractLanguages());
    
    // Cache translations
    this.cache.set('translations', this.extractTranslations());
    
    // Cache streaming platforms
    this.cache.set('streamingPlatforms', this.extractStreamingPlatforms());
    
    // Cache SEO configuration
    this.cache.set('seo', this.extractSEOConfig());
    
    // Cache app configuration
    this.cache.set('app', this.extractAppConfig());
  }

  /**
   * Interpolate environment variables in string values
   */
  interpolateEnvVars(value) {
    if (typeof value !== 'string') return value;
    
    return value.replace(ENV_VAR_REGEX, (match, varName) => {
      return process.env[varName] || match;
    });
  }

  /**
   * Get value with environment variable interpolation
   */
  getValue(subject, predicate, defaultValue = null) {
    const value = this.graph.getValue(subject, predicate);
    if (value === null) return defaultValue;
    return this.interpolateEnvVars(value);
  }

  /**
   * Extract supported languages from TTL
   */
  extractLanguages() {
    const ns = 'http://gallery.example.org/i18n#';
    const languages = [];
    
    const langSubjects = this.graph.getSubjectsOfType(`${ns}Language`);
    
    for (const subject of langSubjects) {
      const lang = {
        code: this.getValue(subject, `${ns}code`),
        name: this.getValue(subject, `${ns}name`),
        nativeName: this.getValue(subject, `${ns}nativeName`),
        direction: this.getValue(subject, `${ns}direction`, 'ltr'),
        enabled: this.getValue(subject, `${ns}enabled`) === true,
        default: this.getValue(subject, `${ns}default`) === true,
        locale: this.getValue(subject, `${ns}locale`),
        dateFormat: this.getValue(subject, `${ns}dateFormat`),
        timeFormat: this.getValue(subject, `${ns}timeFormat`),
        numberFormat: this.getValue(subject, `${ns}numberFormat`),
        flagEmoji: this.getValue(subject, `${ns}flagEmoji`)
      };
      
      if (lang.code && lang.enabled) {
        languages.push(lang);
      }
    }
    
    return languages;
  }

  /**
   * Extract translations from TTL
   */
  extractTranslations() {
    const ns = 'http://gallery.example.org/i18n#';
    const translations = {};
    
    const translationSubjects = this.graph.getSubjectsOfType(`${ns}TranslationKey`);
    
    for (const subject of translationSubjects) {
      const key = this.getValue(subject, `${ns}key`);
      if (!key) continue;
      
      const multiLangValues = this.graph.getMultilingualValues(subject, `${ns}text`);
      translations[key] = multiLangValues;
    }
    
    return translations;
  }

  /**
   * Extract streaming platform configurations
   */
  extractStreamingPlatforms() {
    const ns = 'http://gallery.example.org/streaming#';
    const cfgNs = 'http://gallery.example.org/config#';
    const platforms = [];
    
    const platformSubjects = this.graph.getSubjectsOfType(`${ns}StreamingPlatform`);
    
    for (const subject of platformSubjects) {
      const platform = {
        id: this.getValue(subject, `${cfgNs}platformId`),
        name: this.getValue(subject, `${NAMESPACES.rdfs}label`),
        baseUrl: this.getValue(subject, `${cfgNs}baseUrl`),
        embedPattern: this.getValue(subject, `${cfgNs}embedPattern`),
        profilePattern: this.getValue(subject, `${cfgNs}profilePattern`),
        apiEndpoint: this.getValue(subject, `${cfgNs}apiEndpoint`),
        embedWidth: this.getValue(subject, `${cfgNs}embedWidth`),
        embedHeight: this.getValue(subject, `${cfgNs}embedHeight`),
        supportsEmbed: this.getValue(subject, `${cfgNs}supportsEmbed`),
        supportsApi: this.getValue(subject, `${cfgNs}supportsApi`),
        affiliateParam: this.getValue(subject, `${cfgNs}affiliateParam`),
        iconClass: this.getValue(subject, `${cfgNs}iconClass`),
        brandColor: this.getValue(subject, `${cfgNs}brandColor`),
        adultContent: this.getValue(subject, `${cfgNs}adultContent`)
      };
      
      if (platform.id) {
        platforms.push(platform);
      }
    }
    
    return platforms;
  }

  /**
   * Extract SEO configuration
   */
  extractSEOConfig() {
    const ns = 'http://gallery.example.org/seo#';
    const configSubject = `${ns}SiteConfig`;
    
    return {
      siteName: this.getValue(configSubject, `${ns}siteName`),
      siteUrl: this.getValue(configSubject, `${ns}siteUrl`),
      defaultLocale: this.getValue(configSubject, `${ns}defaultLocale`),
      titleSeparator: this.getValue(configSubject, `${ns}titleSeparator`),
      titleSuffix: this.getValue(configSubject, `${ns}titleSuffix`),
      defaultOgImage: this.getValue(configSubject, `${ns}defaultOgImage`),
      twitterCard: this.getValue(configSubject, `${ns}twitterCard`),
      twitterSite: this.getValue(configSubject, `${ns}twitterSite`),
      facebookAppId: this.getValue(configSubject, `${ns}facebookAppId`),
      urlPatterns: this.extractUrlPatterns(),
      metaTemplates: this.extractMetaTemplates(),
      hreflang: this.extractHreflangConfig()
    };
  }

  /**
   * Extract URL patterns
   */
  extractUrlPatterns() {
    const ns = 'http://gallery.example.org/seo#';
    const patterns = {};
    
    // This would need list parsing - simplified for now
    // In production, implement full RDF list parsing
    return patterns;
  }

  /**
   * Extract meta templates
   */
  extractMetaTemplates() {
    const ns = 'http://gallery.example.org/seo#';
    const templates = {};
    
    const templateSubjects = this.graph.getSubjectsOfType(`${ns}MetaTemplate`);
    
    for (const subject of templateSubjects) {
      const pageType = this.getValue(subject, `${ns}pageType`);
      if (!pageType) continue;
      
      templates[pageType] = {
        titleTemplate: this.graph.getMultilingualValues(subject, `${ns}titleTemplate`),
        descriptionTemplate: this.graph.getMultilingualValues(subject, `${ns}descriptionTemplate`),
        ogType: this.getValue(subject, `${ns}ogType`),
        noIndex: this.getValue(subject, `${ns}noIndex`)
      };
    }
    
    return templates;
  }

  /**
   * Extract hreflang configuration
   */
  extractHreflangConfig() {
    const ns = 'http://gallery.example.org/seo#';
    const configSubject = `${ns}HreflangConfig`;
    
    return {
      enabled: this.getValue(configSubject, `${ns}enabled`),
      defaultLocale: this.getValue(configSubject, `${ns}defaultLocale`),
      xDefaultLocale: this.getValue(configSubject, `${ns}xDefaultLocale`)
    };
  }

  /**
   * Extract application configuration
   */
  extractAppConfig() {
    const ns = 'http://gallery.example.org/app#';
    const appSubject = `${ns}Application`;
    
    return {
      name: this.getValue(appSubject, `${ns}name`),
      version: this.getValue(appSubject, `${ns}version`),
      environment: this.getValue(appSubject, `${ns}environment`),
      baseUrl: this.getValue(appSubject, `${ns}baseUrl`),
      apiVersion: this.getValue(appSubject, `${ns}apiVersion`)
    };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Get all supported languages
   */
  getLanguages() {
    return this.cache.get('languages') || [];
  }

  /**
   * Get default language
   */
  getDefaultLanguage() {
    return this.getLanguages().find(l => l.default) || this.getLanguages()[0];
  }

  /**
   * Get translation for key and language
   */
  getTranslation(key, lang = 'en') {
    const translations = this.cache.get('translations') || {};
    const keyTranslations = translations[key];
    
    if (!keyTranslations) return key;
    
    return keyTranslations[lang] || keyTranslations['en'] || keyTranslations['default'] || key;
  }

  /**
   * Get all translations for a language
   */
  getAllTranslations(lang = 'en') {
    const translations = this.cache.get('translations') || {};
    const result = {};
    
    for (const [key, values] of Object.entries(translations)) {
      result[key] = values[lang] || values['en'] || values['default'] || key;
    }
    
    return result;
  }

  /**
   * Get streaming platforms
   */
  getStreamingPlatforms() {
    return this.cache.get('streamingPlatforms') || [];
  }

  /**
   * Get streaming platform by ID
   */
  getStreamingPlatform(platformId) {
    return this.getStreamingPlatforms().find(p => p.id === platformId);
  }

  /**
   * Get SEO configuration
   */
  getSEOConfig() {
    return this.cache.get('seo') || {};
  }

  /**
   * Get application configuration
   */
  getAppConfig() {
    return this.cache.get('app') || {};
  }

  /**
   * Reload configuration
   */
  async reload() {
    await this.initialize(this.configPaths);
  }
}

// Singleton instance
let instance = null;

/**
 * Get configuration service instance
 */
export function getConfigService() {
  if (!instance) {
    instance = new ConfigurationService();
  }
  return instance;
}

/**
 * Initialize configuration
 */
export async function initializeConfig(paths) {
  const service = getConfigService();
  await service.initialize(paths);
  return service;
}

export { ConfigurationService };
export default { getConfigService, initializeConfig, ConfigurationService };
