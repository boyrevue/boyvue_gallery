/**
 * useSEO Hook
 * React hook for managing SEO metadata from TTL golden source
 * All SEO patterns and templates defined in seo.ttl
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getConfigService } from '../services/config-service.js';
import { useI18n } from './useI18n.js';

/**
 * useSEO hook
 */
export function useSEO(pageType = 'home', pageData = {}) {
  const config = getConfigService();
  const seoConfig = config.getSEOConfig();
  const { currentLang, t } = useI18n();
  
  const [meta, setMeta] = useState({});

  // Generate meta tags based on page type and data
  const generateMeta = useCallback(() => {
    const template = seoConfig.metaTemplates?.[pageType] || {};
    
    // Build title
    let title = interpolateTemplate(
      template.titleTemplate?.[currentLang] || template.titleTemplate?.en || '',
      pageData
    );
    if (seoConfig.titleSuffix && !title.includes(seoConfig.titleSuffix)) {
      title = `${title} ${seoConfig.titleSeparator || '|'} ${seoConfig.titleSuffix}`;
    }
    
    // Build description
    const description = interpolateTemplate(
      template.descriptionTemplate?.[currentLang] || template.descriptionTemplate?.en || '',
      pageData
    );
    
    // Build canonical URL
    const canonical = buildCanonicalUrl(pageType, pageData, seoConfig, currentLang);
    
    // Build Open Graph data
    const og = {
      type: template.ogType || 'website',
      title: title,
      description: description,
      url: canonical,
      image: pageData.image || seoConfig.defaultOgImage,
      locale: getOgLocale(currentLang),
      siteName: seoConfig.siteName
    };
    
    // Build Twitter Card data
    const twitter = {
      card: seoConfig.twitterCard || 'summary_large_image',
      title: title,
      description: description,
      image: pageData.image || seoConfig.defaultOgImage,
      site: seoConfig.twitterSite
    };
    
    // Build structured data
    const structuredData = buildStructuredData(pageType, pageData, seoConfig, currentLang);
    
    // Build hreflang links
    const hreflang = buildHreflangLinks(pageType, pageData, config.getLanguages(), seoConfig);
    
    return {
      title,
      description,
      canonical,
      og,
      twitter,
      structuredData,
      hreflang,
      noIndex: template.noIndex || false,
      noFollow: template.noFollow || false
    };
  }, [pageType, pageData, seoConfig, currentLang]);

  // Update meta when dependencies change
  useEffect(() => {
    const newMeta = generateMeta();
    setMeta(newMeta);
    
    // Update document head
    if (typeof document !== 'undefined') {
      updateDocumentHead(newMeta);
    }
  }, [generateMeta]);

  // Manual refresh
  const refresh = useCallback(() => {
    const newMeta = generateMeta();
    setMeta(newMeta);
    if (typeof document !== 'undefined') {
      updateDocumentHead(newMeta);
    }
  }, [generateMeta]);

  return {
    meta,
    refresh,
    
    // Direct access to meta components
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    og: meta.og,
    twitter: meta.twitter,
    structuredData: meta.structuredData,
    hreflang: meta.hreflang,
    
    // Helper to render meta tags (for SSR)
    renderMetaTags: () => renderMetaTagsToString(meta)
  };
}

/**
 * Interpolate template with data
 */
