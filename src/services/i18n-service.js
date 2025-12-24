/**
 * Internationalization (i18n) Service
 * Provides multilingual support derived from TTL golden source
 * All languages, translations, and formatting rules come from TTL
 */

import { getConfigService } from './config-service.js';

/**
 * i18n Service Class
 */
class I18nService {
  constructor() {
    this.currentLanguage = null;
    this.translations = {};
    this.languages = [];
    this.formatters = new Map();
  }

  /**
   * Initialize from configuration service
   */
  initialize() {
    const config = getConfigService();
    this.languages = config.getLanguages();
    this.translations = config.cache.get('translations') || {};
    
    // Set default language
    const defaultLang = this.languages.find(l => l.default);
    this.currentLanguage = defaultLang?.code || 'en';
    
    // Initialize formatters for each language
    this.initializeFormatters();
  }

  /**
   * Initialize Intl formatters for each language
   */
  initializeFormatters() {
    for (const lang of this.languages) {
      this.formatters.set(lang.code, {
        date: new Intl.DateTimeFormat(lang.locale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        time: new Intl.DateTimeFormat(lang.locale, {
          hour: '2-digit',
          minute: '2-digit'
        }),
        dateTime: new Intl.DateTimeFormat(lang.locale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        number: new Intl.NumberFormat(lang.locale),
        currency: new Intl.NumberFormat(lang.locale, {
          style: 'currency',
          currency: 'USD'
        }),
        relativeTime: new Intl.RelativeTimeFormat(lang.locale, {
          numeric: 'auto'
        })
      });
    }
  }

  /**
   * Set current language
   */
  setLanguage(langCode) {
    const lang = this.languages.find(l => l.code === langCode);
    if (lang) {
      this.currentLanguage = langCode;
      // Update document direction for RTL languages
      if (typeof document !== 'undefined') {
        document.documentElement.dir = lang.direction;
        document.documentElement.lang = langCode;
      }
      return true;
    }
    return false;
  }

  /**
   * Get current language
   */
  getLanguage() {
    return this.currentLanguage;
  }

  /**
   * Get language details
   */
  getLanguageDetails(langCode = null) {
    const code = langCode || this.currentLanguage;
    return this.languages.find(l => l.code === code);
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages() {
    return this.languages;
  }

  /**
   * Translate a key
   */
  t(key, params = {}, lang = null) {
    const langCode = lang || this.currentLanguage;
    const keyTranslations = this.translations[key];
    
    if (!keyTranslations) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }
    
    let text = keyTranslations[langCode] || 
               keyTranslations['en'] || 
               keyTranslations['default'] || 
               key;
    
    // Interpolate parameters
    text = this.interpolate(text, params);
    
    return text;
  }

  /**
   * Interpolate parameters into text
   */
  interpolate(text, params) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  /**
   * Pluralize text based on count
   */
  plural(key, count, params = {}) {
    // Check for plural forms
    const pluralKey = count === 1 ? `${key}.one` : `${key}.other`;
    const translation = this.t(pluralKey, { count, ...params });
    
    // Fallback to base key if plural forms not found
    if (translation === pluralKey) {
      return this.t(key, { count, ...params });
    }
    
    return translation;
  }

  /**
   * Format date
   */
  formatDate(date, lang = null) {
    const langCode = lang || this.currentLanguage;
    const formatter = this.formatters.get(langCode)?.date;
    return formatter ? formatter.format(new Date(date)) : date.toString();
  }

  /**
   * Format time
   */
  formatTime(date, lang = null) {
    const langCode = lang || this.currentLanguage;
    const formatter = this.formatters.get(langCode)?.time;
    return formatter ? formatter.format(new Date(date)) : date.toString();
  }

  /**
   * Format date and time
   */
  formatDateTime(date, lang = null) {
    const langCode = lang || this.currentLanguage;
    const formatter = this.formatters.get(langCode)?.dateTime;
    return formatter ? formatter.format(new Date(date)) : date.toString();
  }

  /**
   * Format number
   */
  formatNumber(number, lang = null) {
    const langCode = lang || this.currentLanguage;
    const formatter = this.formatters.get(langCode)?.number;
    return formatter ? formatter.format(number) : number.toString();
  }

  /**
   * Format currency
   */
  formatCurrency(amount, currency = 'USD', lang = null) {
    const langCode = lang || this.currentLanguage;
    const langDetails = this.getLanguageDetails(langCode);
    
    const formatter = new Intl.NumberFormat(langDetails?.locale || 'en-US', {
      style: 'currency',
      currency
    });
    
    return formatter.format(amount);
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  formatRelativeTime(date, lang = null) {
    const langCode = lang || this.currentLanguage;
    const formatter = this.formatters.get(langCode)?.relativeTime;
    
    if (!formatter) return date.toString();
    
    const now = new Date();
    const then = new Date(date);
    const diffMs = then - now;
    const diffSeconds = Math.round(diffMs / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);
    
    if (Math.abs(diffSeconds) < 60) {
      return formatter.format(diffSeconds, 'second');
    } else if (Math.abs(diffMinutes) < 60) {
      return formatter.format(diffMinutes, 'minute');
    } else if (Math.abs(diffHours) < 24) {
      return formatter.format(diffHours, 'hour');
    } else {
      return formatter.format(diffDays, 'day');
    }
  }

  /**
   * Get text direction for language
   */
  getDirection(lang = null) {
    const langCode = lang || this.currentLanguage;
    const langDetails = this.getLanguageDetails(langCode);
    return langDetails?.direction || 'ltr';
  }

  /**
   * Check if language is RTL
   */
  isRTL(lang = null) {
    return this.getDirection(lang) === 'rtl';
  }
}

// Singleton instance
let i18nInstance = null;

/**
 * Get i18n service instance
 */
export function getI18nService() {
  if (!i18nInstance) {
    i18nInstance = new I18nService();
    i18nInstance.initialize();
  }
  return i18nInstance;
}

/**
 * React hook for i18n (for use in React components)
 */
export function useI18n() {
  const i18n = getI18nService();
  
  return {
    t: (key, params) => i18n.t(key, params),
    plural: (key, count, params) => i18n.plural(key, count, params),
    formatDate: (date) => i18n.formatDate(date),
    formatTime: (date) => i18n.formatTime(date),
    formatDateTime: (date) => i18n.formatDateTime(date),
    formatNumber: (num) => i18n.formatNumber(num),
    formatCurrency: (amount, currency) => i18n.formatCurrency(amount, currency),
    formatRelativeTime: (date) => i18n.formatRelativeTime(date),
    language: i18n.getLanguage(),
    languages: i18n.getAvailableLanguages(),
    setLanguage: (code) => i18n.setLanguage(code),
    isRTL: i18n.isRTL(),
    direction: i18n.getDirection()
  };
}

export { I18nService };
export default { getI18nService, useI18n, I18nService };
