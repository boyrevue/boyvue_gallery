/**
 * Fansly Browser Spider
 *
 * Scrapes performer data from Fansly using Playwright.
 * Similar to OnlyFans but with different page structure.
 *
 * Features:
 * - Browse explore/discovery pages
 * - Extract performer profiles
 * - Category and tag filtering
 * - Support for trending/new creators
 */

import BaseBrowserSpider from './base-browser-spider.js';

class FanslySpider extends BaseBrowserSpider {
  constructor(pool, options = {}) {
    super(pool, 'fansly', options);

    this.baseUrl = 'https://fansly.com';
    this.category = options.category || 'male';
    this.limit = options.limit || 50;
  }

  /**
   * Check if currently logged in
   */
  async isLoggedIn() {
    try {
      await this.goto(`${this.baseUrl}/settings`);
      await this.page.waitForTimeout(2000);

      const url = this.page.url();
      if (url.includes('/login') || url.includes('/signup')) {
        return false;
      }

      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Login to Fansly
   */
  async login(username, password) {
    console.log(`[fansly] Attempting login...`);

    await this.goto(`${this.baseUrl}/login`);
    await this.humanDelay();

    // Wait for login form
    await this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    // Fill email
    await this.page.fill('input[type="email"], input[name="email"]', username);
    await this.humanDelay(500, 1000);

    // Fill password
    await this.page.fill('input[type="password"], input[name="password"]', password);
    await this.humanDelay(500, 1000);

    // Click submit
    await this.page.click('button[type="submit"], button:has-text("Log in"), button:has-text("Login")');

    // Wait for navigation
    await this.page.waitForNavigation({ timeout: 30000 }).catch(() => {});
    await this.humanDelay(2000, 3000);

    // Check for 2FA
    const twoFactorInput = await this.page.$('input[name="code"], input[placeholder*="code"], input[placeholder*="2FA"]');
    if (twoFactorInput) {
      console.log(`[fansly] 2FA required - please enter code manually`);
      await this.screenshot('2fa-required');
      throw new Error('2FA required - manual intervention needed');
    }

    // Verify login
    const isLoggedIn = await this.isLoggedIn();
    if (!isLoggedIn) {
      await this.screenshot('login-failed');
      throw new Error('Login failed - check credentials');
    }

    console.log(`[fansly] Login successful`);
  }

  /**
   * Fetch performers from explore/discovery pages
   */
  async fetchPerformers(options = {}) {
    const performers = [];
    const category = options.category || this.category;
    const limit = options.limit || this.limit;

    console.log(`[fansly] Fetching ${category} performers (limit: ${limit})...`);

    // Set age verification cookie before navigation to bypass modal
    await this.context.addCookies([
      {
        name: 'fansly_age_verified',
        value: 'true',
        domain: '.fansly.com',
        path: '/'
      },
      {
        name: 'age_verified',
        value: '1',
        domain: '.fansly.com',
        path: '/'
      }
    ]);

    // Navigate to explore page
    const exploreUrl = `${this.baseUrl}/explore`;
    await this.goto(exploreUrl);
    await this.humanDelay(3000, 4000);

    // If age modal appears, use Playwright's built-in click
    try {
      // Wait for the green Enter button specifically
      const enterButton = this.page.locator('button').filter({ hasText: /^Enter$/ });
      const count = await enterButton.count();
      console.log(`[fansly] Found ${count} Enter buttons`);

      if (count > 0) {
        await enterButton.first().click({ timeout: 5000 });
        console.log(`[fansly] Clicked Enter button`);
        await this.humanDelay(2000, 3000);
      }
    } catch (err) {
      console.log(`[fansly] No Enter button found or click failed: ${err.message}`);
    }

    // Take screenshot to see current state
    await this.screenshot('after-modal-handling');
    await this.humanDelay(2000, 3000);

    // Try to apply category filter if available
    try {
      const filterBtn = await this.page.$('button:has-text("Filter"), [class*="filter"]');
      if (filterBtn) {
        await filterBtn.click();
        await this.humanDelay(500, 1000);

        // Look for male/gay category
        const categoryOption = await this.page.$(`button:has-text("${category}"), label:has-text("${category}")`);
        if (categoryOption) {
          await categoryOption.click();
          await this.humanDelay(1000, 2000);
        }
      }
    } catch (err) {
      console.log(`[fansly] Could not apply filter, continuing without`);
    }

    // Scroll and extract
    let previousCount = 0;
    let scrollAttempts = 0;
    const maxScrolls = Math.ceil(limit / 15);

    while (performers.length < limit && scrollAttempts < maxScrolls) {
      // Extract performers - look for the visible streamer cards in "Streams You Might Like"
      const pagePerformers = await this.page.evaluate(() => {
        const results = [];
        const debug = { totalText: '', foundUsernames: [] };

        // Get all text content for debugging
        debug.totalText = document.body?.innerText?.substring(0, 500) || '';

        // Method 1: Find all @username patterns in the entire page
        const allText = document.body?.innerText || '';
        const usernameMatches = allText.match(/@([a-zA-Z0-9_]+)/g) || [];
        debug.foundUsernames = usernameMatches.slice(0, 20);

        // For each found username, try to find more details
        for (const match of usernameMatches) {
          const username = match.replace('@', '');
          if (results.find(r => r.username === username)) continue;

          // Look for the smallest element containing just this username
          const xpath = `//*[contains(text(), '@${username}')]`;
          const xpathResult = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

          for (let i = 0; i < xpathResult.snapshotLength; i++) {
            const el = xpathResult.snapshotItem(i);
            const elText = el.textContent?.trim() || '';

            // Skip if element has too much text (not the direct username element)
            if (elText.length > 100) continue;

            // Get the direct parent element for card info
            const card = el.parentElement?.parentElement || el.parentElement;
            if (!card) continue;

            // Find avatar - look for img in the same card
            let avatarUrl = null;
            const imgs = card.querySelectorAll('img');
            for (const img of imgs) {
              if (img.src && img.src.includes('cdn') && !img.src.includes('emoji')) {
                avatarUrl = img.src;
                break;
              }
            }

            // Extract display name - look for sibling text that's NOT the @username
            let displayName = username;
            const siblings = el.parentElement?.children || [];
            for (const sib of siblings) {
              const sibText = sib.textContent?.trim();
              if (sibText && !sibText.startsWith('@') && sibText.length < 50 && sibText.length > 2) {
                displayName = sibText;
                break;
              }
            }

            // Look for viewer count in the card
            const cardText = card.textContent || '';
            const viewerMatch = cardText.match(/(\d+)\s*$/m);
            const viewerCount = viewerMatch ? parseInt(viewerMatch[1]) : null;

            // Check if streaming (has Watch button)
            const hasWatch = cardText.toLowerCase().includes('watch');

            results.push({
              username,
              display_name: displayName,
              avatar_url: avatarUrl,
              viewer_count: viewerCount,
              is_online: hasWatch
            });
            break;
          }
        }

        // Method 2: Look for specific streamer card patterns
        // The cards have structure like: avatar + name + @username + viewer count + Watch button
        const watchButtons = document.querySelectorAll('button, [role="button"]');
        for (const btn of watchButtons) {
          const text = btn.textContent?.trim().toLowerCase();
          if (text === 'watch') {
            // Found a Watch button - find the parent card
            const card = btn.closest('div, section, article');
            if (card) {
              const cardText = card.textContent || '';
              const usernameMatch = cardText.match(/@([a-zA-Z0-9_]+)/);
              if (usernameMatch && !results.find(r => r.username === usernameMatch[1])) {
                const username = usernameMatch[1];
                const img = card.querySelector('img');
                const viewerMatch = cardText.match(/(\d+)/);

                results.push({
                  username,
                  display_name: cardText.split('@')[0]?.trim()?.split('\n').pop() || username,
                  avatar_url: img?.src,
                  viewer_count: viewerMatch ? parseInt(viewerMatch[1]) : null,
                  is_online: true
                });
              }
            }
          }
        }

        return { results, debug };
      });

      console.log(`[fansly] Debug - found usernames: ${JSON.stringify(pagePerformers.debug.foundUsernames)}`);
      console.log(`[fansly] Found ${pagePerformers.results.length} performers on page`);
      const extractedPerformers = pagePerformers.results;

      // Add unique performers
      for (const p of extractedPerformers) {
        if (p.username && !performers.find(e => e.username === p.username)) {
          performers.push({
            external_id: p.username,
            username: p.username,
            display_name: p.display_name,
            profile_url: `${this.baseUrl}/@${p.username}`,
            avatar_url: p.avatar_url,
            is_online: p.is_online
          });
        }
        if (performers.length >= limit) break;
      }

      // Legacy card extraction as fallback
      const cards = await this.page.$$('[class*="creator-card"], [class*="profile-card"], a[href*="/@"]');

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

    console.log(`[fansly] Extracted ${performers.length} performers`);

    // Only screenshot if we have results for debugging
    if (performers.length === 0) {
      try {
        await this.screenshot('explore-page');
      } catch (e) {
        console.log(`[fansly] Screenshot failed, continuing...`);
      }
    }

    // Fetch full profiles if requested
    if (options.fetchProfiles) {
      console.log(`[fansly] Fetching full profiles...`);
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
   * Extract performer data from a card element
   */
  async extractPerformerFromCard(card) {
    const data = await card.evaluate((el) => {
      // Find username from link or text - check multiple patterns
      let username = null;

      // Check if this element itself is a link
      if (el.tagName === 'A' && el.href) {
        const match = el.href.match(/\/@([^\/\?]+)/);
        if (match) username = match[1];
      }

      // Check child links
      if (!username) {
        const linkEl = el.querySelector('a[href*="/@"]');
        if (linkEl) {
          const match = linkEl.href.match(/\/@([^\/\?]+)/);
          if (match) username = match[1];
        }
      }

      // Fallback to any link starting with /
      if (!username) {
        const linkEl = el.querySelector('a[href^="/"]');
        if (linkEl) {
          const href = linkEl.getAttribute('href');
          if (href && href.startsWith('/')) {
            username = href.replace(/^\/[@]?/, '').split('/')[0].split('?')[0];
          }
        }
      }

      // Look for @username text
      if (!username) {
        const allText = el.textContent || '';
        const atMatch = allText.match(/@([a-zA-Z0-9_]+)/);
        if (atMatch) username = atMatch[1];
      }

      // Display name - look for name near avatar or in prominent position
      const nameEl = el.querySelector('[class*="name"], [class*="display"], h3, h4, span');
      let displayName = nameEl?.textContent?.trim();
      // Clean up display name (remove @ prefix if present)
      if (displayName) {
        displayName = displayName.replace(/^@/, '').split('\n')[0].trim();
      }

      // Avatar
      const avatarEl = el.querySelector('img[class*="avatar"], img[class*="profile"], img[src*="avatar"]');
      const avatarUrl = avatarEl?.src;

      // Price
      const priceEl = el.querySelector('[class*="price"], [class*="subscription"]');
      const priceText = priceEl?.textContent || '';
      const priceMatch = priceText.match(/\$?([\d.]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : null;

      // Viewer/follower count - look for numbers
      let viewerCount = null;
      const statsEls = el.querySelectorAll('[class*="viewer"], [class*="count"], [class*="stat"]');
      for (const statEl of statsEls) {
        const numMatch = statEl.textContent?.match(/(\d+)/);
        if (numMatch) {
          viewerCount = parseInt(numMatch[1]);
          break;
        }
      }

      // Online/live indicator
      const isOnline = !!el.querySelector('[class*="online"], [class*="live"], [class*="streaming"]') ||
                       el.textContent?.toLowerCase().includes('watch');

      return {
        username,
        display_name: displayName || username,
        avatar_url: avatarUrl,
        subscription_price: price,
        follower_count: viewerCount,
        is_online: isOnline
      };
    });

    if (!data.username) return null;

    return {
      external_id: data.username,
      username: data.username,
      display_name: data.display_name,
      profile_url: `${this.baseUrl}/${data.username}`,
      avatar_url: data.avatar_url,
      subscription_price: data.subscription_price,
      follower_count: data.follower_count,
      is_online: data.is_online
    };
  }

  /**
   * Fetch full performer profile
   */
  async fetchPerformerProfile(username) {
    console.log(`  Fetching profile: ${username}`);

    await this.goto(`${this.baseUrl}/${username}`);
    await this.humanDelay(1500, 2500);

    const profile = await this.page.evaluate(() => {
      const data = {};

      // Display name
      const nameEl = document.querySelector('[class*="display-name"], h1, [class*="profile-name"]');
      data.display_name = nameEl?.textContent?.trim();

      // Bio/About
      const bioEl = document.querySelector('[class*="bio"], [class*="about"], [class*="description"]');
      data.bio = bioEl?.textContent?.trim();

      // Avatar
      const avatarEl = document.querySelector('[class*="avatar"] img, [class*="profile-image"] img');
      data.avatar_url = avatarEl?.src;

      // Banner/Cover
      const coverEl = document.querySelector('[class*="banner"] img, [class*="cover"] img, [class*="header"] img');
      data.cover_photo_url = coverEl?.src;

      // Stats
      const statElements = document.querySelectorAll('[class*="stat"], [class*="count"]');
      statElements.forEach(el => {
        const text = el.textContent?.toLowerCase() || '';
        const numMatch = text.match(/([\d,]+)/);
        const num = numMatch ? parseInt(numMatch[1].replace(/,/g, '')) : null;

        if (text.includes('follower') || text.includes('fan')) {
          data.follower_count = num;
        } else if (text.includes('subscriber')) {
          data.subscriber_count = num;
        } else if (text.includes('post') || text.includes('media')) {
          data.media_count = num;
        } else if (text.includes('photo') || text.includes('image')) {
          data.photo_count = num;
        } else if (text.includes('video')) {
          data.video_count = num;
        } else if (text.includes('like')) {
          data.likes = num;
        }
      });

      // Price
      const priceEl = document.querySelector('[class*="subscription-price"], [class*="price"]');
      if (priceEl) {
        const priceMatch = priceEl.textContent?.match(/\$?([\d.]+)/);
        data.subscription_price = priceMatch ? parseFloat(priceMatch[1]) : null;
      }

      // Free trial
      const trialEl = document.querySelector('[class*="free-trial"], [class*="trial"]');
      if (trialEl) {
        const trialMatch = trialEl.textContent?.match(/(\d+)/);
        data.free_trial_days = trialMatch ? parseInt(trialMatch[1]) : null;
      }

      // Verified badge
      data.is_verified = !!document.querySelector('[class*="verified"], [class*="badge"]');

      // Location
      const locationEl = document.querySelector('[class*="location"]');
      data.location = locationEl?.textContent?.trim();

      // Social links
      data.social_links = {};
      const socialEls = document.querySelectorAll('a[href*="twitter"], a[href*="instagram"], a[href*="tiktok"]');
      socialEls.forEach(link => {
        const href = link.href;
        if (href.includes('twitter')) data.social_links.twitter = href;
        if (href.includes('instagram')) data.social_links.instagram = href;
        if (href.includes('tiktok')) data.social_links.tiktok = href;
      });

      // Tags/Categories
      const tagEls = document.querySelectorAll('[class*="tag"], [class*="category"]');
      data.categories = Array.from(tagEls).map(t => t.textContent?.trim()).filter(Boolean);

      return data;
    });

    return profile;
  }

  /**
   * Search for performers
   */
  async searchPerformers(query, options = {}) {
    const limit = options.limit || this.limit;
    const performers = [];

    console.log(`[fansly] Searching for: ${query}`);

    await this.goto(`${this.baseUrl}/search?q=${encodeURIComponent(query)}`);
    await this.humanDelay(2000, 3000);

    const cards = await this.page.$$('[class*="creator-card"], [class*="search-result"], [class*="user-card"]');

    for (const card of cards) {
      if (performers.length >= limit) break;

      try {
        const data = await this.extractPerformerFromCard(card);
        if (data) {
          performers.push(data);
        }
      } catch (err) {
        // Skip
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
      is_online: raw.is_online || false,
      follower_count: raw.follower_count || raw.likes,
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
    const affiliateId = this.credentials?.affiliateId;

    if (affiliateId) {
      return `${this.baseUrl}/${performer.username}?ref=${affiliateId}`;
    }

    return performer.profile_url || `${this.baseUrl}/${performer.username}`;
  }
}

export default FanslySpider;
