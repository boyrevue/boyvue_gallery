/**
 * Stripchat Spider
 *
 * Fetches male performers from Stripchat affiliate API.
 * Stripchat has a similar API structure to Chaturbate.
 *
 * API Endpoint: https://stripchat.com/api/front/v2/models
 * Parameters:
 *   - gender: 'male' for male performers
 *   - limit: number of results
 *   - offset: pagination offset
 *   - online: filter by online status
 */

import BaseSpider from './base-spider.js';
import https from 'https';

class StripchatSpider extends BaseSpider {
  constructor(pool, options = {}) {
    super(pool, 'stripchat', options);

    this.apiEndpoint = 'stripchat.com';
    this.affiliateId = options.affiliateId || process.env.STRIPCHAT_AFFILIATE_ID || '';
    this.gender = options.gender || 'male';
    this.onlineOnly = options.onlineOnly !== false;
    this.limit = options.limit || 100;
  }

  /**
   * Fetch performers from Stripchat API
   */
  async fetchPerformers(options = {}) {
    const { offset = 0, limit = this.limit } = options;

    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        primaryTag: 'men',
        filterGroupTags: '[]',
        sortBy: this.onlineOnly ? 'viewers' : 'popular'
      });

      const requestOptions = {
        hostname: this.apiEndpoint,
        path: `/api/front/v2/models?${params.toString()}`,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BoyVue Affiliate Spider/1.0',
          'Origin': 'https://stripchat.com',
          'Referer': 'https://stripchat.com/men'
        }
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(data);

            if (result.models && Array.isArray(result.models)) {
              resolve(result.models);
            } else if (result.data && Array.isArray(result.data)) {
              resolve(result.data);
            } else if (Array.isArray(result)) {
              resolve(result);
            } else {
              console.log('Unexpected Stripchat response structure:', Object.keys(result));
              resolve([]);
            }
          } catch (err) {
            console.error('Error parsing Stripchat response:', err.message);
            resolve([]);
          }
        });
      });

      req.on('error', (err) => {
        console.error('Stripchat API request error:', err.message);
        reject(err);
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Alternative: Fetch from public online listing with different endpoint
   */
  async fetchFromWebApi() {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: 'stripchat.com',
        path: '/api/front/v2/models?sortBy=viewers&primaryTag=men&limit=100',
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; BoyVue/1.0)'
        }
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result.models || result.data || []);
          } catch (e) {
            console.error('Parse error:', e.message);
            resolve([]);
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Normalize Stripchat performer data to our schema
   */
  normalizePerformer(raw) {
    return {
      external_id: raw.id?.toString() || raw.username,
      username: raw.username || raw.name,
      display_name: raw.displayName || raw.display_name || raw.username,
      profile_url: `https://stripchat.com/${raw.username}`,
      avatar_url: raw.avatarUrl || raw.previewUrl || raw.snapshotUrl,
      cover_photo_url: raw.coverUrl || null,
      bio: raw.description || raw.aboutMe || raw.bio || null,
      categories: this.extractCategories(raw),
      gender: raw.gender || this.gender,
      body_type: raw.bodyType || null,
      ethnicity: raw.ethnicity || null,
      age: raw.age ? parseInt(raw.age) : null,
      location: raw.country || raw.location || null,
      is_verified: raw.isVerified || raw.verified || false,
      is_online: raw.isLive || raw.isOnline || raw.status === 'public',
      last_online: raw.lastBroadcast ? new Date(raw.lastBroadcast) : new Date(),
      follower_count: raw.favoritesCount || raw.followers ? parseInt(raw.favoritesCount || raw.followers) : null,
      subscriber_count: raw.subscribersCount ? parseInt(raw.subscribersCount) : null,
      languages: raw.languages || null,
      social_links: this.extractSocialLinks(raw),
      raw_data: raw
    };
  }

  /**
   * Extract categories/tags from Stripchat data
   */
  extractCategories(raw) {
    const categories = [];

    if (raw.tags && Array.isArray(raw.tags)) {
      categories.push(...raw.tags.map(t => t.name || t));
    }

    if (raw.hashtags && Array.isArray(raw.hashtags)) {
      categories.push(...raw.hashtags);
    }

    // Add attributes as categories
    if (raw.bodyType) categories.push(raw.bodyType);
    if (raw.ethnicity) categories.push(raw.ethnicity);
    if (raw.hairColor) categories.push(raw.hairColor);
    if (raw.eyeColor) categories.push(raw.eyeColor);
    if (raw.breastSize) categories.push(raw.breastSize);
    if (raw.pubicHair) categories.push(raw.pubicHair);

    return [...new Set(categories.filter(c => c))];
  }

  /**
   * Extract social links
   */
  extractSocialLinks(raw) {
    const links = {};

    if (raw.socialLinks) {
      if (raw.socialLinks.twitter) links.twitter = raw.socialLinks.twitter;
      if (raw.socialLinks.instagram) links.instagram = raw.socialLinks.instagram;
      if (raw.socialLinks.tiktok) links.tiktok = raw.socialLinks.tiktok;
    }

    if (raw.twitter) links.twitter = raw.twitter;
    if (raw.instagram) links.instagram = raw.instagram;

    return Object.keys(links).length > 0 ? links : null;
  }

  /**
   * Build affiliate tracking URL
   */
  buildAffiliateUrl(performer) {
    const baseUrl = `https://stripchat.com/${performer.username}`;

    if (this.affiliateId) {
      // Stripchat affiliate link format with campaign tracking
      return `https://go.stripchat.com/${performer.username}?affId=${this.affiliateId}`;
    }

    return baseUrl;
  }

  /**
   * Override run to handle Stripchat-specific pagination
   */
  async run() {
    console.log(`\n=== Starting Stripchat Spider ===`);
    console.log(`Gender: ${this.gender}`);
    console.log(`Online only: ${this.onlineOnly}`);

    // Create job record
    this.jobId = await this.createJob('full_crawl');

    let totalProcessed = 0;
    let totalAdded = 0;
    let totalUpdated = 0;
    let offset = 0;
    const batchSize = this.limit;

    try {
      while (true) {
        console.log(`\nFetching batch at offset ${offset}...`);

        let rawPerformers;
        try {
          rawPerformers = await this.fetchPerformers({ offset, limit: batchSize });
        } catch (err) {
          console.log('Primary API failed, trying alternative...');
          rawPerformers = await this.fetchFromWebApi();
        }

        if (rawPerformers.length === 0) {
          console.log('No more performers found');
          break;
        }

        console.log(`Processing ${rawPerformers.length} performers...`);

        for (const raw of rawPerformers) {
          const normalized = this.normalizePerformer(raw);

          if (!normalized.external_id || !normalized.username) {
            console.log(`Skipping invalid performer`);
            continue;
          }

          const result = await this.savePerformer(normalized);
          totalProcessed++;

          if (result.action === 'inserted') {
            totalAdded++;
          } else if (result.action === 'updated') {
            totalUpdated++;
          }

          // Rate limit
          await this.sleep(this.rateLimitMs);
        }

        offset += batchSize;

        // Stop if we got fewer than requested
        if (rawPerformers.length < batchSize) {
          break;
        }

        // Safety limit
        if (offset >= 5000) {
          console.log('Reached safety limit of 5000 performers');
          break;
        }
      }

      // Complete job
      await this.completeJob(totalProcessed, totalAdded, 0);

      console.log(`\n=== Stripchat Spider Complete ===`);
      console.log(`Total processed: ${totalProcessed}`);
      console.log(`Added: ${totalAdded}`);
      console.log(`Updated: ${totalUpdated}`);

      return { processed: totalProcessed, added: totalAdded, updated: totalUpdated };

    } catch (err) {
      console.error('Spider error:', err);
      await this.failJob(err.message);
      throw err;
    }
  }
}

export default StripchatSpider;
