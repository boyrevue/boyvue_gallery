/**
 * BongaCams Spider
 *
 * Fetches male performers from BongaCams affiliate API.
 * BongaCams provides a JSON feed of online performers.
 *
 * API Endpoint: https://bongacams.com/tools/listing_v3.php
 * Parameters:
 *   - livetab: 'male' for male performers
 *   - online_only: 'true' for only online performers
 *   - limit: number of results
 *   - offset: pagination offset
 */

import BaseSpider from './base-spider.js';
import https from 'https';

class BongaCamsSpider extends BaseSpider {
  constructor(pool, options = {}) {
    super(pool, 'bongacams', options);

    this.apiEndpoint = 'bongacams.com';
    this.affiliateId = options.affiliateId || process.env.BONGACAMS_AFFILIATE_ID || '';
    this.gender = options.gender || 'male';
    this.onlineOnly = options.onlineOnly !== false;
    this.limit = options.limit || 100;
  }

  /**
   * Fetch performers from BongaCams API
   */
  async fetchPerformers(options = {}) {
    const { offset = 0, limit = this.limit } = options;
    const performers = [];

    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        livetab: this.gender,
        online_only: this.onlineOnly ? 'true' : 'false',
        limit: limit.toString(),
        offset: offset.toString(),
        c: this.affiliateId || ''
      });

      const requestOptions = {
        hostname: this.apiEndpoint,
        path: `/tools/listing_v3.php?${params.toString()}`,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BoyVue Affiliate Spider/1.0'
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
              for (const model of result.models) {
                performers.push(model);
              }
            } else if (Array.isArray(result)) {
              // Some endpoints return array directly
              for (const model of result) {
                performers.push(model);
              }
            }

            resolve(performers);
          } catch (err) {
            console.error('Error parsing BongaCams response:', err.message);
            // Try alternative parsing
            try {
              // BongaCams sometimes wraps in callback
              const jsonMatch = data.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                if (result.models) {
                  resolve(result.models);
                  return;
                }
              }
            } catch (e) {
              // Ignore secondary parse error
            }
            resolve([]);
          }
        });
      });

      req.on('error', (err) => {
        console.error('BongaCams API request error:', err.message);
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
   * Alternative: Fetch from public online listing
   */
  async fetchFromPublicListing() {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: 'bongacams.com',
        path: '/tools/amf.php',
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'BoyVue Affiliate Spider/1.0'
        }
      };

      const postData = new URLSearchParams({
        method: 'getRoomList',
        args: JSON.stringify({
          gender: this.gender === 'male' ? 'male' : 'female',
          limit: this.limit,
          offset: 0
        })
      }).toString();

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result.models || result || []);
          } catch (e) {
            resolve([]);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Normalize BongaCams performer data to our schema
   */
  normalizePerformer(raw) {
    return {
      external_id: raw.username || raw.performer_id || raw.id?.toString(),
      username: raw.username || raw.display_name,
      display_name: raw.display_name || raw.username,
      profile_url: `https://bongacams.com/${raw.username}`,
      avatar_url: raw.profile_images?.profile_image || raw.thumb || raw.avatar,
      cover_photo_url: raw.profile_images?.cover_image || null,
      bio: raw.about_me || raw.bio || null,
      categories: this.extractCategories(raw),
      gender: raw.gender || this.gender,
      body_type: raw.body_type || null,
      ethnicity: raw.ethnicity || null,
      age: raw.age ? parseInt(raw.age) : null,
      location: raw.country || raw.location || null,
      is_verified: raw.is_verified || false,
      is_online: raw.online !== false && raw.online !== 0,
      last_online: raw.last_online ? new Date(raw.last_online) : new Date(),
      follower_count: raw.followers ? parseInt(raw.followers) : null,
      languages: raw.languages ? (Array.isArray(raw.languages) ? raw.languages : [raw.languages]) : null,
      social_links: null,
      raw_data: raw
    };
  }

  /**
   * Extract categories/tags from BongaCams data
   */
  extractCategories(raw) {
    const categories = [];

    if (raw.tags && Array.isArray(raw.tags)) {
      categories.push(...raw.tags);
    }

    if (raw.categories && Array.isArray(raw.categories)) {
      categories.push(...raw.categories);
    }

    // Add known attributes as categories
    if (raw.body_type) categories.push(raw.body_type);
    if (raw.ethnicity) categories.push(raw.ethnicity);
    if (raw.hair_color) categories.push(raw.hair_color);
    if (raw.eye_color) categories.push(raw.eye_color);

    return [...new Set(categories)]; // Dedupe
  }

  /**
   * Build affiliate tracking URL
   */
  buildAffiliateUrl(performer) {
    const baseUrl = performer.profile_url || `https://bongacams.com/${performer.username}`;

    if (this.affiliateId) {
      // BongaCams affiliate link format
      return `https://bongacams.com/${performer.username}/?c=${this.affiliateId}`;
    }

    return baseUrl;
  }

  /**
   * Override run to handle BongaCams-specific pagination
   */
  async run() {
    console.log(`\n=== Starting BongaCams Spider ===`);
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

        const rawPerformers = await this.fetchPerformers({ offset, limit: batchSize });

        if (rawPerformers.length === 0) {
          console.log('No more performers found');
          break;
        }

        console.log(`Processing ${rawPerformers.length} performers...`);

        for (const raw of rawPerformers) {
          const normalized = this.normalizePerformer(raw);

          if (!normalized.external_id || !normalized.username) {
            console.log(`Skipping invalid performer: ${JSON.stringify(raw).slice(0, 100)}`);
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

        // Stop if we got fewer than requested (end of list)
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

      console.log(`\n=== BongaCams Spider Complete ===`);
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

export default BongaCamsSpider;