function interpolateTemplate(template, data) {
  if (!template) return '';
  
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

/**
 * Build canonical URL
 */
function buildCanonicalUrl(pageType, data, config, lang) {
  const baseUrl = config.siteUrl || '';
  const patterns = config.urlPatterns || {};
  
  let path = '/';
  
  switch (pageType) {
    case 'gallery':
      path = `/${lang}/gallery/${data.slug || data.id}`;
      break;
    case 'photo':
    case 'image':
      path = `/${lang}/photo/${data.slug || data.id}`;
      break;
    case 'video':
      path = `/${lang}/video/${data.slug || data.id}`;
      break;
    case 'category':
      path = `/${lang}/category/${data.slug || data.id}`;
      break;
    case 'creator':
      path = `/${lang}/creator/${data.username || data.slug || data.id}`;
      break;
    case 'tag':
      path = `/${lang}/tag/${data.slug || data.name}`;
      break;
    case 'search':
      path = `/${lang}/search`;
      break;
    case 'live':
      path = `/${lang}/live`;
      break;
    default:
      path = lang === config.defaultLocale ? '/' : `/${lang}`;
  }
  
  return `${baseUrl}${path}`;
}

/**
 * Get Open Graph locale format
 */
function getOgLocale(lang) {
  const localeMap = {
    en: 'en_US',
    es: 'es_ES',
    fr: 'fr_FR',
    de: 'de_DE',
    ja: 'ja_JP',
    pt: 'pt_BR',
    ru: 'ru_RU',
    zh: 'zh_CN',
    it: 'it_IT',
    nl: 'nl_NL',
    pl: 'pl_PL',
    ar: 'ar_SA'
  };
  
  return localeMap[lang] || `${lang}_${lang.toUpperCase()}`;
}

/**
 * Build structured data (JSON-LD)
 */
function buildStructuredData(pageType, data, config, lang) {
  const schemas = [];
  
  // Organization schema (always include)
  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: config.siteName,
    url: config.siteUrl,
    logo: config.defaultOgImage
  });
  
  // Page-specific schemas
  switch (pageType) {
    case 'photo':
    case 'image':
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'ImageObject',
        name: data.title,
        description: data.description,
        contentUrl: data.imageUrl,
        thumbnailUrl: data.thumbnailUrl,
        uploadDate: data.createdAt,
        author: data.creator ? {
          '@type': 'Person',
          name: data.creator.name || data.creator.username
        } : undefined
      });
      break;
      
    case 'video':
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
        uploadDate: data.createdAt,
        duration: data.duration ? `PT${data.duration}S` : undefined,
        contentUrl: data.videoUrl,
        author: data.creator ? {
          '@type': 'Person',
          name: data.creator.name || data.creator.username
        } : undefined
      });
      break;
      
    case 'creator':
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: data.name || data.username,
        url: `${config.siteUrl}/${lang}/creator/${data.username}`,
        image: data.avatar,
        description: data.bio
      });
      break;
      
    case 'gallery':
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: data.title,
        description: data.description,
        numberOfItems: data.itemCount
      });
      break;
  }
  
  // Breadcrumb schema
  if (data.breadcrumbs && data.breadcrumbs.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: data.breadcrumbs.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.url
      }))
    });
  }
  
  return schemas;
}

/**
 * Build hreflang links
 */
function buildHreflangLinks(pageType, data, languages, config) {
  if (!config.hreflang?.enabled) return [];
  
  const links = [];
  const enabledLangs = languages.filter(l => l.enabled);
  
  for (const lang of enabledLangs) {
    const url = buildCanonicalUrl(pageType, data, config, lang.code);
    links.push({
      lang: lang.locale || lang.code,
      url
    });
  }
  
  // Add x-default
  const defaultLang = config.hreflang?.xDefaultLocale || config.defaultLocale || 'en';
  const xDefaultUrl = buildCanonicalUrl(pageType, data, config, defaultLang);
  links.push({
    lang: 'x-default',
    url: xDefaultUrl
  });
  
  return links;
}

/**
 * Update document head with meta tags
 */
function updateDocumentHead(meta) {
  // Title
  document.title = meta.title;
  
  // Update or create meta tags
  setMetaTag('description', meta.description);
  setMetaTag('robots', buildRobotsContent(meta));
  
  // Open Graph
  setMetaTag('og:type', meta.og?.type, 'property');
  setMetaTag('og:title', meta.og?.title, 'property');
  setMetaTag('og:description', meta.og?.description, 'property');
  setMetaTag('og:url', meta.og?.url, 'property');
  setMetaTag('og:image', meta.og?.image, 'property');
  setMetaTag('og:locale', meta.og?.locale, 'property');
  setMetaTag('og:site_name', meta.og?.siteName, 'property');
  
  // Twitter
  setMetaTag('twitter:card', meta.twitter?.card);
  setMetaTag('twitter:title', meta.twitter?.title);
  setMetaTag('twitter:description', meta.twitter?.description);
  setMetaTag('twitter:image', meta.twitter?.image);
  setMetaTag('twitter:site', meta.twitter?.site);
  
  // Canonical
  updateLinkTag('canonical', meta.canonical);
  
  // Hreflang
  updateHreflangTags(meta.hreflang || []);
  
  // Structured data
  updateStructuredData(meta.structuredData || []);
}

