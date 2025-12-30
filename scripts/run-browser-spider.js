#!/usr/bin/env node
/**
 * Browser Spider Runner
 *
 * Run Playwright-based spiders for platforms without APIs.
 *
 * Usage:
 *   node scripts/run-browser-spider.js <platform> [options]
 *
 * Examples:
 *   node scripts/run-browser-spider.js onlyfans --limit=50
 *   node scripts/run-browser-spider.js fansly --category=male --fetch-profiles
 *   node scripts/run-browser-spider.js onlyfans --search="twink"
 *   node scripts/run-browser-spider.js onlyfans --headless=false  # Show browser
 */

import pg from 'pg';
import OnlyFansSpider from '../src/spiders/onlyfans-spider.js';
import FanslySpider from '../src/spiders/fansly-spider.js';

const { Pool } = pg;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'gallery',
  user: process.env.DB_USER || 'galleryuser',
  password: process.env.DB_PASSWORD
});

// Available browser spiders
const spiders = {
  onlyfans: OnlyFansSpider,
  fansly: FanslySpider
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    platform: null,
    category: 'male',
    limit: 50,
    search: null,
    headless: true,
    fetchProfiles: false,
    username: process.env.SPIDER_USERNAME,
    password: process.env.SPIDER_PASSWORD,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--fetch-profiles') {
      options.fetchProfiles = true;
    } else if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

      if (value === 'false') {
        options[camelKey] = false;
      } else if (value === 'true') {
        options[camelKey] = true;
      } else if (!isNaN(value)) {
        options[camelKey] = parseInt(value);
      } else {
        options[camelKey] = value || true;
      }
    } else if (!options.platform) {
      options.platform = arg.toLowerCase();
    }
  }

  return options;
}

// Show help
function showHelp() {
  console.log(`
Browser Spider Runner - Playwright-based scraping for subscription platforms

Usage: node scripts/run-browser-spider.js <platform> [options]

Platforms:
  onlyfans      OnlyFans subscription platform
  fansly        Fansly subscription platform

Options:
  --category=male       Category filter (male, female, trans, couples)
  --limit=50            Maximum performers to fetch
  --search="query"      Search for performers instead of browsing
  --fetch-profiles      Fetch full profile details (slower)
  --headless=false      Show browser window (for debugging)
  --username=EMAIL      Login username (or set SPIDER_USERNAME env)
  --password=PASS       Login password (or set SPIDER_PASSWORD env)
  --help                Show this help message

Examples:
  # Browse male performers on OnlyFans
  node scripts/run-browser-spider.js onlyfans --category=male --limit=100

  # Search OnlyFans with full profile fetch
  node scripts/run-browser-spider.js onlyfans --search="fitness" --fetch-profiles

  # Browse Fansly with visible browser
  node scripts/run-browser-spider.js fansly --headless=false --limit=20

  # Login and browse (credentials via env vars)
  SPIDER_USERNAME=email@example.com SPIDER_PASSWORD=pass123 \\
    node scripts/run-browser-spider.js onlyfans

Environment Variables:
  DB_PASSWORD           Database password
  SPIDER_USERNAME       Login email for platforms
  SPIDER_PASSWORD       Login password for platforms
`);
}

// Run spider
async function runSpider(platform, options) {
  const SpiderClass = spiders[platform];
  if (!SpiderClass) {
    console.error(`Unknown platform: ${platform}`);
    console.error(`Available platforms: ${Object.keys(spiders).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running ${platform} browser spider...`);
  console.log(`${'='.repeat(60)}\n`);

  const spider = new SpiderClass(pool, {
    headless: options.headless,
    category: options.category,
    limit: options.limit
  });

  try {
    let results;

    if (options.search) {
      // Search mode
      await spider.initialize();
      await spider.launchBrowser();

      if (options.username && options.password) {
        const loggedIn = await spider.isLoggedIn();
        if (!loggedIn) {
          await spider.login(options.username, options.password);
        }
      }

      const performers = await spider.searchPerformers(options.search, {
        limit: options.limit,
        fetchProfiles: options.fetchProfiles
      });

      // Save performers
      let added = 0, updated = 0;
      for (const raw of performers) {
        try {
          const normalized = spider.normalizePerformer(raw);
          const result = await spider.savePerformer(normalized);
          if (result.action === 'inserted') added++;
          else updated++;
        } catch (err) {
          console.error(`Error saving performer:`, err.message);
        }
      }

      results = { processed: performers.length, added, updated };
      await spider.close();
    } else {
      // Browse mode
      results = await spider.run({
        category: options.category,
        limit: options.limit,
        fetchProfiles: options.fetchProfiles,
        username: options.username,
        password: options.password
      });
    }

    console.log(`\n${platform} spider completed!`);
    return results;

  } catch (err) {
    console.error(`\n${platform} spider failed:`, err.message);
    await spider.close().catch(() => {});
    throw err;
  }
}

// Main
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.platform) {
    console.error('Error: Platform required');
    showHelp();
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('BoyVue Creatives - Browser Spider Runner');
  console.log('='.repeat(60));
  console.log(`Platform: ${options.platform}`);
  console.log(`Category: ${options.category}`);
  console.log(`Limit: ${options.limit}`);
  console.log(`Headless: ${options.headless}`);
  console.log(`Fetch Profiles: ${options.fetchProfiles}`);
  if (options.search) console.log(`Search: ${options.search}`);

  const startTime = Date.now();

  try {
    const results = await runSpider(options.platform, options);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Spider completed in ${elapsed}s`);
    console.log(`Processed: ${results.processed}`);
    console.log(`Added: ${results.added}`);
    console.log(`Updated: ${results.updated}`);
    console.log('='.repeat(60));

    process.exit(0);
  } catch (err) {
    console.error('\nSpider failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
