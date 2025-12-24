/**
 * SEO Service
 * Generates meta tags, structured data, and hreflang tags from TTL golden source
 * All SEO configuration derived from TTL - no hardcoding
 */

import { getConfigService } from './config-service.js';
import { getI18nService } from './i18n-service.js';

/**
 * SEO Service Class
 */
class SEOService {
  constructor() {
    this.config = null;
    this.languages = [];
  }

  /**
   * Initialize from configuration service
   */
  initialize() {
    const configService = getConfigService();
    this.config = configService.getSEOConfig();
    this.languages = configService.getLanguages();
  }

  /**
   * Generate page title
   */
  generateTitle(pageData, lang = 'en') {
    const template = this.config.metaTemplates?.[pageData.pageType];
    if (!template?.titleTemplate) {
      return `${pageData.title || 'Page'} ${this.config.titleSeparator} ${this.config.titleSuffix}`;
    }

    let title = template.titleTemplate[lang] || template.titleTemplate['en'] || '';
    return this.interpolateTemplate(title, pageData);
  }

  /**
   * Generate meta description
   */
  generateDescription(pageData, lang = 'en') {
    const template = this.config.metaTemplates?.[pageData.pageType];
    if (!template?.descriptionTemplate) {
      return pageData.description || '';
    }

    let description = template.descriptionTemplate[lang] || template.descriptionTemplate['en'] || '';
    return this.interpolateTemplate(description, pageData);
  }

  /**
   * Interpolate template variables
   */
  interpolateTemplate(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }

  /**
   * Generate complete meta tags for a page
   */
  generateMetaTags(pageData, lang = 'en') {
    const title = this.generateTitle(pageData, lang);
    const description = this.generateDescription(pageData, lang);
    const template = this.config.metaTemplates?.[pageData.pageType];

    const tags = {
      title,
      meta: [
        { name: 'description', content: description },
        { name: 'robots', content: template?.noIndex ? 'noindex, nofollow' : 'index, follow' }
      ],
      og: [
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: template?.ogType || 'website' },
        { property: 'og:url', content: pageData.canonicalUrl || pageData.url },
        { property: 'og:site_name', content: this.config.siteName },
        { property: 'og:locale', content: this.getLocaleCode(lang) }
      ],
      twitter: [
        { name: 'twitter:card', content: this.config.twitterCard || 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description }
      ],
      link: []
    };

    // Add image meta tags
    if (pageData.image) {
      tags.og.push({ property: 'og:image', content: pageData.image });
      tags.twitter.push({ name: 'twitter:image', content: pageData.image });
    } else if (this.config.defaultOgImage) {
      tags.og.push({ property: 'og:image', content: this.config.defaultOgImage });
      tags.twitter.push({ name: 'twitter:image', content: this.config.defaultOgImage });
    }

    // Add Twitter site handle
    if (this.config.twitterSite) {
      tags.twitter.push({ name: 'twitter:site', content: this.config.twitterSite });
    }

    // Add Facebook App ID
    if (this.config.facebookAppId) {
      tags.og.push({ property: 'fb:app_id', content: this.config.facebookAppId });
    }

    // Add canonical URL
    if (pageData.canonicalUrl) {
      tags.link.push({ rel: 'canonical', href: pageData.canonicalUrl });
    }

    // Add hreflang tags
    if (this.config.hreflang?.enabled) {
      tags.link.push(...this.generateHreflangTags(pageData));
    }