/**
 * Set a meta tag value
 */
function setMetaTag(name, content, attribute = 'name') {
  if (!content) return;
  
  let tag = document.querySelector(`meta[${attribute}="${name}"]`);
  
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, name);
    document.head.appendChild(tag);
  }
  
  tag.setAttribute('content', content);
}

/**
 * Update link tag
 */
function updateLinkTag(rel, href) {
  if (!href) return;
  
  let tag = document.querySelector(`link[rel="${rel}"]`);
  
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  
  tag.setAttribute('href', href);
}

/**
 * Update hreflang tags
 */
function updateHreflangTags(links) {
  // Remove existing hreflang tags
  const existing = document.querySelectorAll('link[rel="alternate"][hreflang]');
  existing.forEach(tag => tag.remove());
  
  // Add new tags
  for (const link of links) {
    const tag = document.createElement('link');
    tag.setAttribute('rel', 'alternate');
    tag.setAttribute('hreflang', link.lang);
    tag.setAttribute('href', link.url);
    document.head.appendChild(tag);
  }
}

/**
 * Update structured data scripts
 */
function updateStructuredData(schemas) {
  // Remove existing LD+JSON scripts
  const existing = document.querySelectorAll('script[type="application/ld+json"]');
  existing.forEach(tag => tag.remove());
  
  // Add new scripts
  for (const schema of schemas) {
    const script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }
}

/**
 * Build robots content
 */
function buildRobotsContent(meta) {
  const directives = [];
  
  if (meta.noIndex) {
    directives.push('noindex');
  } else {
    directives.push('index');
  }
  
  if (meta.noFollow) {
    directives.push('nofollow');
  } else {
    directives.push('follow');
  }
  
  return directives.join(', ');
}

/**
 * Render meta tags to string (for SSR)
 */
function renderMetaTagsToString(meta) {
  const tags = [];
  
  // Title
  tags.push(`<title>${escapeHtml(meta.title)}</title>`);
  
  // Meta description
  tags.push(`<meta name="description" content="${escapeHtml(meta.description)}">`);
  
  // Robots
  tags.push(`<meta name="robots" content="${buildRobotsContent(meta)}">`);
  
  // Open Graph
  if (meta.og) {
    tags.push(`<meta property="og:type" content="${meta.og.type}">`);
    tags.push(`<meta property="og:title" content="${escapeHtml(meta.og.title)}">`);
    tags.push(`<meta property="og:description" content="${escapeHtml(meta.og.description)}">`);
    tags.push(`<meta property="og:url" content="${meta.og.url}">`);
    if (meta.og.image) {
      tags.push(`<meta property="og:image" content="${meta.og.image}">`);
    }
    tags.push(`<meta property="og:locale" content="${meta.og.locale}">`);
    tags.push(`<meta property="og:site_name" content="${escapeHtml(meta.og.siteName)}">`);
  }
  
  // Twitter
  if (meta.twitter) {
    tags.push(`<meta name="twitter:card" content="${meta.twitter.card}">`);
    tags.push(`<meta name="twitter:title" content="${escapeHtml(meta.twitter.title)}">`);
    tags.push(`<meta name="twitter:description" content="${escapeHtml(meta.twitter.description)}">`);
    if (meta.twitter.image) {
      tags.push(`<meta name="twitter:image" content="${meta.twitter.image}">`);
    }
    if (meta.twitter.site) {
      tags.push(`<meta name="twitter:site" content="${meta.twitter.site}">`);
    }
  }
  
  // Canonical
  if (meta.canonical) {
    tags.push(`<link rel="canonical" href="${meta.canonical}">`);
  }
  
  // Hreflang
  for (const link of (meta.hreflang || [])) {
    tags.push(`<link rel="alternate" hreflang="${link.lang}" href="${link.url}">`);
  }
  
  // Structured data
  for (const schema of (meta.structuredData || [])) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(schema)}</script>`);
  }
  
  return tags.join('\n');
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default useSEO;
