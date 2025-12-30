/**
 * Chaturbate Spider
 * Fetches performer data from Chaturbate affiliate API
 *
 * API Documentation: https://chaturbate.com/affiliates/promotools/api_guide.php
 */

import { BaseSpider } from './base-spider.js';

export class ChaturbateSpider extends BaseSpider {
  constructor(options = {}) {
    super('chaturbate', {
      rateLimitMs: 2000, // 2 seconds between requests
      ...options
    });

    // Chaturbate API settings
    this.apiBase = 'https://chaturbate.com/api/public/affiliates/onlinerooms/';
    this.gender = options.gender || 'm'; // m = male, f = female, s = trans, c = couple
  }

  /**
   * Build API URL with affiliate tracking
   */
  buildApiUrl(options = {}) {
    const params = new URLSearchParams({
      wm: this.account.affiliate_id || this.account.tracking_code,
      client_ip: 'request',
      gender: options.gender || this.gender,
      limit: options.limit || 100,
      offset: options.offset || 0
    });

    // Optional filters
    if (options.tag) params.append('tag', options.tag);
    if (options.region) params.append('region', options.region);
    if (options.hd) params.append('hd', '1');

    return `${this.apiBase}?${params.toString()}`;
  }

  /**
   * Fetch performers from Chaturbate API
   */
  async fetchPerformers(options = {}) {
    const allPerformers = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    console.log(`[chaturbate] Fetching male performers...`);

    while (hasMore) {
      const url = this.buildApiUrl({
        gender: this.gender,
        limit,
        offset,
        ...options
      });

      try {
        const response = await this.fetch(url);
        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
          hasMore = false;
        } else {
          allPerformers.push(...data);
          console.log(`[chaturbate] Fetched ${data.length} performers (total: ${allPerformers.length})`);

          // Check if we got a full page
          if (data.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
            await this.delay(this.rateLimitMs);
          }
        }

        // Limit total to prevent runaway
        if (allPerformers.length >= 1000) {
          console.log(`[chaturbate] Reached limit of 1000 performers`);
          hasMore = false;
        }
      } catch (err) {
        console.error(`[chaturbate] Error fetching page:`, err.message);
        hasMore = false;
      }
    }

    return allPerformers;
  }

  /**
   * Normalize Chaturbate performer data to standard format
   */
  normalizePerformer(raw) {
    if (!raw || !raw.username) return null;

    // Parse tags into categories
    const categories = [];
    if (raw.tags) {
      categories.push(...raw.tags);
    }

    // Determine body type from tags
    let bodyType = null;
    if (categories.includes('twink')) bodyType = 'twink';
    else if (categories.includes('muscle') || categories.includes('muscular')) bodyType = 'muscle';
    else if (categories.includes('bear')) bodyType = 'bear';
    else if (categories.includes('jock')) bodyType = 'jock';
    else if (categories.includes('daddy')) bodyType = 'daddy';

    return {
      external_id: raw.username, // Chaturbate uses username as unique ID
      username: raw.username,
      display_name: raw.display_name || raw.username,
      profile_url: `https://chaturbate.com/${raw.username}`,
      avatar_url: raw.image_url || raw.image_url_360x270 || null,
      cover_photo_url: raw.image_url_360x270 || null,
      bio: raw.subject || null, // Current broadcast subject
      categories: categories,
      gender: this.mapGender(raw.gender),
      body_type: bodyType,
      ethnicity: null, // Not provided by API
      age: raw.age || null,
      location: raw.location || null,
      is_verified: raw.is_hd || false, // HD streams are often verified
      is_online: true, // All results from this API are online
      last_online: new Date(),
      follower_count: raw.num_followers || null,
      subscriber_count: null, // Not provided
      media_count: null,
      video_count: null,
      photo_count: null,
      subscription_price: null, // Free site
      subscription_currency: 'USD',
      free_trial_days: null,
      languages: raw.spoken_languages ? raw.spoken_languages.split(',').map(l => l.trim()) : [],
      social_links: {},
      raw_data: {
        seconds_online: raw.seconds_online,
        num_users: raw.num_users,
        is_hd: raw.is_hd,
        is_new: raw.is_new,
        current_show: raw.current_show,
        iframe_embed: raw.iframe_embed,
        chat_room_url: raw.chat_room_url
      }
    };
  }

  /**
   * Map Chaturbate gender code to standard
   */
  mapGender(code) {
    const map = {
      'm': 'male',
      'f': 'female',
      's': 'trans',
      'c': 'couple'
    };
    return map[code] || code;
  }

  /**
   * Build affiliate tracking URL for a performer
   */
  buildAffiliateUrl(performer) {
    const trackingCode = this.account.tracking_code || this.account.affiliate_id;
    return `https://chaturbate.com/in/?track=default&tour=dT8X&campaign=${trackingCode}&room=${performer.username}`;
  }

  /**
   * After run: Generate affiliate links for new performers
   */
  async afterRun() {
    console.log(`[chaturbate] Generating affiliate links for promoted performers...`);

    // Get promoted performers without affiliate links
    const result = await this.pool.query(`
      SELECT p.id, p.username, p.profile_url
      FROM performers p
      JOIN performer_selections ps ON p.id = ps.performer_id
      LEFT JOIN affiliate_links al ON p.id = al.performer_id AND al.is_active = true
      WHERE p.platform_id = $1
        AND ps.is_promoted = true
        AND al.id IS NULL
    `, [this.platform.id]);

    let linksCreated = 0;
    for (const performer of result.rows) {
      const affiliateUrl = this.buildAffiliateUrl(performer);
      const shortCode = this.generateShortCode();

      await this.pool.query(`
        INSERT INTO affiliate_links
          (account_id, performer_id, link_type, original_url, affiliate_url, short_code)
        VALUES ($1, $2, 'live', $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [this.account.id, performer.id, performer.profile_url, affiliateUrl, shortCode]);

      linksCreated++;
    }

    console.log(`[chaturbate] Created ${linksCreated} affiliate links`);
  }

  /**
   * Generate random short code for affiliate links
   */
  generateShortCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

export default ChaturbateSpider;
