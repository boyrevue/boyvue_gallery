/**
 * OnlyFans Browser Spider
 *
 * Scrapes performer data from OnlyFans using Playwright.
 * OnlyFans doesn't have a public API, so we use browser automation.
 *
 * Features:
 * - Browse discovery/search pages
 * - Extract performer profiles
 * - Scrape media counts, prices, bios
 * - Support for category filtering
 */

import BaseBrowserSpider from './base-browser-spider.js';

class OnlyFansSpider extends BaseBrowserSpider {
  constructor(pool, options = {}) {
    super(pool, 'onlyfans', options);

    this.baseUrl = 'https://onlyfans.com';
    this.category = options.category || 'male'; // male, female, trans, couples
    this.limit = options.limit || 50;
  }

  /**
   * Check if currently logged in
   */
  async isLoggedIn() {
    try {
      await this.goto(`${this.baseUrl}/my/subscribers`);
      await this.page.waitForTimeout(2000);

      // Check for login page redirect
      const url = this.page.url();
      if (url.includes('/login') || url.includes('/auth')) {
        return false;
      }

      // Check for user menu
      const userMenu = await this.page.$('[class*="user-menu"], [class*="profile-avatar"]');
      return !!userMenu;
    } catch (err) {
      return false;
    }
  }

  /**
   * Login to OnlyFans
   */
  async login(username, password) {
    console.log(`[onlyfans] Attempting login...`);

    await this.goto(`${this.baseUrl}`);
    await this.humanDelay();

    // Click login button
    const loginBtn = await this.page.$('a[href="/login"], button:has-text("Log in")');
    if (loginBtn) {
      await loginBtn.click();
      await this.humanDelay();
    }

    // Wait for login form
    await this.page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });

    // Fill email
    await this.page.fill('input[name="email"], input[type="email"]', username);
    await this.humanDelay(500, 1000);

    // Fill password
    await this.page.fill('input[name="password"], input[type="password"]', password);
    await this.humanDelay(500, 1000);

    // Click submit
    const submitBtn = await this.page.$('button[type="submit"], button:has-text("Log in")');
    if (submitBtn) {
      await submitBtn.click();
    }

    // Wait for navigation
    await this.page.waitForNavigation({ timeout: 30000 }).catch(() => {});
    await this.humanDelay(2000, 3000);

    // Handle potential 2FA or verification
    const twoFactorInput = await this.page.$('input[name="code"], input[placeholder*="code"]');
    if (twoFactorInput) {
      console.log(`[onlyfans] 2FA required - please enter code manually`);
      await this.screenshot('2fa-required');
      throw new Error('2FA required - manual intervention needed');
    }

    // Verify login
    const isLoggedIn = await this.isLoggedIn();
    if (!isLoggedIn) {
      await this.screenshot('login-failed');
      throw new Error('Login failed - check credentials');
    }

    console.log(`[onlyfans] Login successful`);
  }

  /**
   * Fetch performers from discovery pages
   */
  async fetchPerformers(options = {}) {
    const performers = [];
    const category = options.category || this.category;
    const limit = options.limit || this.limit;

    console.log(`[onlyfans] Fetching ${category} performers (limit: ${limit})...`);

    // Navigate to discovery page (requires login) or try homepage
    let discoveryUrl = `${this.baseUrl}`;

    // Check if we're logged in - if so, use discover page
    const isLoggedIn = await this.isLoggedIn().catch(() => false);
    if (isLoggedIn) {
      discoveryUrl = `${this.baseUrl}/discover/${category}`;
    } else {
      console.log(`[onlyfans] Not logged in - OnlyFans requires authentication to browse`);
      console.log(`[onlyfans] Set SPIDER_USERNAME and SPIDER_PASSWORD to enable scraping`);
    }

    await this.goto(discoveryUrl);
    await this.humanDelay(2000, 3000);

    // Scroll to load more content
    let previousCount = 0;
    let scrollAttempts = 0;
    const maxScrolls = Math.ceil(limit / 20); // Approximate cards per scroll

    while (performers.length < limit && scrollAttempts < maxScrolls) {
      // Extract performer cards
      const cards = await this.page.$$('[class*="user-card"], [class*="creator-card"], [class*="profile-card"]');

      for (const card of cards) {
        if (performers.length >= limit) break;

        try {
          const data = await this.extractPerformerFromCard(card);
          if (data && !performers.find(p => p.username === data.username)) {
            performers.push(data);
          }
        } catch (err) {
          // Skip failed cards
        }
      }

      // Check if we got new performers
      if (performers.length === previousCount) {
        scrollAttempts++;
      } else {
        previousCount = performers.length;
        scrollAttempts = 0;
      }

      // Scroll down
      await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await this.humanDelay(1500, 2500);
    }

    console.log(`[onlyfans] Extracted ${performers.length} performers from discovery`);

    // Take debug screenshot
    await this.screenshot('discovery-page');

    // Optionally fetch full profiles
    if (options.fetchProfiles) {
      console.log(`[onlyfans] Fetching full profiles...`);
      for (let i = 0; i < performers.length; i++) {
        try {
          const fullProfile = await this.fetchPerformerProfile(performers[i].username);
          performers[i] = { ...performers[i], ...fullProfile };
          await this.humanDelay(this.rateLimitMs, this.rateLimitMs * 2);
        } catch (err) {
          console.log(`  ! Failed to fetch profile for ${performers[i].username}`);
        }
      }
    }

    return performers;
  }

  /**
   * Extract performer data from a discovery card
   */
  async extractPerformerFromCard(card) {
    const data = await card.evaluate((el) => {
      // Try various selector patterns OnlyFans might use
      const usernameEl = el.querySelector('[class*="username"], [class*="screen-name"], a[href^="/"]');
      const displayNameEl = el.querySelector('[class*="display-name"], [class*="name"], h3, h4');
      const avatarEl = el.querySelector('img[class*="avatar"], img[class*="profile"]');
      const priceEl = el.querySelector('[class*="price"], [class*="subscription"]');
      const statsEl = el.querySelector('[class*="stats"], [class*="count"]');

      let username = null;
      if (usernameEl) {
        const href = usernameEl.getAttribute('href');
        if (href && href.startsWith('/')) {
          username = href.replace('/', '').split('/')[0];
        } else {
          username = usernameEl.textContent?.replace('@', '').trim();
        }
      }

      return {
        username: username,
        display_name: displayNameEl?.textContent?.trim() || username,
        avatar_url: avatarEl?.src || null,
        subscription_price: priceEl?.textContent?.match(/[\d.]+/)?.[0] || null,
        stats_text: statsEl?.textContent || null
      };
    });

    if (!data.username) return null;

    return {
      external_id: data.username,
      username: data.username,
      display_name: data.display_name,
      profile_url: `${this.baseUrl}/${data.username}`,
      avatar_url: data.avatar_url,
      subscription_price: data.subscription_price ? parseFloat(data.subscription_price) : null,
      raw_stats: data.stats_text
    };
  }

  /**
   * Fetch full performer profile
   */
  async fetchPerformerProfile(username) {
    console.log(`  Fetching profile: ${username}`);

    const profileUrl = `${this.baseUrl}/${username}`;
    await this.goto(profileUrl);
    await this.humanDelay(1500, 2500);

    const profile = await this.page.evaluate(() => {
      const data = {};

      // Display name
      const nameEl = document.querySelector('[class*="profile-name"], h1, [class*="display-name"]');
      data.display_name = nameEl?.textContent?.trim();

      // Bio
      const bioEl = document.querySelector('[class*="bio"], [class*="about"], [class*="description"]');
      data.bio = bioEl?.textContent?.trim();

      // Avatar
      const avatarEl = document.querySelector('[class*="avatar"] img, [class*="profile-pic"] img');
      data.avatar_url = avatarEl?.src;

      // Cover photo
      const coverEl = document.querySelector('[class*="cover"] img, [class*="header"] img');
      data.cover_photo_url = coverEl?.src;

      // Stats (followers, likes, media count)
      const statsEls = document.querySelectorAll('[class*="stat"], [class*="count"]');
      statsEls.forEach(el => {
        const text = el.textContent?.toLowerCase() || '';
        const num = text.match(/[\d,]+/)?.[0]?.replace(/,/g, '');

        if (text.includes('like') || text.includes('heart')) {
          data.likes = parseInt(num) || null;
        } else if (text.includes('photo') || text.includes('image')) {
          data.photo_count = parseInt(num) || null;
        } else if (text.includes('video')) {
          data.video_count = parseInt(num) || null;
        } else if (text.includes('post') || text.includes('media')) {
          data.media_count = parseInt(num) || null;
        } else if (text.includes('fan') || text.includes('subscriber')) {
          data.subscriber_count = parseInt(num) || null;
        }
      });

      // Price
      const priceEl = document.querySelector('[class*="price"], [class*="subscription-price"]');
      const priceText = priceEl?.textContent || '';
      const priceMatch = priceText.match(/\$?([\d.]+)/);
      data.subscription_price = priceMatch ? parseFloat(priceMatch[1]) : null;

      // Free trial
      const freeTrialEl = document.querySelector('[class*="free-trial"], [class*="trial"]');
      if (freeTrialEl) {
        const trialMatch = freeTrialEl.textContent?.match(/(\d+)/);
        data.free_trial_days = trialMatch ? parseInt(trialMatch[1]) : null;
      }

      // Location
      const locationEl = document.querySelector('[class*="location"], [class*="place"]');
      data.location = locationEl?.textContent?.trim();

      // Verified
      data.is_verified = !!document.querySelector('[class*="verified"], [class*="badge"]');

      // Social links
      data.social_links = {};
      const socialLinks = document.querySelectorAll('a[href*="twitter"], a[href*="instagram"], a[href*="tiktok"]');
      socialLinks.forEach(link => {
        const href = link.href;
        if (href.includes('twitter')) data.social_links.twitter = href;
        if (href.includes('instagram')) data.social_links.instagram = href;
        if (href.includes('tiktok')) data.social_links.tiktok = href;
      });

      return data;
    });

    return profile;
  }

  /**
   * Search for performers by keyword
   */
  async searchPerformers(query, options = {}) {
    const limit = options.limit || this.limit;
    const performers = [];

    console.log(`[onlyfans] Searching for: ${query}`);

    await this.goto(`${this.baseUrl}/search?q=${encodeURIComponent(query)}&type=users`);
    await this.humanDelay(2000, 3000);

    // Similar extraction logic as fetchPerformers
    const cards = await this.page.$$('[class*="user-card"], [class*="search-result"]');

    for (const card of cards) {
      if (performers.length >= limit) break;

      try {
        const data = await this.extractPerformerFromCard(card);
        if (data) {
          performers.push(data);
        }
      } catch (err) {
        // Skip failed cards
      }
    }

    return performers;
  }

  /**
   * Normalize performer data
   */
  normalizePerformer(raw) {
    return {
      external_id: raw.external_id || raw.username,
      username: raw.username,
      display_name: raw.display_name || raw.username,
      profile_url: raw.profile_url || `${this.baseUrl}/${raw.username}`,
      avatar_url: raw.avatar_url,
      cover_photo_url: raw.cover_photo_url,
      bio: raw.bio,
      categories: raw.categories || [this.category],
      gender: raw.gender || this.category,
      body_type: raw.body_type,
      ethnicity: raw.ethnicity,
      age: raw.age,
      location: raw.location,
      is_verified: raw.is_verified || false,
      follower_count: raw.likes,
      subscriber_count: raw.subscriber_count,
      media_count: raw.media_count,
      video_count: raw.video_count,
      photo_count: raw.photo_count,
      subscription_price: raw.subscription_price,
      free_trial_days: raw.free_trial_days,
      languages: raw.languages,
      social_links: raw.social_links && Object.keys(raw.social_links).length > 0 ? raw.social_links : null,
      raw_data: raw
    };
  }

  /**
   * Build affiliate URL
   */
  buildAffiliateUrl(performer) {
    // OnlyFans affiliate URLs typically use a ref parameter
    const affiliateId = this.credentials?.affiliateId;

    if (affiliateId) {
      return `${this.baseUrl}/${performer.username}?ref=${affiliateId}`;
    }

    return performer.profile_url || `${this.baseUrl}/${performer.username}`;
  }
}

export default OnlyFansSpider;
