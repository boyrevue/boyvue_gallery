/**
 * Base Spider Class
 * Abstract base class for all platform-specific spiders
 */

import pg from 'pg';

const { Pool } = pg;

export class BaseSpider {
  constructor(platformSlug, options = {}) {
    this.platformSlug = platformSlug;
    this.platform = null;
    this.account = null;
    this.jobId = null;

    // Configuration
    this.rateLimitMs = options.rateLimitMs || 1000; // Default 1 second between requests
    this.maxRetries = options.maxRetries || 3;
    this.batchSize = options.batchSize || 100;
    this.timeout = options.timeout || 30000;

    // Stats
    this.stats = {
      processed: 0,
      added: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };

    // Database pool
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'gallery',
      user: 'galleryuser',
      password: 'apple1apple'
    });

    // Error log
    this.errorLog = [];
  }

  /**
   * Initialize spider - load platform and account data
   */
  async init() {
    // Load platform
    const platformResult = await this.pool.query(
      'SELECT * FROM affiliate_platforms WHERE slug = $1 AND is_active = true',
      [this.platformSlug]
    );

    if (platformResult.rows.length === 0) {
      throw new Error(`Platform not found or inactive: ${this.platformSlug}`);
    }

    this.platform = platformResult.rows[0];

    // Load account
    const accountResult = await this.pool.query(
      'SELECT * FROM affiliate_accounts WHERE platform_id = $1 AND account_status = $2',
      [this.platform.id, 'active']
    );

    if (accountResult.rows.length === 0) {
      throw new Error(`No active account found for platform: ${this.platformSlug}`);
    }

    this.account = accountResult.rows[0];

    console.log(`[${this.platformSlug}] Spider initialized`);
    console.log(`  Platform: ${this.platform.name}`);
    console.log(`  Account: ${this.account.account_name}`);

    return this;
  }

  /**
   * Create a spider job record
   */
  async createJob(jobType = 'full_sync') {
    const result = await this.pool.query(`
      INSERT INTO spider_jobs (platform_id, job_type, status, started_at, triggered_by)
      VALUES ($1, $2, 'running', NOW(), 'script')
      RETURNING id
    `, [this.platform.id, jobType]);

    this.jobId = result.rows[0].id;
    console.log(`[${this.platformSlug}] Job created: ${this.jobId}`);
    return this.jobId;
  }

  /**
   * Update job progress
   */
  async updateJobProgress(progress = null) {
    if (!this.jobId) return;

    await this.pool.query(`
      UPDATE spider_jobs SET
        items_processed = $2,
        items_added = $3,
        items_updated = $4,
        items_skipped = $5,
        errors_count = $6,
        progress_percent = $7
      WHERE id = $1
    `, [
      this.jobId,
      this.stats.processed,
      this.stats.added,
      this.stats.updated,
      this.stats.skipped,
      this.stats.errors,
      progress
    ]);
  }

  /**
   * Complete the job
   */
  async completeJob(status = 'completed') {
    if (!this.jobId) return;

    await this.pool.query(`
      UPDATE spider_jobs SET
        status = $2,
        completed_at = NOW(),
        items_processed = $3,
        items_added = $4,
        items_updated = $5,
        items_skipped = $6,
        errors_count = $7,
        error_log = $8,
        progress_percent = 100
      WHERE id = $1
    `, [
      this.jobId,
      status,
      this.stats.processed,
      this.stats.added,
      this.stats.updated,
      this.stats.skipped,
      this.stats.errors,
      this.errorLog.length > 0 ? this.errorLog.join('\n') : null
    ]);

    console.log(`[${this.platformSlug}] Job ${this.jobId} ${status}`);
  }

  /**
   * Run the spider
   */
  async run(options = {}) {
    try {
      await this.init();
      await this.createJob(options.jobType || 'full_sync');

      console.log(`[${this.platformSlug}] Starting spider run...`);

      await this.beforeRun();

      const performers = await this.fetchPerformers(options);
      console.log(`[${this.platformSlug}] Fetched ${performers.length} performers`);

      const total = performers.length;
      for (let i = 0; i < performers.length; i++) {
        try {
          await this.processPerformer(performers[i]);

          // Update progress every 10 items
          if (i % 10 === 0) {
            const progress = Math.round((i / total) * 100);
            await this.updateJobProgress(progress);
            console.log(`[${this.platformSlug}] Progress: ${progress}% (${i}/${total})`);
          }

          // Rate limiting
          if (i < performers.length - 1) {
            await this.delay(this.rateLimitMs);
          }
        } catch (err) {
          this.stats.errors++;
          this.errorLog.push(`Error processing performer: ${err.message}`);
          console.error(`[${this.platformSlug}] Error:`, err.message);
        }
      }

      await this.afterRun();
      await this.completeJob('completed');

      console.log(`[${this.platformSlug}] Spider run complete`);
      console.log(`  Processed: ${this.stats.processed}`);
      console.log(`  Added: ${this.stats.added}`);
      console.log(`  Updated: ${this.stats.updated}`);
      console.log(`  Skipped: ${this.stats.skipped}`);
      console.log(`  Errors: ${this.stats.errors}`);

      return this.stats;
    } catch (err) {
      console.error(`[${this.platformSlug}] Spider failed:`, err.message);
      this.errorLog.push(`Fatal error: ${err.message}`);
      await this.completeJob('failed');
      throw err;
    } finally {
      await this.pool.end();
    }
  }

  /**
   * Process a single performer
   */
  async processPerformer(rawPerformer) {
    this.stats.processed++;

    // Normalize the performer data
    const performer = this.normalizePerformer(rawPerformer);

    if (!performer || !performer.external_id || !performer.username) {
      this.stats.skipped++;
      return;
    }

    // Check if performer exists
    const existing = await this.pool.query(
      'SELECT id FROM performers WHERE platform_id = $1 AND external_id = $2',
      [this.platform.id, performer.external_id]
    );

    if (existing.rows.length > 0) {
      // Update existing performer
      await this.updatePerformer(existing.rows[0].id, performer);
      this.stats.updated++;
    } else {
      // Insert new performer
      await this.insertPerformer(performer);
      this.stats.added++;
    }
  }

  /**
   * Insert new performer
   */
  async insertPerformer(performer) {
    const result = await this.pool.query(`
      INSERT INTO performers (
        platform_id, external_id, username, display_name, profile_url,
        avatar_url, cover_photo_url, bio, categories, gender, body_type,
        ethnicity, age, location, is_verified, is_online, last_online,
        follower_count, subscriber_count, media_count, video_count, photo_count,
        subscription_price, subscription_currency, free_trial_days, languages,
        social_links, last_spidered, raw_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW(), $28
      ) RETURNING id
    `, [
      this.platform.id,
      performer.external_id,
      performer.username,
      performer.display_name,
      performer.profile_url,
      performer.avatar_url,
      performer.cover_photo_url,
      performer.bio,
      performer.categories || [],
      performer.gender,
      performer.body_type,
      performer.ethnicity,
      performer.age,
      performer.location,
      performer.is_verified || false,
      performer.is_online || false,
      performer.last_online,
      performer.follower_count,
      performer.subscriber_count,
      performer.media_count,
      performer.video_count,
      performer.photo_count,
      performer.subscription_price,
      performer.subscription_currency || 'USD',
      performer.free_trial_days,
      performer.languages || [],
      performer.social_links || {},
      performer.raw_data || {}
    ]);

    return result.rows[0].id;
  }

  /**
   * Update existing performer
   */
  async updatePerformer(id, performer) {
    await this.pool.query(`
      UPDATE performers SET
        username = $2,
        display_name = COALESCE($3, display_name),
        profile_url = COALESCE($4, profile_url),
        avatar_url = COALESCE($5, avatar_url),
        cover_photo_url = COALESCE($6, cover_photo_url),
        bio = COALESCE($7, bio),
        categories = COALESCE($8, categories),
        is_verified = COALESCE($9, is_verified),
        is_online = $10,
        last_online = COALESCE($11, last_online),
        follower_count = COALESCE($12, follower_count),
        media_count = COALESCE($13, media_count),
        subscription_price = COALESCE($14, subscription_price),
        last_spidered = NOW(),
        raw_data = COALESCE($15, raw_data),
        updated_at = NOW()
      WHERE id = $1
    `, [
      id,
      performer.username,
      performer.display_name,
      performer.profile_url,
      performer.avatar_url,
      performer.cover_photo_url,
      performer.bio,
      performer.categories,
      performer.is_verified,
      performer.is_online || false,
      performer.last_online,
      performer.follower_count,
      performer.media_count,
      performer.subscription_price,
      performer.raw_data
    ]);
  }

  /**
   * Helper: Delay execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Helper: Make HTTP request with retry
   */
  async fetch(url, options = {}) {
    const { headers = {}, method = 'GET', body = null } = options;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers: {
            'User-Agent': 'BoyVue-Spider/1.0',
            ...headers
          },
          body,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (err) {
        console.warn(`[${this.platformSlug}] Fetch attempt ${attempt} failed:`, err.message);

        if (attempt === this.maxRetries) {
          throw err;
        }

        // Exponential backoff
        await this.delay(1000 * attempt);
      }
    }
  }

  // ============================================
  // Abstract methods - must be implemented by subclasses
  // ============================================

  /**
   * Fetch performers from the platform API
   * @returns {Promise<Array>} Raw performer data from platform
   */
  async fetchPerformers(options) {
    throw new Error('fetchPerformers() must be implemented by subclass');
  }

  /**
   * Normalize raw performer data to standard format
   * @param {Object} raw - Raw performer data from platform
   * @returns {Object} Normalized performer object
   */
  normalizePerformer(raw) {
    throw new Error('normalizePerformer() must be implemented by subclass');
  }

  /**
   * Build affiliate URL for a performer
   * @param {Object} performer - Normalized performer object
   * @returns {string} Affiliate tracking URL
   */
  buildAffiliateUrl(performer) {
    throw new Error('buildAffiliateUrl() must be implemented by subclass');
  }

  // ============================================
  // Optional hooks - can be overridden
  // ============================================

  /**
   * Called before spider run starts
   */
  async beforeRun() {
    // Override in subclass if needed
  }

  /**
   * Called after spider run completes
   */
  async afterRun() {
    // Override in subclass if needed
  }

  /**
   * Fetch content for a specific performer (optional)
   */
  async fetchPerformerContent(performer) {
    // Override in subclass if platform provides content
    return [];
  }
}

export default BaseSpider;
