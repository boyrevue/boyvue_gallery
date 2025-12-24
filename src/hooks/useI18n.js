/**
 * useI18n Hook
 * React hook for accessing translations from TTL golden source
 * All translation keys and values defined in i18n.ttl
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { getConfigService } from '../services/config-service.js';

// Context for i18n state
const I18nContext = createContext(null);

/**
 * I18n Provider component
 */
export function I18nProvider({ children, initialLang = null }) {
  const [currentLang, setCurrentLang] = useState(initialLang);
  const [languages, setLanguages] = useState([]);
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState('ltr');

  // Initialize from config service
  useEffect(() => {
    const config = getConfigService();
    
    const langs = config.getLanguages();
    setLanguages(langs);
    
    // Set initial language
    const defaultLang = config.getDefaultLanguage();
    const lang = initialLang || getBrowserLanguage(langs) || defaultLang?.code || 'en';
    setCurrentLang(lang);
    
    // Load translations for current language
    const trans = config.getAllTranslations(lang);
    setTranslations(trans);
    
    // Set direction
    const langConfig = langs.find(l => l.code === lang);
    setDirection(langConfig?.direction || 'ltr');
    
    setLoading(false);
  }, [initialLang]);

  // Change language
  const changeLanguage = useCallback((langCode) => {
    const config = getConfigService();
    
    setCurrentLang(langCode);
    
    // Load translations
    const trans = config.getAllTranslations(langCode);
    setTranslations(trans);
    
    // Update direction
    const langConfig = languages.find(l => l.code === langCode);
    setDirection(langConfig?.direction || 'ltr');
    
    // Persist preference
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gx_lang', langCode);
    }
    
    // Update HTML attributes
    if (typeof document !== 'undefined') {
      document.documentElement.lang = langCode;
      document.documentElement.dir = langConfig?.direction || 'ltr';
    }
  }, [languages]);

  // Translation function
  const t = useCallback((key, params = {}) => {
    let text = translations[key] || key;
    
    // Parameter substitution: {{param}}
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`{{${param}}}`, 'g'), value);
    }
    
    return text;
  }, [translations]);

  // Plural translation
  const tp = useCallback((key, count, params = {}) => {
    const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
    const text = translations[pluralKey] || translations[key] || key;
    
    return t(text, { ...params, count });
  }, [translations, t]);

  // Format date according to locale
  const formatDate = useCallback((date, options = {}) => {
    const langConfig = languages.find(l => l.code === currentLang);
    const locale = langConfig?.locale || currentLang;
    
    return new Intl.DateTimeFormat(locale, options).format(new Date(date));
  }, [currentLang, languages]);

  // Format number according to locale
  const formatNumber = useCallback((number, options = {}) => {
    const langConfig = languages.find(l => l.code === currentLang);
    const locale = langConfig?.locale || currentLang;
    
    return new Intl.NumberFormat(locale, options).format(number);
  }, [currentLang, languages]);

  // Format currency
  const formatCurrency = useCallback((amount, currency = 'USD') => {
    return formatNumber(amount, { style: 'currency', currency });
  }, [formatNumber]);

  // Format relative time
  const formatRelativeTime = useCallback((date) => {
    const langConfig = languages.find(l => l.code === currentLang);
    const locale = langConfig?.locale || currentLang;
    
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    
    if (diffDays > 30) {
      return formatDate(date);
    } else if (diffDays > 0) {
      return rtf.format(-diffDays, 'day');
    } else if (diffHours > 0) {
      return rtf.format(-diffHours, 'hour');
    } else if (diffMins > 0) {
      return rtf.format(-diffMins, 'minute');
    } else {
      return rtf.format(-diffSecs, 'second');
    }
  }, [currentLang, languages, formatDate]);

  const value = {
    // State
    currentLang,
    languages,
    direction,
    loading,
    
    // Functions
    t,
    tp,
    changeLanguage,
    formatDate,
    formatNumber,
    formatCurrency,
    formatRelativeTime,
    
    // Get language config
    getLanguageConfig: (code = currentLang) => languages.find(l => l.code === code)
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * useI18n hook
 */
export function useI18n() {
  const context = useContext(I18nContext);
  
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  
  return context;
}

/**
 * Get browser preferred language
 */
function getBrowserLanguage(availableLanguages) {
  if (typeof navigator === 'undefined') return null;
  
  // Check localStorage first
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('gx_lang');
    if (stored && availableLanguages.find(l => l.code === stored)) {
      return stored;
    }
  }
  
  // Check browser languages
  const browserLangs = navigator.languages || [navigator.language];
  
  for (const browserLang of browserLangs) {
    const code = browserLang.split('-')[0].toLowerCase();
    const match = availableLanguages.find(l => l.code === code);
    if (match) {
      return match.code;
    }
  }
  
  return null;
}

/**
 * HOC for adding i18n to class components
 */
export function withI18n(Component) {
  return function WithI18nComponent(props) {
    const i18n = useI18n();
    return <Component {...props} i18n={i18n} />;
  };
}

export default useI18n;
