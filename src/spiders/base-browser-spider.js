/**
 * Base Browser Spider
 *
 * Abstract base class for Playwright-based web scraping.
 * Used for platforms without public APIs (OnlyFans, Fansly, etc.)
 *
 * Features:
 * - Persistent browser sessions with cookie storage
 * - Anti-detection measures
 * - Rate limiting and retry logic
 * - Screenshot capture for debugging
 * - Session management via Bitwarden
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIES_DIR = path.join(__dirname, '../../data/browser-sessions');
const SCREENSHOTS_DIR = path.join(__dirname, '../../data/screenshots');

class BaseBrowserSpider {
  constructor(pool, platformSlug, options = {}) {
    this.pool = pool;
    this.platformSlug = platformSlug;
    this.platformId = null;
    this.accountId = null;
    this.jobId = null;

    // Browser options
    this.headless = options.headless !== false;
    this.slowMo = options.slowMo || 50; // Slow down actions to appear more human
    this.timeout = options.timeout || 30000;

    // Rate limiting
    this.rateLimitMs = options.rateLimitMs || 2000;
    this.maxRetries = options.maxRetries || 3;

    // Browser instance
    this.browser = null;
    this.context = null;
    this.page = null;

    // Ensure directories exist
    if (!fs.existsSync(COOKIES_DIR)) {
      fs.mkdirSync(COOKIES_DIR, { recursive: true });
    }
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
  }

  /**
   * Initialize platform and account from database
   */
  async initialize() {
    // Get platform
    const platformResult = await this.pool.query(
      'SELECT id, name, base_url FROM affiliate_platforms WHERE slug = $1',
      [this.platformSlug]
    );

    if (platformResult.rows.length === 0) {
      throw new Error(`Platform not found: ${this.platformSlug}`);
    }

    this.platformId = platformResult.rows[0].id;
    this.platformName = platformResult.rows[0].name;
    this.baseUrl = platformResult.rows[0].base_url;

    // Get account credentials
    const accountResult = await this.pool.query(
      `SELECT id, account_name, affiliate_id, api_key, api_secret, bitwarden_item_id
       FROM affiliate_accounts
       WHERE platform_id = $1 AND account_status = 'active'
       LIMIT 1`,
      [this.platformId]
    );

    if (accountResult.rows.length === 0) {
      console.log(`[${this.platformSlug}] No active account found - will run without login`);
      this.accountId = null;
    } else {
      this.accountId = accountResult.rows[0].id;
      this.accountName = accountResult.rows[0].account_name;
      this.credentials = {
        affiliateId: accountResult.rows[0].affiliate_id,
        apiKey: accountResult.rows[0].api_key,
        apiSecret: accountResult.rows[0].api_secret,
        bitwardenItemId: accountResult.rows[0].bitwarden_item_id
      };
    }

    console.log(`[${this.platformSlug}] Browser spider initialized`);
    console.log(`  Platform: ${this.platformName}`);
    console.log(`  Account: ${this.accountName || 'None'}`);
  }

  /**
   * Launch browser with anti-detection settings
   */
  async launchBrowser() {
    console.log(`[${this.platformSlug}] Launching browser...`);

    this.browser = await chromium.launch({
      headless: this.headless,
      slowMo: this.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    // Create context with realistic viewport and user agent
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      geolocation: { latitude: 40.7128, longitude: -74.0060 },
      permissions: ['geolocation']
    });

    // Load saved cookies if available
    await this.loadCookies();

    // Create new page
    this.page = await this.context.newPage();

    // Set default timeout
    this.page.setDefaultTimeout(this.timeout);

    // Add anti-detection scripts
    await this.page.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });

      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Override chrome
      window.chrome = {
        runtime: {}
      };
    });

    console.log(`[${this.platformSlug}] Browser launched`);
  }

  /**
   * Load cookies from file
   */
  async loadCookies() {
    const cookiePath = path.join(COOKIES_DIR, `${this.platformSlug}-cookies.json`);

    if (fs.existsSync(cookiePath)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));
        await this.context.addCookies(cookies);
        console.log(`[${this.platformSlug}] Loaded ${cookies.length} cookies from session`);
      } catch (err) {
        console.log(`[${this.platformSlug}] Failed to load cookies:`, err.message);
      }
    }
  }

  /**
   * Save cookies to file
   */
  async saveCookies() {
    const cookiePath = path.join(COOKIES_DIR, `${this.platformSlug}-cookies.json`);

    try {
      const cookies = await this.context.cookies();
      fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));
      console.log(`[${this.platformSlug}] Saved ${cookies.length} cookies`);
    } catch (err) {
      console.log(`[${this.platformSlug}] Failed to save cookies:`, err.message);
    }
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(name) {
    const filename = `${this.platformSlug}-${name}-${Date.now()}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    console.log(`[${this.platformSlug}] Screenshot saved: ${filename}`);
    return filepath;
  }

  /**
   * Wait with random delay to appear more human
   */
  async humanDelay(min = 500, max = 2000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await this.page.waitForTimeout(delay);
  }

  /**
   * Scroll page to load lazy content
   */
  async scrollPage(scrolls = 3) {
    for (let i = 0; i < scrolls; i++) {
      await this.page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await this.humanDelay(1000, 2000);
    }

    // Scroll back to top
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
    });
  }

  /**
   * Navigate to URL with retry logic
   */
  async goto(url, options = {}) {
    const maxRetries = options.retries || this.maxRetries;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[${this.platformSlug}] Navigating to: ${url}`);
        await this.page.goto(url, {
          waitUntil: options.waitUntil || 'networkidle',
          timeout: this.timeout
        });
        return true;
      } catch (err) {
        console.log(`[${this.platformSlug}] Navigation attempt ${attempt} failed:`, err.message);

        if (attempt === maxRetries) {
          throw err;
        }

        await this.humanDelay(2000, 5000);
      }
    }
  }

  /**
   * Check if logged in (to be overridden by subclasses)
   */
  async isLoggedIn() {
    throw new Error('isLoggedIn() must be implemented by subclass');
  }

  /**
   * Perform login (to be overridden by subclasses)
   */
  async login(username, password) {
    throw new Error('login() must be implemented by subclass');
  }

  /**
   * Fetch performers (to be overridden by subclasses)
   */
  async fetchPerformers(options) {
    throw new Error('fetchPerformers() must be implemented by subclass');
  }

  /**
   * Normalize performer data (to be overridden by subclasses)
   */
  normalizePerformer(raw) {
    throw new Error('normalizePerformer() must be implemented by subclass');
  }

  /**
   * Build affiliate URL (to be overridden by subclasses)
   */
  buildAffiliateUrl(performer) {
    throw new Error('buildAffiliateUrl() must be implemented by subclass');
  }

  /**
   * Create spider job record
   */
  async createJob(jobType = 'browser_crawl') {
    const result = await this.pool.query(
      `INSERT INTO spider_jobs (platform_id, job_type, status, started_at, triggered_by)
       VALUES ($1, $2, 'running', NOW(), $3)
       RETURNING id`,
      [this.platformId, jobType, this.accountName || 'browser-spider']
    );
    this.jobId = result.rows[0].id;
    console.log(`[${this.platformSlug}] Job created: ${this.jobId}`);
    return this.jobId;
  }

  /**
   * Complete spider job
   */
  async completeJob(processed, added, errors) {
    await this.pool.query(
      `UPDATE spider_jobs
       SET status = 'completed',
           completed_at = NOW(),
           items_processed = $2,
           items_added = $3,
           errors_count = $4
       WHERE id = $1`,
      [this.jobId, processed, added, errors]
    );
    console.log(`[${this.platformSlug}] Job ${this.jobId} completed`);
  }

  /**
   * Fail spider job
   */
  async failJob(errorMessage) {
    await this.pool.query(
      `UPDATE spider_jobs
       SET status = 'failed',
           completed_at = NOW(),
           error_log = $2
       WHERE id = $1`,
      [this.jobId, errorMessage]
    );
    console.log(`[${this.platformSlug}] Job ${this.jobId} failed: ${errorMessage}`);
  }

  /**
   * Save performer to database
   */
  async savePerformer(performer) {
    const result = await this.pool.query(`
      INSERT INTO performers (
        platform_id, external_id, username, display_name, profile_url,
        avatar_url, cover_photo_url, bio, categories, gender,
        body_type, ethnicity, age, location, is_verified,
        follower_count, subscriber_count, media_count, video_count,
        photo_count, subscription_price, free_trial_days, languages,
        social_links, raw_data, last_spidered
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, NOW()
      )
      ON CONFLICT (platform_id, external_id) DO UPDATE SET
        username = EXCLUDED.username,
        display_name = EXCLUDED.display_name,
        avatar_url = COALESCE(EXCLUDED.avatar_url, performers.avatar_url),
        bio = COALESCE(EXCLUDED.bio, performers.bio),
        categories = COALESCE(EXCLUDED.categories, performers.categories),
        follower_count = COALESCE(EXCLUDED.follower_count, performers.follower_count),
        subscriber_count = COALESCE(EXCLUDED.subscriber_count, performers.subscriber_count),
        media_count = COALESCE(EXCLUDED.media_count, performers.media_count),
        subscription_price = COALESCE(EXCLUDED.subscription_price, performers.subscription_price),
        last_spidered = NOW(),
        updated_at = NOW()
      RETURNING id, (xmax = 0) as is_new
    `, [
      this.platformId,
      performer.external_id,
      performer.username,
      performer.display_name,
      performer.profile_url,
      performer.avatar_url,
      performer.cover_photo_url,
      performer.bio,
      performer.categories,
      performer.gender || 'male',
      performer.body_type,
      performer.ethnicity,
      performer.age,
      performer.location,
      performer.is_verified || false,
      performer.follower_count,
      performer.subscriber_count,
      performer.media_count,
      performer.video_count,
      performer.photo_count,
      performer.subscription_price,
      performer.free_trial_days,
      performer.languages,
      JSON.stringify(performer.social_links),
      JSON.stringify(performer.raw_data)
    ]);

    return {
      id: result.rows[0].id,
      action: result.rows[0].is_new ? 'inserted' : 'updated'
    };
  }

  /**
   * Close browser and cleanup
   */
  async close() {
    if (this.browser) {
      await this.saveCookies();
      await this.browser.close();
      console.log(`[${this.platformSlug}] Browser closed`);
    }
  }

  /**
   * Main run method
   */
  async run(options = {}) {
    console.log(`\n=== Starting ${this.platformSlug} Browser Spider ===`);

    try {
      await this.initialize();
      await this.launchBrowser();
      await this.createJob('browser_crawl');

      // Check if we need to login
      if (options.username && options.password) {
        const loggedIn = await this.isLoggedIn();
        if (!loggedIn) {
          console.log(`[${this.platformSlug}] Logging in...`);
          await this.login(options.username, options.password);
          await this.saveCookies();
        }
      }

      // Fetch performers
      const performers = await this.fetchPerformers(options);

      let added = 0, updated = 0, errors = 0;

      for (const raw of performers) {
        try {
          const normalized = this.normalizePerformer(raw);

          if (!normalized.external_id || !normalized.username) {
            errors++;
            continue;
          }

          const result = await this.savePerformer(normalized);

          if (result.action === 'inserted') {
            added++;
            console.log(`  + Added: ${normalized.username}`);
          } else {
            updated++;
          }
        } catch (err) {
          console.error(`  ! Error:`, err.message);
          errors++;
        }
      }

      await this.completeJob(performers.length, added, errors);

      console.log(`\n=== ${this.platformSlug} Spider Complete ===`);
      console.log(`Processed: ${performers.length}`);
      console.log(`Added: ${added}`);
      console.log(`Updated: ${updated}`);
      console.log(`Errors: ${errors}`);

      return { processed: performers.length, added, updated, errors };

    } catch (err) {
      console.error(`[${this.platformSlug}] Spider error:`, err);
      if (this.jobId) {
        await this.failJob(err.message);
      }
      throw err;
    } finally {
      await this.close();
    }
  }
}

export default BaseBrowserSpider;