    return tags;
  }

  /**
   * Get locale code for og:locale
   */
  getLocaleCode(langCode) {
    const langDetails = this.languages.find(l => l.code === langCode);
    return langDetails?.locale?.replace('-', '_') || 'en_US';
  }

  /**
   * Generate hreflang tags for multilingual pages
   */
  generateHreflangTags(pageData) {
    const tags = [];
    const baseUrl = this.config.siteUrl || '';

    for (const lang of this.languages) {
      if (!lang.enabled) continue;

      const href = this.buildLocalizedUrl(pageData.path, lang.code, baseUrl);
      tags.push({
        rel: 'alternate',
        hreflang: lang.code,
        href
      });

      // Add regional variants
      if (lang.regions) {
        for (const region of lang.regions) {
          tags.push({
            rel: 'alternate',
            hreflang: `${lang.code}-${region}`,
            href
          });
        }
      }
    }

    // Add x-default
    if (this.config.hreflang?.xDefaultLocale) {
      const defaultHref = this.buildLocalizedUrl(
        pageData.path, 
        this.config.hreflang.xDefaultLocale, 
        baseUrl
      );
      tags.push({
        rel: 'alternate',
        hreflang: 'x-default',
        href: defaultHref
      });
    }

    return tags;
  }

  /**
   * Build localized URL
   */
  buildLocalizedUrl(path, langCode, baseUrl) {
    const defaultLang = this.config.hreflang?.defaultLocale || 'en';
    
    // Don't add language prefix for default language
    if (langCode === defaultLang) {
      return `${baseUrl}${path}`;
    }
    
    return `${baseUrl}/${langCode}${path}`;
  }

  /**
   * Generate JSON-LD structured data
   */
  generateStructuredData(pageData, lang = 'en') {
    const schemas = [];

    // Organization schema (for all pages)
    schemas.push(this.generateOrganizationSchema());

    // Page-specific schemas
    switch (pageData.pageType) {
      case 'gallery':
      case 'photoset':
        schemas.push(this.generateImageGallerySchema(pageData, lang));
        break;
      case 'photo':
        schemas.push(this.generateImageObjectSchema(pageData, lang));
        break;
      case 'video':
        schemas.push(this.generateVideoObjectSchema(pageData, lang));
        break;
      case 'creator':
        schemas.push(this.generatePersonSchema(pageData, lang));
        break;
    }

    // Breadcrumb schema
    if (pageData.breadcrumbs) {
      schemas.push(this.generateBreadcrumbSchema(pageData.breadcrumbs, lang));
    }

    return schemas;
  }

  /**
   * Generate Organization schema
   */
  generateOrganizationSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: this.config.siteName,
      url: this.config.siteUrl,
      logo: this.config.defaultOgImage,
      sameAs: this.config.socialProfiles || []
    };
  }

  /**
   * Generate ImageGallery schema
   */
  generateImageGallerySchema(pageData, lang) {
    return {
      '@context': 'https://schema.org',
      '@type': 'ImageGallery',
      name: pageData.title,
      description: pageData.description,
      url: pageData.url,
      image: pageData.images?.map(img => ({
        '@type': 'ImageObject',
        contentUrl: img.url,
        thumbnail: img.thumbnail,
        name: img.title,
        description: img.description
      })) || [],
      numberOfItems: pageData.imageCount,
      datePublished: pageData.publishedAt,
      dateModified: pageData.updatedAt
    };
  }

  /**
   * Generate ImageObject schema
   */
  generateImageObjectSchema(pageData, lang) {
    return {
      '@context': 'https://schema.org',
      '@type': 'ImageObject',
      contentUrl: pageData.imageUrl,
      thumbnailUrl: pageData.thumbnailUrl,
      name: pageData.title,
      description: pageData.description,
      width: pageData.width,
      height: pageData.height,
      uploadDate: pageData.uploadedAt,
      author: pageData.creator ? {
        '@type': 'Person',
        name: pageData.creator.name,
        url: pageData.creator.url
      } : undefined,
      interactionStatistic: [
        {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/ViewAction',
          userInteractionCount: pageData.viewCount
        },
        {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/LikeAction',
          userInteractionCount: pageData.likeCount
        }
      ]
    };
  }

  /**
   * Generate VideoObject schema
   */
  generateVideoObjectSchema(pageData, lang) {
    return {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: pageData.title,
      description: pageData.description,
      thumbnailUrl: pageData.thumbnailUrl,
      contentUrl: pageData.videoUrl,
      embedUrl: pageData.embedUrl,
      duration: pageData.duration ? `PT${Math.floor(pageData.duration / 60)}M${pageData.duration % 60}S` : undefined,
      uploadDate: pageData.uploadedAt,
      author: pageData.creator ? {
        '@type': 'Person',
        name: pageData.creator.name,
        url: pageData.creator.url
      } : undefined,
      interactionStatistic: [
        {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/WatchAction',
          userInteractionCount: pageData.viewCount
        }
      ]
    };
  }

  /**
   * Generate Person schema (for creator pages)
   */
  generatePersonSchema(pageData, lang) {
    return {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: pageData.name,
      description: pageData.bio,
      image: pageData.avatarUrl,
      url: pageData.url,
      sameAs: pageData.socialLinks || []
    };
  }

  /**
   * Generate BreadcrumbList schema
   */
  generateBreadcrumbSchema(breadcrumbs, lang) {
    const i18n = getI18nService();
    
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.translationKey ? i18n.t(crumb.translationKey) : crumb.name,
        item: crumb.url
      }))
    };
  }

  /**
   * Generate robots.txt content
   */
  generateRobotsTxt() {
    const baseUrl = this.config.siteUrl || '';
    
    let content = `# Generated from TTL configuration\n\n`;
    content += `User-agent: *\n`;
    content += `Allow: /\n`;
    content += `Disallow: /api/\n`;
    content += `Disallow: /admin/\n`;
    content += `Disallow: /private/\n`;
    content += `Disallow: /search\n\n`;
    
    content += `Sitemap: ${baseUrl}/sitemap.xml\n`;
    
    return content;
  }

  /**
   * Generate sitemap index
   */
  generateSitemapIndex() {
    const baseUrl = this.config.siteUrl || '';
    
    const sitemaps = [
      { loc: `${baseUrl}/sitemap-galleries.xml`, lastmod: new Date().toISOString() },
      { loc: `${baseUrl}/sitemap-photos.xml`, lastmod: new Date().toISOString() },
      { loc: `${baseUrl}/sitemap-videos.xml`, lastmod: new Date().toISOString() },
      { loc: `${baseUrl}/sitemap-categories.xml`, lastmod: new Date().toISOString() },
      { loc: `${baseUrl}/sitemap-creators.xml`, lastmod: new Date().toISOString() },
      { loc: `${baseUrl}/sitemap-pages.xml`, lastmod: new Date().toISOString() }
    ];

    return {
      '@xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9',
      sitemapindex: {
        sitemap: sitemaps
      }
    };
  }

  /**
   * Render meta tags as HTML
   */
  renderMetaTags(tags) {
    let html = `<title>${this.escapeHtml(tags.title)}</title>\n`;

    // Regular meta tags
    for (const meta of tags.meta) {
      html += `<meta name="${meta.name}" content="${this.escapeHtml(meta.content)}">\n`;
    }

    // Open Graph tags
    for (const og of tags.og) {
      html += `<meta property="${og.property}" content="${this.escapeHtml(og.content)}">\n`;
    }

    // Twitter tags
    for (const twitter of tags.twitter) {
      html += `<meta name="${twitter.name}" content="${this.escapeHtml(twitter.content)}">\n`;
    }

    // Link tags
    for (const link of tags.link) {
      const attrs = Object.entries(link)
        .map(([key, value]) => `${key}="${this.escapeHtml(value)}"`)
        .join(' ');
      html += `<link ${attrs}>\n`;
    }

    return html;
  }

  /**
   * Render structured data as script tag
   */
  renderStructuredData(schemas) {
    return schemas.map(schema => 
      `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`
    ).join('\n');
  }

  /**
   * Escape HTML entities
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = { textContent: text };
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Singleton instance
let seoInstance = null;

/**
 * Get SEO service instance
 */
export function getSEOService() {
  if (!seoInstance) {
    seoInstance = new SEOService();
    seoInstance.initialize();
  }
  return seoInstance;
}

export { SEOService };
export default { getSEOService, SEOService };
